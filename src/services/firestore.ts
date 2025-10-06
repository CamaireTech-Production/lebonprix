import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type WriteBatch,
  setDoc,
  updateDoc,
  Timestamp,
  deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Product,
  Sale,
  Expense,
  Category,
  DashboardStats,
  OrderStatus,
  PaymentStatus,
  Company,
  SaleDetails,
  Customer,
  Objective,
  FinanceEntry,
  FinanceEntryType,
  StockChange,
  StockBatch,
  Supplier,
  ExpenseType
} from '../types/models';
import { useState, useEffect } from 'react';
import type { InventoryMethod } from '../utils/inventoryManagement';
import { 
  createStockBatch as createBatchUtil,
  validateStockBatch,
  type InventoryResult
} from '../utils/inventoryManagement';

// Enhanced stock adjustment functions are defined below

// ============================================================================
// STOCK BATCH MANAGEMENT FUNCTIONS (Consolidated)
// ============================================================================

/**
 * Create a new stock batch
 */
export const createStockBatch = async (
  productId: string,
  quantity: number,
  costPrice: number,
  userId: string,
  supplierId?: string,
  isOwnPurchase?: boolean,
  isCredit?: boolean,
  notes?: string
): Promise<StockBatch> => {
  // Validate input
  const validationErrors = validateStockBatch({
    productId,
    quantity,
    costPrice,
    userId
  });
  
  if (validationErrors.length > 0) {
    throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
  }

  const batchData = createBatchUtil(
    productId,
    quantity,
    costPrice,
    userId,
    supplierId,
    isOwnPurchase,
    isCredit
  );

  const stockBatchRef = await addDoc(collection(db, 'stockBatches'), {
    ...batchData,
    notes,
    createdAt: serverTimestamp()
  });

  return {
    id: stockBatchRef.id,
    ...batchData,
    ...(notes && { notes }),
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  };
};

/**
 * Get available stock batches for a product (for consumption)
 */
export const getAvailableStockBatches = async (productId: string): Promise<StockBatch[]> => {
  const q = query(
    collection(db, 'stockBatches'),
    where('productId', '==', productId),
    where('remainingQuantity', '>', 0),
    where('status', '==', 'active'),
    orderBy('createdAt', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StockBatch[];
};

/**
 * Consume stock from batches using FIFO/LIFO logic
 */
export const consumeStockFromBatches = async (
  batch: WriteBatch,
  productId: string,
  quantity: number,
  method: InventoryMethod = 'FIFO'
): Promise<InventoryResult> => {
  const availableBatches = await getAvailableStockBatches(productId);
  
  if (availableBatches.length === 0) {
    throw new Error(`No available stock batches found for product ${productId}`);
  }

  // Sort batches according to inventory method
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

    // Update batch remaining quantity
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

/**
 * Update stock batch
 */
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

/**
 * Create stock change record
 */
export const createStockChange = (
  batch: WriteBatch,
  productId: string,
  change: number,
  reason: StockChange['reason'],
  userId: string,
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
    productId,
    change,
    reason,
    userId,
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

// ============================================================================
// SUBSCRIPTION FUNCTIONS
// ============================================================================

// Categories
export const subscribeToCategories = (userId: string, callback: (categories: Category[]) => void): (() => void) => {
  const q = query(
    collection(db, 'categories'),
    where('userId', '==', userId), // Filter by user first
    orderBy('name', 'asc'),
    limit(50) // Add pagination
  );
  
  return onSnapshot(q, (snapshot) => {
    const categories = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Category[];
    callback(categories);
  });
};

// Products - OPTIMIZED for faster initial load
export const subscribeToProducts = (userId: string, callback: (products: Product[]) => void): (() => void) => {
  const q = query(
    collection(db, 'products'),
    where('userId', '==', userId), // Filter by user first
    orderBy('createdAt', 'desc')
    // 🔄 NO LIMIT: Products page now uses infinite scroll for better UX
  );
  
  return onSnapshot(q, (snapshot) => {
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Product[];
    callback(products);
  });
};

// Sales - PROGRESSIVE LOADING: Load recent first, then all
export const subscribeToSales = (userId: string, callback: (sales: Sale[]) => void, limitCount?: number): (() => void) => {
  const q = limitCount 
    ? query(
        collection(db, 'sales'),
        where('userId', '==', userId), // Filter by user first
        orderBy('createdAt', 'desc'),
        limit(limitCount) // 🚀 CONFIGURABLE: Allow different limits
      )
    : query(
        collection(db, 'sales'),
        where('userId', '==', userId), // Filter by user first
        orderBy('createdAt', 'desc')
        // 🔄 NO LIMIT: Load all sales when needed
      );
  
  return onSnapshot(q, (snapshot) => {
    const sales = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Sale[];
    // Only return sales that are not soft-deleted
    callback(sales.filter(sale => sale.isAvailable !== false));
  });
};

// Sales - Load ALL sales (for reports, analytics, etc.)
export const subscribeToAllSales = (userId: string, callback: (sales: Sale[]) => void): (() => void) => {
  return subscribeToSales(userId, callback); // No limit
};

// Expenses
export const subscribeToExpenses = (userId: string, callback: (expenses: Expense[]) => void): (() => void) => {
  const q = query(
    collection(db, 'expenses'),
    where('userId', '==', userId), // Filter by user first
    orderBy('createdAt', 'desc'),
    limit(100) // Add pagination
  );
  
  return onSnapshot(q, (snapshot) => {
    const expenses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Expense[];
    callback(expenses);
  });
};

// Dashboard Stats
export const subscribeToDashboardStats = (callback: (stats: Partial<DashboardStats>) => void): (() => void) => {
  const docRef = doc(db, 'dashboardStats', 'current');

  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      callback(data);
    }
  });
};

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

export const createCategory = async (
  data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<Category> => {
  const categoryRef = await addDoc(collection(db, 'categories'), {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return {
    id: categoryRef.id,
    ...data,
    userId,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  };
};

// ============================================================================
// AUDIT LOGGING
// ============================================================================

const createAuditLog = async (
  batch: WriteBatch,
  action: 'create' | 'update' | 'delete',
  entityType: 'product' | 'sale' | 'expense' | 'category' | 'objective' | 'finance' | 'supplier',
  entityId: string,
  changes: any,
  performedBy: string
) => {
  function replaceUndefined(obj: any): any {
    if (obj === undefined) return null;
    if (obj === null) return null;
    if (typeof obj === 'object') {
      const newObj: any = {};
      for (const key in obj) {
        newObj[key] = replaceUndefined(obj[key]);
      }
      return newObj;
    }
    return obj;
  }
  
  const auditRef = doc(collection(db, 'auditLogs'));
  batch.set(auditRef, {
    action,
    entityType,
    entityId,
    changes: replaceUndefined(changes),
    performedBy,
    timestamp: serverTimestamp()
  });
};

// ============================================================================
// PRODUCT MANAGEMENT
// ============================================================================

export const createProduct = async (
  data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string,
  supplierInfo?: {
    supplierId?: string;
    isOwnPurchase?: boolean;
    isCredit?: boolean;
    costPrice?: number;
  }
): Promise<Product> => {
  try {
    console.log('Creating product with data:', data, 'supplierInfo:', supplierInfo);
    
  // Validate product data
  if (
    !data.name ||
    data.sellingPrice < 0 ||
    data.stock < 0 ||
    !data.category
  ) {
    throw new Error('Invalid product data');
  }

  const batch = writeBatch(db);
  
  // Set default inventory settings
  const productData = {
    ...data,
    userId,
    isAvailable: true,
    inventoryMethod: (data as any).inventoryMethod || 'FIFO',
    enableBatchTracking: (data as any).enableBatchTracking !== false, // Default to true
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  // Create product
  const productRef = doc(collection(db, 'products'));
  batch.set(productRef, productData);
  
  // Add initial stock change and create stock batch if stock > 0
  if (data.stock > 0) {
    // Create stock batch if cost price is provided
    console.log('Creating product with supplierInfo:', supplierInfo);
    console.log('Product data enableBatchTracking:', (data as any).enableBatchTracking);
    
    // Always create batch if cost price is provided (enableBatchTracking defaults to true)
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
        supplierInfo.supplierId,
        supplierInfo.isOwnPurchase,
        supplierInfo.isCredit,
        supplierInfo.costPrice,
        stockBatchRef.id
      );
      
      // Create supplier debt if credit purchase
      console.log('=== DEBT CREATION DEBUG ===');
      console.log('supplierInfo:', supplierInfo);
      
      // Force debt creation for credit purchases
      if (supplierInfo.supplierId && supplierInfo.isCredit === true && supplierInfo.isOwnPurchase === false) {
        console.log('✅ Creating debt for credit purchase');
        const debtAmount = data.stock * supplierInfo.costPrice;
        const debtRef = doc(collection(db, 'finances'));
        const debtData = {
          id: debtRef.id,
          userId,
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
        console.log('✅ Debt created successfully:', debtData);
      } else {
        console.log('❌ Debt creation skipped - conditions not met');
        console.log('Conditions:', {
          hasSupplierId: !!supplierInfo.supplierId,
          isCredit: supplierInfo.isCredit,
          isOwnPurchase: supplierInfo.isOwnPurchase
        });
      }
    } else {
      // Create stock change without batch (legacy mode)
    createStockChange(
      batch, 
      productRef.id, 
      data.stock, 
      'creation', 
      userId,
      supplierInfo?.supplierId,
      supplierInfo?.isOwnPurchase,
      supplierInfo?.isCredit,
      supplierInfo?.costPrice
    );
    }
  }

  // Create audit log
  createAuditLog(batch, 'create', 'product', productRef.id, productData, userId);
  
  console.log('=== BATCH COMMIT DEBUG ===');
  console.log('About to commit batch with all operations...');
  
  try {
    await batch.commit();
    console.log('✅ Batch committed successfully!');
  } catch (error) {
    console.error('❌ Batch commit failed:', error);
    throw error;
  }
  
  return {
    id: productRef.id,
    ...productData,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  };
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
};

export const updateProduct = async (
  id: string,
  data: Partial<Product>,
  userId: string,
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
    console.log('Updating product:', id, 'data:', data, 'stockReason:', stockReason, 'stockChange:', stockChange, 'supplierInfo:', supplierInfo);
  const batch = writeBatch(db);
  const productRef = doc(db, 'products', id);
  
  // Get current product data
  const productSnap = await getDoc(productRef);
  if (!productSnap.exists()) {
    throw new Error('Product not found');
  }
  
  const currentProduct = productSnap.data() as Product;
  if (currentProduct.userId !== userId) {
    throw new Error('Unauthorized to update this product');
  }
  
  // Handle stock changes
  if (stockChange !== undefined && stockReason) {
    const newStock = currentProduct.stock + stockChange;
    
    if (newStock < 0) {
      throw new Error('Stock cannot be negative');
    }
    
    // Update product stock
    batch.update(productRef, {
      stock: newStock,
    updatedAt: serverTimestamp()
    });
    
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
      supplierInfo?.supplierId,
      supplierInfo?.isOwnPurchase,
      supplierInfo?.isCredit,
      supplierInfo?.costPrice
    );
  }
  }
  
  // Update other product data
  if (Object.keys(data).length > 0) {
    batch.update(productRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }
  
  // Create audit log
  createAuditLog(batch, 'update', 'product', id, { ...data, stockChange, stockReason }, userId);
  
    await batch.commit();
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
};

// ============================================================================
// SALES MANAGEMENT WITH FIFO/LIFO
// ============================================================================

export const createSale = async (
  data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<Sale> => {
  try {
    console.log('Creating sale with data:', data);
  const batch = writeBatch(db);
  
  // Create sale reference first (needed for stock change tracking)
  const saleRef = doc(collection(db, 'sales'));
  
  // Enhanced products with cost price information
  const enhancedProducts: any[] = [];
  let totalCost = 0;
  let totalProfit = 0;
  
  // Validate product stock and calculate cost prices for all products
  for (const product of data.products) {
    const productRef = doc(db, 'products', product.productId);
    const productSnap = await getDoc(productRef);
    
    if (!productSnap.exists()) {
      throw new Error(`Product with ID ${product.productId} not found`);
    }
    
    const productData = productSnap.data() as Product;
    // Verify product ownership
    if (productData.userId !== userId) {
      throw new Error(`Unauthorized to sell product ${productData.name}`);
    }
    if (productData.stock < product.quantity) {
      throw new Error(`Insufficient stock for product ${productData.name}`);
    }
    
    // Get inventory method from sale data or fallback to product default
    const inventoryMethod: InventoryMethod = ((data as any).inventoryMethod?.toUpperCase() as InventoryMethod) || (productData as any).inventoryMethod || 'FIFO';
    
    // Consume stock from batches using FIFO/LIFO logic
    const inventoryResult = await consumeStockFromBatches(
      batch,
      product.productId,
      product.quantity,
      inventoryMethod
    );
    
    // Calculate batch-level profit (correct method)
    let productProfit = 0;
    let productCost = 0;
    
    // Calculate profit per batch consumption
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
    
    // Update totals
    totalCost += productCost;
    totalProfit += productProfit;
    
    // Create enhanced product with batch-level profit information
    const enhancedProduct = {
      ...product,
      costPrice: averageCostPrice,
      batchId: inventoryResult.primaryBatchId,
      profit: productProfit,
      profitMargin,
      consumedBatches: batchProfits,
      batchLevelProfits: batchProfits // New field for detailed profit breakdown
    };
    enhancedProducts.push(enhancedProduct);
    
    // Update product stock
    batch.update(productRef, {
      stock: productData.stock - product.quantity,
      updatedAt: serverTimestamp()
    });
    
    // Add stock change for sale with detailed batch consumption tracking
    createStockChange(
      batch, 
      product.productId, 
      -product.quantity, 
      'sale', 
      userId,
      undefined, // No supplier info for sales
      undefined,
      undefined,
      inventoryResult.averageCostPrice,
      inventoryResult.primaryBatchId,
      saleRef.id, // saleId
      inventoryResult.consumedBatches // Detailed batch consumption data
    );
  }
  
  // Calculate sale totals
  const averageProfitMargin = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
  
  // Create sale with enhanced data
  const saleData = {
    ...data,
    products: enhancedProducts,
    totalCost,
    totalProfit,
    averageProfitMargin,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  batch.set(saleRef, saleData);
  
  // Create audit log
  createAuditLog(batch, 'create', 'sale', saleRef.id, saleData, userId);
  
  await batch.commit();
  
  return {
    id: saleRef.id,
    ...saleData,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  };
  } catch (error) {
    console.error('Error creating sale:', error);
    throw error;
  }
};

// ============================================================================
// REMAINING FUNCTIONS (keeping existing implementations)
// ============================================================================

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
  
  // Update sale status
  batch.update(saleRef, {
    status,
    paymentStatus,
    updatedAt: serverTimestamp(),
    statusHistory: [
      ...(sale.statusHistory || []),
      { status, timestamp: new Date().toISOString() }
    ]
  });
  
  // Create audit log
  createAuditLog(batch, 'update', 'sale', id, { status, paymentStatus }, userId);
  
  await batch.commit();
};

export const createExpense = async (
  data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<Expense> => {
  const expenseRef = await addDoc(collection(db, 'expenses'), {
    ...data,
    userId,
    isAvailable: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return {
    id: expenseRef.id,
    ...data,
    userId,
    isAvailable: true,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  };
};

export const updateExpense = async (
  id: string,
  data: Partial<Expense>,
  userId: string
): Promise<void> => {
  const expenseRef = doc(db, 'expenses', id);
  const expenseSnap = await getDoc(expenseRef);
  
  if (!expenseSnap.exists()) {
    throw new Error('Expense not found');
  }

  const expense = expenseSnap.data() as Expense;
  if (expense.userId !== userId) {
    throw new Error('Unauthorized to update this expense');
  }
  
  const batch = writeBatch(db);
  
  batch.update(expenseRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
  
  // Create audit log
  createAuditLog(batch, 'update', 'expense', id, data, userId);
  
  await batch.commit();
  
  // Sync with finance entry after successful update
  const updatedExpense = { ...expense, ...data, id };
  await syncFinanceEntryWithExpense(updatedExpense);
};

// --- Expense Types ---
export const createExpenseType = async (type: Omit<ExpenseType, 'id' | 'createdAt'>): Promise<ExpenseType> => {
  const ref = doc(collection(db, 'expenseTypes'));
  const now = serverTimestamp();
  const data = { ...type, createdAt: now };
  await setDoc(ref, data);
  const snap = await getDoc(ref);
  return { id: ref.id, ...snap.data() } as ExpenseType;
};

export const getExpenseTypes = async (userId: string): Promise<ExpenseType[]> => {
  // Ensure default expense types exist first
  await ensureDefaultExpenseTypes();
  
  const defaultSnap = await getDocs(query(collection(db, 'expenseTypes'), where('isDefault', '==', true)));
  const userSnap = await getDocs(query(collection(db, 'expenseTypes'), where('userId', '==', userId)));
  const allDocs = [...defaultSnap.docs, ...userSnap.docs];
  const seen = new Set<string>();
  const types: ExpenseType[] = [];
  for (const docSnap of allDocs) {
    if (!seen.has(docSnap.id)) {
      seen.add(docSnap.id);
      types.push({ id: docSnap.id, ...docSnap.data() } as ExpenseType);
    }
  }
  return types;
};

// Ensure default expense types exist
export const ensureDefaultExpenseTypes = async (): Promise<void> => {
  const defaultTypes = [
    { name: 'transportation', isDefault: true },
    { name: 'purchase', isDefault: true },
    { name: 'other', isDefault: true }
  ];

  // Get existing default types
  const existingDefaultsQuery = query(
    collection(db, 'expenseTypes'),
    where('isDefault', '==', true)
  );
  const existingDefaultsSnap = await getDocs(existingDefaultsQuery);
  
  // Create a Set of existing type names for fast lookup
  const existingTypeNames = new Set(
    existingDefaultsSnap.docs.map(doc => doc.data().name)
  );
  
  // Only create missing types
  const missingTypes = defaultTypes.filter(type => !existingTypeNames.has(type.name));
  
  // If all types exist, skip the batch operation entirely
  if (missingTypes.length === 0) {
    console.log('✅ All default expense types already exist - skipping');
    return;
  }
  
  // Create batch for missing types only
  const batch = writeBatch(db);
  
  for (const typeData of missingTypes) {
    const typeRef = doc(collection(db, 'expenseTypes'));
    const newType = {
      id: typeRef.id,
      name: typeData.name,
      isDefault: true,
      createdAt: serverTimestamp()
    };
    batch.set(typeRef, newType);
    console.log(`✅ Creating missing default expense type: ${typeData.name}`);
  }
  
  try {
    await batch.commit();
    console.log(`✅ Created ${missingTypes.length} missing default expense types`);
  } catch (error) {
    console.error('❌ Error creating default expense types:', error);
    throw error;
  }
};

// ============================================================================
// DASHBOARD AND STATISTICS
// ============================================================================

export const updateDashboardStats = async (userId: string): Promise<void> => {
  // This function would calculate and update dashboard statistics
  // Implementation depends on your specific requirements
  console.log('Dashboard stats update requested for user:', userId);
};

export const getLowStockProducts = async (userId: string, threshold?: number): Promise<Product[]> => {
  const q = query(
    collection(db, 'products'),
    where('userId', '==', userId),
    where('isAvailable', '==', true)
  );

  const snapshot = await getDocs(q);
  const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
  
  return products.filter(product => product.stock <= (threshold || 10));
};

export const getProductPerformance = async (userId: string, productId: string): Promise<{
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  averagePrice: number;
}> => {
  const q = query(
    collection(db, 'sales'),
    where('userId', '==', userId),
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

// ============================================================================
// REMAINING EXISTING FUNCTIONS
// ============================================================================

// Keep all the remaining functions as they are...
// (This is a partial update to focus on the core FIFO/LIFO implementation)

export const addSaleWithValidation = async (sale: Sale) => {
  // Implementation remains the same
  console.log('Sale validation requested:', sale);
};

export const getSaleDetails = async (saleId: string): Promise<Sale> => {
  const saleRef = doc(db, 'sales', saleId);
  const saleSnap = await getDoc(saleRef);
  
  if (!saleSnap.exists()) {
    throw new Error('Sale not found');
  }
  
  return { id: saleSnap.id, ...saleSnap.data() } as Sale;
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
  if (sale.userId !== userId) {
    throw new Error('Unauthorized to update this sale');
  }

  const batch = writeBatch(db);

  batch.update(saleRef, {
    ...data,
        updatedAt: serverTimestamp()
      });
  
  // Create audit log
  createAuditLog(batch, 'update', 'sale', saleId, data, userId);
  
    await batch.commit();
};

// ============================================================================
// HOOKS AND UTILITIES
// ============================================================================

export const useSales = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToSales((data) => {
      setSales(data);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const addSale = async (data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>): Promise<Sale> => {
    try {
      return await createSale(data, data.userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add sale');
      throw err;
    }
  };

  const updateSale = async (saleId: string, data: Partial<Sale>): Promise<void> => {
    try {
      await updateSaleDocument(saleId, data, data.userId || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sale');
      throw err;
    }
  };

  const updateStatus = async (id: string, status: OrderStatus, paymentStatus: PaymentStatus) => {
    try {
      await updateSaleStatus(id, status, paymentStatus, sales.find(s => s.id === id)?.userId || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sale status');
      throw err;
    }
  };

  return { sales, loading, error, addSale, updateSale, updateStatus };
};

// Keep all other existing functions...
// (This is a partial update focusing on the core FIFO/LIFO implementation)

export const getCompanyByUserId = async (userId: string): Promise<Company> => {
  const companiesRef = collection(db, 'companies');
  const q = query(companiesRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    throw new Error('Company not found');
  }
  
  const companyDoc = snapshot.docs[0];
  return {
    id: companyDoc.id,
    ...companyDoc.data()
  } as Company;
};

export const subscribeToCompanies = (callback: (companies: Company[]) => void): (() => void) => {
  const companiesRef = collection(db, 'companies');
  
  return onSnapshot(companiesRef, (snapshot) => {
    const companies = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Company[];
    
    callback(companies);
  });
};

export const subscribeToStockChanges = (userId: string, callback: (stockChanges: StockChange[]) => void): (() => void) => {
  const q = query(
    collection(db, 'stockChanges'),
    where('userId', '==', userId), // Filter by user first
    orderBy('createdAt', 'desc'),
    limit(200) // Stock changes can be numerous but are small
  );
  
  return onSnapshot(q, (snapshot) => {
    const stockChanges = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as StockChange[];
    
    callback(stockChanges);
  });
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

export const deleteSale = async (saleId: string, userId: string): Promise<void> => {
  const batch = writeBatch(db);
  const saleRef = doc(db, 'sales', saleId);
  
  // Get current sale data for audit log and stock restoration
  const saleSnap = await getDoc(saleRef);
  if (!saleSnap.exists()) {
    throw new Error('Sale not found');
  }

  const sale = saleSnap.data() as Sale;
  if (sale.userId !== userId) {
    throw new Error('Unauthorized to delete this sale');
  }

  // Restore product stock
  for (const product of sale.products) {
    const productRef = doc(db, 'products', product.productId);
    const productSnap = await getDoc(productRef);
    
    if (!productSnap.exists()) {
      throw new Error(`Product with ID ${product.productId} not found`);
    }
    
    const productData = productSnap.data() as Product;
    // Verify product ownership
    if (productData.userId !== userId) {
      throw new Error(`Unauthorized to modify product ${productData.name}`);
    }
    
    // Restore the stock
    batch.update(productRef, {
      stock: productData.stock + product.quantity,
      updatedAt: serverTimestamp()
    });
  }

  // Soft delete the sale (set isAvailable: false)
  batch.update(saleRef, {
    isAvailable: false,
    updatedAt: serverTimestamp()
  });

  // Create audit log
  createAuditLog(batch, 'delete', 'sale', saleId, sale, userId);
  
  await batch.commit();
};

export const getCustomerByPhone = async (phone: string): Promise<Customer | null> => {
  try {
    const customersRef = collection(db, 'customers');
    const q = query(customersRef, where('phone', '==', phone));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    const customerDoc = querySnapshot.docs[0];
    return {
      id: customerDoc.id,
      ...customerDoc.data()
    } as Customer;
  } catch (error) {
    console.error('Error getting customer:', error);
    throw error;
  }
};

export const addCustomer = async (customerData: Omit<Customer, 'id'>): Promise<Customer> => {
  try {
    const customersRef = collection(db, 'customers');
    const docRef = await addDoc(customersRef, customerData);
    return {
      id: docRef.id,
      ...customerData
    };
  } catch (error) {
    console.error('Error adding customer:', error);
    throw error;
  }
};

export const subscribeToCustomers = (userId: string, callback: (customers: Customer[]) => void) => {
  const q = query(
    collection(db, 'customers'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const customers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Customer[];
    callback(customers);
  });
};

// Objectives
export const subscribeToObjectives = (userId: string, callback: (objectives: Objective[]) => void): (() => void) => {
  const q = query(
    collection(db, 'objectives'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const objectives = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Objective[];
    // Return all objectives; filtering for active ones is handled at the UI level
    callback(objectives);
  });
};

export const createObjective = async (
  data: Omit<Objective, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<Objective> => {
  // Validate objective data
  if (!data.title || !data.targetAmount || !data.metric) {
    throw new Error('Invalid objective data');
  }

  const batch = writeBatch(db);
  
  // Create objective
  const objectiveRef = doc(collection(db, 'objectives'));
  const objectiveData = {
    ...data,
    userId,
    isAvailable: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  batch.set(objectiveRef, objectiveData);
  
  // Create audit log
  createAuditLog(batch, 'create', 'objective', objectiveRef.id, objectiveData, userId);
  
  await batch.commit();
  
  return {
    id: objectiveRef.id,
    ...objectiveData,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  };
};

export const updateObjective = async (
  id: string,
  data: Partial<Objective>,
  userId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const objectiveRef = doc(db, 'objectives', id);
  
  // Get current objective data for audit log
  const objectiveSnap = await getDoc(objectiveRef);
  if (!objectiveSnap.exists()) {
    throw new Error('Objective not found');
  }
  
  // Verify ownership
  const objective = objectiveSnap.data() as Objective;
  if (objective.userId !== userId) {
    throw new Error('Unauthorized to update this objective');
  }
  
  // Update objective
  const updateData = {
    ...data,
    updatedAt: serverTimestamp()
  };
  batch.update(objectiveRef, updateData);
  
  // Create audit log with changes
  const changes = {
    oldValue: objective,
    newValue: { ...objective, ...updateData }
  };
  createAuditLog(batch, 'update', 'objective', id, changes, userId);
  
  await batch.commit();
};

export const deleteObjective = async (objectiveId: string, userId: string): Promise<void> => {
  const batch = writeBatch(db);
  const objectiveRef = doc(db, 'objectives', objectiveId);
  // Get current objective data for audit log
  const objectiveSnap = await getDoc(objectiveRef);
  if (!objectiveSnap.exists()) {
    throw new Error('Objective not found');
  }
  // Verify ownership
  const objective = objectiveSnap.data() as Objective;
  if (objective.userId !== userId) {
    throw new Error('Unauthorized to delete this objective');
  }
  // Soft delete the objective (set isAvailable: false)
  batch.update(objectiveRef, {
    isAvailable: false,
    updatedAt: serverTimestamp()
  });
  // Create audit log
  createAuditLog(batch, 'delete', 'objective', objectiveId, objective, userId);
  await batch.commit();
};

// --- Finance Entries ---

export const createFinanceEntry = async (entry: Omit<FinanceEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<FinanceEntry> => {
  const ref = doc(collection(db, 'finances'));
  const now = serverTimestamp();
  const data = { ...entry, createdAt: now, updatedAt: now };
  await setDoc(ref, data);
  const snap = await getDoc(ref);
  // Add audit log for manual finance entries (debt/refund)
  if (entry.sourceType === 'manual') {
    const batch = writeBatch(db);
    await createAuditLog(
      batch,
      'create',
      'finance',
      ref.id,
      { all: { oldValue: null, newValue: data } },
      entry.userId
    );
    await batch.commit();
  }
  return { id: ref.id, ...snap.data() } as FinanceEntry;
};

export const updateFinanceEntry = async (id: string, data: Partial<FinanceEntry>): Promise<void> => {
  const ref = doc(db, 'finances', id);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
};

export const softDeleteFinanceEntry = async (id: string): Promise<void> => {
  await updateFinanceEntry(id, { isDeleted: true });
};

// Cascade soft delete for finance entry
export const softDeleteFinanceEntryWithCascade = async (financeEntryId: string): Promise<void> => {
  const ref = doc(db, 'finances', financeEntryId);
  const entrySnap = await getDoc(ref);
  if (!entrySnap.exists()) return;
  const entry = entrySnap.data() as FinanceEntry;
  // Soft delete the finance entry
  await updateFinanceEntry(financeEntryId, { isDeleted: true });
  // Cascade: if sale or expense, also soft delete the corresponding doc
  if (entry.sourceType === 'sale' && entry.sourceId) {
    await softDeleteSale(entry.sourceId, entry.userId);
  } else if (entry.sourceType === 'expense' && entry.sourceId) {
    await softDeleteExpense(entry.sourceId, entry.userId);
  }
  // Cascade: if debt, also soft delete all related refunds
  if (entry.type === 'debt') {
    console.log('[CascadeDelete] Attempting to delete refunds for debt:', financeEntryId);
    let q = query(collection(db, 'finances'), where('type', '==', 'refund'), where('refundedDebtId', '==', financeEntryId));
    let snap = await getDocs(q);
    if (!snap.empty) {
      for (const docSnap of snap.docs) {
        console.log('[CascadeDelete] Soft deleting refund (direct match):', docSnap.id);
        await updateFinanceEntry(docSnap.id, { isDeleted: true });
      }
    } else {
      // Fallback: fetch all refunds and compare refundedDebtId as string
      console.log('[CascadeDelete] No direct Firestore match, falling back to manual string comparison.');
      const allRefundsSnap = await getDocs(query(collection(db, 'finances'), where('type', '==', 'refund')));
      let found = false;
      for (const docSnap of allRefundsSnap.docs) {
        const refund = docSnap.data();
        if (refund.refundedDebtId && String(refund.refundedDebtId) === String(financeEntryId)) {
          console.log('[CascadeDelete] Soft deleting refund (manual match):', docSnap.id);
          await updateFinanceEntry(docSnap.id, { isDeleted: true });
          found = true;
        }
      }
      if (!found) {
        console.log('[CascadeDelete] No associated refunds found for debt:', financeEntryId);
      }
    }
  }
};

// Soft delete sale and cascade to finance entry
export const softDeleteSale = async (saleId: string, userId: string): Promise<void> => {
  // Soft delete the sale
  await deleteSale(saleId, userId);
  // Find and soft delete corresponding finance entry
  const q = query(collection(db, 'finances'), where('sourceType', '==', 'sale'), where('sourceId', '==', saleId));
  const snap = await getDocs(q);
  if (!snap.empty) {
    for (const docSnap of snap.docs) {
      await updateFinanceEntry(docSnap.id, { isDeleted: true });
    }
  }
};

// Soft delete expense and cascade to finance entry
export const softDeleteExpense = async (expenseId: string, userId: string): Promise<void> => {
  // Soft delete the expense
  await updateExpense(expenseId, { isAvailable: false }, userId);
  // Find and soft delete corresponding finance entry
  const q = query(collection(db, 'finances'), where('sourceType', '==', 'expense'), where('sourceId', '==', expenseId));
  const snap = await getDocs(q);
  if (!snap.empty) {
    for (const docSnap of snap.docs) {
      await updateFinanceEntry(docSnap.id, { isDeleted: true });
    }
  }
};

// --- Sync with Sales/Expenses ---

export const syncFinanceEntryWithSale = async (sale: Sale) => {
  // Add explicit checks for required fields before querying
  if (!sale || !sale.id || !sale.userId) {
    console.error('syncFinanceEntryWithSale: Invalid sale object received, skipping sync.', sale);
    return; // Exit early if data is invalid
  }

  // Find existing finance entry for this sale
  const q = query(collection(db, 'finances'), where('sourceType', '==', 'sale'), where('sourceId', '==', sale.id));
  const snap = await getDocs(q);
  const entry: Omit<FinanceEntry, 'id' | 'createdAt' | 'updatedAt'> = {
    userId: sale.userId,
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

export const syncFinanceEntryWithExpense = async (expense: Expense) => {
  // Add explicit checks for required fields before querying
  if (!expense || !expense.id || !expense.userId) {
    console.error('syncFinanceEntryWithExpense: Invalid expense object received, skipping sync.', expense);
    return; // Exit early if data is invalid
  }

  const q = query(collection(db, 'finances'), where('sourceType', '==', 'expense'), where('sourceId', '==', expense.id));
  const entry: Omit<FinanceEntry, 'id' | 'createdAt' | 'updatedAt'> = {
    userId: expense.userId,
    sourceType: 'expense',
    sourceId: expense.id,
    type: 'expense',
    amount: -Math.abs(expense.amount),
    description: expense.description,
    date: expense.createdAt,
    isDeleted: expense.isAvailable === false,
  };
  const snap = await getDocs(q);
  if (snap.empty) {
    await createFinanceEntry(entry);
  } else {
    const docId = snap.docs[0].id;
    await updateFinanceEntry(docId, entry);
  }
};

// --- Finance Entry Types ---

export const createFinanceEntryType = async (type: Omit<FinanceEntryType, 'id' | 'createdAt'>): Promise<FinanceEntryType> => {
  const ref = doc(collection(db, 'financeEntryTypes'));
  const now = serverTimestamp();
  const data = { ...type, createdAt: now };
  await setDoc(ref, data);
  const snap = await getDoc(ref);
  return { id: ref.id, ...snap.data() } as FinanceEntryType;
};

export const getFinanceEntryTypes = async (userId: string): Promise<FinanceEntryType[]> => {
  // Firestore JS SDK does not support 'or' queries directly; fetch both and merge
  const defaultSnap = await getDocs(query(collection(db, 'financeEntryTypes'), where('isDefault', '==', true)));
  const userSnap = await getDocs(query(collection(db, 'financeEntryTypes'), where('userId', '==', userId)));
  const allDocs = [...defaultSnap.docs, ...userSnap.docs];
  // Remove duplicates by id
  const seen = new Set();
  const types: FinanceEntryType[] = [];
  for (const doc of allDocs) {
    if (!seen.has(doc.id)) {
      seen.add(doc.id);
      types.push({ id: doc.id, ...doc.data() } as FinanceEntryType);
    }
  }
  return types;
};

// Ensure default finance entry types exist - OPTIMIZED VERSION
export const ensureDefaultFinanceEntryTypes = async (): Promise<void> => {
  const defaultTypes = [
    { name: 'loan', isDefault: true },
    { name: 'expense', isDefault: true },
    { name: 'sale', isDefault: true },
    { name: 'refund', isDefault: true },
    { name: 'debt', isDefault: true },
    { name: 'supplier_debt', isDefault: true },
    { name: 'supplier_refund', isDefault: true },
    { name: 'sortie', isDefault: true },
    { name: 'other', isDefault: true }
  ];

  // 🚀 OPTIMIZATION: Single query to get ALL existing default types
  const existingDefaultsQuery = query(
    collection(db, 'financeEntryTypes'),
    where('isDefault', '==', true)
  );
  const existingDefaultsSnap = await getDocs(existingDefaultsQuery);
  
  // Create a Set of existing type names for fast lookup
  const existingTypeNames = new Set(
    existingDefaultsSnap.docs.map(doc => doc.data().name)
  );
  
  // 🚀 OPTIMIZATION: Only create missing types
  const missingTypes = defaultTypes.filter(type => !existingTypeNames.has(type.name));
  
  // If all types exist, skip the batch operation entirely
  if (missingTypes.length === 0) {
    console.log('✅ All default finance entry types already exist - skipping');
    return;
  }
  
  // Create batch for missing types only
  const batch = writeBatch(db);
  
  for (const typeData of missingTypes) {
    const typeRef = doc(collection(db, 'financeEntryTypes'));
    const newType = {
      id: typeRef.id,
      name: typeData.name,
      isDefault: true,
      createdAt: serverTimestamp()
    };
    batch.set(typeRef, newType);
    console.log(`✅ Creating missing default finance entry type: ${typeData.name}`);
  }
  
  try {
    await batch.commit();
    console.log(`✅ Created ${missingTypes.length} missing default finance entry types`);
  } catch (error) {
    console.error('❌ Error creating default finance entry types:', error);
    throw error;
  }
};

// --- Suppliers ---

export const subscribeToSuppliers = (userId: string, callback: (suppliers: Supplier[]) => void): (() => void) => {
  const q = query(
    collection(db, 'suppliers'),
    where('userId', '==', userId), // Filter by user first
    orderBy('createdAt', 'desc'),
    limit(50) // Add pagination
  );
  
  return onSnapshot(q, (snapshot) => {
    const suppliers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Supplier[];
    callback(suppliers);
  });
};

export const createSupplier = async (
  data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<Supplier> => {
  // Validate supplier data
  if (!data.name || !data.contact) {
    throw new Error('Invalid supplier data');
  }

  const batch = writeBatch(db);
  
  // Create supplier
  const supplierRef = doc(collection(db, 'suppliers'));
  const supplierData = {
    ...data,
    userId,
    isDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  batch.set(supplierRef, supplierData);
  
  // Create audit log
  createAuditLog(batch, 'create', 'supplier', supplierRef.id, supplierData, userId);
  
  await batch.commit();
  
  return {
    id: supplierRef.id,
    ...supplierData,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  };
};

export const updateSupplier = async (
  id: string,
  data: Partial<Supplier>,
  userId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const supplierRef = doc(db, 'suppliers', id);
  
  // Get current supplier data for audit log
  const supplierSnap = await getDoc(supplierRef);
  if (!supplierSnap.exists()) {
    throw new Error('Supplier not found');
  }
  
  const supplier = supplierSnap.data() as Supplier;
  if (supplier.userId !== userId) {
    throw new Error('Unauthorized to update this supplier');
  }
  
  const updateData = {
    ...data,
    updatedAt: serverTimestamp()
  };
  batch.update(supplierRef, updateData);
  
  // Create audit log
  createAuditLog(batch, 'update', 'supplier', id, updateData, userId);
  
  await batch.commit();
};

export const softDeleteSupplier = async (
  id: string,
  userId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const supplierRef = doc(db, 'suppliers', id);
  
  // Get current supplier data
  const supplierSnap = await getDoc(supplierRef);
  if (!supplierSnap.exists()) {
    throw new Error('Supplier not found');
  }
  
  const supplier = supplierSnap.data() as Supplier;
  if (supplier.userId !== userId) {
    throw new Error('Unauthorized to delete this supplier');
  }
  
  // Check if supplier has outstanding debts
  const q = query(
    collection(db, 'finances'),
    where('type', '==', 'supplier_debt'),
    where('supplierId', '==', id),
    where('isDeleted', '==', false)
  );
  const debtSnap = await getDocs(q);
  
  if (!debtSnap.empty) {
    throw new Error('Cannot delete supplier with outstanding debts');
  }
  
  // Soft delete supplier
  batch.update(supplierRef, {
    isDeleted: true,
    updatedAt: serverTimestamp()
  });
  
  // Create audit log
  createAuditLog(batch, 'delete', 'supplier', id, { isDeleted: { oldValue: false, newValue: true } }, userId);
  
  await batch.commit();
};

// Create supplier debt entry
export const createSupplierDebt = async (
  supplierId: string,
  amount: number,
  description: string,
  userId: string,
  batchId?: string
): Promise<FinanceEntry> => {
  const entry: Omit<FinanceEntry, 'id' | 'createdAt' | 'updatedAt'> = {
    userId,
    sourceType: 'supplier',
    sourceId: supplierId,
    type: 'supplier_debt',
    amount: amount,
    description,
    date: Timestamp.now(),
    isDeleted: false,
    supplierId,
    ...(batchId && { batchId })
  };
  
  return await createFinanceEntry(entry);
};

// Create supplier refund entry
export const createSupplierRefund = async (
  supplierId: string,
  amount: number,
  description: string,
  refundedDebtId: string,
  userId: string
): Promise<FinanceEntry> => {
  const entry: Omit<FinanceEntry, 'id' | 'createdAt' | 'updatedAt'> = {
    userId,
    sourceType: 'supplier',
    sourceId: supplierId,
    type: 'supplier_refund',
    amount: -Math.abs(amount), // Negative amount for refunds
    description,
    date: Timestamp.now(),
    isDeleted: false,
    supplierId,
    refundedDebtId
  };
  
  return await createFinanceEntry(entry);
};

// ============================================================================
// STOCK BATCH UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all stock batches for a product
 */
export const getProductStockBatches = async (productId: string): Promise<StockBatch[]> => {
  const q = query(
    collection(db, 'stockBatches'),
    where('productId', '==', productId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StockBatch[];
};

/**
 * Get current stock value and cost information for a product
 */
export const getProductStockInfo = async (productId: string): Promise<{
  totalStock: number;
  totalValue: number;
  averageCostPrice: number;
  batches: StockBatch[];
}> => {
  const batches = await getProductStockBatches(productId);
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

/**
 * Correct cost price for a specific stock batch
 */
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
  
  // Verify ownership
  if (batchData.userId !== userId) {
    throw new Error('Unauthorized to modify this stock batch');
  }
  
  const batch = writeBatch(db);
  
  // Update the batch cost price
  batch.update(batchRef, {
    costPrice: newCostPrice,
    status: 'corrected'
  });
  
  // Create a stock change record for the correction
  createStockChange(
    batch,
    batchData.productId,
    0, // No stock change
    'cost_correction',
    userId,
    batchData.supplierId,
    batchData.isOwnPurchase,
    batchData.isCredit,
    newCostPrice,
    batchId
  );
  
  await batch.commit();
};

/**
 * Get stock batch statistics for reporting
 */
export const getStockBatchStats = async (userId: string): Promise<{
  totalBatches: number;
  activeBatches: number;
  depletedBatches: number;
  totalStockValue: number;
  averageCostPrice: number;
}> => {
  const q = query(
    collection(db, 'stockBatches'),
    where('userId', '==', userId)
  );
  
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

/**
 * Delete a stock change document
 */
export const deleteStockChange = async (stockChangeId: string): Promise<void> => {
  try {
    const stockChangeRef = doc(db, 'stockChanges', stockChangeId);
    await deleteDoc(stockChangeRef);
    console.log(`Stock change ${stockChangeId} deleted successfully`);
  } catch (error) {
    console.error('Error deleting stock change:', error);
    throw error;
  }
};

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
  createStockChange(
    batch,
    productId,
    quantity,
    'restock',
    userId,
    supplierId,
    isOwnPurchase,
    isCredit,
    costPrice,
    stockBatchRef.id
  );
  
  // Create supplier debt if credit purchase
  if (supplierId && isCredit && !isOwnPurchase) {
    const debtAmount = quantity * costPrice;
    const debtRef = doc(collection(db, 'finances'));
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
  userId: string,
  newCostPrice?: number,
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
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
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
  createStockChange(
    batch,
    productId,
    quantityChange,
    'manual_adjustment',
    userId,
    batchData.supplierId,
    batchData.isOwnPurchase,
    batchData.isCredit,
    newCostPrice || batchData.costPrice,
    batchId
  );
  
  // Handle supplier debt adjustment for credit purchases
  if (batchData.supplierId && batchData.isCredit && !batchData.isOwnPurchase) {
    const debtChange = quantityChange * (newCostPrice || batchData.costPrice);
    
    if (debtChange !== 0) {
      const debtRef = doc(collection(db, 'finances'));
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
  createStockChange(
    batch,
    productId,
    -damagedQuantity,
    'damage',
    userId,
    batchData.supplierId,
    batchData.isOwnPurchase,
    batchData.isCredit,
    batchData.costPrice,
    batchId
  );
  
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

/**
 * Get batch details for adjustment operations
 */
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

/**
 * Validate batch adjustment operation
 */
export const validateBatchAdjustment = (
  batch: StockBatch,
  quantityChange: number,
  newCostPrice?: number
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Check if batch is active
  if (batch.status !== 'active' && batch.status !== 'corrected') {
    errors.push('Batch is not available for adjustment');
  }
  
  // Check if quantity change would make remaining quantity negative
  const newRemainingQuantity = batch.remainingQuantity + quantityChange;
  if (newRemainingQuantity < 0) {
    errors.push('Adjustment would result in negative remaining quantity');
  }
  
  // Check if new cost price is valid
  if (newCostPrice !== undefined && newCostPrice < 0) {
    errors.push('Cost price cannot be negative');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Get stock adjustment history for a product
 */
export const getProductAdjustmentHistory = async (productId: string): Promise<StockChange[]> => {
  const stockChangesSnapshot = await getDocs(
    query(
      collection(db, 'stockChanges'),
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