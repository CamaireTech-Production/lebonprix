import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  subscribeToCustomerSources,
  createCustomerSource,
  updateCustomerSource,
  deleteCustomerSource
} from '../services/customerSourceService';
import type { CustomerSource } from '../types/models';

interface UseCustomerSourcesReturn {
  sources: CustomerSource[];
  loading: boolean;
  error: Error | null;
  addSource: (data: Omit<CustomerSource, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'companyId'>) => Promise<CustomerSource>;
  updateSource: (sourceId: string, data: Partial<Omit<CustomerSource, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'companyId'>>) => Promise<void>;
  deleteSource: (sourceId: string) => Promise<void>;
  activeSources: CustomerSource[];
}

export const useCustomerSources = (): UseCustomerSourcesReturn => {
  const { user, company } = useAuth();
  const [sources, setSources] = useState<CustomerSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user || !company) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToCustomerSources(company.id, (data: CustomerSource[]) => {
      setSources(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, company]);

  const addSource = async (data: Omit<CustomerSource, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'companyId'>): Promise<CustomerSource> => {
    if (!user?.uid || !company?.id) throw new Error('User not authenticated');
    try {
      setError(null);
      return await createCustomerSource(data, company.id, user.uid);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateSource = async (
    sourceId: string,
    data: Partial<Omit<CustomerSource, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'companyId'>>
  ): Promise<void> => {
    if (!user?.uid || !company?.id) throw new Error('User not authenticated');
    try {
      setError(null);
      await updateCustomerSource(sourceId, data, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteSource = async (sourceId: string): Promise<void> => {
    if (!user?.uid || !company?.id) throw new Error('User not authenticated');
    try {
      setError(null);
      await deleteCustomerSource(sourceId, company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const activeSources = sources.filter(source => source.isActive);

  return {
    sources,
    loading,
    error,
    addSource,
    updateSource,
    deleteSource,
    activeSources
  };
};





