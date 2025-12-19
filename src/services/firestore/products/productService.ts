// Product service - extracted from firestore.ts
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
  type WriteBatch
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError } from '@utils/core/logger';
import type { Product, Sale } from '../../../types/models';
import { createAuditLog } from '../shared';
import { updateCategoryProductCount } from '../categories/categoryService';

// Import createStockChange from firestore.ts temporarily (will be moved to stock/ later)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createStockChange = (batch: WriteBatch, productId: string, change: number, reason: any, userId: string, companyId: string, supplierId?: string, isOwnPurchase?: boolean, isCredit?: boolean, costPrice?: number, batchId?: string) => {
  const stockChangeRef = doc(collection(db, 'stockChanges'));
  const stockChangeData: any = {
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
  
  batch.set(stockChangeRef, stockChangeData);
  return stockChangeRef.id;
};

// ============================================================================
// PRODUCT SUBSCRIPTIONS
// ============================================================================

export const subscribeToProducts = (companyId: string, callback: (products: Product[]) => void): (() => void) => {
  const q = query(
    collection(db, 'products'),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Product[];
    callback(products.filter(product => 
      product.isAvailable !== false && product.isDeleted !== true
    ));
  });
};

// ============================================================================
// PRODUCT CRUD OPERATIONS
// ============================================================================

export const createProduct = async (
  data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>,
  companyId: string,
  supplierInfo?: {
    supplierId?: string;
    isOwnPurchase?: boolean;
    isCredit?: boolean;
    costPrice?: number;
  },
  createdBy?: import('../../../types/models').EmployeeRef | null
): Promise<Product> => {
  try {
    // Validate product data
    if (
      !data.name ||
      data.sellingPrice < 0 ||
      data.stock < 0
    ) {
      throw new Error('Invalid product data');
    }

    const batch = writeBatch(db);
    
    // Create product document first to get the ID for barcode generation
    const productRef = doc(collection(db, 'products'));
    const productId = productRef.id;
    
    // Generate barcode automatically if not provided
    let barCode = data.barCode;
    if (!barCode) {
      const { generateEAN13 } = await import('@services/utilities/barcodeService');
      barCode = generateEAN13(productId);
    }
    
    // Set default inventory settings
    const productData: any = {
      ...data,
      barCode,
      companyId,
      isAvailable: true,
      inventoryMethod: (data as any).inventoryMethod || 'FIFO',
      enableBatchTracking: (data as any).enableBatchTracking !== false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Add createdBy if provided
    if (createdBy) {
      productData.createdBy = createdBy;
    }
    
    // Get userId from data if available, otherwise use companyId for audit
    const userId = data.userId || companyId;
    
    // Set product data
    batch.set(productRef, productData);
    
    // Add initial stock change and create stock batch if stock > 0
    if (data.stock > 0) {
      if (supplierInfo?.costPrice) {
        const stockBatchRef = doc(collection(db, 'stockBatches'));
        const stockBatchData = {
          id: stockBatchRef.id,
          productId: productRef.id,
          quantity: data.stock,
          costPrice: supplierInfo.costPrice,
          ...(supplierInfo.supplierId && { supplierId: supplierInfo.supplierId }),
          ...(supplierInfo.isOwnPurchase !== undefined && { isOwnPurchase: supplierInfo.isOwnPurchase }),
          ...(supplierInfo.isCredit !== undefined && { isCredit: supplierInfo.isCredit }),
          createdAt: serverTimestamp(),
          userId,
          companyId,
          remainingQuantity: data.stock,
          status: 'active'
        };
        batch.set(stockBatchRef, stockBatchData);
        
        // Create stock change with batch reference
        createStockChange(
          batch,
          productRef.id,
          data.stock,
          'creation',
          userId,
          companyId,
          supplierInfo.supplierId,
          supplierInfo.isOwnPurchase,
          supplierInfo.isCredit,
          supplierInfo.costPrice,
          stockBatchRef.id
        );
        
        // Create supplier debt if credit purchase
        if (supplierInfo.supplierId && supplierInfo.isCredit === true && supplierInfo.isOwnPurchase === false) {
          const debtAmount = data.stock * supplierInfo.costPrice;
          const debtRef = doc(collection(db, 'finances'));
          const debtData = {
            id: debtRef.id,
            userId,
            companyId,
            sourceType: 'supplier',
            sourceId: supplierInfo.supplierId,
            type: 'supplier_debt',
            amount: debtAmount,
            description: `Initial stock purchase for ${data.name} (${data.stock} units)`,
            date: serverTimestamp(),
            isDeleted: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            supplierId: supplierInfo.supplierId,
            batchId: stockBatchRef.id
          };
          batch.set(debtRef, debtData);
        }
      } else {
        // Create stock change without batch (legacy mode)
        createStockChange(
          batch, 
          productRef.id, 
          data.stock, 
          'creation', 
          userId,
          companyId,
          supplierInfo?.supplierId,
          supplierInfo?.isOwnPurchase,
          supplierInfo?.isCredit,
          supplierInfo?.costPrice
        );
      }
    }

    // Create audit log
    createAuditLog(batch, 'create', 'product', productRef.id, productData, userId);
    
    try {
      await batch.commit();
    } catch (error) {
      logError('Batch commit failed', error);
      throw error;
    }
    
    // Update category product count after successful product creation
    if (data.category) {
      try {
        await updateCategoryProductCount(data.category, companyId, true);
      } catch (error) {
        logError('Error updating category product count', error);
      }
    }
    
    return {
      id: productRef.id,
      ...productData,
      createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
      updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
    };
  } catch (error) {
    logError('Error creating product', error);
    throw error;
  }
};

export const updateProduct = async (
  id: string,
  data: Partial<Product>,
  companyId: string,
  stockReason?: 'sale' | 'restock' | 'adjustment' | 'creation' | 'cost_correction',
  stockChange?: number,
  supplierInfo?: {
    supplierId?: string;
    isOwnPurchase?: boolean;
    isCredit?: boolean;
    costPrice?: number;
  }
): Promise<void> => {
  try {
    const batch = writeBatch(db);
    const productRef = doc(db, 'products', id);
    
    // Get current product data
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) {
      throw new Error('Product not found');
    }
    
    const currentProduct = productSnap.data() as Product;
    if (currentProduct.companyId !== companyId) {
      throw new Error('Unauthorized: Product belongs to different company');
    }
    
    const userId = currentProduct.userId || companyId;
    const updateFields: any = {};
    let newStock: number | undefined;
    
    // Handle stock changes
    if (stockChange !== undefined && stockReason) {
      newStock = currentProduct.stock + stockChange;
      
      if (newStock < 0) {
        throw new Error('Stock cannot be negative');
      }
      
      updateFields.stock = newStock;
      
      // Handle stock batch creation for restock
      if (stockChange > 0 && stockReason === 'restock' && supplierInfo?.costPrice) {
        const stockBatchRef = doc(collection(db, 'stockBatches'));
        const stockBatchData = {
          id: stockBatchRef.id,
          productId: id,
          quantity: stockChange,
          costPrice: supplierInfo.costPrice,
          ...(supplierInfo.supplierId && { supplierId: supplierInfo.supplierId }),
          ...(supplierInfo.isOwnPurchase !== undefined && { isOwnPurchase: supplierInfo.isOwnPurchase }),
          ...(supplierInfo.isCredit !== undefined && { isCredit: supplierInfo.isCredit }),
          createdAt: serverTimestamp(),
          userId,
          companyId,
          remainingQuantity: stockChange,
          status: 'active'
        };
        batch.set(stockBatchRef, stockBatchData);
        
        // Create stock change with batch reference
        createStockChange(
          batch,
          id,
          stockChange,
          stockReason,
          userId,
          companyId,
          supplierInfo.supplierId,
          supplierInfo.isOwnPurchase,
          supplierInfo.isCredit,
          supplierInfo.costPrice,
          stockBatchRef.id
        );
        
        // Create supplier debt if credit purchase
        if (supplierInfo.supplierId && supplierInfo.isCredit && !supplierInfo.isOwnPurchase) {
          const debtAmount = stockChange * supplierInfo.costPrice;
          const debtRef = doc(collection(db, 'finances'));
          const debtData = {
            id: debtRef.id,
            userId,
            companyId,
            sourceType: 'supplier',
            sourceId: supplierInfo.supplierId,
            type: 'supplier_debt',
            amount: debtAmount,
            description: `Credit purchase for ${stockChange} units of product ${currentProduct.name}`,
            date: serverTimestamp(),
            isDeleted: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            supplierId: supplierInfo.supplierId,
            batchId: stockBatchRef.id
          };
          batch.set(debtRef, debtData);
        }
      } else {
        // Create stock change without batch
        createStockChange(
          batch,
          id,
          stockChange,
          stockReason,
          userId,
          companyId,
          supplierInfo?.supplierId,
          supplierInfo?.isOwnPurchase,
          supplierInfo?.isCredit,
          supplierInfo?.costPrice
        );
      }
    }
    
    // Merge other product data
    if (Object.keys(data).length > 0) {
      const { stock: _, ...dataWithoutStock } = data;
      Object.assign(updateFields, stockChange !== undefined ? dataWithoutStock : data);
    }
    
    updateFields.updatedAt = serverTimestamp();
    
    if (Object.keys(updateFields).length > 0) {
      batch.update(productRef, updateFields);
    }
    
    createAuditLog(batch, 'update', 'product', id, { ...data, stockChange, stockReason }, userId);
    
    await batch.commit();
    
    // Update category product counts if category changed
    if (data.category && data.category !== currentProduct.category) {
      try {
        if (currentProduct.category) {
          await updateCategoryProductCount(currentProduct.category, companyId, false);
        }
        if (data.category) {
          await updateCategoryProductCount(data.category, companyId, true);
        }
      } catch (error) {
        logError('Error updating category product counts', error);
      }
    }
    
    // Update category product counts if visibility changed
    if (data.isVisible !== undefined && data.isVisible !== currentProduct.isVisible) {
      try {
        const categoryName = data.category || currentProduct.category;
        if (categoryName) {
          const shouldIncrement = data.isVisible !== false;
          await updateCategoryProductCount(categoryName, companyId, shouldIncrement);
        }
      } catch (error) {
        logError('Error updating category product count for visibility change', error);
      }
    }
  } catch (error) {
    logError('Error updating product', error);
    throw error;
  }
};

export const softDeleteProduct = async (id: string, userId: string): Promise<void> => {
  try {
    const productRef = doc(db, 'products', id);
    const productSnap = await getDoc(productRef);
    
    if (!productSnap.exists()) {
      throw new Error('Product not found');
    }
    
    const currentProduct = productSnap.data() as Product;
    if (currentProduct.userId !== userId) {
      throw new Error('Unauthorized to delete this product');
    }
    
    const batch = writeBatch(db);
    
    batch.update(productRef, {
      isDeleted: true,
      updatedAt: serverTimestamp()
    });
    
    createAuditLog(batch, 'delete', 'product', id, { isDeleted: true }, userId);
    
    await batch.commit();
    
    // Update category product count
    if (currentProduct.category) {
      try {
        await updateCategoryProductCount(currentProduct.category, currentProduct.companyId, false);
      } catch (error) {
        logError('Error updating category product count after deletion', error);
      }
    }
  } catch (error) {
    logError('Error soft deleting product', error);
    throw error;
  }
};

// ============================================================================
// PRODUCT UTILITIES
// ============================================================================

export const getLowStockProducts = async (companyId: string, threshold?: number): Promise<Product[]> => {
  const q = query(
    collection(db, 'products'),
    where('companyId', '==', companyId),
    where('isAvailable', '==', true)
  );

  const snapshot = await getDocs(q);
  const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
  
  return products.filter(product => product.stock <= (threshold || 10));
};

export const getProductPerformance = async (companyId: string, productId: string): Promise<{
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  averagePrice: number;
}> => {
  const q = query(
    collection(db, 'sales'),
    where('companyId', '==', companyId),
    where('isAvailable', '!=', false)
  );

  const snapshot = await getDocs(q);
  const sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Sale[];
  
  let totalSales = 0;
  let totalRevenue = 0;
  let totalProfit = 0;
  let totalQuantity = 0;
  
  sales.forEach(sale => {
    sale.products.forEach(product => {
      if (product.productId === productId) {
        totalSales += product.quantity;
        totalRevenue += product.basePrice * product.quantity;
        totalProfit += product.profit || 0;
        totalQuantity += product.quantity;
      }
    });
  });

  return {
    totalSales,
    totalRevenue,
    totalProfit,
    averagePrice: totalQuantity > 0 ? totalRevenue / totalQuantity : 0
  };
};

