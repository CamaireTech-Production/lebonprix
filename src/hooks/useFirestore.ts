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
  subscribeToDashboardStats
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

// Products Hook
export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToProducts((data) => {
      setProducts(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const addProduct = async (productData: Omit<Product, 'id' | 'createdAt'>) => {
    try {
      // TODO: Get actual user ID from auth context
      const userId = 'current-user';
      await createProduct(productData, userId);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateProductData = async (productId: string, data: Partial<Product>) => {
    try {
      // TODO: Get actual user ID from auth context
      const userId = 'current-user';
      await updateProduct(productId, data, userId);
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

  useEffect(() => {
    const unsubscribe = subscribeToCategories((data) => {
      setCategories(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const addCategory = async (name: string) => {
    try {
      // TODO: Get actual user ID from auth context
      const userId = 'current-user';
      const category = await createCategory({ name, createdBy: userId }, userId);
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
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToSales((data) => {
      setSales(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const addSale = async (data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>): Promise<Sale> => {
    try {
      // TODO: Get actual user ID from auth context
      const userId = 'current-user';
      return await createSale(data, userId);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateStatus = async (id: string, status: OrderStatus, paymentStatus: PaymentStatus) => {
    try {
      // TODO: Get actual user ID from auth context
      const userId = 'current-user';
      await updateSaleStatus(id, status, paymentStatus, userId);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return { sales, loading, error, addSale, updateStatus };
};

// Expenses Hook
export const useExpenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToExpenses((data) => {
      setExpenses(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const addExpense = async (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      // TODO: Get actual user ID from auth context
      const userId = 'current-user';
      await createExpense(data, userId);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  // updateExpense is not implemented in services/firestore, so we provide a stub that throws
  const updateExpenseData = async (_id: string, _data: Partial<Expense>) => {
    throw new Error('updateExpense is not implemented. Please implement it in services/firestore.ts');
  };

  return { expenses, loading, error, addExpense, updateExpense: updateExpenseData };
};

// Dashboard Stats Hook
export const useDashboardStats = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToDashboardStats((data) => {
      setStats({
        totalSales: data.totalSales || 0,
        totalExpenses: data.totalExpenses || 0,
        totalProfit: data.totalProfit || 0,
        activeOrders: data.activeOrders || 0,
        completedOrders: data.completedOrders || 0,
        cancelledOrders: data.cancelledOrders || 0,
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { stats, loading, error };
};

