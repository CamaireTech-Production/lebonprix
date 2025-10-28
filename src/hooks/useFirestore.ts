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
  addCustomer,
  syncFinanceEntryWithSale,
  syncFinanceEntryWithExpense,
  subscribeToSuppliers,
  subscribeToStockChanges,
  createSupplier,
  updateSupplier,
  softDeleteSupplier
} from '../services/firestore';
import { dataCache, cacheKeys, invalidateSpecificCache } from '../utils/dataCache';
import ProductsManager from '../services/storage/ProductsManager';
import SalesManager from '../services/storage/SalesManager';
import ExpensesManager from '../services/storage/ExpensesManager';
import BackgroundSyncService from '../services/backgroundSync';
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
function removeUndefined(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  } else if (obj && typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .reduce((acc, [k, v]) => ({ ...acc, [k]: removeUndefined(v) }), {});
  }
  return obj;
}

// Products Hook with localStorage + Background Sync
export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false); // Start as false - no loading spinner by default
  const [syncing, setSyncing] = useState(false); // New state for background sync indicator
  const [error, setError] = useState<Error | null>(null);
  const { user, company } = useAuth();

  useEffect(() => {
    if (!user || !company) return;
    
    // 1. Check localStorage FIRST - instant display if data exists
    const localProducts = ProductsManager.load(company.id);
    if (localProducts && localProducts.length > 0) {
      setProducts(localProducts);
      setLoading(false); // No loading spinner - data is available
      setSyncing(true); // Show background sync indicator
      console.log('🚀 Products loaded instantly from localStorage');
    } else {
      setLoading(true); // Only show loading spinner if no cached data
      console.log('📡 No cached products, loading from Firebase...');
    }
    
    // 2. Start background sync with Firebase
    BackgroundSyncService.syncProducts(company.id, (freshProducts) => {
      setProducts(freshProducts);
      setSyncing(false); // Hide background sync indicator
      setLoading(false); // Ensure loading is false
      console.log('🔄 Products updated from background sync');
    });

    // 3. Also maintain real-time subscription for immediate updates
    const unsubscribe = subscribeToProducts(company.id, (data) => {
      setProducts(data);
      setLoading(false);
      setSyncing(false);
      
      // Save to localStorage for future instant loads
      ProductsManager.save(company.id, data);
      console.log('💾 Products saved to localStorage');
    });

    return () => unsubscribe();
  }, [user, company]);

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
      const createdProduct = await createProduct(productData, user.uid, supplierInfo);
      // Invalidate products cache when new product is added
      invalidateSpecificCache(user.uid, 'products');
      // Force sync to update localStorage
      BackgroundSyncService.forceSyncProducts(user.uid, (freshProducts) => {
        setProducts(freshProducts);
      });
      return createdProduct;
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
      // Invalidate products cache when product is updated
      invalidateSpecificCache(user.uid, 'products');
      // Force sync to update localStorage
      BackgroundSyncService.forceSyncProducts(user.uid, (freshProducts) => {
        setProducts(freshProducts);
      });
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
      // Invalidate products cache when product is deleted
      invalidateSpecificCache(user.uid, 'products');
      // Force sync to update localStorage
      BackgroundSyncService.forceSyncProducts(user.uid, (freshProducts) => {
        setProducts(freshProducts);
      });
    } catch (err) {
      console.error('Error deleting product:', err);
      throw err;
    }
  };

  return {
    products,
    loading,
    syncing, // Export syncing state for UI indicators
    error,
    addProduct,
    updateProductData,
    deleteProduct
  };
};

// Categories Hook with Caching
export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, company } = useAuth();

  useEffect(() => {
    if (!user || !company) return;
    
    const cacheKey = cacheKeys.categories(company.id);
    
    // Check cache first
    const cachedCategories = dataCache.get<Category[]>(cacheKey);
    if (cachedCategories) {
      setCategories(cachedCategories);
      setLoading(false);
      console.log('🚀 Categories loaded from cache');
    }
    
    const unsubscribe = subscribeToCategories(company.id, (data) => {
      setCategories(data);
      setLoading(false);
      
      // Cache the data for 10 minutes (categories change rarely)
      dataCache.set(cacheKey, data, 10 * 60 * 1000);
      console.log('📦 Categories cached for faster loading');
    });

    return () => unsubscribe();
  }, [user, company]);

  const addCategory = async (name: string) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      const category = await createCategory({ name, userId: user.uid, companyId: company.id }, company.id);
      return category;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return { categories, loading, error, addCategory };
};

// Sales Hook with localStorage + Background Sync
export const useSales = () => {
  const { user, company } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false); // Start as false - no loading spinner by default
  const [syncing, setSyncing] = useState(false); // New state for background sync indicator
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
    if (!user || !company) return;
    
    // 1. Check localStorage FIRST - instant display if data exists
    const localSales = SalesManager.load(company.id);
    if (localSales && localSales.length > 0) {
      setSales(localSales);
      setLoading(false); // No loading spinner - data is available
      setSyncing(true); // Show background sync indicator
      console.log('🚀 Sales loaded instantly from localStorage');
    } else {
      setLoading(true); // Only show loading spinner if no cached data
      console.log('📡 No cached sales, loading from Firebase...');
    }
    
    // 2. Start background sync with Firebase
    BackgroundSyncService.syncSales(company.id, (freshSales) => {
      setSales(freshSales);
      setSyncing(false); // Hide background sync indicator
      setLoading(false); // Ensure loading is false
      console.log('🔄 Sales updated from background sync');
    });

    // 3. Also maintain real-time subscription for immediate updates
    const unsubscribe = subscribeToSales(company.id, (data) => {
      setSales(data);
      setLoading(false);
      setSyncing(false);
      
      // Save to localStorage for future instant loads
      SalesManager.save(company.id, data);
      console.log('💾 Sales saved to localStorage');
    });

    return () => unsubscribe();
  }, [user, company]);

  const addSale = async (data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>): Promise<Sale> => {
    if (!user || !company) {
      throw new Error('User not authenticated');
    }
    try {
      const newSale = await createSale({ ...data, userId: user.uid, companyId: company.id }, company.id);
      await syncFinanceEntryWithSale(newSale);
      // Invalidate sales cache when new sale is added
      invalidateSpecificCache(company.id, 'sales');
      // Force sync to update localStorage
      BackgroundSyncService.forceSyncSales(company.id, (freshSales) => {
        setSales(freshSales);
      });
      return newSale;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateSale = async (saleId: string, data: Partial<Sale>): Promise<void> => {
    if (!user || !company) {
      throw new Error('User must be authenticated to update a sale');
    }

    try {
      const saleRef = doc(db, 'sales', saleId);
      const saleDoc = await getDoc(saleRef);
      
      if (!saleDoc.exists()) {
        throw new Error('Sale not found');
      }

      const saleData = saleDoc.data() as Sale;
      if (saleData.companyId !== company.id) {
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
      await updateSaleDocument(saleId, cleanedSale as Partial<Sale>, company.id);
      
      // Create a complete sale object with ID for finance sync
      const saleForSync = {
        ...(cleanedSale as Sale),
        id: saleId
      };
      await syncFinanceEntryWithSale(saleForSync);

      // Update local state
      updateLocalSale(saleForSync);
      
      // Invalidate sales cache when sale is updated
      invalidateSpecificCache(company.id, 'sales');
      // Force sync to update localStorage
      BackgroundSyncService.forceSyncSales(company.id, (freshSales) => {
        setSales(freshSales);
      });
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

  const deleteSale = async (saleId: string) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      const saleRef = doc(db, 'sales', saleId);
      
      // Get sale data before deleting
      const saleDoc = await getDoc(saleRef);
      if (saleDoc.exists()) {
        const saleData = saleDoc.data() as Sale;
        // Sync finance entry (mark as deleted) before deleting the sale
        await syncFinanceEntryWithSale({ ...saleData, id: saleId, isAvailable: false });
      }
      
      // Delete the sale document
      await deleteDoc(saleRef);
      
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

  return { sales, loading, syncing, error, addSale, updateSale, deleteSale, updateStatus };
};

// Expenses Hook with localStorage + Background Sync
export const useExpenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false); // Start as false - no loading spinner by default
  const [syncing, setSyncing] = useState(false); // New state for background sync indicator
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    // 1. Check localStorage FIRST - instant display if data exists
    const localExpenses = ExpensesManager.load(user.uid);
    if (localExpenses && localExpenses.length > 0) {
      setExpenses(localExpenses);
      setLoading(false); // No loading spinner - data is available
      setSyncing(true); // Show background sync indicator
      console.log('🚀 Expenses loaded instantly from localStorage');
    } else {
      setLoading(true); // Only show loading spinner if no cached data
      console.log('📡 No cached expenses, loading from Firebase...');
    }
    
    // 2. Start background sync with Firebase
    BackgroundSyncService.syncExpenses(user.uid, (freshExpenses) => {
      setExpenses(freshExpenses);
      setSyncing(false); // Hide background sync indicator
      setLoading(false); // Ensure loading is false
      console.log('🔄 Expenses updated from background sync');
    });

    // 3. Also maintain real-time subscription for immediate updates
    const unsubscribe = subscribeToExpenses(user.uid, (data) => {
      setExpenses(data);
      setLoading(false);
      setSyncing(false);
      
      // Save to localStorage for future instant loads
      ExpensesManager.save(user.uid, data);
      console.log('💾 Expenses saved to localStorage');
    });

    return () => unsubscribe();
  }, [user]);

  const addExpense = async (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user) throw new Error('User not authenticated');
    try {
      const newExpense = await createExpense({ ...data, userId: user.uid }, user.uid);
      await syncFinanceEntryWithExpense(newExpense);
      // Force sync to update localStorage
      BackgroundSyncService.forceSyncExpenses(user.uid, (freshExpenses) => {
        setExpenses(freshExpenses);
      });
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateExpenseData = async (id: string, data: Partial<Expense>) => {
    if (!user) throw new Error('User not authenticated');
    try {
      await updateExpense(id, { ...data, userId: user.uid }, user.uid);
      // Force sync to update localStorage
      BackgroundSyncService.forceSyncExpenses(user.uid, (freshExpenses) => {
        setExpenses(freshExpenses);
      });
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return { expenses, loading, syncing, error, addExpense, updateExpense: updateExpenseData };
};

// Dashboard Stats Hook
export const useDashboardStats = () => {
  const { user, company } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<Error | null>(null);

  useEffect(() => {
    if (!user || !company) {
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
        companyId: company.id,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      setStats(dashboardStats);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, company]);

  return { stats, loading, error };
};

// Stock Changes Hook with Caching
export const useStockChanges = () => {
  const { user } = useAuth();
  const [stockChanges, setStockChanges] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const cacheKey = cacheKeys.stockChanges(user.uid);
    
    // Check cache first
    const cachedStockChanges = dataCache.get<unknown[]>(cacheKey);
    if (cachedStockChanges) {
      setStockChanges(cachedStockChanges);
      setLoading(false);
      console.log('🚀 Stock changes loaded from cache');
    }
    
    const unsubscribe = subscribeToStockChanges(user.uid, (data) => {
      setStockChanges(data);
      setLoading(false);
      
      // Cache the data for 3 minutes (stock changes frequently)
      dataCache.set(cacheKey, data, 3 * 60 * 1000);
      console.log('📦 Stock changes cached for faster loading');
    });
    return () => unsubscribe();
  }, [user]);

  return { stockChanges, loading };
};

// Customers Hook
export const useCustomers = () => {
  const { user, company } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user || !company) return;
    const unsubscribe = subscribeToCustomers(company.id, (data: Customer[]) => {
      setCustomers(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, company]);

  const addCustomerToStore = async (customerData: Omit<Customer, 'id'>) => {
    if (!user) throw new Error('User not authenticated');
    try {
      return await addCustomer(customerData);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return { customers, loading, error, addCustomer: addCustomerToStore };
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

// Suppliers Hook with Caching
export const useSuppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    const cacheKey = cacheKeys.suppliers(user.uid);
    
    // Check cache first
    const cachedSuppliers = dataCache.get<Supplier[]>(cacheKey);
    if (cachedSuppliers) {
      setSuppliers(cachedSuppliers);
      setLoading(false);
      console.log('🚀 Suppliers loaded from cache');
    }
    
    const unsubscribe = subscribeToSuppliers(user.uid, (data) => {
      // Filter out soft-deleted suppliers (user filtering already done by Firebase)
      const activeSuppliers = data.filter(supplier => !supplier.isDeleted);
      setSuppliers(activeSuppliers);
      setLoading(false);
      
      // Cache the data for 5 minutes
      dataCache.set(cacheKey, activeSuppliers, 5 * 60 * 1000);
      console.log('📦 Suppliers cached for faster loading');
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

// Audit Logs Hook
export const useAuditLogs = () => {
  const { currentUser } = useAuth();
  const [auditLogs, setAuditLogs] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'auditLogs'),
      where('performedBy', '==', currentUser.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAuditLogs(logs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  return { auditLogs, loading };
};

