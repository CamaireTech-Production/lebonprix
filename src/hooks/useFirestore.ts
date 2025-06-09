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
  updateSaleDocument
} from '../services/firestore';
import type {
  Product,
  Sale,
  Expense,
  Category,
  DashboardStats,
  OrderStatus,
  PaymentStatus
} from '../types/models';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

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

  const addProduct = async (productData: Omit<Product, 'id' | 'createdAt'>) => {
    if (!user) throw new Error('User not authenticated');
    try {
      await createProduct(productData, user.uid);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateProductData = async (productId: string, data: Partial<Product>) => {
    if (!user) throw new Error('User not authenticated');
    try {
      await updateProduct(productId, data, user.uid);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return { products, loading, error, addProduct, updateProduct: updateProductData };
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
    if (!user) throw new Error('User not authenticated');
    try {
      const newSale = await createSale({ ...data, userId: user.uid }, user.uid);
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

      // Update in Firestore
      await updateSaleDocument(saleId, updatedSale, user.uid);

      // Update local state
      updateLocalSale(updatedSale);
    } catch (err) {
      console.error('Error updating sale:', err);
      throw err;
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

  return { sales, loading, error, addSale, updateSale, updateStatus };
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
      await createExpense({ ...data, userId: user.uid }, user.uid);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateExpenseData = async (id: string, data: Partial<Expense>) => {
    if (!user) throw new Error('User not authenticated');
    try {
      await updateExpense(id, { ...data, userId: user.uid }, user.uid);
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
  const [error, setError] = useState<Error | null>(null);

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

