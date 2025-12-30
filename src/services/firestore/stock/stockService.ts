// Stock service - extracted from firestore.ts
// Contains core stock batch and stock change management functions
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type WriteBatch,
  setDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError } from '@utils/core/logger';
import type { StockBatch, StockChange, Product } from '../../../types/models';
import type { InventoryMethod } from '@utils/inventory/inventoryManagement';
import type { InventoryResult } from '@utils/inventory/inventoryManagement';

// ============================================================================
// STOCK BATCH MANAGEMENT
// ============================================================================

export const createStockBatch = async (
  productIdOrMatiereId: string,
  quantity: number,
  costPrice: number,
  userId: string,
  companyId?: string,
  supplierId?: string,
  isOwnPurchase?: boolean,
  isCredit?: boolean,
  notes?: string,
  type: 'product' | 'matiere' = 'product' // Default to product for backward compatibility
): Promise<StockBatch> => {
  if (!productIdOrMatiereId || quantity <= 0 || costPrice <= 0 || !userId) {
    throw new Error('Invalid stock batch data');
  }

  // Validate type field
  if (type !== 'product' && type !== 'matiere') {
    throw new Error('Type must be either "product" or "matiere"');
  }

  let finalCompanyId = companyId;
  if (!finalCompanyId) {
    if (type === 'matiere') {
      const matiereRef = doc(db, 'matieres', productIdOrMatiereId);
      const matiereSnap = await getDoc(matiereRef);
      if (matiereSnap.exists()) {
        finalCompanyId = matiereSnap.data().companyId;
      }
    } else {
      const productRef = doc(db, 'products', productIdOrMatiereId);
      const productSnap = await getDoc(productRef);
      if (productSnap.exists()) {
        finalCompanyId = productSnap.data().companyId;
      }
    }
    
    if (!finalCompanyId) {
      throw new Error('Company ID not found for product/matiere');
    }
  }

  const stockBatchRef = doc(collection(db, 'stockBatches'));
  const batchData: any = {
    id: stockBatchRef.id,
    type, // Set type field
    quantity,
    costPrice,
    userId,
    companyId: finalCompanyId,
    remainingQuantity: quantity,
    status: 'active',
    createdAt: serverTimestamp(),
  };

  // Set the appropriate ID field based on type
  if (type === 'matiere') {
    batchData.matiereId = productIdOrMatiereId;
  } else {
    batchData.productId = productIdOrMatiereId;
  }

  if (typeof supplierId !== 'undefined') batchData.supplierId = supplierId;
  if (typeof isOwnPurchase !== 'undefined') batchData.isOwnPurchase = isOwnPurchase;
  if (typeof isCredit !== 'undefined') batchData.isCredit = isCredit;
  if (notes) batchData.notes = notes;

  await setDoc(stockBatchRef, batchData);

  return {
    id: stockBatchRef.id,
    ...batchData,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  } as StockBatch;
};

export const getAvailableStockBatches = async (
  productIdOrMatiereId: string,
  companyId: string,
  type: 'product' | 'matiere' = 'product'
): Promise<StockBatch[]> => {
  const constraints: any[] = [
    where('companyId', '==', companyId),
    where('type', '==', type),
    where('remainingQuantity', '>', 0),
    where('status', '==', 'active'),
  ];

  // Add the appropriate ID filter based on type
  if (type === 'matiere') {
    constraints.push(where('matiereId', '==', productIdOrMatiereId));
  } else {
    constraints.push(where('productId', '==', productIdOrMatiereId));
  }

  constraints.push(orderBy('createdAt', 'asc'));

  const q = query(collection(db, 'stockBatches'), ...constraints);
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StockBatch[];
};

export const consumeStockFromBatches = async (
  batch: WriteBatch,
  productIdOrMatiereId: string,
  companyId: string,
  quantity: number,
  method: InventoryMethod = 'FIFO',
  type: 'product' | 'matiere' = 'product'
): Promise<InventoryResult> => {
  const availableBatches = await getAvailableStockBatches(productIdOrMatiereId, companyId, type);
  
  if (availableBatches.length === 0) {
    throw new Error(`No available stock batches found for ${type} ${productIdOrMatiereId}`);
  }

  const sortedBatches = availableBatches.sort((a, b) => {
    if (method === 'FIFO') {
      return (a.createdAt.seconds || 0) - (b.createdAt.seconds || 0);
    } else {
      return (b.createdAt.seconds || 0) - (a.createdAt.seconds || 0);
    }
  });

  let remainingQuantity = quantity;
  const consumedBatches: Array<{
    batchId: string;
    costPrice: number;
    consumedQuantity: number;
    remainingQuantity: number;
  }> = [];
  let totalCost = 0;
  let totalConsumedQuantity = 0;

  for (const stockBatch of sortedBatches) {
    if (remainingQuantity <= 0) break;

    const consumeQuantity = Math.min(remainingQuantity, stockBatch.remainingQuantity);
    const newRemainingQuantity = stockBatch.remainingQuantity - consumeQuantity;

    const batchRef = doc(db, 'stockBatches', stockBatch.id);
    batch.update(batchRef, {
      remainingQuantity: newRemainingQuantity,
      status: newRemainingQuantity === 0 ? 'depleted' : 'active'
    });

    consumedBatches.push({
      batchId: stockBatch.id,
      costPrice: stockBatch.costPrice,
      consumedQuantity: consumeQuantity,
      remainingQuantity: newRemainingQuantity
    });

    totalCost += stockBatch.costPrice * consumeQuantity;
    totalConsumedQuantity += consumeQuantity;
    remainingQuantity -= consumeQuantity;
  }

  if (remainingQuantity > 0) {
    throw new Error(`Insufficient stock available for ${type} ${productIdOrMatiereId}. Need ${quantity}, available ${quantity - remainingQuantity}`);
  }

  const averageCostPrice = totalConsumedQuantity > 0 ? totalCost / totalConsumedQuantity : 0;
  const primaryBatchId = consumedBatches.length > 0 ? consumedBatches[0].batchId : '';

  return {
    consumedBatches,
    totalCost,
    averageCostPrice,
    primaryBatchId
  };
};

export const updateStockBatch = async (
  batchId: string,
  updates: Partial<StockBatch>,
  userId: string
): Promise<void> => {
  const batchRef = doc(db, 'stockBatches', batchId);
  const batchDoc = await getDoc(batchRef);

  if (!batchDoc.exists()) {
    throw new Error(`Stock batch ${batchId} not found`);
  }

  const batchData = batchDoc.data() as StockBatch;
  if (batchData.userId !== userId) {
    throw new Error('Unauthorized to update this stock batch');
  }

  await updateDoc(batchRef, {
    ...updates
  });
};

// ============================================================================
// STOCK CHANGE MANAGEMENT
// ============================================================================

export const createStockChange = (
  batch: WriteBatch,
  productIdOrMatiereId: string,
  change: number,
  reason: StockChange['reason'],
  userId: string,
  companyId: string,
  type: 'product' | 'matiere' = 'product', // Default to product for backward compatibility
  supplierId?: string,
  isOwnPurchase?: boolean,
  isCredit?: boolean,
  costPrice?: number,
  batchId?: string,
  saleId?: string,
  batchConsumptions?: Array<{
    batchId: string;
    costPrice: number;
    consumedQuantity: number;
    remainingQuantity: number;
  }>
) => {
  // Validate type field
  if (type !== 'product' && type !== 'matiere') {
    throw new Error('Type must be either "product" or "matiere"');
  }

  const stockChangeRef = doc(collection(db, 'stockChanges'));
  const stockChangeData: any = {
    type, // Set type field
    change,
    reason,
    userId,
    companyId,
    createdAt: serverTimestamp(),
  };
  
  // Set the appropriate ID field based on type
  if (type === 'matiere') {
    stockChangeData.matiereId = productIdOrMatiereId;
  } else {
    stockChangeData.productId = productIdOrMatiereId;
  }
  
  if (typeof supplierId !== 'undefined') stockChangeData.supplierId = supplierId;
  if (typeof isOwnPurchase !== 'undefined') stockChangeData.isOwnPurchase = isOwnPurchase;
  if (typeof isCredit !== 'undefined') stockChangeData.isCredit = isCredit;
  if (typeof costPrice !== 'undefined') stockChangeData.costPrice = costPrice;
  if (typeof batchId !== 'undefined') stockChangeData.batchId = batchId;
  if (typeof saleId !== 'undefined') stockChangeData.saleId = saleId;
  if (batchConsumptions && batchConsumptions.length > 0) stockChangeData.batchConsumptions = batchConsumptions;
  
  batch.set(stockChangeRef, stockChangeData);
  return stockChangeRef.id;
};

export const subscribeToStockChanges = (
  companyId: string,
  callback: (stockChanges: StockChange[]) => void,
  type?: 'product' | 'matiere'
): (() => void) => {
  const constraints: any[] = [
    where('companyId', '==', companyId),
  ];

  // Add type filter if provided
  if (type) {
    constraints.push(where('type', '==', type));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(200));

  const q = query(collection(db, 'stockChanges'), ...constraints);
  
  return onSnapshot(q, (snapshot) => {
    const stockChanges = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as StockChange[];
    
    callback(stockChanges);
  });
};

export const deleteStockChange = async (stockChangeId: string): Promise<void> => {
  try {
    const stockChangeRef = doc(db, 'stockChanges', stockChangeId);
    await deleteDoc(stockChangeRef);
  } catch (error) {
    logError('Error deleting stock change', error);
    throw error;
  }
};

// ============================================================================
// STOCK BATCH QUERIES
// ============================================================================

export const getProductStockBatches = async (productId: string, companyId: string): Promise<StockBatch[]> => {
  const q = query(
    collection(db, 'stockBatches'),
    where('companyId', '==', companyId),
    where('type', '==', 'product'),
    where('productId', '==', productId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StockBatch[];
};

export const getProductStockInfo = async (productId: string, companyId: string): Promise<{
  totalStock: number;
  totalValue: number;
  averageCostPrice: number;
  batches: StockBatch[];
}> => {
  const batches = await getProductStockBatches(productId, companyId);
  const activeBatches = batches.filter(batch => batch.status === 'active' && batch.remainingQuantity > 0);
  
  let totalStock = 0;
  let totalValue = 0;
  
  for (const batch of activeBatches) {
    totalStock += batch.remainingQuantity;
    totalValue += batch.remainingQuantity * batch.costPrice;
  }
  
  const averageCostPrice = totalStock > 0 ? totalValue / totalStock : 0;
  
  return {
    totalStock,
    totalValue,
    averageCostPrice,
    batches
  };
};

export const getMatiereStockBatches = async (matiereId: string): Promise<StockBatch[]> => {
  const q = query(
    collection(db, 'stockBatches'),
    where('type', '==', 'matiere'),
    where('matiereId', '==', matiereId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StockBatch[];
};

export const getMatiereStockInfo = async (matiereId: string): Promise<{
  totalStock: number;
  totalValue: number;
  averageCostPrice: number;
  batches: StockBatch[];
}> => {
  const batches = await getMatiereStockBatches(matiereId);
  const activeBatches = batches.filter(batch => batch.status === 'active' && batch.remainingQuantity > 0);
  
  let totalStock = 0;
  let totalValue = 0;
  
  for (const batch of activeBatches) {
    totalStock += batch.remainingQuantity;
    totalValue += batch.remainingQuantity * batch.costPrice;
  }
  
  const averageCostPrice = totalStock > 0 ? totalValue / totalStock : 0;
  
  return {
    totalStock,
    totalValue,
    averageCostPrice,
    batches
  };
};

export const subscribeToMatiereStockBatches = (
  companyId: string,
  matiereId: string,
  callback: (batches: StockBatch[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const q = query(
    collection(db, 'stockBatches'),
    where('companyId', '==', companyId),
    where('type', '==', 'matiere'),
    where('matiereId', '==', matiereId)
  );
  
  return onSnapshot(
    q,
    (snapshot) => {
      const batches = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StockBatch[];
      
      batches.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      
      callback(batches);
    },
    (error) => {
      if (onError) {
        onError(new Error(error.message));
      }
    }
  );
};

export const subscribeToMatiereStockChanges = (
  companyId: string,
  matiereId: string,
  callback: (changes: StockChange[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const q = query(
    collection(db, 'stockChanges'),
    where('companyId', '==', companyId),
    where('type', '==', 'matiere'),
    where('matiereId', '==', matiereId),
    limit(200)
  );
  
  return onSnapshot(
    q,
    (snapshot) => {
      const changes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StockChange[];
      
      changes.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      
      callback(changes);
    },
    (error) => {
      if (onError) {
        onError(new Error(error.message));
      }
    }
  );
};

export const correctBatchCostPrice = async (
  batchId: string,
  newCostPrice: number,
  userId: string
): Promise<void> => {
  const batchRef = doc(db, 'stockBatches', batchId);
  const batchDoc = await getDoc(batchRef);
  
  if (!batchDoc.exists()) {
    throw new Error('Stock batch not found');
  }
  
  const batchData = batchDoc.data() as StockBatch;
  
  if (batchData.userId !== userId) {
    throw new Error('Unauthorized to modify this stock batch');
  }
  
  const batch = writeBatch(db);
  
  batch.update(batchRef, {
    costPrice: newCostPrice,
    status: 'corrected',
    updatedAt: serverTimestamp()
  });
  
  createStockChange(
    batch,
    batchData.productId || batchData.matiereId || '',
    0,
    'cost_correction',
    userId,
    batchData.companyId,
    batchData.type || 'product', // Use batch type or default to product
    batchData.supplierId,
    batchData.isOwnPurchase,
    batchData.isCredit,
    newCostPrice,
    batchId
  );
  
  await batch.commit();
};

export const getStockBatchStats = async (
  companyId: string,
  type?: 'product' | 'matiere'
): Promise<{
  totalBatches: number;
  activeBatches: number;
  depletedBatches: number;
  totalStockValue: number;
  averageCostPrice: number;
}> => {
  const constraints: any[] = [
    where('companyId', '==', companyId),
  ];

  // Add type filter if provided
  if (type) {
    constraints.push(where('type', '==', type));
  }

  const q = query(collection(db, 'stockBatches'), ...constraints);
  
  const snapshot = await getDocs(q);
  const batches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StockBatch[];
  
  const activeBatches = batches.filter(batch => batch.status === 'active');
  const depletedBatches = batches.filter(batch => batch.status === 'depleted');
  
  let totalStockValue = 0;
  let totalStock = 0;
  
  for (const batch of activeBatches) {
    totalStockValue += batch.remainingQuantity * batch.costPrice;
    totalStock += batch.remainingQuantity;
  }
  
  const averageCostPrice = totalStock > 0 ? totalStockValue / totalStock : 0;
  
  return {
    totalBatches: batches.length,
    activeBatches: activeBatches.length,
    depletedBatches: depletedBatches.length,
    totalStockValue,
    averageCostPrice
  };
};

export const getProductBatchesForAdjustment = async (productId: string): Promise<StockBatch[]> => {
  const batchesSnapshot = await getDocs(
    query(
      collection(db, 'stockBatches'),
      where('type', '==', 'product'),
      where('productId', '==', productId),
      where('status', 'in', ['active', 'corrected']),
      orderBy('createdAt', 'desc')
    )
  );
  
  return batchesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as StockBatch[];
};

export const getBatchDetails = async (batchId: string): Promise<StockBatch | null> => {
  const batchRef = doc(db, 'stockBatches', batchId);
  const batchSnap = await getDoc(batchRef);
  
  if (!batchSnap.exists()) {
    return null;
  }
  
  return {
    id: batchSnap.id,
    ...batchSnap.data()
  } as StockBatch;
};

export const validateBatchAdjustment = (
  batch: StockBatch,
  quantityChange: number,
  newCostPrice?: number
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (batch.status !== 'active' && batch.status !== 'corrected') {
    errors.push('Batch is not available for adjustment');
  }
  
  const newRemainingQuantity = batch.remainingQuantity + quantityChange;
  if (newRemainingQuantity < 0) {
    errors.push('Adjustment would result in negative remaining quantity');
  }
  
  if (newCostPrice !== undefined && newCostPrice < 0) {
    errors.push('Cost price cannot be negative');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const getProductAdjustmentHistory = async (productId: string): Promise<StockChange[]> => {
  const stockChangesSnapshot = await getDocs(
    query(
      collection(db, 'stockChanges'),
      where('type', '==', 'product'),
      where('productId', '==', productId),
      where('reason', 'in', ['restock', 'manual_adjustment', 'damage']),
      orderBy('createdAt', 'desc')
    )
  );
  
  return stockChangesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as StockChange[];
};

