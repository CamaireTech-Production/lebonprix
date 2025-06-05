import { 
  collection, 
  doc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  type QueryConstraint,
  type DocumentData,
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
  ExpenseCategory,
  AuditLog
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
export const subscribeToDashboardStats = (callback: (stats: DashboardStats) => void): (() => void) => {
  const docRef = doc(db, 'dashboardStats', 'current');
  
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() } as DashboardStats);
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
  
  // Get all required data
  const [salesSnap, expensesSnap, productsSnap] = await Promise.all([
    getDocs(collection(db, 'sales')),
    getDocs(collection(db, 'expenses')),
    getDocs(collection(db, 'products'))
  ]);
  
  const sales = salesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Sale[];
  const expenses = expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Expense[];
  const products = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
  
  // Calculate stats
  const stats: Partial<DashboardStats> = {
    totalSales: sales.reduce((sum, sale) => sum + sale.totalAmount, 0),
    totalExpenses: expenses.reduce((sum, expense) => sum + expense.amount, 0),
    totalProfit: sales.reduce((sum, sale) => sum + sale.profit, 0),
    
    activeOrders: sales.filter(sale => sale.status !== 'paid').length,
    completedOrders: sales.filter(sale => sale.status === 'paid').length,
    cancelledOrders: sales.filter(sale => sale.paymentStatus === 'cancelled').length,
    
    totalProducts: products.length,
    lowStockProducts: products
      .filter(p => p.stock <= (p.minimumStock || 10))
      .map(p => p.id),
    outOfStockProducts: products
      .filter(p => p.stock === 0)
      .map(p => p.id),
    
    averageOrderValue: sales.length > 0
      ? sales.reduce((sum, sale) => sum + sale.totalAmount, 0) / sales.length
      : 0,
    
    lastUpdated: serverTimestamp()
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
    ...doc.data()
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
    totalProfit: sales.reduce((sum, sale) => sum + sale.profit, 0),
    averagePrice: sales.length > 0
      ? sales.reduce((sum, sale) => sum + sale.negotiatedPrice, 0) / sales.length
      : 0
  };
};

export const getAuditLogs = async (
  entityType?: 'product' | 'sale' | 'expense' | 'category',
  entityId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<AuditLog[]> => {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  
  if (entityType) {
    constraints.push(where('entityType', '==', entityType));
  }
  
  if (entityId) {
    constraints.push(where('entityId', '==', entityId));
  }
  
  if (startDate) {
    constraints.push(where('createdAt', '>=', startDate));
  }
  
  if (endDate) {
    constraints.push(where('createdAt', '<=', endDate));
  }
  
  const q = query(collection(db, 'auditLogs'), ...constraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as AuditLog[];
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