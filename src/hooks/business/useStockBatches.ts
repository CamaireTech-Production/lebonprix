import { useState, useEffect } from 'react';
import { onSnapshot, query, where, orderBy, collection } from 'firebase/firestore';
import { db } from '@services/core/firebase';
import type { StockBatch } from '../../types/models';
import { 
  getProductStockInfo,
  createStockBatch,
  correctBatchCostPrice,
  getStockBatchStats
} from '@services/firestore/stock/stockService';
import { useAuth } from '@contexts/AuthContext';
import { devLog, logError } from '@utils/core/logger';

export const useStockBatches = (productId?: string) => {
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, company } = useAuth();

  useEffect(() => {
    if (!productId || !company?.id) {
      setBatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'stockBatches'),
      where('type', '==', 'product'),
      where('productId', '==', productId),
      where('companyId', '==', company.id),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const stockBatches = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StockBatch[];
        setBatches(stockBatches);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [productId, company?.id]);

  const addBatch = async (
    quantity: number,
    costPrice: number,
    supplierId?: string,
    isOwnPurchase?: boolean,
    isCredit?: boolean,
    notes?: string
  ) => {
    if (!user?.uid || !productId) {
      throw new Error('User not authenticated or product ID not provided');
    }

    try {
      await createStockBatch(
        productId,
        quantity,
        costPrice,
        user.uid,
        company?.id, // Pass companyId
        supplierId,
        isOwnPurchase,
        isCredit,
        notes,
        'product' // Set type to product
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create stock batch');
      throw err;
    }
  };

  const correctCostPrice = async (batchId: string, newCostPrice: number) => {
    if (!user?.uid) {
      throw new Error('User not authenticated');
    }

    try {
      await correctBatchCostPrice(batchId, newCostPrice, user.uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to correct cost price');
      throw err;
    }
  };

  const getStockInfo = async () => {
    if (!productId || !company?.id) {
      throw new Error('Product ID or company ID not provided');
    }

    try {
      return await getProductStockInfo(productId, company.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get stock info');
      throw err;
    }
  };

  return {
    batches,
    loading,
    error,
    addBatch,
    correctCostPrice,
    getStockInfo
  };
};

export const useStockBatchStats = () => {
  const [stats, setStats] = useState<{
    totalBatches: number;
    activeBatches: number;
    depletedBatches: number;
    totalStockValue: number;
    averageCostPrice: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { company } = useAuth();

  useEffect(() => {
    if (!company?.id) {
      setStats(null);
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        setLoading(true);
        const batchStats = await getStockBatchStats(company.id);
        setStats(batchStats);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch batch stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [company?.id]);

  return { stats, loading, error };
};

export const useAllStockBatches = (type?: 'product' | 'matiere') => {
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { company } = useAuth();

  useEffect(() => {
    if (!company?.id) {
      setBatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const constraints: any[] = [
      where('companyId', '==', company.id),
    ];

    // Add type filter if provided
    if (type) {
      constraints.push(where('type', '==', type));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, 'stockBatches'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const stockBatches = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StockBatch[];
        setBatches(stockBatches);
        setLoading(false);
      },
      (err) => {
        logError('Error fetching stock batches', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [company?.id, type]);

  return { batches, loading, error };
}; 