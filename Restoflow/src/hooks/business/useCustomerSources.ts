// useCustomerSources hook for Restoflow
import { useState, useEffect, useCallback } from 'react';
import type { CustomerSource } from '../../types/geskap';
import {
  subscribeToCustomerSources,
  addCustomerSource,
  updateCustomerSource,
  deleteCustomerSource
} from '../../services/firestore/customers';

interface UseCustomerSourcesOptions {
  restaurantId: string;
  userId: string;
}

interface UseCustomerSourcesReturn {
  sources: CustomerSource[];
  loading: boolean;
  error: string | null;
  addSource: (data: { name: string; description?: string; color?: string }) => Promise<CustomerSource>;
  updateSource: (sourceId: string, data: Partial<CustomerSource>) => Promise<void>;
  deleteSource: (sourceId: string) => Promise<void>;
}

export const useCustomerSources = ({
  restaurantId,
  userId
}: UseCustomerSourcesOptions): UseCustomerSourcesReturn => {
  const [sources, setSources] = useState<CustomerSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setSources([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToCustomerSources(restaurantId, (data) => {
      setSources(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [restaurantId]);

  const handleAddSource = useCallback(
    async (data: { name: string; description?: string; color?: string }) => {
      try {
        return await addCustomerSource(restaurantId, userId, data);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId, userId]
  );

  const handleUpdateSource = useCallback(
    async (sourceId: string, data: Partial<CustomerSource>) => {
      try {
        await updateCustomerSource(restaurantId, sourceId, data);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleDeleteSource = useCallback(
    async (sourceId: string) => {
      try {
        await deleteCustomerSource(restaurantId, sourceId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  return {
    sources,
    loading,
    error,
    addSource: handleAddSource,
    updateSource: handleUpdateSource,
    deleteSource: handleDeleteSource
  };
};
