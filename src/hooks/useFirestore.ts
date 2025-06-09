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

  // Function to update local state after a sale is modified
  const updateLocalSale = (updatedSale: Sale) => {
    setSales(currentSales => 
      currentSales.map(sale => 
        sale.id === updatedSale.id ? updatedSale : sale
      )
    );
  };

  useEffect(() => {
    const unsubscribe = subscribeToSales((data) => {
      setSales(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const addSale = async (data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>): Promise<Sale> => {
    try {
      const userId = 'current-user';
      const newSale = await createSale(data, userId);
      // The subscription will handle updating the local state
      return newSale;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateSale = async (saleId: string, data: Partial<Sale>): Promise<void> => {
    try {
      // Get the current sale data
      const currentSale = sales.find(s => s.id === saleId);
      if (!currentSale) {
        throw new Error('Sale not found in local state');
      }

      // Create the updated sale object
      const updatedSale: Sale = {
        ...currentSale,
        ...data,
        updatedAt: Timestamp.now()
      };

      // Update in Firestore
      await updateSaleDocument(saleId, data);

      // Update local state
      updateLocalSale(updatedSale);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateStatus = async (id: string, status: OrderStatus, paymentStatus: PaymentStatus) => {
    try {
      const userId = 'current-user';
      await updateSaleStatus(id, status, paymentStatus, userId);
      
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

  const updateExpenseData = async (id: string, data: Partial<Expense>) => {
    try {
      // TODO: Get actual user ID from auth context
      const userId = 'current-user';
      await updateExpense(id, data, userId);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
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

