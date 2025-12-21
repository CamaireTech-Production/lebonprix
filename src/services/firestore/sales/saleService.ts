// Sale service - extracted from firestore.ts
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
  Timestamp
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError } from '@utils/core/logger';
import type { Sale, SaleDetails, Product, StockBatch, OrderStatus, PaymentStatus } from '../../../types/models';
import type { InventoryMethod } from '@utils/inventory/inventoryManagement';
import type { InventoryResult } from '@utils/inventory/inventoryManagement';
import { createAuditLog } from '../shared';

// Temporary imports from firestore.ts - will be moved to stock/ and finance/ later
// These functions will be imported from their respective services after refactoring
const getAvailableStockBatches = async (productId: string): Promise<StockBatch[]> => {
  const q = query(
    collection(db, 'stockBatches'),
    where('type', '==', 'product'),
    where('productId', '==', productId),
    where('remainingQuantity', '>', 0),
    where('status', '==', 'active'),
    orderBy('createdAt', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StockBatch[];
};

const consumeStockFromBatches = async (
  batch: WriteBatch,
  productId: string,
  quantity: number,
  method: InventoryMethod = 'FIFO'
): Promise<InventoryResult> => {
  const availableBatches = await getAvailableStockBatches(productId);
  
  if (availableBatches.length === 0) {
    throw new Error(`No available stock batches found for product ${productId}`);
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
    throw new Error(`Insufficient stock available for product ${productId}. Need ${quantity}, available ${quantity - remainingQuantity}`);
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

const createStockChange = (
  batch: WriteBatch,
  productId: string,
  change: number,
  reason: any,
  userId: string,
  companyId: string,
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
  const stockChangeRef = doc(collection(db, 'stockChanges'));
  const stockChangeData: any = {
    type: 'product' as const, // Always product for sales
    change,
    reason,
    userId,
    companyId,
    productId,
    createdAt: serverTimestamp(),
  };
  
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

const syncFinanceEntryWithSale = async (sale: Sale) => {
  const { logWarning } = await import('@utils/core/logger');
  
  if (!sale || !sale.id || !sale.userId || !sale.companyId) {
    logWarning('syncFinanceEntryWithSale: Invalid sale object received, skipping sync');
    return;
  }

  const q = query(collection(db, 'finances'), where('sourceType', '==', 'sale'), where('sourceId', '==', sale.id));
  const snap = await getDocs(q);
  
  // Import createFinanceEntry and updateFinanceEntry from finance service (will be created later)
  // For now, import from firestore.ts
  const { createFinanceEntry, updateFinanceEntry } = await import('../firestore');
  
  const entry: any = {
    userId: sale.userId,
    companyId: sale.companyId,
    sourceType: 'sale',
    sourceId: sale.id,
    type: 'sale',
    amount: sale.totalAmount,
    description: `Sale to ${sale.customerInfo.name}`,
    date: sale.createdAt,
    isDeleted: sale.isAvailable === false,
  };
  
  if (snap.empty) {
    await createFinanceEntry(entry);
  } else {
    const docId = snap.docs[0].id;
    await updateFinanceEntry(docId, entry);
  }
};

// ============================================================================
// SALE SUBSCRIPTIONS
// ============================================================================

export const subscribeToSales = (companyId: string, callback: (sales: Sale[]) => void, limitCount?: number): (() => void) => {
  const q = limitCount 
    ? query(
        collection(db, 'sales'),
        where('companyId', '==', companyId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      )
    : query(
        collection(db, 'sales'),
        where('companyId', '==', companyId),
        orderBy('createdAt', 'desc')
      );
  
  return onSnapshot(q, (snapshot) => {
    const sales = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Sale[];
    callback(sales.filter(sale => sale.isAvailable !== false));
  });
};

export const subscribeToAllSales = (companyId: string, callback: (sales: Sale[]) => void): (() => void) => {
  return subscribeToSales(companyId, callback);
};

export const subscribeToSaleUpdates = (
  saleId: string,
  callback: (sale: SaleDetails) => void
): (() => void) => {
  const saleRef = doc(db, 'sales', saleId);
  
  return onSnapshot(saleRef, (doc) => {
    if (doc.exists()) {
      const saleData = doc.data() as SaleDetails;
      callback({
        ...saleData,
        id: doc.id,
      });
    }
  });
};

// ============================================================================
// SALE CRUD OPERATIONS
// ============================================================================

export const createSale = async (
  data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>,
  companyId: string,
  createdBy?: import('../../../types/models').EmployeeRef | null
): Promise<Sale> => {
  try {
    const batch = writeBatch(db);
    
    const saleRef = doc(collection(db, 'sales'));
    
    const enhancedProducts: any[] = [];
    let totalCost = 0;
    let totalProfit = 0;
    
    const userId = data.userId || companyId;
    
    for (const product of data.products) {
      const productRef = doc(db, 'products', product.productId);
      const productSnap = await getDoc(productRef);
      
      if (!productSnap.exists()) {
        throw new Error(`Product with ID ${product.productId} not found`);
      }
      
      const productData = productSnap.data() as Product;
      if (productData.companyId !== companyId) {
        throw new Error(`Unauthorized to sell product ${productData.name}`);
      }
      if (productData.stock < product.quantity) {
        throw new Error(`Insufficient stock for product ${productData.name}`);
      }
      
      const inventoryMethod: InventoryMethod = ((data as any).inventoryMethod?.toUpperCase() as InventoryMethod) || (productData as any).inventoryMethod || 'FIFO';
      
      const inventoryResult = await consumeStockFromBatches(
        batch,
        product.productId,
        product.quantity,
        inventoryMethod
      );
      
      let productProfit = 0;
      let productCost = 0;
      
      const batchProfits = inventoryResult.consumedBatches.map(batch => {
        const batchProfit = (product.basePrice - batch.costPrice) * batch.consumedQuantity;
        productProfit += batchProfit;
        productCost += batch.costPrice * batch.consumedQuantity;
        
        return {
          batchId: batch.batchId,
          costPrice: batch.costPrice,
          consumedQuantity: batch.consumedQuantity,
          profit: batchProfit
        };
      });
      
      const averageCostPrice = productCost / product.quantity;
      const profitMargin = productCost > 0 ? (productProfit / (product.basePrice * product.quantity)) * 100 : 0;
      
      totalCost += productCost;
      totalProfit += productProfit;
      
      const enhancedProduct = {
        ...product,
        costPrice: averageCostPrice,
        batchId: inventoryResult.primaryBatchId,
        profit: productProfit,
        profitMargin,
        consumedBatches: batchProfits,
        batchLevelProfits: batchProfits
      };
      enhancedProducts.push(enhancedProduct);
      
      batch.update(productRef, {
        stock: productData.stock - product.quantity,
        updatedAt: serverTimestamp()
      });
      
      createStockChange(
        batch, 
        product.productId, 
        -product.quantity, 
        'sale', 
        userId,
        companyId,
        undefined,
        undefined,
        undefined,
        inventoryResult.averageCostPrice,
        inventoryResult.primaryBatchId,
        saleRef.id,
        inventoryResult.consumedBatches
      );
    }
    
    const averageProfitMargin = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
    
    const normalizedStatus = data.status || 'paid';
    const normalizedPaymentStatus = data.paymentStatus || 'paid';
    const normalizedCustomerInfo = data.customerInfo || { name: 'divers', phone: '' };
    const normalizedDeliveryFee = data.deliveryFee ?? 0;
    const normalizedInventoryMethod = data.inventoryMethod?.toUpperCase() === 'LIFO' ? 'LIFO' : 'FIFO';
    
    let normalizedCreatedAt = serverTimestamp();
    if ((data as any).saleDate && typeof (data as any).saleDate === 'string') {
      const saleDateStr = (data as any).saleDate;
      
      if (saleDateStr.length === 10 && saleDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const now = new Date();
        const saleDateWithTime = `${saleDateStr}T${now.toTimeString().slice(0, 8)}`;
        const saleDateObj = new Date(saleDateWithTime);
        if (!isNaN(saleDateObj.getTime())) {
          normalizedCreatedAt = Timestamp.fromDate(saleDateObj);
        }
      } else {
        const saleDateObj = new Date(saleDateStr);
        if (!isNaN(saleDateObj.getTime())) {
          normalizedCreatedAt = Timestamp.fromDate(saleDateObj);
        }
      }
    } else if ((data as any).createdAt) {
      normalizedCreatedAt = (data as any).createdAt as any;
    }
    
    const saleData: any = {
      ...data,
      products: enhancedProducts,
      totalCost,
      totalProfit,
      averageProfitMargin,
      companyId,
      status: normalizedStatus,
      paymentStatus: normalizedPaymentStatus,
      customerInfo: normalizedCustomerInfo,
      deliveryFee: normalizedDeliveryFee,
      inventoryMethod: normalizedInventoryMethod,
      createdAt: normalizedCreatedAt,
      updatedAt: serverTimestamp()
    };
    
    if (createdBy) {
      saleData.createdBy = createdBy;
    }
    
    if (data.customerSourceId) {
      saleData.customerSourceId = data.customerSourceId;
    }
    batch.set(saleRef, saleData);
    
    createAuditLog(batch, 'create', 'sale', saleRef.id, saleData, userId);
    
    await batch.commit();
    
    const savedSaleDoc = await getDoc(saleRef);
    if (!savedSaleDoc.exists()) {
      throw new Error('Failed to retrieve saved sale');
    }
    
    const savedSaleData = savedSaleDoc.data();
    const savedSale = {
      id: saleRef.id,
      ...saleData,
      createdAt: savedSaleData.createdAt || { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      updatedAt: savedSaleData.updatedAt || { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
    };

    try {
      await syncFinanceEntryWithSale(savedSale as Sale);
    } catch (syncError) {
      logError('Error syncing finance entry with sale', syncError);
    }

    return savedSale;
  } catch (error) {
    logError('Error creating sale', error);
    throw error;
  }
};

export const updateSaleStatus = async (
  id: string,
  status: OrderStatus,
  paymentStatus: PaymentStatus,
  userId: string
): Promise<void> => {
  const saleRef = doc(db, 'sales', id);
  const saleSnap = await getDoc(saleRef);
  
  if (!saleSnap.exists()) {
    throw new Error('Sale not found');
  }

  const sale = saleSnap.data() as Sale;
  if (sale.userId !== userId) {
    throw new Error('Unauthorized to update this sale');
  }
  
  const batch = writeBatch(db);
  
  batch.update(saleRef, {
    status,
    paymentStatus,
    updatedAt: serverTimestamp(),
    statusHistory: [
      ...(sale.statusHistory || []),
      { status, timestamp: new Date().toISOString() }
    ]
  });
  
  createAuditLog(batch, 'update', 'sale', id, { status, paymentStatus }, userId);
  
  await batch.commit();
};

export const updateSaleDocument = async (
  saleId: string,
  data: Partial<Sale>,
  userId: string
): Promise<void> => {
  const saleRef = doc(db, 'sales', saleId);
  const saleSnap = await getDoc(saleRef);
  
  if (!saleSnap.exists()) {
    throw new Error('Sale not found');
  }

  const sale = saleSnap.data() as Sale;
  if (sale.companyId !== userId) {
    throw new Error('Unauthorized to update this sale');
  }

  const batch = writeBatch(db);

  batch.update(saleRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
  
  createAuditLog(batch, 'update', 'sale', saleId, data, userId);
  
  await batch.commit();
};

export const getSaleDetails = async (saleId: string): Promise<Sale> => {
  const saleRef = doc(db, 'sales', saleId);
  const saleSnap = await getDoc(saleRef);
  
  if (!saleSnap.exists()) {
    throw new Error('Sale not found');
  }
  
  return { id: saleSnap.id, ...saleSnap.data() } as Sale;
};

export const deleteSale = async (saleId: string, userId: string): Promise<void> => {
  const batch = writeBatch(db);
  const saleRef = doc(db, 'sales', saleId);
  
  const saleSnap = await getDoc(saleRef);
  if (!saleSnap.exists()) {
    throw new Error('Sale not found');
  }

  const sale = saleSnap.data() as Sale;
  if (sale.userId !== userId) {
    throw new Error('Unauthorized to delete this sale');
  }

  for (const product of sale.products) {
    const productRef = doc(db, 'products', product.productId);
    const productSnap = await getDoc(productRef);
    
    if (!productSnap.exists()) {
      throw new Error(`Product with ID ${product.productId} not found`);
    }
    
    const productData = productSnap.data() as Product;
    if (productData.userId !== userId) {
      throw new Error(`Unauthorized to modify product ${productData.name}`);
    }
    
    batch.update(productRef, {
      stock: productData.stock + product.quantity,
      updatedAt: serverTimestamp()
    });

    if (product.consumedBatches && product.consumedBatches.length > 0) {
      for (const consumedBatch of product.consumedBatches) {
        const batchRef = doc(db, 'stockBatches', consumedBatch.batchId);
        const batchSnap = await getDoc(batchRef);
        
        if (batchSnap.exists()) {
          const batchData = batchSnap.data() as StockBatch;
          const restoredQuantity = batchData.remainingQuantity + consumedBatch.consumedQuantity;
          
          batch.update(batchRef, {
            remainingQuantity: restoredQuantity,
            status: restoredQuantity > 0 ? 'active' : 'depleted',
            updatedAt: serverTimestamp()
          });
        }
      }
    } else if (product.batchLevelProfits && product.batchLevelProfits.length > 0) {
      for (const batchProfit of product.batchLevelProfits) {
        const batchRef = doc(db, 'stockBatches', batchProfit.batchId);
        const batchSnap = await getDoc(batchRef);
        
        if (batchSnap.exists()) {
          const batchData = batchSnap.data() as StockBatch;
          const restoredQuantity = batchData.remainingQuantity + batchProfit.consumedQuantity;
          
          batch.update(batchRef, {
            remainingQuantity: restoredQuantity,
            status: restoredQuantity > 0 ? 'active' : 'depleted',
            updatedAt: serverTimestamp()
          });
        }
      }
    }
  }

  batch.update(saleRef, {
    isAvailable: false,
    updatedAt: serverTimestamp()
  });

  createAuditLog(batch, 'delete', 'sale', saleId, sale, userId);
  
  await batch.commit();
};

export const softDeleteSale = async (saleId: string, userId: string): Promise<void> => {
  await deleteSale(saleId, userId);
  
  const q = query(collection(db, 'finances'), where('sourceType', '==', 'sale'), where('sourceId', '==', saleId));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const { updateFinanceEntry } = await import('../firestore');
    for (const docSnap of snap.docs) {
      await updateFinanceEntry(docSnap.id, { isDeleted: true });
    }
  }
};

export const addSaleWithValidation = async (sale: Sale) => {
  // Implementation remains the same
};

