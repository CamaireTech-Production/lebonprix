// Stock Transfer Service
// Handles transfers between locations: Production → Warehouse → Shop
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  type WriteBatch
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError } from '@utils/core/logger';
import type { StockTransfer, StockBatch, EmployeeRef } from '../../../types/models';
import type { InventoryMethod } from '@utils/inventory/inventoryManagement';
import { 
  getAvailableStockBatches, 
  consumeStockFromBatches, 
  createStockBatch,
  createStockChange 
} from './stockService';
import { notifyTransferCreated } from '../../../utils/notifications/notificationHelpers';

// ============================================================================
// STOCK TRANSFER OPERATIONS
// ============================================================================

/**
 * Transfer stock between locations
 * Supports: Production → Warehouse, Warehouse → Shop, Warehouse ↔ Warehouse, Shop ↔ Shop
 */
export const transferStockBetweenLocations = async (
  transferData: {
    transferType: StockTransfer['transferType'];
    productId: string;
    quantity: number;
    companyId: string;
    userId: string;
    // Source location (one required based on transferType)
    fromWarehouseId?: string;
    fromShopId?: string;
    fromProductionId?: string;
    // Destination location (one required based on transferType)
    toWarehouseId?: string;
    toShopId?: string;
    // Optional
    inventoryMethod?: InventoryMethod;
    notes?: string;
    createdBy?: EmployeeRef | null;
  }
): Promise<StockTransfer> => {
  const {
    transferType,
    productId,
    quantity,
    companyId,
    userId,
    fromWarehouseId,
    fromShopId,
    fromProductionId,
    toWarehouseId,
    toShopId,
    inventoryMethod = 'FIFO',
    notes,
    createdBy
  } = transferData;

  // Validate transfer type and required fields
  if (transferType === 'warehouse_to_shop') {
    if (!fromWarehouseId || !toShopId) {
      throw new Error('fromWarehouseId and toShopId are required for warehouse_to_shop transfer');
    }
  } else if (transferType === 'warehouse_to_warehouse') {
    if (!fromWarehouseId || !toWarehouseId) {
      throw new Error('fromWarehouseId and toWarehouseId are required for warehouse_to_warehouse transfer');
    }
  } else if (transferType === 'shop_to_shop') {
    if (!fromShopId || !toShopId) {
      throw new Error('fromShopId and toShopId are required for shop_to_shop transfer');
    }
  } else if (transferType === 'shop_to_warehouse') {
    if (!fromShopId || !toWarehouseId) {
      throw new Error('fromShopId and toWarehouseId are required for shop_to_warehouse transfer');
    }
  } else {
    throw new Error(`Invalid transfer type: ${transferType}`);
  }

  if (quantity <= 0) {
    throw new Error('Transfer quantity must be greater than 0');
  }

  const batch = writeBatch(db);
  const transferRef = doc(collection(db, 'stockTransfers'));

  try {
    // Determine source location filters
    let sourceShopId: string | undefined;
    let sourceWarehouseId: string | undefined;
    let sourceLocationType: 'warehouse' | 'shop' | 'production' | 'global' | undefined;

    if (transferType === 'warehouse_to_shop' || transferType === 'warehouse_to_warehouse') {
      sourceWarehouseId = fromWarehouseId;
      sourceLocationType = 'warehouse';
    } else if (transferType === 'shop_to_shop' || transferType === 'shop_to_warehouse') {
      sourceShopId = fromShopId;
      sourceLocationType = 'shop';
    }

    // Get available batches from source location
    const availableBatches = await getAvailableStockBatches(
      productId,
      companyId,
      'product',
      sourceShopId,
      sourceWarehouseId,
      sourceLocationType
    );

    if (availableBatches.length === 0) {
      const locationInfo = sourceShopId ? `shop ${sourceShopId}` : 
                          sourceWarehouseId ? `warehouse ${sourceWarehouseId}` : '';
      throw new Error(`No available stock found in ${locationInfo}`);
    }

    // Check total available stock
    const totalAvailable = availableBatches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
    if (totalAvailable < quantity) {
      throw new Error(`Insufficient stock. Available: ${totalAvailable}, Requested: ${quantity}`);
    }

    // Consume stock from source location
    const inventoryResult = await consumeStockFromBatches(
      batch,
      productId,
      companyId,
      quantity,
      inventoryMethod,
      'product',
      sourceShopId,
      sourceWarehouseId,
      sourceLocationType
    );

    // Determine destination location
    let destShopId: string | undefined;
    let destWarehouseId: string | undefined;
    let destLocationType: 'warehouse' | 'shop' | 'production' | 'global';

    if (transferType === 'warehouse_to_warehouse' || transferType === 'shop_to_warehouse') {
      destWarehouseId = toWarehouseId;
      destLocationType = 'warehouse';
    } else {
      destShopId = toShopId;
      destLocationType = 'shop';
    }

    // Create new batches at destination location
    // We'll create one batch per consumed batch to maintain traceability
    const transferredBatchIds: string[] = [];

    for (const consumedBatch of inventoryResult.consumedBatches) {
      // Get the original batch to copy its properties
      const originalBatchRef = doc(db, 'stockBatches', consumedBatch.batchId);
      const originalBatchSnap = await getDoc(originalBatchRef);
      
      if (!originalBatchSnap.exists()) {
        throw new Error(`Original batch ${consumedBatch.batchId} not found`);
      }

      const originalBatch = originalBatchSnap.data() as StockBatch;

      // Create new batch at destination within the batch transaction
      const newBatchRef = doc(collection(db, 'stockBatches'));
      const newBatchData: any = {
        id: newBatchRef.id,
        type: 'product',
        productId,
        quantity: consumedBatch.consumedQuantity,
        costPrice: originalBatch.costPrice,
        userId,
        companyId,
        remainingQuantity: consumedBatch.consumedQuantity,
        status: 'active',
        locationType: destLocationType,
        createdAt: serverTimestamp(),
      };

      // Copy optional fields from original batch
      if (originalBatch.supplierId) newBatchData.supplierId = originalBatch.supplierId;
      if (originalBatch.isOwnPurchase !== undefined) newBatchData.isOwnPurchase = originalBatch.isOwnPurchase;
      if (originalBatch.isCredit !== undefined) newBatchData.isCredit = originalBatch.isCredit;
      if (notes) newBatchData.notes = notes || `Transferred from ${sourceLocationType}`;

      // Set destination location fields
      if (destShopId) newBatchData.shopId = destShopId;
      if (destWarehouseId) newBatchData.warehouseId = destWarehouseId;

      batch.set(newBatchRef, newBatchData);
      transferredBatchIds.push(newBatchRef.id);

      // Create stock change for destination (increase)
      createStockChange(
        batch,
        productId,
        consumedBatch.consumedQuantity,
        'transfer',
        userId,
        companyId,
        'product',
        originalBatch.supplierId,
        originalBatch.isOwnPurchase,
        originalBatch.isCredit,
        originalBatch.costPrice,
        newBatchRef.id,
        undefined,
        undefined,
        destLocationType,
        destShopId,
        destWarehouseId,
        transferRef.id
      );
    }

    // Create stock change for source (decrease)
    for (const consumedBatch of inventoryResult.consumedBatches) {
      const originalBatchRef = doc(db, 'stockBatches', consumedBatch.batchId);
      const originalBatchSnap = await getDoc(originalBatchRef);
      
      if (originalBatchSnap.exists()) {
        const originalBatch = originalBatchSnap.data() as StockBatch;
        
        createStockChange(
          batch,
          productId,
          -consumedBatch.consumedQuantity,
          'transfer',
          userId,
          companyId,
          'product',
          originalBatch.supplierId,
          originalBatch.isOwnPurchase,
          originalBatch.isCredit,
          originalBatch.costPrice,
          consumedBatch.batchId,
          undefined,
          undefined,
          sourceLocationType,
          sourceShopId,
          sourceWarehouseId,
          transferRef.id
        );
      }
    }

    // Create transfer record
    const transferData: any = {
      id: transferRef.id,
      transferType,
      productId,
      quantity,
      batchIds: transferredBatchIds,
      status: 'completed',
      companyId,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Set source and destination based on transfer type
    if (fromWarehouseId) transferData.fromWarehouseId = fromWarehouseId;
    if (fromShopId) transferData.fromShopId = fromShopId;
    if (fromProductionId) transferData.fromProductionId = fromProductionId;
    if (toWarehouseId) transferData.toWarehouseId = toWarehouseId;
    if (toShopId) transferData.toShopId = toShopId;
    if (notes) transferData.notes = notes;
    if (createdBy) transferData.createdBy = createdBy;

    batch.set(transferRef, transferData);

    await batch.commit();

    const createdTransfer = {
      id: transferRef.id,
      ...transferData,
      createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
      updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
    } as StockTransfer;

    // Notify users about the transfer (async, don't wait)
    notifyTransferCreated(
      companyId,
      transferRef.id,
      transferType,
      productId,
      quantity,
      fromShopId,
      fromWarehouseId,
      toShopId,
      toWarehouseId
    ).catch(err => {
      logError('Error sending notification for transfer', err);
    });

    return createdTransfer;

  } catch (error) {
    logError('Error transferring stock', error);
    throw error;
  }
};

/**
 * Get all transfers for a company
 */
export const getStockTransfers = async (
  companyId: string,
  filters?: {
    productId?: string;
    shopId?: string;
    warehouseId?: string;
    transferType?: StockTransfer['transferType'];
    status?: StockTransfer['status'];
  }
): Promise<StockTransfer[]> => {
  const constraints: any[] = [
    where('companyId', '==', companyId),
  ];

  if (filters?.productId) {
    constraints.push(where('productId', '==', filters.productId));
  }
  if (filters?.shopId) {
    constraints.push(where('toShopId', '==', filters.shopId));
  }
  if (filters?.warehouseId) {
    constraints.push(where('toWarehouseId', '==', filters.warehouseId));
  }
  if (filters?.transferType) {
    constraints.push(where('transferType', '==', filters.transferType));
  }
  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, 'stockTransfers'), ...constraints);
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as StockTransfer[];
};

/**
 * Get transfer by ID
 */
export const getStockTransferById = async (transferId: string): Promise<StockTransfer | null> => {
  const transferRef = doc(db, 'stockTransfers', transferId);
  const transferSnap = await getDoc(transferRef);

  if (!transferSnap.exists()) {
    return null;
  }

  return {
    id: transferSnap.id,
    ...transferSnap.data()
  } as StockTransfer;
};

/**
 * Cancel a pending transfer
 */
export const cancelStockTransfer = async (
  transferId: string,
  userId: string
): Promise<void> => {
  const transferRef = doc(db, 'stockTransfers', transferId);
  const transferSnap = await getDoc(transferRef);

  if (!transferSnap.exists()) {
    throw new Error('Transfer not found');
  }

  const transfer = transferSnap.data() as StockTransfer;

  if (transfer.status !== 'pending') {
    throw new Error('Only pending transfers can be cancelled');
  }

  if (transfer.userId !== userId) {
    throw new Error('Unauthorized to cancel this transfer');
  }

  const batch = writeBatch(db);
  batch.update(transferRef, {
    status: 'cancelled',
    updatedAt: serverTimestamp()
  });

  await batch.commit();
};

// ============================================================================
// SUBSCRIPTION FUNCTIONS
// ============================================================================

/**
 * Subscribe to stock transfers for a company
 */
export const subscribeToStockTransfers = (
  companyId: string,
  callback: (transfers: StockTransfer[]) => void,
  onError?: (error: Error) => void,
  filters?: {
    productId?: string;
    shopId?: string;
    warehouseId?: string;
    transferType?: StockTransfer['transferType'];
    status?: StockTransfer['status'];
  }
): (() => void) => {
  const constraints: any[] = [
    where('companyId', '==', companyId),
  ];

  if (filters?.productId) {
    constraints.push(where('productId', '==', filters.productId));
  }
  if (filters?.shopId) {
    constraints.push(where('toShopId', '==', filters.shopId));
  }
  if (filters?.warehouseId) {
    constraints.push(where('toWarehouseId', '==', filters.warehouseId));
  }
  if (filters?.transferType) {
    constraints.push(where('transferType', '==', filters.transferType));
  }
  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, 'stockTransfers'), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const transfers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StockTransfer[];
      callback(transfers);
    },
    (error) => {
      logError('Error subscribing to stock transfers', error);
      if (onError) {
        onError(new Error(error.message));
      }
    }
  );
};

