import {
  collection,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  addDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type WriteBatch,
  setDoc,
  updateDoc
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
  Supplier
} from '../types/models';
import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';

// ============================================================================
// STOCK BATCH MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Create a new stock batch for a product
 */
const createStockBatch = (
  batch: WriteBatch,
  productId: string,
  quantity: number,
  costPrice: number,
  userId: string,
  supplierId?: string,
  isOwnPurchase?: boolean,
  isCredit?: boolean
) => {
  const stockBatchRef = doc(collection(db, 'stockBatches'));
  const stockBatchData: StockBatch = {
    id: stockBatchRef.id,
    productId,
    quantity,
    costPrice,
    supplierId,
    isOwnPurchase,
    isCredit,
    createdAt: serverTimestamp() as Timestamp,
    userId,
    remainingQuantity: quantity,
    status: 'active'
  };
  batch.set(stockBatchRef, stockBatchData);
  return stockBatchRef.id;
};

/**
 * Get available stock batches for a product (FIFO order)
 */
const getAvailableStockBatches = async (productId: string): Promise<StockBatch[]> => {
  const q = query(
    collection(db, 'stockBatches'),
    where('productId', '==', productId),
    where('remainingQuantity', '>', 0),
    where('status', '==', 'active'),
    orderBy('remainingQuantity'),
    orderBy('createdAt', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StockBatch[];
};

/**
 * Consume stock from batches using FIFO logic
 */
const consumeStockFromBatches = async (
  batch: WriteBatch,
  productId: string,
  quantity: number
): Promise<{ costPrice: number; batchId: string; consumedQuantity: number }[]> => {
  const availableBatches = await getAvailableStockBatches(productId);
  
  if (availableBatches.length === 0) {
    throw new Error(`No available stock batches found for product ${productId}`);
  }
  
  let remainingQuantity = quantity;
  const consumedBatches: { costPrice: number; batchId: string; consumedQuantity: number }[] = [];
  
  for (const stockBatch of availableBatches) {
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
      costPrice: stockBatch.costPrice,
      batchId: stockBatch.id,
      consumedQuantity: consumeQuantity
    });
    
    remainingQuantity -= consumeQuantity;
  }
  
  if (remainingQuantity > 0) {
    throw new Error(`Insufficient stock available for product ${productId}. Need ${quantity}, available ${quantity - remainingQuantity}`);
  }
  
  return consumedBatches;
};

/**
 * Update stock change with batch reference
 */
const createStockChangeWithBatch = (
  batch: WriteBatch, 
  productId: string, 
  change: number, 
  reason: 'sale' | 'restock' | 'adjustment' | 'creation' | 'cost_correction', 
  userId: string,
  supplierId?: string,
  isOwnPurchase?: boolean,
  isCredit?: boolean,
  costPrice?: number,
  batchId?: string
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
  batch.set(stockChangeRef, stockChangeData);
};

// Categories
export const subscribeToCategories = (callback: (categories: Category[]) => void): (() => void) => {
  const q = query(
    collection(db, 'categories'),
    orderBy('name', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const categories = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Category[];
    callback(categories);
  });
};

// Products
export const subscribeToProducts = (callback: (products: Product[]) => void): (() => void) => {
  const q = query(
    collection(db, 'products'),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Product[];
    callback(products);
  });
};

// Sales
export const subscribeToSales = (callback: (sales: Sale[]) => void): (() => void) => {
  const q = query(
    collection(db, 'sales'),
    orderBy('createdAt', 'desc')
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

// Expenses
export const subscribeToExpenses = (callback: (expenses: Expense[]) => void): (() => void) => {
  const q = query(
    collection(db, 'expenses'),
    orderBy('createdAt', 'desc')
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
      callback({
        totalSales: data.totalSales || 0,
        totalExpenses: data.totalExpenses || 0,
        totalProfit: data.totalProfit || 0,
        activeOrders: data.activeOrders || 0,
        completedOrders: data.completedOrders || 0,
        cancelledOrders: data.cancelledOrders || 0,
      });
    }
  });
};

export const createCategory = async (
  data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<Category> => {
  const batch = writeBatch(db);
  
  // Check if category already exists for this user
  const existingQuery = query(
    collection(db, 'categories'),
    where('name', '==', data.name),
    where('userId', '==', userId)
  );
  const existingDocs = await getDocs(existingQuery);
  
  if (!existingDocs.empty) {
    throw new Error('Category already exists');
  }
  
  // Create category
  const categoryRef = doc(collection(db, 'categories'));
  const categoryData = {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  batch.set(categoryRef, categoryData);
  
  // Create audit log
  await createAuditLog(
    batch,
    'create',
    'category',
    categoryRef.id,
    { all: { oldValue: null, newValue: categoryData } },
    userId
  );
  
  await batch.commit();
  
  const newCategory = await getDoc(categoryRef);
  return { id: newCategory.id, ...newCategory.data() } as Category;
};

// Audit logging
const createAuditLog = async (
  batch: WriteBatch,
  action: 'create' | 'update' | 'delete',
  entityType: 'product' | 'sale' | 'expense' | 'category' | 'objective' | 'finance' | 'supplier',
  entityId: string,
  changes: any,
  performedBy: string
) => {
  // Recursively replace undefined with null in changes
  function replaceUndefined(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(replaceUndefined);
    } else if (obj && typeof obj === 'object') {
      const newObj: any = {};
      for (const key in obj) {
        const value = obj[key];
        newObj[key] = value === undefined ? null : replaceUndefined(value);
      }
      return newObj;
    }
    return obj;
  }
  
  const safeChanges = replaceUndefined(changes);
  const auditLogRef = doc(collection(db, 'auditLogs'));
  
  const auditLogData = {
    action,
    entityType,
    entityId,
    changes: safeChanges,
    performedBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  try {
    batch.set(auditLogRef, auditLogData);
  } catch (error) {
    throw error;
  }
};

const createStockChange = (
  batch: WriteBatch, 
  productId: string, 
  change: number, 
  reason: 'sale' | 'restock' | 'adjustment' | 'creation', 
  userId: string,
  supplierId?: string,
  isOwnPurchase?: boolean,
  isCredit?: boolean,
  costPrice?: number
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
  batch.set(stockChangeRef, stockChangeData);
};

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
  
  // Create product
  const productRef = doc(collection(db, 'products'));
  const productData = {
    ...data,
    userId,
    isAvailable: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  batch.set(productRef, productData);
  
  // Add initial stock change and create stock batch if stock > 0
  if (data.stock && data.stock > 0) {
    // Create stock batch if cost price is provided
    let batchId: string | undefined;
    if (supplierInfo?.costPrice) {
      batchId = createStockBatch(
        batch,
        productRef.id,
        data.stock,
        supplierInfo.costPrice,
        userId,
        supplierInfo.supplierId,
        supplierInfo.isOwnPurchase,
        supplierInfo.isCredit
      );
    }
    
    // Create stock change with batch reference
    createStockChangeWithBatch(
      batch, 
      productRef.id, 
      data.stock, 
      'creation', 
      userId,
      supplierInfo?.supplierId,
      supplierInfo?.isOwnPurchase,
      supplierInfo?.isCredit,
      supplierInfo?.costPrice,
      batchId
    );
  }

  // Create audit log
  await createAuditLog(
    batch,
    'create',
    'product',
    productRef.id,
    { all: { oldValue: null, newValue: productData } },
    userId
  );
  
  await batch.commit();
  
  const newProduct = await getDoc(productRef);
  return { id: newProduct.id, ...newProduct.data() } as Product;
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
  const batch = writeBatch(db);
  const productRef = doc(db, 'products', id);
  // Get current product data for audit log
  const currentProduct = await getDoc(productRef);
  if (!currentProduct.exists()) {
    throw new Error('Product not found');
  }
  // Verify ownership
  const productData = currentProduct.data() as Product;
  if (productData.userId !== userId) {
    throw new Error('Unauthorized to update this product');
  }
  const updateData = {
    ...data,
    updatedAt: serverTimestamp()
  };
  batch.update(productRef, updateData);
  
  // If stock is being updated, record the change and handle stock batches
  if (typeof data.stock === 'number' && typeof stockChange === 'number' && stockReason) {
    let batchId: string | undefined;
    
    // Handle different stock reasons
    if (stockReason === 'restock' && stockChange > 0 && supplierInfo?.costPrice) {
      // Create new stock batch for restock
      batchId = createStockBatch(
        batch,
        id,
        stockChange,
        supplierInfo.costPrice,
        userId,
        supplierInfo.supplierId,
        supplierInfo.isOwnPurchase,
        supplierInfo.isCredit
      );
    } else if (stockReason === 'cost_correction' && stockChange === 0 && supplierInfo?.costPrice) {
      // Handle cost price correction without stock change
      // Find the most recent active batch and update its cost price
      const availableBatches = await getAvailableStockBatches(id);
      if (availableBatches.length > 0) {
        const latestBatch = availableBatches[availableBatches.length - 1];
        const batchRef = doc(db, 'stockBatches', latestBatch.id);
        batch.update(batchRef, {
          costPrice: supplierInfo.costPrice,
          status: 'corrected'
        });
        batchId = latestBatch.id;
      }
    }
    
    // Create stock change with batch reference
    createStockChangeWithBatch(
      batch,
      id,
      stockChange,
      stockReason,
      userId,
      supplierInfo?.supplierId,
      supplierInfo?.isOwnPurchase,
      supplierInfo?.isCredit,
      supplierInfo?.costPrice,
      batchId
    );
  }
  
  // Create audit log
  const auditChanges = Object.keys(data).reduce((acc, key) => ({
    ...acc,
    [key]: {
      oldValue: currentProduct.data()[key] === undefined ? null : currentProduct.data()[key],
      newValue: data[key as keyof Product] === undefined ? null : data[key as keyof Product]
    }
  }), {});
  await createAuditLog(
    batch,
    'update',
    'product',
    id,
    auditChanges,
    userId
  );
  try {
    await batch.commit();
  } catch (error) {
    throw error;
  }
};

export const createSale = async (
  data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<Sale> => {
  const batch = writeBatch(db);
  
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
    
    // Consume stock from batches using FIFO logic
    const consumedBatches = await consumeStockFromBatches(
      batch,
      product.productId,
      product.quantity
    );
    
    // Calculate weighted average cost price from consumed batches
    let totalBatchCost = 0;
    let totalBatchQuantity = 0;
    let primaryBatchId = '';
    
    for (const batch of consumedBatches) {
      totalBatchCost += batch.costPrice * batch.consumedQuantity;
      totalBatchQuantity += batch.consumedQuantity;
      if (!primaryBatchId) primaryBatchId = batch.batchId; // Use first batch as primary
    }
    
    const averageCostPrice = totalBatchQuantity > 0 ? totalBatchCost / totalBatchQuantity : 0;
    const productCost = averageCostPrice * product.quantity;
    const productProfit = (product.basePrice - averageCostPrice) * product.quantity;
    const profitMargin = averageCostPrice > 0 ? (productProfit / productCost) * 100 : 0;
    
    // Update totals
    totalCost += productCost;
    totalProfit += productProfit;
    
    // Create enhanced product with cost information
    const enhancedProduct = {
      ...product,
      costPrice: averageCostPrice,
      batchId: primaryBatchId,
      profit: productProfit,
      profitMargin
    };
    enhancedProducts.push(enhancedProduct);
    
    // Update product stock
    batch.update(productRef, {
      stock: productData.stock - product.quantity,
      updatedAt: serverTimestamp()
    });
    
    // Add stock change for sale with batch reference
    createStockChangeWithBatch(
      batch, 
      product.productId, 
      -product.quantity, 
      'sale', 
      userId,
      undefined, // No supplier info for sales
      undefined,
      undefined,
      averageCostPrice,
      primaryBatchId
    );
  }
  
  // Calculate sale totals
  const averageProfitMargin = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
  
  // Create sale with enhanced data
  const saleRef = doc(collection(db, 'sales'));
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
  await createAuditLog(
    batch,
    'create',
    'sale',
    saleRef.id,
    { all: { oldValue: null, newValue: saleData } },
    userId
  );
  
  await batch.commit();
  
  const newSale = await getDoc(saleRef);
  return { id: newSale.id, ...newSale.data() } as Sale;
};

export const updateSaleStatus = async (
  id: string,
  status: OrderStatus,
  paymentStatus: PaymentStatus,
  userId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const saleRef = doc(db, 'sales', id);
  
  // Get current sale data for audit log
  const currentSale = await getDoc(saleRef);
  if (!currentSale.exists()) {
    throw new Error('Sale not found');
  }

  // Verify ownership
  const saleData = currentSale.data() as Sale;
  if (saleData.userId !== userId) {
    throw new Error('Unauthorized to update this sale');
  }
  
  const updateData = {
    status,
    paymentStatus,
    ...(status === 'paid' ? { paymentDate: serverTimestamp() } : {}),
    updatedAt: serverTimestamp()
  };
  
  batch.update(saleRef, updateData);
  
  // Create audit log
  await createAuditLog(
    batch,
    'update',
    'sale',
    id,
    {
      status: {
        oldValue: currentSale.data().status,
        newValue: status
      },
      paymentStatus: {
        oldValue: currentSale.data().paymentStatus,
        newValue: paymentStatus
      }
    },
    userId
  );
  
  await batch.commit();
};

export const createExpense = async (
  data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<Expense> => {
  const batch = writeBatch(db);
  
  // Create expense
  const expenseRef = doc(collection(db, 'expenses'));
  const expenseData = {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  batch.set(expenseRef, expenseData);
  
  // Create audit log
  await createAuditLog(
    batch,
    'create',
    'expense',
    expenseRef.id,
    { all: { oldValue: null, newValue: expenseData } },
    userId
  );
  
  await batch.commit();
  
  const newExpense = await getDoc(expenseRef);
  return { id: newExpense.id, ...newExpense.data() } as Expense;
};

export const updateExpense = async (
  id: string,
  data: Partial<Expense>,
  userId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const expenseRef = doc(db, 'expenses', id);
  
  // Get current expense data for audit log
  const currentExpense = await getDoc(expenseRef);
  if (!currentExpense.exists()) {
    throw new Error('Expense not found');
  }

  // Verify ownership
  const expenseData = currentExpense.data() as Expense;
  if (expenseData.userId !== userId) {
    throw new Error('Unauthorized to update this expense');
  }
  
  const updateData = {
    ...data,
    updatedAt: serverTimestamp()
  };
  
  batch.update(expenseRef, updateData);
  
  // Create audit log
  await createAuditLog(
    batch,
    'update',
    'expense',
    id,
    Object.keys(data).reduce((acc, key) => ({
      ...acc,
      [key]: {
        oldValue: currentExpense.data()[key],
        newValue: data[key as keyof Expense]
      }
    }), {}),
    userId
  );
  
  await batch.commit();
};

export const updateDashboardStats = async (userId: string): Promise<void> => {
  const batch = writeBatch(db);
  const statsRef = doc(db, 'dashboardStats', userId);

  const [salesSnap, expensesSnap] = await Promise.all([
    getDocs(query(collection(db, 'sales'), where('userId', '==', userId))),
    getDocs(query(collection(db, 'expenses'), where('userId', '==', userId))),
  ]);

  // Exclude soft-deleted sales
  const sales = salesSnap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter((sale: any) => sale.isAvailable !== false) as Sale[];
  const expenses = expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Expense[];

  const stats: Partial<DashboardStats> = {
    userId,
    totalSales: sales.reduce((sum, sale) => sum + sale.totalAmount, 0),
    totalExpenses: expenses.reduce((sum, expense) => sum + expense.amount, 0),
    totalProfit: sales.reduce((sum, sale) => 
      sum + sale.products.reduce((productSum, product) => 
        productSum + ((product.negotiatedPrice || product.basePrice) - product.basePrice) * product.quantity, 0), 0),
    activeOrders: sales.filter(sale => sale.status !== 'paid').length,
    completedOrders: sales.filter(sale => sale.status === 'paid').length,
    cancelledOrders: sales.filter(sale => sale.paymentStatus === 'cancelled').length,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  batch.set(statsRef, stats, { merge: true });
  await batch.commit();
};

export const getLowStockProducts = async (userId: string, threshold?: number): Promise<Product[]> => {
  const productsRef = collection(db, 'products');
  const q = query(
    productsRef,
    where('userId', '==', userId),
    where('stock', '<=', threshold || 10),
    orderBy('stock', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Product[];
};

export const getProductPerformance = async (userId: string, productId: string): Promise<{
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  averagePrice: number;
}> => {
  const salesRef = collection(db, 'sales');
  const q = query(
    salesRef,
    where('userId', '==', userId),
    where('products', 'array-contains', { productId })
  );

  const snapshot = await getDocs(q);
  const sales = snapshot.docs.map(doc => doc.data() as Sale);

  const productSales = sales.flatMap(sale => 
    sale.products.filter(p => p.productId === productId)
  );

  return {
    totalSales: productSales.length,
    totalRevenue: productSales.reduce((sum, sale) => sum + (sale.negotiatedPrice || sale.basePrice) * sale.quantity, 0),
    totalProfit: productSales.reduce((sum, sale) => 
      sum + ((sale.negotiatedPrice || sale.basePrice) - sale.basePrice) * sale.quantity, 0),
    averagePrice: productSales.length > 0
      ? productSales.reduce((sum, sale) => sum + (sale.negotiatedPrice || sale.basePrice), 0) / productSales.length
      : 0,
  };
};

export const addSaleWithValidation = async (sale: Sale) => {
  // Validate all products
  for (const product of sale.products) {
    const productDoc = await getDoc(doc(db, 'products', product.productId));
    if (!productDoc.exists()) {
      throw new Error(`Product with ID ${product.productId} does not exist.`);
    }

    const productData = productDoc.data() as Product;

    // Validate quantity
    if (product.quantity <= 0 || product.quantity > productData.stock) {
      throw new Error(`Invalid quantity for product ${productData.name}.`);
    }

    // Validate negotiated price
    if (product.negotiatedPrice && product.negotiatedPrice > product.basePrice) {
      throw new Error(`Negotiated price exceeds standard selling price for product ${productData.name}.`);
    }
  }

  // Validate delivery fee (if applicable)
  if (sale.deliveryFee !== undefined && sale.deliveryFee < 0) {
    throw new Error('Delivery fee must be a non-negative number.');
  }

  // Proceed with adding the sale
  return await addDoc(collection(db, 'sales'), {
    ...sale,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};

export const getSaleDetails = async (saleId: string): Promise<Sale> => {
  const saleDoc = await getDoc(doc(db, 'sales', saleId));
  if (!saleDoc.exists()) {
    throw new Error('Sale not found');
  }
  const saleData = saleDoc.data() as Sale;
  return {
    ...saleData,
    statusHistory: [], // Provide a default empty array for statusHistory
  };
};

export const updateSaleDocument = async (
  saleId: string,
  data: Partial<Sale>,
  userId: string
): Promise<void> => {
  const saleRef = doc(db, 'sales', saleId);
  const currentSale = await getDoc(saleRef);
  
  if (!currentSale.exists()) {
    throw new Error('Sale not found');
  }

  // Verify ownership
  const saleData = currentSale.data() as Sale;
  if (saleData.userId !== userId) {
    throw new Error('Unauthorized to update this sale');
  }

  const currentData = currentSale.data() as Sale;
  const batch = writeBatch(db);

  // Handle product stock changes if products are being updated
  if (data.products) {
    // Create a map of product IDs to their current quantities in the sale
    const currentProductQuantities = new Map<string, number>();
    currentData.products.forEach(product => {
      currentProductQuantities.set(product.productId, product.quantity);
    });

    // Create a map of product IDs to their new quantities
    const newProductQuantities = new Map<string, number>();
    data.products.forEach(product => {
      newProductQuantities.set(product.productId, product.quantity);
    });

    // Get all unique product IDs involved in the update
    const allProductIds = new Set([
      ...currentProductQuantities.keys(),
      ...newProductQuantities.keys()
    ]);

    // Process each product's stock changes
    for (const productId of allProductIds) {
      const productRef = doc(db, 'products', productId);
      const productSnap = await getDoc(productRef);
      
      if (!productSnap.exists()) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      const productData = productSnap.data() as Product;
      // Verify product ownership
      if (productData.userId !== userId) {
        throw new Error(`Unauthorized to modify product ${productData.name}`);
      }

      const currentQuantity = currentProductQuantities.get(productId) || 0;
      const newQuantity = newProductQuantities.get(productId) || 0;
      
      // Calculate the stock change
      const stockChange = currentQuantity - newQuantity;
      const newStock = productData.stock + stockChange;

      if (newStock < 0) {
        throw new Error(`Insufficient stock for product ${productData.name}`);
      }

      // Update the product's stock
      batch.update(productRef, {
        stock: newStock,
        updatedAt: serverTimestamp()
      });
    }
  }

  // Update the sale document
  const updateData = {
    ...data,
    updatedAt: serverTimestamp()
  };

  batch.update(saleRef, updateData);

  try {
    await batch.commit();
  } catch (error) {
    console.error('Error updating sale:', error);
    throw new Error('Failed to update sale. Please try again.');
  }
};

// Update the useSales hook
export const useSales = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToSales((data) => {
      // Sort sales by createdAt to ensure consistent order
      const sortedSales = [...data].sort((a, b) => {
        const aTime = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
      });
      setSales(sortedSales);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const addSale = async (data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>): Promise<Sale> => {
    try {
      const userId = 'current-user';
      return await createSale(data, userId);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateSale = async (saleId: string, data: Partial<Sale>): Promise<void> => {
    try {
      // Only update in Firestore - the subscription will handle the state update
      await updateSaleDocument(saleId, data, 'current-user');
    } catch (err) {
      console.error('Error in updateSale:', err);
      setError(err as Error);
      throw err;
    }
  };

  const updateStatus = async (id: string, status: OrderStatus, paymentStatus: PaymentStatus) => {
    try {
      const userId = 'current-user';
      await updateSaleStatus(id, status, paymentStatus, userId);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return { sales, loading, error, addSale, updateSale, updateStatus };
};

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
  const currentSale = await getDoc(saleRef);
  if (!currentSale.exists()) {
    throw new Error('Sale not found');
  }

  // Verify ownership
  const saleData = currentSale.data() as Sale;
  if (saleData.userId !== userId) {
    throw new Error('Unauthorized to delete this sale');
  }

  // Restore product stock
  for (const product of saleData.products) {
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
  await createAuditLog(
    batch,
    'delete',
    'sale',
    saleId,
    { all: { oldValue: saleData, newValue: { ...saleData, isAvailable: false } } },
    userId
  );
  
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
    // Only return objectives that are not soft-deleted
    callback(objectives.filter(obj => obj.isAvailable !== false));
  });
};

export const deleteObjective = async (objectiveId: string, userId: string): Promise<void> => {
  const batch = writeBatch(db);
  const objectiveRef = doc(db, 'objectives', objectiveId);
  // Get current objective data for audit log
  const currentObjective = await getDoc(objectiveRef);
  if (!currentObjective.exists()) {
    throw new Error('Objective not found');
  }
  // Verify ownership
  const objectiveData = currentObjective.data() as Objective;
  if (objectiveData.userId !== userId) {
    throw new Error('Unauthorized to delete this objective');
  }
  // Soft delete the objective (set isAvailable: false)
  batch.update(objectiveRef, {
    isAvailable: false,
    updatedAt: serverTimestamp()
  });
  // Create audit log
  await createAuditLog(
    batch,
    'delete',
    'objective',
    objectiveId,
    { all: { oldValue: objectiveData, newValue: { ...objectiveData, isAvailable: false } } },
    userId
  );
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

// --- Suppliers ---

export const subscribeToSuppliers = (callback: (suppliers: Supplier[]) => void): (() => void) => {
  const q = query(
    collection(db, 'suppliers'),
    orderBy('createdAt', 'desc')
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
  await createAuditLog(
    batch,
    'create',
    'supplier',
    supplierRef.id,
    { all: { oldValue: null, newValue: supplierData } },
    userId
  );
  
  await batch.commit();
  
  const newSupplier = await getDoc(supplierRef);
  return { id: newSupplier.id, ...newSupplier.data() } as Supplier;
};

export const updateSupplier = async (
  id: string,
  data: Partial<Supplier>,
  userId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const supplierRef = doc(db, 'suppliers', id);
  
  // Get current supplier data for audit log
  const currentSupplier = await getDoc(supplierRef);
  if (!currentSupplier.exists()) {
    throw new Error('Supplier not found');
  }
  
  // Verify ownership
  const supplierData = currentSupplier.data() as Supplier;
  if (supplierData.userId !== userId) {
    throw new Error('Unauthorized to update this supplier');
  }
  
  const updateData = {
    ...data,
    updatedAt: serverTimestamp()
  };
  batch.update(supplierRef, updateData);
  
  // Create audit log
  const auditChanges = Object.keys(data).reduce((acc, key) => ({
    ...acc,
    [key]: {
      oldValue: currentSupplier.data()[key] === undefined ? null : currentSupplier.data()[key],
      newValue: data[key as keyof Supplier] === undefined ? null : data[key as keyof Supplier]
    }
  }), {});
  
  await createAuditLog(
    batch,
    'update',
    'supplier',
    id,
    auditChanges,
    userId
  );
  
  await batch.commit();
};

export const softDeleteSupplier = async (
  id: string,
  userId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const supplierRef = doc(db, 'suppliers', id);
  
  // Get current supplier data
  const currentSupplier = await getDoc(supplierRef);
  if (!currentSupplier.exists()) {
    throw new Error('Supplier not found');
  }
  
  // Verify ownership
  const supplierData = currentSupplier.data() as Supplier;
  if (supplierData.userId !== userId) {
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
  await createAuditLog(
    batch,
    'delete',
    'supplier',
    id,
    { isDeleted: { oldValue: false, newValue: true } },
    userId
  );
  
  await batch.commit();
};

// Create supplier debt entry
export const createSupplierDebt = async (
  supplierId: string,
  amount: number,
  description: string,
  userId: string
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
    supplierId
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
  createStockChangeWithBatch(
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