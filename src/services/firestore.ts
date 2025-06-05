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
  PaymentStatus
} from '../types/models';

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
    orderBy('date', 'desc')
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
  
  // Check if category already exists
  const existingQuery = query(
    collection(db, 'categories'),
    where('name', '==', data.name)
  );
  const existingDocs = await getDocs(existingQuery);
  
  if (!existingDocs.empty) {
    throw new Error('Category already exists');
  }
  
  // Create category
  const categoryRef = doc(collection(db, 'categories'));
  const categoryData = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId
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
  
  // Validate product stock
  const productRef = doc(db, 'products', data.productId);
  const productSnap = await getDoc(productRef);
  
  if (!productSnap.exists()) {
    throw new Error('Product not found');
  }
  
  const product = productSnap.data() as Product;
  if (product.stock < data.quantity) {
    throw new Error('Insufficient stock');
  }
  
  // Create sale
  const saleRef = doc(collection(db, 'sales'));
  const saleData = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  batch.set(saleRef, saleData);
  
  // Update product stock
  batch.update(productRef, {
    stock: product.stock - data.quantity,
    updatedAt: serverTimestamp()
  });
  
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

export const updateDashboardStats = async (): Promise<void> => {
  const batch = writeBatch(db);
  const statsRef = doc(db, 'dashboardStats', 'current');

  const [salesSnap, expensesSnap] = await Promise.all([
    getDocs(collection(db, 'sales')),
    getDocs(collection(db, 'expenses')),
  ]);

  const sales = salesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Sale[];
  const expenses = expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Expense[];

  const stats: Partial<DashboardStats> = {
    totalSales: sales.reduce((sum, sale) => sum + sale.totalAmount, 0),
    totalExpenses: expenses.reduce((sum, expense) => sum + expense.amount, 0),
    totalProfit: sales.reduce((sum, sale) => sum + (sale.totalAmount - (sale.negotiatedPrice || sale.basePrice)), 0),
    activeOrders: sales.filter(sale => sale.status !== 'paid').length,
    completedOrders: sales.filter(sale => sale.status === 'paid').length,
    cancelledOrders: sales.filter(sale => sale.paymentStatus === 'cancelled').length,
  };

  batch.update(statsRef, stats);
  await batch.commit();
};

export const getLowStockProducts = async (threshold?: number): Promise<Product[]> => {
  const productsRef = collection(db, 'products');
  const q = query(
    productsRef,
    where('stock', '<=', threshold || 10),
    orderBy('stock', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Product[];
};

export const getProductPerformance = async (productId: string): Promise<{
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  averagePrice: number;
}> => {
  const salesRef = collection(db, 'sales');
  const q = query(salesRef, where('productId', '==', productId));

  const snapshot = await getDocs(q);
  const sales = snapshot.docs.map(doc => doc.data() as Sale);

  return {
    totalSales: sales.length,
    totalRevenue: sales.reduce((sum, sale) => sum + sale.totalAmount, 0),
    totalProfit: sales.reduce((sum, sale) => sum + (sale.totalAmount - (sale.negotiatedPrice || sale.basePrice)), 0),
    averagePrice: sales.length > 0
      ? sales.reduce((sum, sale) => sum + (sale.negotiatedPrice || sale.basePrice), 0) / sales.length
      : 0,
  };
};

export const addSaleWithValidation = async (sale: Sale) => {
  const productDoc = await getDoc(doc(db, 'products', sale.productId));
  if (!productDoc.exists()) {
    throw new Error('Product does not exist.');
  }

  const product = productDoc.data() as Product;

  // Validate quantity
  if (sale.quantity <= 0 || sale.quantity > product.stock) {
    throw new Error('Invalid quantity.');
  }

  // Validate negotiated price
  if (sale.negotiatedPrice && sale.negotiatedPrice > product.sellingPrice) {
    throw new Error('Negotiated price exceeds standard selling price.');
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