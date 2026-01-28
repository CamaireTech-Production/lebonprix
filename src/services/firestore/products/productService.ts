// Product service - extracted from firestore.ts
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
  type WriteBatch
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError } from '@utils/core/logger';
import { trackRead } from '@utils/firestore/readTracker';
import type { Product, Sale } from '../../../types/models';
import { createAuditLog } from '../shared';
import { updateCategoryProductCount } from '../categories/categoryService';
import { addSupplierDebt } from '../suppliers/supplierDebtService';

// Import createStockChange from firestore.ts temporarily (will be moved to stock/ later)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createStockChange = (batch: WriteBatch, productId: string, change: number, reason: any, userId: string, companyId: string, supplierId?: string, isOwnPurchase?: boolean, isCredit?: boolean, costPrice?: number, batchId?: string) => {
  const stockChangeRef = doc(collection(db, 'stockChanges'));
  const stockChangeData: any = {
    type: 'product' as const, // Always product for product stock changes
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

export const subscribeToProducts = (companyId: string, callback: (products: Product[]) => void, limitCount?: number): (() => void) => {
  const defaultLimit = 100; // OPTIMIZATION: Default limit to reduce Firebase reads
  const appliedLimit = limitCount || defaultLimit;
  const q = query(
    collection(db, 'products'),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc'),
    limit(appliedLimit)
  );

  // Track the subscription
  trackRead('products', 'onSnapshot', undefined, appliedLimit);

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
  createdBy?: import('../../../types/models').EmployeeRef | null,
  locationInfo?: {
    locationType?: 'warehouse' | 'shop' | 'production' | 'global';
    warehouseId?: string;
    shopId?: string;
    productionId?: string;
  }
): Promise<Product> => {
  try {
    // Validate product data
    if (
      !data.name ||
      data.sellingPrice < 0 ||
      (data.stock !== undefined && data.stock < 0)
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
    // Remove stock field - batches are the source of truth
    const { stock, ...dataWithoutStock } = data;

    // Filter out undefined values (Firestore doesn't accept undefined)
    const cleanData: any = {};
    Object.keys(dataWithoutStock).forEach(key => {
      const value = (dataWithoutStock as any)[key];
      if (value !== undefined) {
        cleanData[key] = value;
      }
    });

    const productData: any = {
      ...cleanData,
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

    // Add initial stock change and create stock batch if initial stock provided
    const initialStock = stock || 0;
    // Declare stockBatchRef in outer scope so it's accessible after batch commit
    let stockBatchRef: ReturnType<typeof doc> | null = null;

    if (initialStock > 0) {
      if (supplierInfo?.costPrice !== undefined) {
        stockBatchRef = doc(collection(db, 'stockBatches'));
        const stockBatchData: any = {
          id: stockBatchRef.id,
          type: 'product' as const, // Always product for product batches
          productId: productRef.id,
          quantity: initialStock,
          costPrice: supplierInfo.costPrice,
          ...(supplierInfo.supplierId && { supplierId: supplierInfo.supplierId }),
          ...(supplierInfo.isOwnPurchase !== undefined && { isOwnPurchase: supplierInfo.isOwnPurchase }),
          ...(supplierInfo.isCredit !== undefined && { isCredit: supplierInfo.isCredit }),
          createdAt: serverTimestamp(),
          userId,
          companyId,
          remainingQuantity: initialStock,
          status: 'active'
        };

        // Add location information if provided
        if (locationInfo) {
          if (locationInfo.locationType) {
            stockBatchData.locationType = locationInfo.locationType;
          }
          if (locationInfo.warehouseId) {
            stockBatchData.warehouseId = locationInfo.warehouseId;
          }
          if (locationInfo.shopId) {
            stockBatchData.shopId = locationInfo.shopId;
          }
          if (locationInfo.productionId) {
            stockBatchData.productionId = locationInfo.productionId;
          }
        }

        batch.set(stockBatchRef, stockBatchData);

        // Create stock change with batch reference
        createStockChange(
          batch,
          productRef.id,
          initialStock,
          'creation',
          userId,
          companyId,
          'product',
          supplierInfo.supplierId,
          supplierInfo.isOwnPurchase,
          supplierInfo.isCredit,
          supplierInfo.costPrice,
          stockBatchRef.id,
          undefined,
          undefined,
          locationInfo?.locationType,
          locationInfo?.shopId,
          locationInfo?.warehouseId
        );

        // Note: Supplier debt will be created after batch commit (see below)
      } else {
        // Create stock change without batch (should not happen, but keep for safety)
        createStockChange(
          batch,
          productRef.id,
          initialStock,
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

    // Create supplier debt if credit purchase (after batch commit)
    if (supplierInfo?.supplierId && supplierInfo.isCredit === true && supplierInfo.isOwnPurchase === false && stockBatchRef) {
      try {
        const debtAmount = initialStock * (supplierInfo.costPrice || 0);
        await addSupplierDebt(
          supplierInfo.supplierId,
          debtAmount,
          `Initial stock purchase for ${data.name} (${initialStock} units)`,
          companyId,
          stockBatchRef.id
        );
      } catch (error) {
        logError('Error creating supplier debt after product creation', error);
        // Don't throw - product was created successfully, debt can be fixed manually
      }
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

    // Handle stock changes (batches are source of truth, don't update product.stock)
    if (stockChange !== undefined && stockReason) {
      // Validate stock change doesn't make stock negative (check batches)
      if (stockChange < 0) {
        const { getProductStockBatches } = await import('../stock/stockService');
        const productDoc = await getDoc(doc(db, 'products', id));
        const productData = productDoc.data() as Product;
        if (!productData?.companyId) {
          throw new Error('Product companyId not found');
        }
        const batches = await getProductStockBatches(id, productData.companyId);
        const currentStock = batches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
        if (currentStock + stockChange < 0) {
          throw new Error('Stock cannot be negative');
        }
      }

      // Handle stock batch creation for restock
      if (stockChange > 0 && stockReason === 'restock' && supplierInfo?.costPrice !== undefined) {
        const stockBatchRef = doc(collection(db, 'stockBatches'));
        const stockBatchData = {
          id: stockBatchRef.id,
          type: 'product' as const, // Always product for product batches
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
  // OPTIMIZATION: Added limit to reduce Firebase reads
  // Note: This function checks stock for all products, so we limit to active products
  const defaultLimit = 200; // OPTIMIZATION: Default limit to reduce Firebase reads
  const q = query(
    collection(db, 'products'),
    where('companyId', '==', companyId),
    where('isAvailable', '==', true),
    limit(defaultLimit)
  );

  const snapshot = await getDocs(q);
  const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];

  // Calculate stock from batches for each product
  const { getProductStockBatches } = await import('../stock/stockService');
  const productsWithStock = await Promise.all(
    products.map(async (product) => {
      const batches = await getProductStockBatches(product.id, companyId);
      const stock = batches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
      return { product, stock };
    })
  );

  const stockThreshold = threshold || 10;
  return productsWithStock
    .filter(({ stock }) => stock <= stockThreshold)
    .map(({ product }) => product);
};

export const getProductPerformance = async (companyId: string, productId: string): Promise<{
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  averagePrice: number;
}> => {
  // OPTIMIZATION: Added limit to reduce Firebase reads
  // Note: This function analyzes sales for a specific product, so we limit to recent sales
  const defaultLimit = 500; // OPTIMIZATION: Limit to 500 most recent sales for performance analysis
  const q = query(
    collection(db, 'sales'),
    where('companyId', '==', companyId),
    where('isAvailable', '!=', false),
    orderBy('createdAt', 'desc'),
    limit(defaultLimit)
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

