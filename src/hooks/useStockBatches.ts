import { useState, useEffect } from 'react';
import { onSnapshot, query, where, orderBy, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { StockBatch } from '../types/models';
import { 
  getProductStockInfo,
  createStockBatch,
  correctBatchCostPrice,
  getStockBatchStats
} from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';
import { devLog, logError } from '../utils/logger';

export const useStockBatches = (productId?: string) => {
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, company } = useAuth();

  useEffect(() => {
    if (!productId) {
      setBatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'stockBatches'),
      where('productId', '==', productId),
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
  }, [productId]);

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
        notes
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
    if (!productId) {
      throw new Error('Product ID not provided');
    }

    try {
      return await getProductStockInfo(productId);
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
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid) {
      setStats(null);
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        setLoading(true);
        const batchStats = await getStockBatchStats(user.uid);
        setStats(batchStats);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch batch stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user?.uid]);

  return { stats, loading, error };
};

export const useAllStockBatches = () => {
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid) {
      setBatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'stockBatches'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
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
        logError('Error fetching stock batches', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user?.uid]);

  return { batches, loading, error };
}; 