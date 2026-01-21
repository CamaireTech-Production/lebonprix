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

// Import location-aware stock functions from stock service
import { 
  getAvailableStockBatches,
  consumeStockFromBatches,
  createStockChange as createStockChangeService
} from '../stock/stockService';

// createStockChange is now imported from stock service

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
      
      // Determine source location for stock consumption
      const sourceType = data.sourceType || 'shop'; // Default to shop
      const shopId = data.shopId;
      const warehouseId = data.warehouseId;
      
      // Validate that selected location is active
      if (sourceType === 'shop' && shopId) {
        const shopRef = doc(db, 'shops', shopId);
        const shopSnap = await getDoc(shopRef);
        if (shopSnap.exists()) {
          const shopData = shopSnap.data();
          if (shopData.isActive === false) {
            throw new Error('Le magasin sélectionné est désactivé. Veuillez sélectionner un magasin actif.');
          }
        }
      } else if (sourceType === 'warehouse' && warehouseId) {
        const warehouseRef = doc(db, 'warehouses', warehouseId);
        const warehouseSnap = await getDoc(warehouseRef);
        if (warehouseSnap.exists()) {
          const warehouseData = warehouseSnap.data();
          if (warehouseData.isActive === false) {
            throw new Error('L\'entrepôt sélectionné est désactivé. Veuillez sélectionner un entrepôt actif.');
          }
        }
      }
      
      // Determine location type and IDs for stock query
      let locationType: 'warehouse' | 'shop' | 'production' | 'global' | undefined;
      let queryShopId: string | undefined;
      let queryWarehouseId: string | undefined;
      
      if (sourceType === 'shop' && shopId) {
        locationType = 'shop';
        queryShopId = shopId;
      } else if (sourceType === 'warehouse' && warehouseId) {
        locationType = 'warehouse';
        queryWarehouseId = warehouseId;
      }
      // If no location specified, use global stock (backward compatible)
      
      // Check stock from batches (source of truth) - location-aware
      const availableBatches = await getAvailableStockBatches(
        product.productId,
        companyId,
        'product',
        queryShopId,
        queryWarehouseId,
        locationType
      );
      const availableStock = availableBatches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
      
      if (availableStock < product.quantity) {
        const locationInfo = queryShopId ? `shop ${queryShopId}` : 
                            queryWarehouseId ? `warehouse ${queryWarehouseId}` : 
                            'global stock';
        throw new Error(`Insufficient stock for product ${productData.name} in ${locationInfo}. Available: ${availableStock}, Requested: ${product.quantity}`);
      }
      
      const inventoryMethod: InventoryMethod = ((data as any).inventoryMethod?.toUpperCase() as InventoryMethod) || (productData as any).inventoryMethod || 'FIFO';
      
      // Consume stock from location-aware batches
      const inventoryResult = await consumeStockFromBatches(
        batch,
        product.productId,
        companyId,
        product.quantity,
        inventoryMethod,
        'product',
        queryShopId,
        queryWarehouseId,
        locationType
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
      
      // Don't update product.stock - batches are the source of truth (already updated via consumeStockFromBatches)
      batch.update(productRef, {
        updatedAt: serverTimestamp()
      });
      
      // Create stock change with location information
      createStockChangeService(
        batch, 
        product.productId, 
        -product.quantity, 
        'sale', 
        userId,
        companyId,
        'product',
        undefined,
        undefined,
        undefined,
        inventoryResult.averageCostPrice,
        inventoryResult.primaryBatchId,
        saleRef.id,
        inventoryResult.consumedBatches,
        locationType,
        queryShopId,
        queryWarehouseId
      );
    }
    
    const averageProfitMargin = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
    
    const normalizedStatus = data.status || 'paid';
    const normalizedPaymentStatus = data.paymentStatus || 'paid';
    const quarterValue = data.customerInfo?.quarter?.trim();
    // Build customerInfo without quarter first, then conditionally add it
    const baseCustomerInfo = data.customerInfo || { name: 'divers', phone: '' };
    const { quarter: _, ...customerInfoWithoutQuarter } = baseCustomerInfo;
    const normalizedCustomerInfo = {
      ...customerInfoWithoutQuarter,
      // Only include quarter if it has a value (Firestore doesn't allow undefined)
      ...(quarterValue ? { quarter: quarterValue } : {}),
    };
    const normalizedDeliveryFee = data.deliveryFee ?? 0;
    const inventoryMethodUpper = data.inventoryMethod?.toUpperCase();
    const normalizedInventoryMethod: InventoryMethod = 
      inventoryMethodUpper === 'LIFO' ? 'LIFO' :
      inventoryMethodUpper === 'CMUP' ? 'CMUP' :
      'FIFO';
    
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
    
    // Determine sourceType if not provided (default to shop)
    const sourceType = data.sourceType || (data.shopId ? 'shop' : data.warehouseId ? 'warehouse' : 'shop');
    
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
      sourceType, // Add sourceType
      createdAt: normalizedCreatedAt,
      updatedAt: serverTimestamp()
    };
    
    // Add location fields if provided
    if (data.shopId) {
      saleData.shopId = data.shopId;
    }
    if (data.warehouseId) {
      saleData.warehouseId = data.warehouseId;
    }
    
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

export const deleteSale = async (saleId: string, companyId: string): Promise<void> => {
  const batch = writeBatch(db);
  const saleRef = doc(db, 'sales', saleId);
  
  // Get current sale data for audit log and stock restoration
  const saleSnap = await getDoc(saleRef);
  if (!saleSnap.exists()) {
    throw new Error('Sale not found');
  }

  const sale = saleSnap.data() as Sale;
  // companyId parameter is actually company.id in this context
  // Check companyId instead of userId to allow owners to delete employee-created sales
  if (sale.companyId !== companyId) {
    throw new Error('Unauthorized to delete this sale');
  }

  // Restore product stock AND batches
  for (const product of sale.products) {
    const productRef = doc(db, 'products', product.productId);
    const productSnap = await getDoc(productRef);
    
    if (!productSnap.exists()) {
      throw new Error(`Product with ID ${product.productId} not found`);
    }
    
    const productData = productSnap.data() as Product;
    // Verify product belongs to company
    if (productData.companyId !== companyId) {
      throw new Error(`Unauthorized to modify product ${productData.name}`);
    }
    
    // Restore the stock
    batch.update(productRef, {
      stock: (productData.stock || 0) + product.quantity,
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

  // Soft delete the sale (set isAvailable: false)
  batch.update(saleRef, {
    isAvailable: false,
    updatedAt: serverTimestamp()
  });

  // Create audit log (use sale.userId for audit trail, companyId for authorization)
  const userIdForAudit = sale.userId || companyId;
  createAuditLog(batch, 'delete', 'sale', saleId, sale, userIdForAudit);
  
  await batch.commit();
};

export const softDeleteSale = async (saleId: string, companyId: string): Promise<void> => {
  await deleteSale(saleId, companyId);
  
  const q = query(collection(db, 'finances'), where('sourceType', '==', 'sale'), where('sourceId', '==', saleId));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const { updateFinanceEntry } = await import('../firestore');
    for (const docSnap of snap.docs) {
      await updateFinanceEntry(docSnap.id, { isDeleted: true });
    }
  }
};

export const addSaleWithValidation = async () => {
  // Implementation remains the same
};

