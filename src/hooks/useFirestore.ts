import { useState, useEffect } from 'react';
import { 
  createSale, 
  updateSaleStatus, 
  subscribeToSales,
  subscribeToCategories,
  createCategory,
  subscribeToProducts,
  createProduct,
  updateProduct,
  subscribeToExpenses,
  createExpense,
  updateExpense,
  subscribeToDashboardStats,
  updateSaleDocument,
  subscribeToCustomers,
  syncFinanceEntryWithSale,
  syncFinanceEntryWithExpense,
  subscribeToSuppliers,
  createSupplier,
  updateSupplier,
  softDeleteSupplier
} from '../services/firestore';
import type {
  Product,
  Sale,
  Expense,
  Category,
  DashboardStats,
  OrderStatus,
  PaymentStatus,
  Customer,
  FinanceEntry,
  Supplier
} from '../types/models';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, deleteDoc, collection, query, where, orderBy, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

// Utility to deeply remove undefined fields from an object
function removeUndefined(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  } else if (obj && typeof obj === 'object') {
    return Object.entries(obj)
      .filter(([_, v]) => v !== undefined)
      .reduce((acc, [k, v]) => ({ ...acc, [k]: removeUndefined(v) }), {});
  }
  return obj;
}

// Products Hook
export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = subscribeToProducts((data) => {
      // Filter products for the current user
      const userProducts = data.filter(product => product.userId === user.uid);
      setProducts(userProducts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const addProduct = async (
    productData: Omit<Product, 'id' | 'createdAt'>,
    supplierInfo?: {
      supplierId?: string;
      isOwnPurchase?: boolean;
      isCredit?: boolean;
      costPrice?: number;
    }
  ) => {
    if (!user) throw new Error('User not authenticated');
    try {
      await createProduct(productData, user.uid, supplierInfo);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateProductData = async (
    productId: string, 
    data: Partial<Product>,
    stockReason?: 'sale' | 'restock' | 'adjustment' | 'creation',
    stockChange?: number,
    supplierInfo?: {
      supplierId?: string;
      isOwnPurchase?: boolean;
      isCredit?: boolean;
      costPrice?: number;
    }
  ) => {
    if (!user) throw new Error('User not authenticated');
    try {
      await updateProduct(productId, data, user.uid, stockReason, stockChange, supplierInfo);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!user?.uid) throw new Error('User not authenticated');
    
    try {
      await deleteDoc(doc(db, 'products', productId));
      setProducts(prev => prev.filter(p => p.id !== productId));
    } catch (err) {
      console.error('Error deleting product:', err);
      throw err;
    }
  };

  return {
    products,
    loading,
    error,
    addProduct,
    updateProduct,
    deleteProduct
  };
};

// Categories Hook
export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = subscribeToCategories((data) => {
      // Filter categories for the current user
      const userCategories = data.filter(category => category.userId === user.uid);
      setCategories(userCategories);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const addCategory = async (name: string) => {
    if (!user) throw new Error('User not authenticated');
    try {
      const category = await createCategory({ name, userId: user.uid }, user.uid);
      return category;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return { categories, loading, error, addCategory };
};

// Sales Hook
export const useSales = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Function to update local state after a sale is modified
  const updateLocalSale = (updatedSale: Sale) => {
    setSales(currentSales => 
      currentSales.map(sale => 
        sale.id === updatedSale.id ? updatedSale : sale
      )
    );
  };

  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = subscribeToSales((data) => {
      // Filter sales for the current user
      const userSales = data.filter(sale => sale.userId === user.uid);
      setSales(userSales);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const addSale = async (data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>): Promise<Sale> => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    try {
      const newSale = await createSale({ ...data, userId: user.uid }, user.uid);
      await syncFinanceEntryWithSale(newSale);
      return newSale;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateSale = async (saleId: string, data: Partial<Sale>): Promise<void> => {
    if (!user) {
      throw new Error('User must be authenticated to update a sale');
    }

    try {
      const saleRef = doc(db, 'sales', saleId);
      const saleDoc = await getDoc(saleRef);
      
      if (!saleDoc.exists()) {
        throw new Error('Sale not found');
      }

      const saleData = saleDoc.data() as Sale;
      if (saleData.userId !== user.uid) {
        throw new Error('You do not have permission to update this sale');
      }

      const updatedSale = {
        ...saleData,
        ...data,
        updatedAt: Timestamp.now()
      };

      // Deeply remove undefined fields before sending to Firestore
      const cleanedSale = removeUndefined(updatedSale);

      // Update in Firestore
      await updateSaleDocument(saleId, cleanedSale, user.uid);
      await syncFinanceEntryWithSale(cleanedSale);

      // Update local state
      updateLocalSale(cleanedSale);
    } catch (err) {
      console.error('Error updating sale:', err);
      throw err;
    }
  };

  const fetchSales = async () => {
    if (!user) return;
    
    try {
      const salesRef = collection(db, 'sales');
      const q = query(salesRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const salesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Sale[];
      setSales(salesData);
    } catch (error) {
      console.error('Error fetching sales:', error);
      throw error;
    }
  };

  const deleteSale = async (saleId: string, userId: string) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      const saleRef = doc(db, 'sales', saleId);
      await deleteDoc(saleRef);
      // Sync finance entry (mark as deleted)
      const saleDoc = await getDoc(saleRef);
      if (saleDoc.exists()) {
        const saleData = saleDoc.data() as Sale;
        await syncFinanceEntryWithSale({ ...saleData, isAvailable: false });
      }
      // Update local state by removing the deleted sale
      setSales(prevSales => prevSales?.filter(sale => sale.id !== saleId) || []);
      // Refresh sales data to update dashboard
      await fetchSales();
      return true;
    } catch (error) {
      console.error('Error deleting sale:', error);
      throw error;
    }
  };

  const updateStatus = async (id: string, status: OrderStatus, paymentStatus: PaymentStatus) => {
    if (!user) throw new Error('User not authenticated');
    try {
      await updateSaleStatus(id, status, paymentStatus, user.uid);
      
      // Update local state
      setSales(currentSales => 
        currentSales.map(sale => 
          sale.id === id 
            ? { ...sale, status, paymentStatus, updatedAt: Timestamp.now() }
            : sale
        )
      );
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return { sales, loading, error, addSale, updateSale, deleteSale, updateStatus };
};

// Expenses Hook
export const useExpenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = subscribeToExpenses((data) => {
      // Filter expenses for the current user
      const userExpenses = data.filter(expense => expense.userId === user.uid);
      setExpenses(userExpenses);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const addExpense = async (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user) throw new Error('User not authenticated');
    try {
      const newExpense = await createExpense({ ...data, userId: user.uid }, user.uid);
      await syncFinanceEntryWithExpense(newExpense);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateExpenseData = async (id: string, data: Partial<Expense>) => {
    if (!user) throw new Error('User not authenticated');
    try {
      await updateExpense(id, { ...data, userId: user.uid }, user.uid);
      // Fetch updated expense and sync
      const expenseRef = doc(db, 'expenses', id);
      const expenseDoc = await getDoc(expenseRef);
      if (expenseDoc.exists()) {
        await syncFinanceEntryWithExpense(expenseDoc.data() as Expense);
      }
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return { expenses, loading, error, addExpense, updateExpense: updateExpenseData };
};

// Dashboard Stats Hook
export const useDashboardStats = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToDashboardStats((data) => {
      // Filter stats for the current user
      const userStats = {
        totalSales: data.totalSales || 0,
        totalExpenses: data.totalExpenses || 0,
        totalProfit: data.totalProfit || 0,
        activeOrders: data.activeOrders || 0,
        completedOrders: data.completedOrders || 0,
        cancelledOrders: data.cancelledOrders || 0
      };

      const dashboardStats: DashboardStats = {
        id: 'dashboard-stats',
        ...userStats,
        userId: user.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      setStats(dashboardStats);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return { stats, loading, error };
};

// Stock Changes Hook
export const useStockChanges = () => {
  const { user } = useAuth();
  const [stockChanges, setStockChanges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'stockChanges'), where('userId', '==', user.uid), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snapshot => {
      setStockChanges(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  return { stockChanges, loading };
};

// Customers Hook
export const useCustomers = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToCustomers(user.uid, (data: Customer[]) => {
      setCustomers(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  return { customers, loading, error };
};

export const useFinanceEntries = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'finances'),
      where('userId', '==', user.uid),
      where('isDeleted', '==', false),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as FinanceEntry)));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  return { entries, loading };
};

// Suppliers Hook
export const useSuppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = subscribeToSuppliers((data) => {
      // Filter suppliers for the current user
      const userSuppliers = data.filter(supplier => supplier.userId === user.uid);
      setSuppliers(userSuppliers);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const addSupplier = async (supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user) throw new Error('User not authenticated');
    try {
      await createSupplier(supplierData, user.uid);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateSupplierData = async (supplierId: string, data: Partial<Supplier>) => {
    if (!user) throw new Error('User not authenticated');
    try {
      await updateSupplier(supplierId, data, user.uid);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteSupplier = async (supplierId: string) => {
    if (!user?.uid) throw new Error('User not authenticated');
    try {
      await softDeleteSupplier(supplierId, user.uid);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    suppliers,
    loading,
    error,
    addSupplier,
    updateSupplier: updateSupplierData,
    deleteSupplier
  };
};

