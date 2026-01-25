// useCustomers hook for Restoflow
import { useState, useEffect, useCallback } from 'react';
import type { Customer } from '../../types/geskap';
import {
  subscribeToCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerByPhone
} from '../../services/firestore/customers';

interface UseCustomersOptions {
  restaurantId: string;
}

interface UseCustomersReturn {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  addCustomer: (data: Omit<Customer, 'id' | 'createdAt'>) => Promise<Customer>;
  updateCustomer: (customerId: string, data: Partial<Customer>) => Promise<void>;
  deleteCustomer: (customerId: string) => Promise<void>;
  getCustomerByPhone: (phone: string) => Promise<Customer | null>;
  refresh: () => void;
}

export const useCustomers = ({ restaurantId }: UseCustomersOptions): UseCustomersReturn => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setCustomers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToCustomers(restaurantId, (data) => {
      setCustomers(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [restaurantId]);

  const handleAddCustomer = useCallback(
    async (data: Omit<Customer, 'id' | 'createdAt'>) => {
      try {
        return await addCustomer({ ...data, restaurantId });
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleUpdateCustomer = useCallback(
    async (customerId: string, data: Partial<Customer>) => {
      try {
        await updateCustomer(restaurantId, customerId, data);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleDeleteCustomer = useCallback(
    async (customerId: string) => {
      try {
        await deleteCustomer(restaurantId, customerId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleGetCustomerByPhone = useCallback(
    async (phone: string) => {
      try {
        return await getCustomerByPhone(restaurantId, phone);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const refresh = useCallback(() => {
    // Subscription will auto-refresh, but we can trigger a re-render
    setLoading(true);
  }, []);

  return {
    customers,
    loading,
    error,
    addCustomer: handleAddCustomer,
    updateCustomer: handleUpdateCustomer,
    deleteCustomer: handleDeleteCustomer,
    getCustomerByPhone: handleGetCustomerByPhone,
    refresh
  };
};
