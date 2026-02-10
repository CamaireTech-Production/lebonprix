import { useState, useEffect, useCallback, useMemo } from 'react';
import { sharedSubscriptions } from '@services/firestore/sharedSubscriptions';
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
import {
  subscribeToReplenishmentRequests,
  createReplenishmentRequest,
  updateReplenishmentRequest,
  approveReplenishmentRequest,
  rejectReplenishmentRequest,
  fulfillReplenishmentRequest
} from '@services/firestore/stock/stockReplenishmentService';
import {
  subscribeToNotifications,
  createNotification,
  createNotificationsForUsers,
  markNotificationAsRead,
  markNotificationsAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationsCount
} from '@services/firestore/notifications/notificationService';
import {
  subscribeToProductionFlowSteps,
  createProductionFlowStep,
  updateProductionFlowStep,
  deleteProductionFlowStep
} from '@services/firestore/productions/productionFlowStepService';
import {
  subscribeToProductionFlows,
  createProductionFlow,
  updateProductionFlow,
  deleteProductionFlow,
  getDefaultProductionFlow
} from '@services/firestore/productions/productionFlowService';
import {
  subscribeToProductionCategories,
  createProductionCategory,
  updateProductionCategory,
  deleteProductionCategory
} from '@services/firestore/productions/productionCategoryService';
import {
  subscribeToProductions,
  createProduction,
  updateProduction,
  deleteProduction,
  changeProductionState,
  publishProduction
} from '@services/firestore/productions/productionService';
import {
  subscribeToCharges,
  subscribeToFixedCharges,
  subscribeToCustomCharges,
  createCharge,
  updateCharge,
  deleteCharge,
  getFixedCharges,
  getCustomCharges,
  getAllCharges
} from '@services/firestore/charges/chargeService';
import {
  subscribeToShops,
  createShop,
  updateShop,
  deleteShop,
  getDefaultShop
} from '@services/firestore/shops/shopService';
import {
  subscribeToWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  getDefaultWarehouse
} from '@services/firestore/warehouse/warehouseService';
import {
  subscribeToStockTransfers,
  transferStockBetweenLocations,
  cancelStockTransfer
} from '@services/firestore/stock/stockTransferService';
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
  SupplierDebt,
  Production,
  ProductionFlowStep,
  ProductionFlow,
  ProductionCategory,
  ProductionCharge,
  Charge,
  Shop,
  Warehouse,
  StockTransfer,
  StockReplenishmentRequest,
  Notification
} from '../types/models';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, deleteDoc, collection, query, where, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
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

// Products Hook - Now uses shared subscriptions to avoid duplicate subscriptions
export const useProducts = () => {
  const { user, company } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize shared subscription when company is available
  useEffect(() => {
    if (!user || !company) {
      setProducts([]);
      setLoading(false);
      setSyncing(false);
      return;
    }

    // Initialize shared subscription (only creates one subscription per company)
    sharedSubscriptions.initializeProducts(company.id);

    // Subscribe to updates from shared subscription
    const unsubscribe = sharedSubscriptions.subscribeToProducts((data) => {
      setProducts(data);
      const state = sharedSubscriptions.getProductsState();
      setLoading(state.loading);
      setSyncing(state.syncing);
      setError(state.error);
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
    createdBy?: import('../types/models').EmployeeRef | null,
    locationInfo?: {
      locationType?: 'warehouse' | 'shop' | 'production' | 'global';
      warehouseId?: string;
      shopId?: string;
      productionId?: string;
    }
  ) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      // Resolve effective location for initial stock if not explicitly provided
      let effectiveLocationInfo = locationInfo;

      const initialStock = (productData as any).stock ?? 0;

      if (!effectiveLocationInfo && initialStock > 0) {
        try {
          // Prefer default shop, fallback to default warehouse
          const defaultShop = await getDefaultShop(company.id);
          if (defaultShop) {
            effectiveLocationInfo = {
              locationType: 'shop',
              shopId: defaultShop.id
            };
          } else {
            const defaultWarehouse = await getDefaultWarehouse(company.id);
            if (defaultWarehouse) {
              effectiveLocationInfo = {
                locationType: 'warehouse',
                warehouseId: defaultWarehouse.id
              };
            }
          }
        } catch (error) {
          console.error('Error resolving default location for product creation:', error);
        }

        // If we still don't have a location and there is initial stock, prevent silent creation
        if (!effectiveLocationInfo) {
          throw new Error('No default shop or warehouse found to assign initial stock.');
        }
      }

      const createdProduct = await createProduct(
        { ...productData, userId: user.uid, companyId: company.id },
        company.id,
        supplierInfo,
        createdBy,
        effectiveLocationInfo
      );

      // Invalidate products cache
      ProductsManager.remove(company.id);
      if (user.uid) {
        ProductsManager.remove(user.uid);
      }

      // Notify product list to refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('products:refresh', {
          detail: { companyId: company.id }
        }));
      }

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
      await updateProduct(productId, {
        ...data,
        updatedAt: Timestamp.now()
      }, company.id, stockReason, stockChange, supplierInfo);

      // Invalidate products cache
      ProductsManager.remove(company.id);

      // Notify product list to refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('products:refresh', {
          detail: { companyId: company.id }
        }));
      }
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!user?.uid || !company) throw new Error('User not authenticated');
    try {
      await deleteDoc(doc(db, 'products', productId));

      // Invalidate products cache
      ProductsManager.remove(company.id);

      // Notify product list to refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('products:refresh', {
          detail: { companyId: company.id }
        }));
      }
    } catch (err) {
      logError('Error deleting product', err);
      throw err;
    }
  };

  return {
    products,
    loading,
    syncing,
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

// Sales Hook - Now uses shared subscriptions to avoid duplicate subscriptions
export const useSales = () => {
  const { user, company } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize shared subscription when company is available
  useEffect(() => {
    if (!user || !company) {
      setSales([]);
      setLoading(false);
      setSyncing(false);
      return;
    }

    // Initialize shared subscription (only creates one subscription per company)
    sharedSubscriptions.initializeSales(company.id);

    // Subscribe to updates from shared subscription
    const unsubscribe = sharedSubscriptions.subscribeToSales((data) => {
      setSales(data);
      const state = sharedSubscriptions.getSalesState();
      setLoading(state.loading);
      setSyncing(state.syncing);
      setError(state.error);
    });

    return () => unsubscribe();
  }, [user, company]);

  const addSale = async (data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>, createdBy?: import('../types/models').EmployeeRef | null): Promise<Sale> => {
    if (!user || !company) {
      throw new Error('User not authenticated');
    }
    try {
      const newSale = await createSale({ ...data, userId: user.uid, companyId: company.id }, company.id, createdBy);

      // Invalidate sales cache
      SalesManager.remove(company.id);

      // Force sync to update localStorage
      BackgroundSyncService.forceSyncSales(company.id, (freshSales) => {
        sharedSubscriptions.initializeSales(company.id); // Re-initialize to update shared state
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

      // Invalidate sales cache when sale is updated
      SalesManager.remove(company.id);
      // Force sync to update localStorage
      BackgroundSyncService.forceSyncSales(company.id, (freshSales) => {
        sharedSubscriptions.initializeSales(company.id); // Re-initialize to update shared state
      });
    } catch (err) {
      logError('Error updating sale', err);
      throw err;
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

      // Invalidate sales cache
      if (company) {
        SalesManager.remove(company.id);
        BackgroundSyncService.forceSyncSales(company.id, (freshSales) => {
          sharedSubscriptions.initializeSales(company.id); // Re-initialize to update shared state
        });
      }

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

      // Invalidate sales cache
      SalesManager.remove(company.id);
      BackgroundSyncService.forceSyncSales(company.id, (freshSales) => {
        sharedSubscriptions.initializeSales(company.id); // Re-initialize to update shared state
      });
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
    // OPTIMIZATION: Added limit to reduce Firebase reads
    const defaultLimit = 200; // OPTIMIZATION: Default limit to reduce Firebase reads
    const q = query(
      collection(db, 'finances'),
      where('companyId', '==', company.id),
      orderBy('createdAt', 'desc'),
      limit(defaultLimit)
    );

    // Set up real-time listener with proper error handling
    // OPTIMIZATION: Removed includeMetadataChanges to reduce Firebase read costs
    // We only listen to server-confirmed changes, which is sufficient for most use cases
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        // Process server-confirmed updates only
        // This reduces Firebase reads by 50% (no duplicate reads for pending + confirmed)

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

// Shops Hook
export const useShops = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, company, currentEmployee, isOwner } = useAuth();

  useEffect(() => {
    if (!user || !company) return;

    const unsubscribe = subscribeToShops(company.id, (data) => {
      setShops(data);
      setLoading(false);
      setError(null);
    }, (err) => {
      setError(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, company]);

  const addShop = async (shopData: Omit<Shop, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      let createdBy: ReturnType<typeof getCurrentEmployeeRef> = null;
      if (user && company) {
        let userData: Awaited<ReturnType<typeof getUserById>> | null = null;
        if (isOwner && !currentEmployee) {
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            logError('Error fetching user data for createdBy', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }

      await createShop(shopData, company.id, createdBy);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateShopData = async (shopId: string, data: Partial<Shop>) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await updateShop(shopId, data, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteShopData = async (shopId: string) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await deleteShop(shopId, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    shops,
    loading,
    error,
    addShop,
    updateShop: updateShopData,
    deleteShop: deleteShopData
  };
};

// Warehouses Hook
export const useWarehouses = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, company, currentEmployee, isOwner } = useAuth();

  useEffect(() => {
    if (!user || !company) return;

    const unsubscribe = subscribeToWarehouses(company.id, (data) => {
      setWarehouses(data);
      setLoading(false);
      setError(null);
    }, (err) => {
      setError(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, company]);

  const addWarehouse = async (warehouseData: Omit<Warehouse, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      let createdBy: ReturnType<typeof getCurrentEmployeeRef> = null;
      if (user && company) {
        let userData: Awaited<ReturnType<typeof getUserById>> | null = null;
        if (isOwner && !currentEmployee) {
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            logError('Error fetching user data for createdBy', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }

      await createWarehouse(warehouseData, company.id, createdBy);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateWarehouseData = async (warehouseId: string, data: Partial<Warehouse>) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await updateWarehouse(warehouseId, data, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteWarehouseData = async (warehouseId: string) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await deleteWarehouse(warehouseId, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    warehouses,
    loading,
    error,
    addWarehouse,
    updateWarehouse: updateWarehouseData,
    deleteWarehouse: deleteWarehouseData
  };
};

// Stock Transfers Hook
export const useStockTransfers = (filters?: {
  productId?: string;
  shopId?: string;
  warehouseId?: string;
  transferType?: StockTransfer['transferType'];
  status?: StockTransfer['status'];
}) => {
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, company, currentEmployee, isOwner } = useAuth();

  // Memoize filters to prevent infinite loops when object reference changes
  const memoizedFilters = useMemo(() => filters, [
    filters?.productId,
    filters?.shopId,
    filters?.warehouseId,
    filters?.transferType,
    filters?.status
  ]);

  useEffect(() => {
    if (!user || !company) {
      setLoading(false);
      return;
    }

    console.log('[useStockTransfers] Setting up subscription for company:', company.id);
    setLoading(true);

    const unsubscribe = subscribeToStockTransfers(
      company.id,
      (data) => {
        console.log('[useStockTransfers] Received transfers:', data.length);
        setTransfers(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useStockTransfers] Subscription error:', err);
        setError(err);
        setLoading(false);
      },
      memoizedFilters
    );

    return () => {
      console.log('[useStockTransfers] Cleaning up subscription');
      unsubscribe();
    };
  }, [user, company, memoizedFilters]);

  const createTransfer = async (transferData: {
    transferType: StockTransfer['transferType'];
    products: { productId: string; quantity: number }[];
    fromWarehouseId?: string;
    fromShopId?: string;
    fromProductionId?: string;
    toWarehouseId?: string;
    toShopId?: string;
    inventoryMethod?: 'FIFO' | 'LIFO';
    notes?: string;
    date?: Date | any;
  }) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      let createdBy: ReturnType<typeof getCurrentEmployeeRef> = null;
      if (user && company) {
        let userData: Awaited<ReturnType<typeof getUserById>> | null = null;
        if (isOwner && !currentEmployee) {
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            logError('Error fetching user data for createdBy', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }

      return await transferStockBetweenLocations({
        ...transferData,
        companyId: company.id,
        userId: user.uid,
        createdBy
      });
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const cancelTransfer = async (transferId: string) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await cancelStockTransfer(transferId, user.uid);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    transfers,
    loading,
    error,
    createTransfer,
    cancelTransfer
  };
};

// Stock Replenishment Requests Hook
export const useStockReplenishmentRequests = (filters?: {
  shopId?: string;
  productId?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  requestedBy?: string;
}) => {
  const [requests, setRequests] = useState<StockReplenishmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, company, currentEmployee, isOwner } = useAuth();

  // Memoize filters to prevent infinite loops when object reference changes
  const memoizedFilters = useMemo(() => filters, [
    filters?.shopId,
    filters?.productId,
    filters?.status,
    filters?.requestedBy
  ]);

  useEffect(() => {
    if (!user || !company) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToReplenishmentRequests(
      company.id,
      (data) => {
        setRequests(data);
        setLoading(false);
        setError(null);
      },
      memoizedFilters
    );

    return () => unsubscribe();
  }, [user, company, memoizedFilters]);

  const createRequest = async (requestData: {
    shopId: string;
    productId: string;
    quantity: number;
    notes?: string;
  }) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      let createdBy: ReturnType<typeof getCurrentEmployeeRef> = null;
      if (user && company) {
        let userData: Awaited<ReturnType<typeof getUserById>> | null = null;
        if (isOwner && !currentEmployee) {
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            logError('Error fetching user data for createdBy', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }

      return await createReplenishmentRequest(
        {
          companyId: company.id,
          shopId: requestData.shopId,
          productId: requestData.productId,
          quantity: requestData.quantity,
          requestedBy: user.uid,
          status: 'pending',
          notes: requestData.notes
        },
        createdBy
      );
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const approveRequest = async (requestId: string) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await approveReplenishmentRequest(requestId);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const rejectRequest = async (requestId: string, reason?: string) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await rejectReplenishmentRequest(requestId, reason);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const fulfillRequest = async (requestId: string, transferId: string) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await fulfillReplenishmentRequest(requestId, transferId);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    requests,
    loading,
    error,
    createRequest,
    approveRequest,
    rejectRequest,
    fulfillRequest
  };
};

// Notifications Hook
export const useNotifications = (filters?: {
  companyId?: string;
  read?: boolean;
  type?: Notification['type'];
  limit?: number;
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, company } = useAuth();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let unsubscribeFn: (() => void) | null = null;

    // Create stable filter object to prevent unnecessary recreations
    const stableFilters = {
      companyId: filters?.companyId || company?.id,
      read: filters?.read,
      type: filters?.type,
      limit: filters?.limit
    };

    try {
      unsubscribeFn = subscribeToNotifications(
        user.uid,
        (data) => {
          if (!isMounted) return;

          setNotifications(data);
          setLoading(false);
          setError(null);
          // Update unread count
          const unread = data.filter(n => !n.read).length;
          setUnreadCount(unread);
        },
        stableFilters
      );
    } catch (error) {
      if (isMounted) {
        logError('Error setting up notifications subscription', error);
        setError(error as Error);
        setLoading(false);
      }
    }

    return () => {
      isMounted = false;
      if (unsubscribeFn) {
        try {
          unsubscribeFn();
        } catch (error) {
          // Ignore errors during cleanup
        }
        unsubscribeFn = null;
      }
    };
  }, [user?.uid, company?.id, filters?.companyId, filters?.read, filters?.type, filters?.limit]);

  // Also fetch unread count separately for real-time updates
  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      try {
        const count = await getUnreadNotificationsCount(
          user.uid,
          filters?.companyId || company?.id
        );
        setUnreadCount(count);
      } catch (err) {
        // Silently fail, count will be updated via subscription
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [user, company?.id, filters?.companyId]);

  const markAsRead = async (notificationId: string) => {
    if (!user) throw new Error('User not authenticated');
    try {
      await markNotificationAsRead(notificationId);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const markMultipleAsRead = async (notificationIds: string[]) => {
    if (!user) throw new Error('User not authenticated');
    try {
      await markNotificationsAsRead(notificationIds);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const markAllAsRead = async () => {
    if (!user) throw new Error('User not authenticated');
    try {
      await markAllNotificationsAsRead(user.uid, filters?.companyId || company?.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const createNotificationForUser = async (
    notificationData: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!user) throw new Error('User not authenticated');
    try {
      return await createNotification(notificationData);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markMultipleAsRead,
    markAllAsRead,
    createNotificationForUser
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

// ============================================================================
// PRODUCTION HOOKS
// ============================================================================

// Production Flow Steps Hook
export const useProductionFlowSteps = () => {
  const [flowSteps, setFlowSteps] = useState<ProductionFlowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, company, currentEmployee, isOwner } = useAuth();

  useEffect(() => {
    if (!user || !company) return;

    const unsubscribe = subscribeToProductionFlowSteps(company.id, (data) => {
      setFlowSteps(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, company]);

  const addFlowStep = async (stepData: Omit<ProductionFlowStep, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'userId'>) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      let createdBy: ReturnType<typeof getCurrentEmployeeRef> = null;
      if (user && company) {
        let userData: Awaited<ReturnType<typeof getUserById>> | null = null;
        if (isOwner && !currentEmployee) {
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            logError('Error fetching user data for createdBy', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }
      // Add userId to stepData for audit log
      const stepDataWithIds = {
        ...stepData,
        userId: user.uid
      };
      return await createProductionFlowStep(stepDataWithIds, company.id, createdBy);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateFlowStep = async (stepId: string, data: Partial<ProductionFlowStep>) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await updateProductionFlowStep(stepId, data, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteFlowStep = async (stepId: string) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await deleteProductionFlowStep(stepId, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    flowSteps,
    loading,
    error,
    addFlowStep,
    updateFlowStep,
    deleteFlowStep
  };
};

// Production Flows Hook
export const useProductionFlows = () => {
  const [flows, setFlows] = useState<ProductionFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, company, currentEmployee, isOwner } = useAuth();

  useEffect(() => {
    if (!user || !company) return;

    const unsubscribe = subscribeToProductionFlows(company.id, (data) => {
      setFlows(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, company]);

  const addFlow = async (flowData: Omit<ProductionFlow, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'userId'>) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      let createdBy: ReturnType<typeof getCurrentEmployeeRef> = null;
      if (user && company) {
        let userData: Awaited<ReturnType<typeof getUserById>> | null = null;
        if (isOwner && !currentEmployee) {
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            logError('Error fetching user data for createdBy', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }
      // Add userId to flowData for audit log
      const flowDataWithIds = {
        ...flowData,
        userId: user.uid
      };
      return await createProductionFlow(flowDataWithIds, company.id, createdBy);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateFlow = async (flowId: string, data: Partial<ProductionFlow>) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await updateProductionFlow(flowId, data, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteFlow = async (flowId: string) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await deleteProductionFlow(flowId, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const getDefaultFlow = async () => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      return await getDefaultProductionFlow(company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    flows,
    loading,
    error,
    addFlow,
    updateFlow,
    deleteFlow,
    getDefaultFlow
  };
};

// Production Categories Hook
export const useProductionCategories = () => {
  const [categories, setCategories] = useState<ProductionCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, company, currentEmployee, isOwner } = useAuth();

  useEffect(() => {
    if (!user || !company) return;

    const unsubscribe = subscribeToProductionCategories(company.id, (data) => {
      setCategories(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, company]);

  const addCategory = async (categoryData: Omit<ProductionCategory, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'userId'>) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      let createdBy: ReturnType<typeof getCurrentEmployeeRef> = null;
      if (user && company) {
        let userData: Awaited<ReturnType<typeof getUserById>> | null = null;
        if (isOwner && !currentEmployee) {
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            logError('Error fetching user data for createdBy', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }
      // Add userId to categoryData for audit log
      const categoryDataWithIds = {
        ...categoryData,
        userId: user.uid
      };
      return await createProductionCategory(categoryDataWithIds, company.id, createdBy);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateCategory = async (categoryId: string, data: Partial<ProductionCategory>) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await updateProductionCategory(categoryId, data, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteCategory = async (categoryId: string) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await deleteProductionCategory(categoryId, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    categories,
    loading,
    error,
    addCategory,
    updateCategory,
    deleteCategory
  };
};

// Productions Hook
export const useProductions = () => {
  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, company, currentEmployee, isOwner } = useAuth();

  useEffect(() => {
    if (!user || !company) {
      setProductions([]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    try {
      unsubscribe = subscribeToProductions(company.id, (data) => {
        if (isMounted) {
          setProductions(data);
          setLoading(false);
        }
      });
    } catch (error) {
      logError('Error setting up productions subscription', error);
      if (isMounted) {
        setProductions([]);
        setLoading(false);
      }
    }

    return () => {
      isMounted = false;
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    };
  }, [user, company]);

  const addProduction = async (productionData: Omit<Production, 'id' | 'createdAt' | 'updatedAt' | 'stateHistory' | 'calculatedCostPrice' | 'isCostValidated' | 'isPublished' | 'isClosed'>) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      let createdBy: ReturnType<typeof getCurrentEmployeeRef> = null;
      if (user && company) {
        let userData: Awaited<ReturnType<typeof getUserById>> | null = null;
        if (isOwner && !currentEmployee) {
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            logError('Error fetching user data for createdBy', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }
      return await createProduction(productionData, company.id, createdBy);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateProductionData = async (productionId: string, data: Partial<Production>) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await updateProduction(productionId, data, company.id, user.uid);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteProductionData = async (productionId: string) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await deleteProduction(productionId, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const changeState = async (productionId: string, newStepId: string, note?: string) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await changeProductionState(productionId, newStepId, company.id, user.uid, note);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const changeStatus = async (productionId: string, newStatus: 'draft' | 'in_progress' | 'ready' | 'published' | 'cancelled' | 'closed', note?: string) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      const { changeProductionStatus } = await import('@services/firestore/productions/productionService');
      await changeProductionStatus(productionId, newStatus, company.id, user.uid, note);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const publish = async (
    productionId: string,
    productData: {
      name: string;
      category?: string;
      sellingPrice: number;
      cataloguePrice?: number;
      description?: string;
      barCode?: string;
      isVisible: boolean;
      costPrice: number;
    }
  ) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      return await publishProduction(productionId, productData, company.id, user.uid);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    productions,
    loading,
    error,
    addProduction,
    updateProduction: updateProductionData,
    deleteProduction: deleteProductionData,
    changeState,
    changeStatus,
    publishProduction: publish
  };
};

/**
 * @deprecated useProductionCharges is deprecated
 * Charges are now stored as snapshots in production.charges array
 * Use production.charges directly or use useCharges/useFixedCharges hooks for managing charges
 */
export const useProductionCharges = (productionId: string | null) => {
  console.warn('useProductionCharges is deprecated. Use production.charges array directly or use useCharges/useFixedCharges hooks.');
  const [charges, setCharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Return empty state - this hook should not be used anymore
  useEffect(() => {
    setCharges([]);
    setLoading(false);
  }, [productionId]);

  return {
    charges,
    loading,
    error,
    addCharge: async () => { throw new Error('useProductionCharges is deprecated'); },
    updateCharge: async () => { throw new Error('useProductionCharges is deprecated'); },
    deleteCharge: async () => { throw new Error('useProductionCharges is deprecated'); }
  };
};

// ============================================================================
// CHARGES HOOKS (Unified Charge System)
// ============================================================================

/**
 * Hook to fetch and manage charges (both fixed and custom)
 * @param type - Optional filter: 'fixed', 'custom', or undefined for all
 */
export const useCharges = (type?: 'fixed' | 'custom') => {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, company, currentEmployee, isOwner } = useAuth();

  useEffect(() => {
    if (!company) {
      setCharges([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let unsubscribe: (() => void) | null = null;

    (async () => {
      try {
        if (type === 'fixed') {
          unsubscribe = subscribeToFixedCharges(company.id, (data) => {
            setCharges(data);
            setLoading(false);
            setError(null);
          });
        } else if (type === 'custom') {
          unsubscribe = subscribeToCustomCharges(company.id, (data) => {
            setCharges(data);
            setLoading(false);
            setError(null);
          });
        } else {
          unsubscribe = subscribeToCharges(company.id, (data) => {
            setCharges(data);
            setLoading(false);
            setError(null);
          });
        }
      } catch (err) {
        logError('Error setting up charges subscription', err);
        setError(err as Error);
        setLoading(false);
      }
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [company, type]);

  const addCharge = async (chargeData: Omit<Charge, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      let createdBy = null;
      if (user && company) {
        let userData = null;
        if (isOwner && !currentEmployee) {
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            console.error('Error fetching user data for createdBy:', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }
      return await createCharge(
        { ...chargeData, userId: user.uid, companyId: company.id },
        company.id,
        createdBy
      );
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateChargeData = async (chargeId: string, data: Partial<Charge>) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await updateCharge(chargeId, data, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteChargeData = async (chargeId: string) => {
    if (!user || !company) throw new Error('User not authenticated');
    try {
      await deleteCharge(chargeId, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    charges,
    loading,
    error,
    addCharge,
    updateCharge: updateChargeData,
    deleteCharge: deleteChargeData
  };
};

/**
 * Hook to fetch only fixed charges
 */
export const useFixedCharges = () => {
  return useCharges('fixed');
};

/**
 * Hook to fetch only custom charges
 */
export const useCustomCharges = () => {
  return useCharges('custom');
};

