import { useState, useEffect, useCallback } from 'react';
import { 
  createSale, 
  updateSaleStatus, 
  subscribeToSales,
  updateSaleDocument
} from '@services/firestore/sales/saleService';
import {
  subscribeToCategories,
  createCategory
} from '@services/firestore/categories/categoryService';
import {
  subscribeToProducts,
  createProduct,
  updateProduct
} from '@services/firestore/products/productService';
import {
  subscribeToExpenses,
  createExpense,
  updateExpense
} from '@services/firestore/expenses/expenseService';
import {
  subscribeToDashboardStats
} from '@services/firestore/firestore';
import {
  subscribeToCustomers,
  updateCustomer,
  deleteCustomer,
  addCustomer
} from '@services/firestore/customers/customerService';
import {
  syncFinanceEntryWithSale,
  syncFinanceEntryWithExpense
} from '@services/firestore/finance/financeService';
import {
  subscribeToSuppliers,
  createSupplier,
  updateSupplier,
  softDeleteSupplier
} from '@services/firestore/suppliers/supplierService';
import {
  subscribeToSupplierDebts,
  subscribeToSupplierDebt,
  addSupplierDebt,
  addSupplierRefund,
  getSupplierDebt
} from '@services/firestore/suppliers/supplierDebtService';
import { subscribeToStockChanges } from '@services/firestore/stock/stockService';
import { dataCache, cacheKeys, invalidateSpecificCache } from '@utils/storage/dataCache';
import { logError } from '@utils/core/logger';
import ProductsManager from '@services/storage/ProductsManager';
import SalesManager from '@services/storage/SalesManager';
import ExpensesManager from '@services/storage/ExpensesManager';
import BackgroundSyncService from '@services/utilities/backgroundSync';
import { getCurrentEmployeeRef } from '@utils/business/employeeUtils';
import { getUserById } from '@services/utilities/userService';
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
  Supplier,
  StockChange,
  SupplierDebt
} from '../types/models';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, deleteDoc, collection, query, where, orderBy, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@services/core/firebase';

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
    } else {
      setLoading(true); // Only show loading spinner if no cached data
    }
    
    // 2. Start background sync with Firebase
    BackgroundSyncService.syncProducts(company.id, (freshProducts) => {
      setProducts(freshProducts);
      setSyncing(false); // Hide background sync indicator
      setLoading(false); // Ensure loading is false
    });

    // 3. Also maintain real-time subscription for immediate updates
    const unsubscribe = subscribeToProducts(company.id, (data) => {
      setProducts(data);
      setLoading(false);
      setSyncing(false);
      
      // Save to localStorage for future instant loads
      ProductsManager.save(company.id, data);
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
    },
    createdBy?: import('../types/models').EmployeeRef | null
  ) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      const createdProduct = await createProduct(productData, company.id, supplierInfo, createdBy);
      // Invalidate products cache when new product is added
      invalidateSpecificCache(company.id, 'products');
      // Force sync to update localStorage
      BackgroundSyncService.forceSyncProducts(company.id, (freshProducts) => {
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
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await updateProduct(productId, data, company.id, stockReason, stockChange, supplierInfo);
      // Invalidate products cache when product is updated
      invalidateSpecificCache(company.id, 'products');
      // Force sync to update localStorage
      BackgroundSyncService.forceSyncProducts(company.id, (freshProducts) => {
        setProducts(freshProducts);
      });
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!user?.uid || !company) throw new Error('User not authenticated');
    
    try {
      await deleteDoc(doc(db, 'products', productId));
      setProducts(prev => prev.filter(p => p.id !== productId));
      // Invalidate products cache when product is deleted
      invalidateSpecificCache(company.id, 'products');
      // Force sync to update localStorage
      BackgroundSyncService.forceSyncProducts(company.id, (freshProducts) => {
        setProducts(freshProducts);
      });
    } catch (err) {
      logError('Error deleting product', err);
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

// Categories Hook with Caching (backward compatible, supports optional type filter)
export const useCategories = (type?: 'product' | 'matiere') => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, company, currentEmployee, isOwner } = useAuth();

  useEffect(() => {
    if (!user || !company) return;
    
    const cacheKey = type ? cacheKeys.categories(company.id, type) : cacheKeys.categories(company.id);
    
    // Check cache first
    const cachedCategories = dataCache.get<Category[]>(cacheKey);
    if (cachedCategories) {
      setCategories(cachedCategories);
      setLoading(false);
    }
    
    const unsubscribe = subscribeToCategories(company.id, (data) => {
      setCategories(data);
      setLoading(false);
      
      // Cache the data for 10 minutes (categories change rarely)
      dataCache.set(cacheKey, data, 10 * 60 * 1000);
    }, type);

    return () => unsubscribe();
  }, [user, company, type]);

  const addCategory = async (name: string, categoryType?: 'product' | 'matiere') => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      // Get createdBy employee reference
      let createdBy: ReturnType<typeof getCurrentEmployeeRef> = null;
      if (user && company) {
        let userData: Awaited<ReturnType<typeof getUserById>> | null = null;
        if (isOwner && !currentEmployee) {
          // If owner, fetch user data to create EmployeeRef
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            logError('Error fetching user data for createdBy', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }
      
      // Use provided type, or fallback to hook type, or default to 'product' for backward compatibility
      const finalType = categoryType || type || 'product';
      
      const category = await createCategory({ 
        name, 
        type: finalType,
        userId: user.uid, 
        companyId: company.id 
      }, company.id, createdBy);
      return category;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return { categories, loading, error, addCategory };
};

// Product Categories Hook - queries only product categories
export const useProductCategories = () => {
  return useCategories('product');
};

// Matiere Categories Hook - queries only matiere categories
export const useMatiereCategories = () => {
  return useCategories('matiere');
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
    } else {
      setLoading(true); // Only show loading spinner if no cached data
    }
    
    // 2. Start background sync with Firebase
    BackgroundSyncService.syncSales(company.id, (freshSales) => {
      setSales(freshSales);
      setSyncing(false); // Hide background sync indicator
      setLoading(false); // Ensure loading is false
    });

    // 3. Also maintain real-time subscription for immediate updates
    const unsubscribe = subscribeToSales(company.id, (data) => {
      setSales(data);
      setLoading(false);
      setSyncing(false);
      
      // Save to localStorage for future instant loads
      SalesManager.save(company.id, data);
    });

    return () => unsubscribe();
  }, [user, company]);

  const addSale = async (data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>, createdBy?: import('../types/models').EmployeeRef | null): Promise<Sale> => {
    if (!user || !company) {
      throw new Error('User not authenticated');
    }
    try {
      const newSale = await createSale({ ...data, userId: user.uid, companyId: company.id }, company.id, createdBy);
      // Invalidate sales cache when new sale is added
      invalidateSpecificCache(company.id, 'sales');
      // Force sync to update localStorage
      BackgroundSyncService.forceSyncSales(company.id, (freshSales) => {
        setSales(freshSales);
      });
      // Invalidate product caches so stock values refresh
      ProductsManager.remove(company.id);
      if (user.uid) {
        ProductsManager.remove(user.uid);
      }
      // Notify product list to refresh immediately if mounted
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('products:refresh', {
          detail: { companyId: company.id }
        }));
      }
      
      // Wait for syncFinanceEntryWithSale to complete
      // syncFinanceEntryWithSale is called inside createSale but is async
      // Small delay ensures the finance entry is created before refresh
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Trigger finance refresh to update balance immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('finance:refresh'));
      }
      
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

      // Wait for finance entry to be updated
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Trigger finance refresh to update balance immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('finance:refresh'));
      }

      // Update local state
      updateLocalSale(saleForSync);
      
      // Invalidate sales cache when sale is updated
      invalidateSpecificCache(company.id, 'sales');
      // Force sync to update localStorage
      BackgroundSyncService.forceSyncSales(company.id, (freshSales) => {
        setSales(freshSales);
      });
    } catch (err) {
      logError('Error updating sale', err);
      throw err;
    }
  };

  const fetchSales = async () => {
    if (!user || !company) return;
    
    try {
      const salesRef = collection(db, 'sales');
      const q = query(salesRef, where('companyId', '==', company.id), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const salesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Sale[];
      setSales(salesData);
    } catch (error) {
      logError('Error fetching sales', error);
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
      logError('Error deleting sale', error);
      throw error;
    }
  };

  const updateStatus = async (id: string, status: OrderStatus, paymentStatus: PaymentStatus) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await updateSaleStatus(id, status, paymentStatus, company.id);
      
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
  const { user, company } = useAuth();

  useEffect(() => {
    if (!user || !company) return;
    
    // 1. Check localStorage FIRST - instant display if data exists
    const localExpenses = ExpensesManager.load(company.id);
    if (localExpenses && localExpenses.length > 0) {
      setExpenses(localExpenses);
      setLoading(false); // No loading spinner - data is available
      setSyncing(true); // Show background sync indicator
    } else {
      setLoading(true); // Only show loading spinner if no cached data
    }
    
    // 2. Start background sync with Firebase
    BackgroundSyncService.syncExpenses(company.id, (freshExpenses) => {
      setExpenses(freshExpenses);
      setSyncing(false); // Hide background sync indicator
      setLoading(false); // Ensure loading is false
    });

    // 3. Also maintain real-time subscription for immediate updates
    const unsubscribe = subscribeToExpenses(company.id, (data) => {
      setExpenses(data);
      setLoading(false);
      setSyncing(false);
      
      // Save to localStorage for future instant loads
      ExpensesManager.save(company.id, data);
    });

    return () => unsubscribe();
  }, [user, company]);

  const addExpense = async (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>, createdBy?: import('../types/models').EmployeeRef | null) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      const newExpense = await createExpense({ ...data, userId: user.uid, companyId: company.id }, company.id, createdBy);
      await syncFinanceEntryWithExpense(newExpense);
      // Force sync to update localStorage
      BackgroundSyncService.forceSyncExpenses(company.id, (freshExpenses) => {
        setExpenses(freshExpenses);
      });
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateExpenseData = async (id: string, data: Partial<Expense>) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await updateExpense(id, { ...data, userId: user.uid, companyId: company.id }, company.id);
      // Force sync to update localStorage
      BackgroundSyncService.forceSyncExpenses(company.id, (freshExpenses) => {
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
export const useStockChanges = (type?: 'product' | 'matiere') => {
  const { user, company } = useAuth();
  const [stockChanges, setStockChanges] = useState<StockChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !company) return;
    
    const cacheKey = cacheKeys.stockChanges(company.id);
    
    // Check cache first
    const cachedStockChanges = dataCache.get<StockChange[]>(cacheKey);
    if (cachedStockChanges) {
      // Filter by type if provided
      const filtered = type 
        ? cachedStockChanges.filter(sc => sc.type === type)
        : cachedStockChanges;
      setStockChanges(filtered);
      setLoading(false);
    }
    
    const unsubscribe = subscribeToStockChanges(company.id, (data) => {
      // Filter by type if provided
      const filtered = type 
        ? data.filter(sc => sc.type === type)
        : data;
      setStockChanges(filtered);
      setLoading(false);
      
      // Cache the data for 3 minutes (stock changes frequently)
      dataCache.set(cacheKey, data, 3 * 60 * 1000);
    }, type);
    return () => unsubscribe();
  }, [user, company, type]);

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
    if (!user || !company) throw new Error('User not authenticated');
    try {
      return await addCustomer(customerData);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateCustomerData = async (customerId: string, customerData: Partial<Customer>) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await updateCustomer(customerId, customerData, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteCustomerData = async (customerId: string) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await deleteCustomer(customerId, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return { 
    customers, 
    loading, 
    error, 
    addCustomer: addCustomerToStore,
    updateCustomer: updateCustomerData,
    deleteCustomer: deleteCustomerData
  };
};

export const useFinanceEntries = () => {
  const { user, company } = useAuth();
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Simple refresh function - manually reload data from Firestore
  const refresh = useCallback(async () => {
    if (!user || !company) return;
    
    setLoading(true);
    const q = query(
      collection(db, 'finances'),
      where('companyId', '==', company.id),
      orderBy('createdAt', 'desc')
    );
    
    try {
      const snapshot = await getDocs(q);
      const financeEntries = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as FinanceEntry))
        .filter(entry => entry.isDeleted !== true)
        .sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
      
      setEntries([...financeEntries]);
      setLoading(false);
      
    } catch (error) {
      logError('Error refreshing finance entries', error);
      setLoading(false);
    }
  }, [user, company]);

  useEffect(() => {
    if (!user || !company) {
      setEntries([]);
      setLoading(false);
      return;
    }

    // Real-time listener for finance entries
    // FIXED: Simplified query to avoid composite index issues
    // Query by companyId only, filter isDeleted in client-side for better real-time performance
    const q = query(
      collection(db, 'finances'),
      where('companyId', '==', company.id),
      orderBy('createdAt', 'desc')
    );

    // Set up real-time listener with proper error handling
    // FIXED: Include metadata changes to catch local writes immediately
    // This ensures onSnapshot fires even for pending writes (like batch commits)
    const unsub = onSnapshot(
      q,
      { includeMetadataChanges: true }, // CRITICAL: This catches local writes immediately
      (snapshot) => {
        // Process ALL updates (including pending writes) for immediate UI feedback
        // includeMetadataChanges: true gives us:
        // 1. Immediate update when write is added to local cache (pending)
        // 2. Confirmation update when write is committed to server
        // We process both for the best user experience
        
        // Success callback - filter isDeleted on client-side for better real-time performance
        const financeEntries = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as FinanceEntry))
          .filter(entry => entry.isDeleted !== true); // Filter soft-deleted entries client-side
        
        // Sort by createdAt (descending) - already sorted by Firestore, but ensure consistency
        financeEntries.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
        
        // Always update state - Firestore guarantees consistency
        // CRITICAL: Create new array reference to ensure React detects the change
        setEntries([...financeEntries]);
        setLoading(false);
      },
      (error) => {
        // Error callback - log error and provide helpful information
        logError('Error listening to finance entries', error);
        
        setLoading(false);
        // Fallback: Try to get data without orderBy (simpler query)
        const fallbackQuery = query(
          collection(db, 'finances'),
          where('companyId', '==', company.id)
        );
        getDocs(fallbackQuery).then((snap) => {
          const fallbackEntries = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as FinanceEntry))
            .filter(entry => entry.isDeleted !== true)
            .sort((a, b) => {
              const aTime = a.createdAt?.seconds || 0;
              const bTime = b.createdAt?.seconds || 0;
              return bTime - aTime;
            });
          setEntries(fallbackEntries);
        }).catch((err) => {
          logError('Fallback query for finance entries failed', err);
        });
      }
    );

    return () => unsub();
  }, [user, company]);

  return { entries, loading, refresh };
};

// Suppliers Hook with Caching
export const useSuppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, company, currentEmployee, isOwner } = useAuth();

  useEffect(() => {
    if (!user || !company) return;
    
    const cacheKey = cacheKeys.suppliers(company.id);
    
    // Check cache first
    const cachedSuppliers = dataCache.get<Supplier[]>(cacheKey);
    if (cachedSuppliers) {
      setSuppliers(cachedSuppliers);
      setLoading(false);
    }
    
    const unsubscribe = subscribeToSuppliers(company.id, (data) => {
      // Filter out soft-deleted suppliers (user filtering already done by Firebase)
      const activeSuppliers = data.filter(supplier => !supplier.isDeleted);
      setSuppliers(activeSuppliers);
      setLoading(false);
      
      // Cache the data for 5 minutes
      dataCache.set(cacheKey, activeSuppliers, 5 * 60 * 1000);
    });

    return () => unsubscribe();
  }, [user, company]);

  const addSupplier = async (supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      // Get createdBy employee reference
      let createdBy: ReturnType<typeof getCurrentEmployeeRef> = null;
      if (user && company) {
        let userData: Awaited<ReturnType<typeof getUserById>> | null = null;
        if (isOwner && !currentEmployee) {
          // If owner, fetch user data to create EmployeeRef
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            logError('Error fetching user data for createdBy', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }
      
      await createSupplier(supplierData, company.id, createdBy);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateSupplierData = async (supplierId: string, data: Partial<Supplier>) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await updateSupplier(supplierId, data, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteSupplier = async (supplierId: string) => {
    if (!user?.uid || !company) throw new Error('User not authenticated');
    try {
      await softDeleteSupplier(supplierId, company.id);
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

// Supplier Debts Hook with Caching
export const useSupplierDebts = () => {
  const [debts, setDebts] = useState<SupplierDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, company } = useAuth();

  useEffect(() => {
    if (!user || !company) return;
    
    const cacheKey = `supplier_debts_${company.id}`;
    
    // Check cache first
    const cachedDebts = dataCache.get<SupplierDebt[]>(cacheKey);
    if (cachedDebts) {
      setDebts(cachedDebts);
      setLoading(false);
    }
    
    const unsubscribe = subscribeToSupplierDebts(company.id, (data) => {
      setDebts(data);
      setLoading(false);
      
      // Cache the data for 5 minutes
      dataCache.set(cacheKey, data, 5 * 60 * 1000);
    });

    return () => unsubscribe();
  }, [user, company]);

  const addDebt = async (
    supplierId: string,
    amount: number,
    description: string,
    batchId?: string
  ) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await addSupplierDebt(supplierId, amount, description, company.id, batchId);
      // Invalidate cache
      invalidateSpecificCache(`supplier_debts_${company.id}`);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const addRefund = async (
    supplierId: string,
    amount: number,
    description: string,
    refundedDebtId?: string
  ) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await addSupplierRefund(supplierId, amount, description, company.id, refundedDebtId);
      // Invalidate cache
      invalidateSpecificCache(`supplier_debts_${company.id}`);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const getDebt = async (supplierId: string) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      return await getSupplierDebt(supplierId, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    debts,
    loading,
    error,
    addDebt,
    addRefund,
    getDebt
  };
};

// Hook to get debt for a specific supplier
export const useSupplierDebt = (supplierId: string | null) => {
  const [debt, setDebt] = useState<SupplierDebt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, company } = useAuth();

  useEffect(() => {
    if (!user || !company || !supplierId) {
      setDebt(null);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const unsubscribe = subscribeToSupplierDebt(supplierId, company.id, (data) => {
      setDebt(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, company, supplierId]);

  return {
    debt,
    loading,
    error
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

