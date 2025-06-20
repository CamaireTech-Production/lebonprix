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
  type WriteBatch
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
  Customer
} from '../types/models';
import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';

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
    callback(sales);
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
  entityType: 'product' | 'sale' | 'expense' | 'category',
  entityId: string,
  changes: any,
  performedBy: string
) => {
  const auditLogRef = doc(collection(db, 'auditLogs'));
  batch.set(auditLogRef, {
    action,
    entityType,
    entityId,
    changes,
    performedBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};

export const createProduct = async (
  data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<Product> => {
  // Validate product data
  if (
    !data.name ||
    data.costPrice < 0 ||
    data.sellingPrice < data.costPrice ||
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
  userId: string
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
  
  // Create audit log
  await createAuditLog(
    batch,
    'update',
    'product',
    id,
    Object.keys(data).reduce((acc, key) => ({
      ...acc,
      [key]: {
        oldValue: currentProduct.data()[key],
        newValue: data[key as keyof Product]
      }
    }), {}),
    userId
  );
  
  await batch.commit();
};

export const createSale = async (
  data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<Sale> => {
  const batch = writeBatch(db);
  
  // Validate product stock for all products
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
    
    // Update product stock
    batch.update(productRef, {
      stock: productData.stock - product.quantity,
      updatedAt: serverTimestamp()
    });
  }
  
  // Create sale
  const saleRef = doc(collection(db, 'sales'));
  const saleData = {
    ...data,
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

  const sales = salesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Sale[];
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

  // Delete the sale
  batch.delete(saleRef);
  
  // Create audit log
  await createAuditLog(
    batch,
    'delete',
    'sale',
    saleId,
    { all: { oldValue: saleData, newValue: null } },
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