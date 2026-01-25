// Stock service for Restoflow
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  updateDoc,
  WriteBatch,
  limit
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import type {
  Stock,
  StockBatch,
  StockChange,
  StockChangeReason,
  BatchAdjustment,
  Timestamp
} from '../../../types/geskap';

// ============================================================================
// STOCK BATCH SUBSCRIPTIONS
// ============================================================================

export const subscribeToStockBatches = (
  restaurantId: string,
  type: 'product' | 'matiere',
  itemId: string,
  callback: (batches: StockBatch[]) => void
): (() => void) => {
  if (!restaurantId || !itemId) {
    callback([]);
    return () => {};
  }

  const fieldName = type === 'product' ? 'productId' : 'matiereId';

  const q = query(
    collection(db, 'restaurants', restaurantId, 'stockBatches'),
    where('type', '==', type),
    where(fieldName, '==', itemId),
    where('status', '==', 'active'),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const batches = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as StockBatch[];
    callback(batches);
  }, (error) => {
    console.error('Error in stock batches subscription:', error);
    callback([]);
  });
};

export const subscribeToAllStockBatches = (
  restaurantId: string,
  type: 'product' | 'matiere',
  callback: (batches: StockBatch[]) => void
): (() => void) => {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'restaurants', restaurantId, 'stockBatches'),
    where('type', '==', type),
    where('status', '==', 'active'),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const batches = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as StockBatch[];
    callback(batches);
  }, (error) => {
    console.error('Error in all stock batches subscription:', error);
    callback([]);
  });
};

// ============================================================================
// STOCK CHANGE HISTORY
// ============================================================================

export const subscribeToStockChanges = (
  restaurantId: string,
  type: 'product' | 'matiere',
  itemId: string,
  callback: (changes: StockChange[]) => void
): (() => void) => {
  if (!restaurantId || !itemId) {
    callback([]);
    return () => {};
  }

  const fieldName = type === 'product' ? 'productId' : 'matiereId';

  const q = query(
    collection(db, 'restaurants', restaurantId, 'stockChanges'),
    where('type', '==', type),
    where(fieldName, '==', itemId),
    orderBy('createdAt', 'desc'),
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {
    const changes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as StockChange[];
    callback(changes);
  }, (error) => {
    console.error('Error in stock changes subscription:', error);
    callback([]);
  });
};

// ============================================================================
// STOCK BATCH CREATION (for use in batch operations)
// ============================================================================

export const createStockBatch = async (
  batch: WriteBatch,
  type: 'product' | 'matiere',
  itemId: string,
  quantity: number,
  costPrice: number,
  userId: string,
  restaurantId: string,
  supplierInfo?: {
    supplierId?: string;
    isOwnPurchase?: boolean;
    isCredit?: boolean;
  }
): Promise<string> => {
  const stockBatchRef = doc(collection(db, 'restaurants', restaurantId, 'stockBatches'));

  const stockBatchData: any = {
    id: stockBatchRef.id,
    type,
    quantity,
    costPrice,
    remainingQuantity: quantity,
    status: 'active',
    userId,
    restaurantId,
    createdAt: serverTimestamp()
  };

  if (type === 'product') {
    stockBatchData.productId = itemId;
  } else {
    stockBatchData.matiereId = itemId;
  }

  if (supplierInfo?.supplierId) stockBatchData.supplierId = supplierInfo.supplierId;
  if (supplierInfo?.isOwnPurchase !== undefined) stockBatchData.isOwnPurchase = supplierInfo.isOwnPurchase;
  if (supplierInfo?.isCredit !== undefined) stockBatchData.isCredit = supplierInfo.isCredit;

  batch.set(stockBatchRef, stockBatchData);

  return stockBatchRef.id;
};

// ============================================================================
// STOCK CHANGE CREATION (for use in batch operations)
// ============================================================================

export const createStockChange = (
  batch: WriteBatch,
  restaurantId: string,
  itemId: string,
  change: number,
  reason: StockChangeReason,
  userId: string,
  type: 'product' | 'matiere',
  supplierId?: string,
  isOwnPurchase?: boolean,
  isCredit?: boolean,
  costPrice?: number,
  batchId?: string,
  saleId?: string,
  notes?: string
): string => {
  const stockChangeRef = doc(collection(db, 'restaurants', restaurantId, 'stockChanges'));

  const stockChangeData: any = {
    id: stockChangeRef.id,
    type,
    change,
    reason,
    userId,
    restaurantId,
    createdAt: serverTimestamp()
  };

  if (type === 'product') {
    stockChangeData.productId = itemId;
  } else {
    stockChangeData.matiereId = itemId;
  }

  if (supplierId) stockChangeData.supplierId = supplierId;
  if (isOwnPurchase !== undefined) stockChangeData.isOwnPurchase = isOwnPurchase;
  if (isCredit !== undefined) stockChangeData.isCredit = isCredit;
  if (costPrice !== undefined) stockChangeData.costPrice = costPrice;
  if (batchId) stockChangeData.batchId = batchId;
  if (saleId) stockChangeData.saleId = saleId;
  if (notes) stockChangeData.notes = notes;

  batch.set(stockChangeRef, stockChangeData);

  return stockChangeRef.id;
};

// ============================================================================
// STOCK OPERATIONS
// ============================================================================

/**
 * Get total stock quantity for an item (sum of all active batches)
 */
export const getStockQuantity = async (
  restaurantId: string,
  type: 'product' | 'matiere',
  itemId: string
): Promise<number> => {
  const fieldName = type === 'product' ? 'productId' : 'matiereId';

  const q = query(
    collection(db, 'restaurants', restaurantId, 'stockBatches'),
    where('type', '==', type),
    where(fieldName, '==', itemId),
    where('status', '==', 'active')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.reduce((total, doc) => {
    const batch = doc.data() as StockBatch;
    return total + (batch.remainingQuantity || 0);
  }, 0);
};

/**
 * Restock an item (add to existing batch or create new)
 */
export const restockItem = async (
  restaurantId: string,
  type: 'product' | 'matiere',
  itemId: string,
  quantity: number,
  costPrice: number,
  userId: string,
  supplierInfo?: {
    supplierId?: string;
    isOwnPurchase?: boolean;
    isCredit?: boolean;
  },
  notes?: string
): Promise<void> => {
  const batch = writeBatch(db);

  const batchId = await createStockBatch(
    batch,
    type,
    itemId,
    quantity,
    costPrice,
    userId,
    restaurantId,
    supplierInfo
  );

  createStockChange(
    batch,
    restaurantId,
    itemId,
    quantity,
    'restock',
    userId,
    type,
    supplierInfo?.supplierId,
    supplierInfo?.isOwnPurchase,
    supplierInfo?.isCredit,
    costPrice,
    batchId,
    undefined,
    notes
  );

  await batch.commit();
};

/**
 * Consume stock using FIFO (First In, First Out) method
 */
export const consumeStockFIFO = async (
  restaurantId: string,
  type: 'product' | 'matiere',
  itemId: string,
  quantity: number,
  userId: string,
  reason: StockChangeReason = 'sale',
  saleId?: string
): Promise<{ totalCost: number; consumedBatches: Array<{ batchId: string; costPrice: number; consumedQuantity: number }> }> => {
  const fieldName = type === 'product' ? 'productId' : 'matiereId';

  // Get active batches ordered by creation date (FIFO)
  const q = query(
    collection(db, 'restaurants', restaurantId, 'stockBatches'),
    where('type', '==', type),
    where(fieldName, '==', itemId),
    where('status', '==', 'active'),
    orderBy('createdAt', 'asc')
  );

  const snapshot = await getDocs(q);
  const batches = snapshot.docs.map(doc => ({
    id: doc.id,
    ref: doc.ref,
    ...doc.data()
  })) as (StockBatch & { ref: any })[];

  let remainingToConsume = quantity;
  let totalCost = 0;
  const consumedBatches: Array<{ batchId: string; costPrice: number; consumedQuantity: number }> = [];
  const batch = writeBatch(db);

  for (const stockBatch of batches) {
    if (remainingToConsume <= 0) break;

    const available = stockBatch.remainingQuantity || 0;
    const toConsume = Math.min(available, remainingToConsume);

    if (toConsume > 0) {
      const newRemaining = available - toConsume;
      const newStatus = newRemaining <= 0 ? 'depleted' : 'active';

      batch.update(stockBatch.ref, {
        remainingQuantity: newRemaining,
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      totalCost += toConsume * stockBatch.costPrice;
      consumedBatches.push({
        batchId: stockBatch.id,
        costPrice: stockBatch.costPrice,
        consumedQuantity: toConsume
      });

      remainingToConsume -= toConsume;
    }
  }

  if (remainingToConsume > 0) {
    throw new Error(`Insufficient stock: needed ${quantity}, available ${quantity - remainingToConsume}`);
  }

  // Record the stock change
  createStockChange(
    batch,
    restaurantId,
    itemId,
    -quantity,
    reason,
    userId,
    type,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    saleId
  );

  await batch.commit();

  return { totalCost, consumedBatches };
};

/**
 * Adjust a batch (correction, damage, etc.)
 */
export const adjustBatch = async (
  restaurantId: string,
  adjustment: BatchAdjustment,
  userId: string
): Promise<void> => {
  const batchRef = doc(db, 'restaurants', restaurantId, 'stockBatches', adjustment.batchId);
  const batchSnap = await getDoc(batchRef);

  if (!batchSnap.exists()) {
    throw new Error('Stock batch not found');
  }

  const stockBatch = batchSnap.data() as StockBatch;
  const batch = writeBatch(db);
  const type = stockBatch.type;
  const itemId = type === 'product' ? stockBatch.productId : stockBatch.matiereId;

  const updates: any = {
    updatedAt: serverTimestamp()
  };

  let stockChange = 0;
  let changeNotes = adjustment.notes || '';

  // Handle quantity correction
  if (adjustment.newTotalQuantity !== undefined) {
    const oldQuantity = stockBatch.quantity;
    const consumed = oldQuantity - (stockBatch.remainingQuantity || 0);
    const newRemaining = Math.max(0, adjustment.newTotalQuantity - consumed);

    updates.quantity = adjustment.newTotalQuantity;
    updates.remainingQuantity = newRemaining;
    stockChange = adjustment.newTotalQuantity - oldQuantity;
    changeNotes += ` Quantity: ${oldQuantity} -> ${adjustment.newTotalQuantity}`;
  }

  // Handle remaining quantity adjustment
  if (adjustment.remainingQuantityDelta !== undefined) {
    const newRemaining = Math.max(0, (stockBatch.remainingQuantity || 0) + adjustment.remainingQuantityDelta);
    updates.remainingQuantity = newRemaining;
    stockChange += adjustment.remainingQuantityDelta;
    changeNotes += ` Remaining adjusted by: ${adjustment.remainingQuantityDelta}`;
  }

  // Handle damage
  if (adjustment.damageQuantity !== undefined && adjustment.damageQuantity > 0) {
    const newDamaged = (stockBatch.damagedQuantity || 0) + adjustment.damageQuantity;
    const newRemaining = Math.max(0, (stockBatch.remainingQuantity || 0) - adjustment.damageQuantity);
    updates.damagedQuantity = newDamaged;
    updates.remainingQuantity = newRemaining;
    stockChange -= adjustment.damageQuantity;
    changeNotes += ` Damaged: ${adjustment.damageQuantity}`;
  }

  // Handle cost price correction
  if (adjustment.newCostPrice !== undefined) {
    updates.costPrice = adjustment.newCostPrice;
    changeNotes += ` Cost: ${stockBatch.costPrice} -> ${adjustment.newCostPrice}`;
  }

  // Check if batch is depleted
  if (updates.remainingQuantity !== undefined && updates.remainingQuantity <= 0) {
    updates.status = 'depleted';
  }

  batch.update(batchRef, updates);

  // Record stock change if quantity changed
  if (stockChange !== 0 && itemId) {
    createStockChange(
      batch,
      restaurantId,
      itemId,
      stockChange,
      adjustment.adjustmentType === 'damage' ? 'damage' : 'adjustment',
      userId,
      type,
      undefined,
      undefined,
      undefined,
      undefined,
      adjustment.batchId,
      undefined,
      changeNotes.trim()
    );
  }

  await batch.commit();
};

/**
 * Delete a batch (soft delete)
 */
export const deleteBatch = async (
  restaurantId: string,
  batchId: string,
  userId: string
): Promise<void> => {
  const batchRef = doc(db, 'restaurants', restaurantId, 'stockBatches', batchId);
  const batchSnap = await getDoc(batchRef);

  if (!batchSnap.exists()) {
    throw new Error('Stock batch not found');
  }

  const stockBatch = batchSnap.data() as StockBatch;
  const type = stockBatch.type;
  const itemId = type === 'product' ? stockBatch.productId : stockBatch.matiereId;

  const batch = writeBatch(db);

  batch.update(batchRef, {
    status: 'deleted',
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: userId
  });

  // Record the deletion as a stock change
  if (stockBatch.remainingQuantity && stockBatch.remainingQuantity > 0 && itemId) {
    createStockChange(
      batch,
      restaurantId,
      itemId,
      -stockBatch.remainingQuantity,
      'batch_deletion',
      userId,
      type,
      undefined,
      undefined,
      undefined,
      undefined,
      batchId
    );
  }

  await batch.commit();
};
