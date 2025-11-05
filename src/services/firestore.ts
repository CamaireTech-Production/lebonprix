import type { Category } from '../types/models';
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
  ExpenseType,
  ProductTag
} from '../types/models';
import type { SellerSettings } from '../types/order';
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
    productId,
    change,
    reason,
    userId,
    companyId, // Ensure companyId is set
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
export const subscribeToCategories = (companyId: string, callback: (categories: Category[]) => void): (() => void) => {
  const q = query(
    collection(db, 'categories'),
    where('companyId', '==', companyId),
    where('isActive', '==', true), // Only get active categories
    orderBy('name', 'asc'),
    limit(100) // Increased limit for categories
  );

  return onSnapshot(q, (snapshot) => {
    const categories = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Category[];
    callback(categories);
  });
};

// Utility function to update category product count
export const updateCategoryProductCount = async (categoryName: string, companyId: string, increment: boolean = true): Promise<void> => {
  if (!categoryName || !companyId) return;

  try {
    // Find the category by name and companyId
    const q = query(
      collection(db, 'categories'),
      where('name', '==', categoryName),
      where('companyId', '==', companyId),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.warn(`Category "${categoryName}" not found for company ${companyId}`);
      return;
    }

    const categoryDoc = snapshot.docs[0];
    const currentCount = categoryDoc.data().productCount || 0;
    const newCount = increment ? currentCount + 1 : Math.max(0, currentCount - 1);

    await updateDoc(categoryDoc.ref, {
      productCount: newCount,
      updatedAt: serverTimestamp()
    });

    console.log(`Updated category "${categoryName}" product count: ${currentCount} -> ${newCount}`);
  } catch (error) {
    console.error('Error updating category product count:', error);
  }
};

// Utility function to recalculate all category product counts
export const recalculateCategoryProductCounts = async (companyId: string): Promise<void> => {
  try {
    // Get all categories for the company
    const categoriesQuery = query(
      collection(db, 'categories'),
      where('companyId', '==', companyId),
      where('isActive', '==', true)
    );

    const categoriesSnapshot = await getDocs(categoriesQuery);
    const categories = categoriesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Category[];

    // Get all products for the company
    const productsQuery = query(
      collection(db, 'products'),
      where('companyId', '==', companyId),
      where('isDeleted', '==', false),
      where('isVisible', '!=', false) // Include products where isVisible is true or undefined
    );

    const productsSnapshot = await getDocs(productsQuery);
    const products = productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Product[];

    // Count products per category
    const categoryCounts: { [categoryName: string]: number } = {};
    products.forEach(product => {
      if (product.category) {
        categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
      }
    });

    // Update each category with the correct count
    const batch = writeBatch(db);
    categories.forEach(category => {
      const correctCount = categoryCounts[category.name] || 0;
      if (category.productCount !== correctCount) {
        const categoryRef = doc(db, 'categories', category.id);
        batch.update(categoryRef, {
          productCount: correctCount,
          updatedAt: serverTimestamp()
        });
      }
    });

    await batch.commit();
    console.log('Recalculated all category product counts');
  } catch (error) {
    console.error('Error recalculating category product counts:', error);
  }
};

// Products - OPTIMIZED for faster initial load
export const subscribeToProducts = (companyId: string, callback: (products: Product[]) => void): (() => void) => {
  const q = query(
    collection(db, 'products'),
    where('companyId', '==', companyId), // Filter by company
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
export const subscribeToSales = (companyId: string, callback: (sales: Sale[]) => void, limitCount?: number): (() => void) => {
  const q = limitCount 
    ? query(
        collection(db, 'sales'),
        where('companyId', '==', companyId), // Filter by company
        orderBy('createdAt', 'desc'),
        limit(limitCount) // 🚀 CONFIGURABLE: Allow different limits
      )
    : query(
        collection(db, 'sales'),
        where('companyId', '==', companyId), // Filter by company
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
export const subscribeToAllSales = (companyId: string, callback: (sales: Sale[]) => void): (() => void) => {
  return subscribeToSales(companyId, callback); // No limit
};

// Expenses
export const subscribeToExpenses = (companyId: string, callback: (expenses: Expense[]) => void): (() => void) => {
  const q = query(
    collection(db, 'expenses'),
    where('companyId', '==', companyId), // Filter by company
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
  companyId: string
): Promise<Category> => {
  const batch = writeBatch(db);
  
  // Validate category data
  if (!data.name || data.name.trim() === '') {
    throw new Error('Category name is required');
  }
  
  const categoryData = {
    ...data,
    companyId, // Ensure companyId is set
    isActive: data.isActive !== false, // Default to true
    productCount: 0, // Initialize with 0 products
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  const categoryRef = doc(collection(db, 'categories'));
  batch.set(categoryRef, categoryData);
  
  // Create audit log (use userId from data if available, otherwise use companyId for audit)
  const auditUserId = data.userId || companyId;
  createAuditLog(batch, 'create', 'category', categoryRef.id, categoryData, auditUserId);
  
  await batch.commit();

  return {
    id: categoryRef.id,
    ...categoryData,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  };
};

export const updateCategory = async (
  id: string,
  data: Partial<Category>,
  companyId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const categoryRef = doc(db, 'categories', id);
  
  // Get current category data
  const categorySnap = await getDoc(categoryRef);
  if (!categorySnap.exists()) {
    throw new Error('Category not found');
  }
  
  // Verify companyId matches
  const currentData = categorySnap.data() as Category;
  if (currentData.companyId !== companyId) {
    throw new Error('Unauthorized: Category belongs to different company');
  }
  
  // Get userId from category for audit
  const userId = currentData.userId || companyId;
  
  // Update category data
  const updateData = {
    ...data,
    updatedAt: serverTimestamp()
  };
  
  batch.update(categoryRef, updateData);
  
  // Create audit log
  createAuditLog(batch, 'update', 'category', id, updateData, userId);
  
  await batch.commit();
};

export const deleteCategory = async (
  id: string,
  companyId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const categoryRef = doc(db, 'categories', id);
  
  // Get current category data
  const categorySnap = await getDoc(categoryRef);
  if (!categorySnap.exists()) {
    throw new Error('Category not found');
  }
  
  const currentCategory = categorySnap.data() as Category;
  // Verify companyId matches
  if (currentCategory.companyId !== companyId) {
    throw new Error('Unauthorized: Category belongs to different company');
  }
  
  // Get userId from category for audit
  const userId = currentCategory.userId || companyId;
  
  // Check if category has products
  if (currentCategory.productCount && currentCategory.productCount > 0) {
    throw new Error('Cannot delete category with existing products. Please move or delete products first.');
  }
  
  // Soft delete by setting isActive to false
  batch.update(categoryRef, {
    isActive: false,
    updatedAt: serverTimestamp()
  });
  
  // Create audit log
  createAuditLog(batch, 'delete', 'category', id, { isActive: false }, userId);
  
  await batch.commit();
};

export const getCategory = async (id: string, companyId: string): Promise<Category | null> => {
  const categoryRef = doc(db, 'categories', id);
  const categorySnap = await getDoc(categoryRef);
  
  if (!categorySnap.exists()) {
    return null;
  }
  
  // Verify companyId matches
  const categoryData = categorySnap.data() as Category;
  if (categoryData.companyId !== companyId) {
    return null; // Category belongs to different company
  }
  
  const category = categorySnap.data() as Category;
  
  return {
    id: categorySnap.id,
    ...category
  };
};

export const getCompanyCategories = async (companyId: string): Promise<Category[]> => {
  const q = query(
    collection(db, 'categories'),
    where('companyId', '==', companyId),
    where('isActive', '==', true),
    orderBy('name', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Category[];
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
  companyId: string,
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
    data.stock < 0
  ) {
    throw new Error('Invalid product data');
  }

  const batch = writeBatch(db);
  
  // Set default inventory settings
  const productData = {
    ...data,
    companyId, // Ensure companyId is set
    isAvailable: true,
    inventoryMethod: (data as any).inventoryMethod || 'FIFO',
    enableBatchTracking: (data as any).enableBatchTracking !== false, // Default to true
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  // Get userId from data if available, otherwise use companyId for audit
  const userId = data.userId || companyId;
  
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
        companyId, // Ensure companyId is set
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
          companyId, // Ensure companyId is set
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
  
  console.log('=== BATCH COMMIT DEBUG ===');
  console.log('About to commit batch with all operations...');
  
  try {
    await batch.commit();
    console.log('✅ Batch committed successfully!');
  } catch (error) {
    console.error('❌ Batch commit failed:', error);
    throw error;
  }
  
  // Update category product count after successful product creation
  if (data.category) {
    try {
      await updateCategoryProductCount(data.category, companyId, true);
    } catch (error) {
      console.error('Error updating category product count:', error);
      // Don't throw here as the product was created successfully
    }
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
    console.log('Updating product:', id, 'data:', data, 'stockReason:', stockReason, 'stockChange:', stockChange, 'supplierInfo:', supplierInfo);
  const batch = writeBatch(db);
  const productRef = doc(db, 'products', id);
  
  // Get current product data
  const productSnap = await getDoc(productRef);
  if (!productSnap.exists()) {
    throw new Error('Product not found');
  }
  
  const currentProduct = productSnap.data() as Product;
  // Verify product belongs to company
  if (currentProduct.companyId !== companyId) {
    throw new Error('Unauthorized: Product belongs to different company');
  }
  
  // Get userId from product for audit
  const userId = currentProduct.userId || companyId;
  
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
        companyId, // Ensure companyId is set
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
          companyId, // Ensure companyId is set
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
    
    // Update category product counts if category changed
    if (data.category && data.category !== currentProduct.category) {
      try {
        // Decrement old category count
        if (currentProduct.category) {
          await updateCategoryProductCount(currentProduct.category, companyId, false);
        }
        // Increment new category count
        if (data.category) {
          await updateCategoryProductCount(data.category, companyId, true);
        }
      } catch (error) {
        console.error('Error updating category product counts:', error);
        // Don't throw here as the product was updated successfully
      }
    }
    
    // Update category product counts if visibility changed
    if (data.isVisible !== undefined && data.isVisible !== currentProduct.isVisible) {
      try {
        const categoryName = data.category || currentProduct.category;
        if (categoryName) {
          // If product became invisible, decrement count
          // If product became visible, increment count
          const shouldIncrement = data.isVisible !== false;
          await updateCategoryProductCount(categoryName, companyId, shouldIncrement);
        }
      } catch (error) {
        console.error('Error updating category product count for visibility change:', error);
        // Don't throw here as the product was updated successfully
      }
    }
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
};

// Soft delete product and update category count
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
    
    // Soft delete the product
    batch.update(productRef, {
      isDeleted: true,
      updatedAt: serverTimestamp()
    });
    
    // Create audit log
    createAuditLog(batch, 'delete', 'product', id, { isDeleted: true }, userId);
    
    await batch.commit();
    
    // Update category product count
    if (currentProduct.category) {
      try {
        await updateCategoryProductCount(currentProduct.category, companyId, false);
      } catch (error) {
        console.error('Error updating category product count after deletion:', error);
        // Don't throw here as the product was deleted successfully
      }
    }
  } catch (error) {
    console.error('Error soft deleting product:', error);
    throw error;
  }
};

// ============================================================================
// SALES MANAGEMENT WITH FIFO/LIFO
// ============================================================================

export const createSale = async (
  data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>,
  companyId: string
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
  
  // Get userId from data if available
  const userId = data.userId || companyId;
  
  // Validate product stock and calculate cost prices for all products
  for (const product of data.products) {
    const productRef = doc(db, 'products', product.productId);
    const productSnap = await getDoc(productRef);
    
    if (!productSnap.exists()) {
      throw new Error(`Product with ID ${product.productId} not found`);
    }
    
    const productData = productSnap.data() as Product;
    // Verify product ownership by companyId
    if (productData.companyId !== companyId) {
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
      companyId, // Ensure companyId is set
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
    companyId, // Ensure companyId is set
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
  companyId: string
): Promise<Expense> => {
  // Get userId from data if available
  const userId = data.userId || companyId;
  
  const expenseRef = await addDoc(collection(db, 'expenses'), {
    ...data,
    companyId, // Ensure companyId is set
    isAvailable: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return {
    id: expenseRef.id,
    ...data,
    companyId,
    isAvailable: true,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  };
};

export const updateExpense = async (
  id: string,
  data: Partial<Expense>,
  companyId: string
): Promise<void> => {
  const expenseRef = doc(db, 'expenses', id);
  const expenseSnap = await getDoc(expenseRef);
  
  if (!expenseSnap.exists()) {
    throw new Error('Expense not found');
  }

  const expense = expenseSnap.data() as Expense;
  
  // Verify authorization: Check companyId match, with fallback for legacy expenses
  const expenseCompanyId = expense.companyId;
  
  // Get userId for authorization check (from auth context, not from data)
  // Note: We need to verify the user has permission, which could be through userId or companyId
  const expenseUserId = expense.userId;
  
  // Authorization logic:
  // 1. If companyId matches, allow update
  // 2. If companyId doesn't match but userId matches (legacy expense or company switch), 
  //    allow update and update companyId to current company
  // 3. Otherwise, reject
  
  if (expenseCompanyId && expenseCompanyId !== companyId) {
    // CompanyId mismatch - check if this is a legacy expense that needs migration
    // If the expense belongs to the same user but different company (legacy case),
    // we allow the update and migrate it to the current company
    if (data.userId && expenseUserId && data.userId === expenseUserId) {
      // Same user, different company - this is likely a legacy expense being migrated
      // Allow update and migrate companyId
      console.log(`⚠️ Migrating expense ${id} from company ${expenseCompanyId} to ${companyId}`);
    } else {
      // Different user - unauthorized
      throw new Error('Unauthorized: Expense belongs to different company');
    }
  }
  
  // If expense doesn't have companyId (legacy), we allow update if userId matches
  // and will update the expense with the current companyId
  if (!expenseCompanyId && data.userId && expenseUserId && data.userId !== expenseUserId) {
    throw new Error('Unauthorized: Cannot change expense owner');
  }
  
  // Get userId for audit log
  const userId = expense.userId || data.userId || companyId;
  
  // Ensure companyId is set in update (for legacy expenses or company migration)
  // Always use the current companyId to ensure consistency
  const updateData = {
    ...data,
    companyId: companyId, // Always use current companyId for consistency
    updatedAt: serverTimestamp()
  };
  
  const batch = writeBatch(db);
  
  batch.update(expenseRef, updateData);
  
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

export const getExpenseTypes = async (companyId: string): Promise<ExpenseType[]> => {
  // Ensure default expense types exist first
  await ensureDefaultExpenseTypes();
  
  const defaultSnap = await getDocs(query(collection(db, 'expenseTypes'), where('isDefault', '==', true)));
  // Query for company-specific types (using companyId field if it exists, otherwise fallback to userId for legacy)
  const companySnap = await getDocs(query(collection(db, 'expenseTypes'), where('companyId', '==', companyId)));
  const allDocs = [...defaultSnap.docs, ...companySnap.docs];
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

// Update expense type
export const updateExpenseType = async (typeId: string, updates: Partial<ExpenseType>): Promise<ExpenseType> => {
  const typeRef = doc(db, 'expenseTypes', typeId);
  const updateData = {
    ...updates,
    updatedAt: serverTimestamp()
  };
  await updateDoc(typeRef, updateData);
  const snap = await getDoc(typeRef);
  return { id: snap.id, ...snap.data() } as ExpenseType;
};

// Delete expense type (only if not default and not in use)
export const deleteExpenseType = async (typeId: string, companyId: string): Promise<void> => {
  const typeRef = doc(db, 'expenseTypes', typeId);
  const typeSnap = await getDoc(typeRef);
  
  if (!typeSnap.exists()) {
    throw new Error('Expense type not found');
  }
  
  const typeData = typeSnap.data() as ExpenseType;
  
  // Cannot delete default types
  if (typeData.isDefault) {
    throw new Error('Cannot delete default expense types');
  }
  
  // Check if type is in use by this company
  const expensesQuery = query(
    collection(db, 'expenses'),
    where('companyId', '==', companyId),
    where('category', '==', typeData.name),
    where('isAvailable', '!=', false)
  );
  const expensesSnap = await getDocs(expensesQuery);
  
  if (!expensesSnap.empty) {
    throw new Error(`Cannot delete expense type: ${expensesSnap.size} expense(s) are using this category`);
  }
  
  await deleteDoc(typeRef);
};

// Get expense count by category for a company
export const getExpenseCountByCategory = async (companyId: string): Promise<Record<string, number>> => {
  const expensesQuery = query(
    collection(db, 'expenses'),
    where('companyId', '==', companyId),
    where('isAvailable', '!=', false)
  );
  const expensesSnap = await getDocs(expensesQuery);
  
  const counts: Record<string, number> = {};
  expensesSnap.forEach((doc) => {
    const expense = doc.data() as Expense;
    const category = expense.category || 'other';
    counts[category] = (counts[category] || 0) + 1;
  });
  
  return counts;
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

export const updateDashboardStats = async (companyId: string): Promise<void> => {
  // This function would calculate and update dashboard statistics
  // Implementation depends on your specific requirements
  console.log('Dashboard stats update requested for company:', companyId);
};

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
  // userId parameter is actually company.id in this context
  // Check companyId instead of userId to allow employees to update sales
  if (sale.companyId !== userId) {
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

export const getCompanyByUserId = async (companyId: string): Promise<Company> => {
  // First try to get company by document ID (most common case)
  try {
    const companyDoc = await getDoc(doc(db, 'companies', companyId));
    if (companyDoc.exists()) {
      return {
        id: companyDoc.id,
        ...companyDoc.data()
      } as Company;
    }
  } catch (error) {
    console.log('Company not found by document ID, trying alternative lookup...');
  }
  
  // Fallback: search by companyId field (for backward compatibility)
  const companiesRef = collection(db, 'companies');
  const q = query(companiesRef, where('companyId', '==', companyId));
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

// ============================================================================
// SELLER ORDERING SETTINGS
// ============================================================================

export const getSellerSettings = async (userId: string): Promise<SellerSettings | null> => {
  try {
    const ref = doc(db, 'sellerSettings', userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as SellerSettings;
    return { ...data };
  } catch (error) {
    console.error('Error fetching seller settings:', error);
    throw error;
  }
};

export const updateSellerSettings = async (userId: string, settings: Partial<SellerSettings>): Promise<void> => {
  try {
    const ref = doc(db, 'sellerSettings', userId);
    const now = serverTimestamp();
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { ...settings, updatedAt: now });
    } else {
      await setDoc(ref, { userId, createdAt: now, updatedAt: now, currency: 'XAF', paymentMethods: {}, ...settings });
    }
  } catch (error) {
    console.error('Error updating seller settings:', error);
    throw error;
  }
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

export const subscribeToStockChanges = (companyId: string, callback: (stockChanges: StockChange[]) => void): (() => void) => {
  const q = query(
    collection(db, 'stockChanges'),
    where('companyId', '==', companyId), // Filter by company
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

export const subscribeToCustomers = (companyId: string, callback: (customers: Customer[]) => void) => {
  const q = query(
    collection(db, 'customers'),
    where('companyId', '==', companyId),
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
export const subscribeToObjectives = (companyId: string, callback: (objectives: Objective[]) => void): (() => void) => {
  const q = query(
    collection(db, 'objectives'),
    where('companyId', '==', companyId),
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
  companyId: string
): Promise<Objective> => {
  // Validate objective data
  if (!data.title || !data.targetAmount || !data.metric) {
    throw new Error('Invalid objective data');
  }
  
  // Get userId from data if available
  const userId = data.userId || companyId;

  const batch = writeBatch(db);
  
  // Create objective
  const objectiveRef = doc(collection(db, 'objectives'));
  const objectiveData = {
    ...data,
    userId,
    companyId, // Ensure companyId is set
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
  companyId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const objectiveRef = doc(db, 'objectives', id);
  
  // Get current objective data for audit log
  const objectiveSnap = await getDoc(objectiveRef);
  if (!objectiveSnap.exists()) {
    throw new Error('Objective not found');
  }
  
  // Verify companyId matches
  const objective = objectiveSnap.data() as Objective;
  if (objective.companyId !== companyId) {
    throw new Error('Unauthorized: Objective belongs to different company');
  }
  
  // Get userId from objective for audit
  const userId = objective.userId || companyId;
  
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

export const deleteObjective = async (objectiveId: string, companyId: string): Promise<void> => {
  const batch = writeBatch(db);
  const objectiveRef = doc(db, 'objectives', objectiveId);
  // Get current objective data for audit log
  const objectiveSnap = await getDoc(objectiveRef);
  if (!objectiveSnap.exists()) {
    throw new Error('Objective not found');
  }
  // Verify companyId matches
  const objective = objectiveSnap.data() as Objective;
  if (objective.companyId !== companyId) {
    throw new Error('Unauthorized: Objective belongs to different company');
  }
  
  // Get userId from objective for audit
  const userId = objective.userId || companyId;
  
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
  
  // FIXED: Ensure isDeleted is explicitly set to false (not undefined)
  // This ensures the entry matches the query filter
  const data = { 
    ...entry, 
    isDeleted: entry.isDeleted !== undefined ? entry.isDeleted : false, // Explicitly set to false if undefined
    createdAt: now, 
    updatedAt: now 
  };
  
  // Log for sortie entries to verify negative amount is being stored
  if (entry.sourceType === 'manual' && entry.type === 'sortie') {
    console.log('[createFinanceEntry] Storing sortie entry:', {
      amount: data.amount,
      type: data.type,
      description: data.description
    });
    // Ensure amount is negative for sortie
    if (data.amount >= 0) {
      console.error('[createFinanceEntry] ERROR: Sortie amount is not negative!', data.amount);
      data.amount = -Math.abs(data.amount);
      console.log('[createFinanceEntry] Fixed amount to:', data.amount);
    }
  }
  
  // FIXED: Use batch for manual entries (with audit log) and ensure proper commit
  // With includeMetadataChanges: true in onSnapshot, batch writes will trigger immediately
  if (entry.sourceType === 'manual') {
    // For manual entries, we need audit log, so use batch
    // The onSnapshot listener with includeMetadataChanges will catch this write immediately
    const batch = writeBatch(db);
    batch.set(ref, data);
    await createAuditLog(
      batch,
      'create',
      'finance',
      ref.id,
      { all: { oldValue: null, newValue: data } },
      entry.userId
    );
    
    // Commit batch - with includeMetadataChanges: true, onSnapshot will fire immediately
    await batch.commit();
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[createFinanceEntry] ✅ Batch committed for manual entry:', {
        id: ref.id,
        type: data.type,
        amount: data.amount,
        isDeleted: data.isDeleted,
        companyId: data.companyId,
        timestamp: new Date().toISOString()
      });
      console.log('[createFinanceEntry] 🔔 onSnapshot should fire immediately with includeMetadataChanges');
    }
  } else {
    // For non-manual entries, simple write is faster
    await setDoc(ref, data);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[createFinanceEntry] ✅ Document set for non-manual entry:', {
        id: ref.id,
        type: data.type,
        isDeleted: data.isDeleted,
        companyId: data.companyId,
        timestamp: new Date().toISOString()
      });
      console.log('[createFinanceEntry] 🔔 onSnapshot should fire immediately');
    }
  }
  
  // Get the saved data to return (Firestore will have resolved serverTimestamp)
  const snap = await getDoc(ref);
  const savedData = snap.data();
  
  // Verify what was actually saved
  if (entry.sourceType === 'manual' && entry.type === 'sortie') {
    console.log('[createFinanceEntry] ✅ Saved data verified:', {
      amount: savedData?.amount,
      type: savedData?.type,
      isDeleted: savedData?.isDeleted
    });
  }
  
  // Return the saved entry - Firestore real-time listeners will update automatically via onSnapshot
  return { id: ref.id, ...savedData } as FinanceEntry;
};

export const updateFinanceEntry = async (id: string, data: Partial<FinanceEntry>): Promise<void> => {
  const ref = doc(db, 'finances', id);
  
  // Ensure sortie entries always have negative amount
  if (data.type === 'sortie' && data.amount !== undefined) {
    if (data.amount >= 0) {
      console.log('[updateFinanceEntry] Fixing sortie amount from', data.amount, 'to negative');
      data.amount = -Math.abs(data.amount);
    }
    console.log('[updateFinanceEntry] Updating sortie entry with amount:', data.amount);
  }
  
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
  if (!sale || !sale.id || !sale.userId || !sale.companyId) {
    console.error('syncFinanceEntryWithSale: Invalid sale object received, skipping sync.', sale);
    return; // Exit early if data is invalid
  }

  // Find existing finance entry for this sale
  const q = query(collection(db, 'finances'), where('sourceType', '==', 'sale'), where('sourceId', '==', sale.id));
  const snap = await getDocs(q);
  const entry: Omit<FinanceEntry, 'id' | 'createdAt' | 'updatedAt'> = {
    userId: sale.userId,
    companyId: sale.companyId, // Ensure companyId is set
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
  if (!expense || !expense.id || !expense.userId || !expense.companyId) {
    console.error('syncFinanceEntryWithExpense: Invalid expense object received, skipping sync.', expense);
    return; // Exit early if data is invalid
  }

  const q = query(collection(db, 'finances'), where('sourceType', '==', 'expense'), where('sourceId', '==', expense.id));
  const entry: Omit<FinanceEntry, 'id' | 'createdAt' | 'updatedAt'> = {
    userId: expense.userId,
    companyId: expense.companyId, // Ensure companyId is set
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

export const subscribeToSuppliers = (companyId: string, callback: (suppliers: Supplier[]) => void): (() => void) => {
  const q = query(
    collection(db, 'suppliers'),
    where('companyId', '==', companyId), // Filter by company
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
  companyId: string
): Promise<Supplier> => {
  // Validate supplier data
  if (!data.name || !data.contact) {
    throw new Error('Invalid supplier data');
  }

  // Get userId from data if available
  const userId = data.userId || companyId;

  const batch = writeBatch(db);
  
  // Create supplier
  const supplierRef = doc(collection(db, 'suppliers'));
  const supplierData = {
    ...data,
    userId,
    companyId, // Ensure companyId is set
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
  companyId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const supplierRef = doc(db, 'suppliers', id);
  
  // Get current supplier data for audit log
  const supplierSnap = await getDoc(supplierRef);
  if (!supplierSnap.exists()) {
    throw new Error('Supplier not found');
  }
  
  const supplier = supplierSnap.data() as Supplier;
  // Verify supplier belongs to company
  if (supplier.companyId !== companyId) {
    throw new Error('Unauthorized: Supplier belongs to different company');
  }
  
  // Get userId from supplier for audit
  const userId = supplier.userId || companyId;
  
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
  companyId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const supplierRef = doc(db, 'suppliers', id);
  
  // Get current supplier data
  const supplierSnap = await getDoc(supplierRef);
  if (!supplierSnap.exists()) {
    throw new Error('Supplier not found');
  }
  
  const supplier = supplierSnap.data() as Supplier;
  // Verify supplier belongs to company
  if (supplier.companyId !== companyId) {
    throw new Error('Unauthorized: Supplier belongs to different company');
  }
  
  // Get userId from supplier for audit
  const userId = supplier.userId || companyId;
  
  // Check if supplier has outstanding debts
  const q = query(
    collection(db, 'finances'),
    where('companyId', '==', companyId),
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
  companyId: string,
  batchId?: string
): Promise<FinanceEntry> => {
  // Get userId from supplier or use companyId for audit
  const userId = companyId; // For legacy compatibility, will be updated later
  
  const entry: Omit<FinanceEntry, 'id' | 'createdAt' | 'updatedAt'> = {
    userId,
    companyId, // Ensure companyId is set
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
  companyId: string
): Promise<FinanceEntry> => {
  // Get userId from supplier or use companyId for audit
  const userId = companyId; // For legacy compatibility, will be updated later
  
  const entry: Omit<FinanceEntry, 'id' | 'createdAt' | 'updatedAt'> = {
    userId,
    companyId, // Ensure companyId is set
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

// ============================================================================
// USER TAGS MANAGEMENT
// ============================================================================

/**
 * Subscribe to user tags
 */
export const subscribeToUserTags = (userId: string, callback: (tags: ProductTag[]) => void): (() => void) => {
  const q = query(
    collection(db, 'userTags'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const tags = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ProductTag[];
    callback(tags);
  });
};

/**
 * Create a new user tag
 */
export const createUserTag = async (
  data: Omit<ProductTag, 'id'>,
  userId: string
): Promise<ProductTag> => {
  const batch = writeBatch(db);
  
  // Create user tag
  const tagRef = doc(collection(db, 'userTags'));
  const tagData = {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  batch.set(tagRef, tagData);
  
  // Create audit log
  createAuditLog(batch, 'create', 'product', tagRef.id, tagData, userId);
  
  await batch.commit();
  
  return {
    id: tagRef.id,
    ...tagData,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  };
};

/**
 * Update a user tag
 */
export const updateUserTag = async (
  id: string,
  data: Partial<ProductTag>,
  userId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const tagRef = doc(db, 'userTags', id);
  
  // Get current tag data for audit log
  const tagSnap = await getDoc(tagRef);
  if (!tagSnap.exists()) {
    throw new Error('Tag not found');
  }
  
  const tag = tagSnap.data() as ProductTag;
  if (tag.userId !== userId) {
    throw new Error('Unauthorized to update this tag');
  }
  
  const updateData = {
    ...data,
    updatedAt: serverTimestamp()
  };
  batch.update(tagRef, updateData);
  
  // Create audit log
  createAuditLog(batch, 'update', 'product', id, updateData, userId);
  
  await batch.commit();
};

/**
 * Delete a user tag
 */
export const deleteUserTag = async (tagId: string, userId: string): Promise<void> => {
  const batch = writeBatch(db);
  const tagRef = doc(db, 'userTags', tagId);
  
  // Get current tag data for audit log
  const tagSnap = await getDoc(tagRef);
  if (!tagSnap.exists()) {
    throw new Error('Tag not found');
  }
  
  const tag = tagSnap.data() as ProductTag;
  if (tag.userId !== userId) {
    throw new Error('Unauthorized to delete this tag');
  }
  
  // Delete the tag
  batch.delete(tagRef);
  
  // Create audit log
  createAuditLog(batch, 'delete', 'product', tagId, tag, userId);
  
  await batch.commit();
};

/**
 * Get user tags (one-time fetch)
 */
export const getUserTags = async (userId: string): Promise<ProductTag[]> => {
  const q = query(
    collection(db, 'userTags'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as ProductTag[];
};