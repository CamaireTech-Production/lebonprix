import {
  collection,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import type { Product, StockBatch, StockChange } from '../types/models';

/**
 * Enhanced restock with new cost price and batch creation
 */
export const restockProduct = async (
  productId: string,
  quantity: number,
  costPrice: number,
  userId: string,
  supplierId?: string,
  isOwnPurchase?: boolean,
  isCredit?: boolean,
  notes?: string
): Promise<void> => {
  const batch = writeBatch(db);
  
  // Create new stock batch
  const stockBatchRef = doc(collection(db, 'stockBatches'));
  const stockBatchData = {
    id: stockBatchRef.id,
    productId,
    quantity,
    costPrice,
    ...(supplierId && { supplierId }),
    ...(isOwnPurchase !== undefined && { isOwnPurchase }),
    ...(isCredit !== undefined && { isCredit }),
    createdAt: serverTimestamp(),
    userId,
    remainingQuantity: quantity,
    status: 'active',
    ...(notes && { notes })
  };
  batch.set(stockBatchRef, stockBatchData);
  
  // Update product stock
  const productRef = doc(db, 'products', productId);
  const productSnap = await getDoc(productRef);
  if (!productSnap.exists()) {
    throw new Error('Product not found');
  }
  
  const currentProduct = productSnap.data() as Product;
  if (currentProduct.userId !== userId) {
    throw new Error('Unauthorized to update this product');
  }
  
  batch.update(productRef, {
    stock: currentProduct.stock + quantity,
    updatedAt: serverTimestamp()
  });
  
  // Create stock change record
  const stockChangeRef = doc(collection(db, 'stockChanges'));
  const stockChangeData = {
    id: stockChangeRef.id,
    productId,
    change: quantity,
    reason: 'restock' as StockChange['reason'],
    ...(supplierId && { supplierId }),
    ...(isOwnPurchase !== undefined && { isOwnPurchase }),
    ...(isCredit !== undefined && { isCredit }),
    costPrice,
    batchId: stockBatchRef.id,
    createdAt: serverTimestamp(),
    userId
  };
  batch.set(stockChangeRef, stockChangeData);
  
  // Create supplier debt if credit purchase
  if (supplierId && isCredit && !isOwnPurchase) {
    const debtAmount = quantity * costPrice;
    const debtRef = doc(collection(db, 'financeEntries'));
    const debtData = {
      id: debtRef.id,
      userId,
      sourceType: 'supplier',
      sourceId: supplierId,
      type: 'supplier_debt',
      amount: debtAmount,
      description: `Credit purchase for ${quantity} units of product ${currentProduct.name}`,
      date: serverTimestamp(),
      isDeleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      supplierId
    };
    batch.set(debtRef, debtData);
  }
  
  await batch.commit();
};

/**
 * Manual adjustment with batch selection and cost price modification
 */
export const adjustStockManually = async (
  productId: string,
  batchId: string,
  quantityChange: number,
  newCostPrice?: number,
  userId: string,
  notes?: string
): Promise<void> => {
  const batch = writeBatch(db);
  
  // Get batch details
  const batchRef = doc(db, 'stockBatches', batchId);
  const batchSnap = await getDoc(batchRef);
  if (!batchSnap.exists()) {
    throw new Error('Stock batch not found');
  }
  
  const batchData = batchSnap.data() as StockBatch;
  if (batchData.userId !== userId) {
    throw new Error('Unauthorized to update this batch');
  }
  
  // Update batch
  const newRemainingQuantity = batchData.remainingQuantity + quantityChange;
  if (newRemainingQuantity < 0) {
    throw new Error('Batch remaining quantity cannot be negative');
  }
  
  const batchUpdates: Partial<StockBatch> = {
    remainingQuantity: newRemainingQuantity,
    status: newRemainingQuantity === 0 ? 'depleted' : 'active',
    updatedAt: serverTimestamp()
  };
  
  if (newCostPrice !== undefined) {
    batchUpdates.costPrice = newCostPrice;
  }
  
  if (notes) {
    batchUpdates.notes = notes;
  }
  
  batch.update(batchRef, batchUpdates);
  
  // Update product stock
  const productRef = doc(db, 'products', productId);
  const productSnap = await getDoc(productRef);
  if (!productSnap.exists()) {
    throw new Error('Product not found');
  }
  
  const currentProduct = productSnap.data() as Product;
  if (currentProduct.userId !== userId) {
    throw new Error('Unauthorized to update this product');
  }
  
  batch.update(productRef, {
    stock: currentProduct.stock + quantityChange,
    updatedAt: serverTimestamp()
  });
  
  // Create stock change record
  const stockChangeRef = doc(collection(db, 'stockChanges'));
  const stockChangeData = {
    id: stockChangeRef.id,
    productId,
    change: quantityChange,
    reason: 'manual_adjustment' as StockChange['reason'],
    ...(batchData.supplierId && { supplierId: batchData.supplierId }),
    ...(batchData.isOwnPurchase !== undefined && { isOwnPurchase: batchData.isOwnPurchase }),
    ...(batchData.isCredit !== undefined && { isCredit: batchData.isCredit }),
    costPrice: newCostPrice || batchData.costPrice,
    batchId,
    createdAt: serverTimestamp(),
    userId
  };
  batch.set(stockChangeRef, stockChangeData);
  
  // Handle supplier debt adjustment for credit purchases
  if (batchData.supplierId && batchData.isCredit && !batchData.isOwnPurchase) {
    const debtChange = quantityChange * (newCostPrice || batchData.costPrice);
    
    if (debtChange !== 0) {
      const debtRef = doc(collection(db, 'financeEntries'));
      const debtData = {
        id: debtRef.id,
        userId,
        sourceType: 'supplier',
        sourceId: batchData.supplierId,
        type: debtChange > 0 ? 'supplier_debt' : 'supplier_refund',
        amount: Math.abs(debtChange),
        description: `Stock adjustment: ${quantityChange > 0 ? '+' : ''}${quantityChange} units of product ${currentProduct.name}`,
        date: serverTimestamp(),
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        supplierId: batchData.supplierId
      };
      batch.set(debtRef, debtData);
    }
  }
  
  await batch.commit();
};

/**
 * Damage adjustment - reduces stock without affecting supplier debt
 */
export const adjustStockForDamage = async (
  productId: string,
  batchId: string,
  damagedQuantity: number,
  userId: string,
  notes?: string
): Promise<void> => {
  const batch = writeBatch(db);
  
  // Get batch details
  const batchRef = doc(db, 'stockBatches', batchId);
  const batchSnap = await getDoc(batchRef);
  if (!batchSnap.exists()) {
    throw new Error('Stock batch not found');
  }
  
  const batchData = batchSnap.data() as StockBatch;
  if (batchData.userId !== userId) {
    throw new Error('Unauthorized to update this batch');
  }
  
  // Update batch
  const newRemainingQuantity = batchData.remainingQuantity - damagedQuantity;
  if (newRemainingQuantity < 0) {
    throw new Error('Batch remaining quantity cannot be negative');
  }
  
  batch.update(batchRef, {
    remainingQuantity: newRemainingQuantity,
    status: newRemainingQuantity === 0 ? 'depleted' : 'active',
    updatedAt: serverTimestamp(),
    ...(notes && { notes })
  });
  
  // Update product stock
  const productRef = doc(db, 'products', productId);
  const productSnap = await getDoc(productRef);
  if (!productSnap.exists()) {
    throw new Error('Product not found');
  }
  
  const currentProduct = productSnap.data() as Product;
  if (currentProduct.userId !== userId) {
    throw new Error('Unauthorized to update this product');
  }
  
  batch.update(productRef, {
    stock: currentProduct.stock - damagedQuantity,
    updatedAt: serverTimestamp()
  });
  
  // Create stock change record for damage
  const stockChangeRef = doc(collection(db, 'stockChanges'));
  const stockChangeData = {
    id: stockChangeRef.id,
    productId,
    change: -damagedQuantity,
    reason: 'damage' as StockChange['reason'],
    ...(batchData.supplierId && { supplierId: batchData.supplierId }),
    ...(batchData.isOwnPurchase !== undefined && { isOwnPurchase: batchData.isOwnPurchase }),
    ...(batchData.isCredit !== undefined && { isCredit: batchData.isCredit }),
    costPrice: batchData.costPrice,
    batchId,
    createdAt: serverTimestamp(),
    userId
  };
  batch.set(stockChangeRef, stockChangeData);
  
  // Note: No supplier debt adjustment for damage - debt remains unchanged
  
  await batch.commit();
};

/**
 * Get available batches for a product (for adjustment selection)
 */
export const getProductBatchesForAdjustment = async (productId: string): Promise<StockBatch[]> => {
  const batchesSnapshot = await getDocs(
    query(
      collection(db, 'stockBatches'),
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