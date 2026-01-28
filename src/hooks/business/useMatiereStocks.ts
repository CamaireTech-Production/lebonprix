import { useState, useEffect, useMemo } from 'react';
import { onSnapshot, query, where, orderBy, limit, collection } from 'firebase/firestore';
import { db } from '@services/core/firebase';
import { useAuth } from '@contexts/AuthContext';
import { useMatieres } from '@hooks/business/useMatieres';
import type { StockBatch, StockChange } from '../../types/models';
import { logError } from '@utils/core/logger';

interface MatiereStockInfo {
  matiereId: string;
  matiereName: string;
  currentStock: number;
  unit: string;
  costPrice: number;
  category: string;
  batches: StockBatch[];
  stockChanges: StockChange[];
}

export const useMatiereStocks = () => {
  const { company } = useAuth();
  const { matieres } = useMatieres();
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [stockChanges, setStockChanges] = useState<StockChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to all matiere stock batches
  useEffect(() => {
    if (!company?.id) {
      setBatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Query only matiere batches using type filter
    // OPTIMIZATION: Added limit to reduce Firebase reads
    const q = query(
      collection(db, 'stockBatches'),
      where('companyId', '==', company.id),
      where('type', '==', 'matiere'),
      limit(200) // Limit to 200 matiere batches
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const matiereBatches = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StockBatch[];
        
        // Sort in memory by createdAt descending
        matiereBatches.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
        
        setBatches(matiereBatches);
        setLoading(false);
      },
      (err) => {
        logError('Error fetching matiere stock batches', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [company?.id]);

  // Subscribe to matiere stock changes
  useEffect(() => {
    if (!company?.id) {
      setStockChanges([]);
      return;
    }

    // Query only matiere stock changes using type filter
    // OPTIMIZATION: Added limit to reduce Firebase reads
    const q = query(
      collection(db, 'stockChanges'),
      where('companyId', '==', company.id),
      where('type', '==', 'matiere'),
      limit(200) // Limit to 200 matiere stock changes
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const matiereChanges = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StockChange[];
        
        // Sort in memory by createdAt descending
        matiereChanges.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
        
        setStockChanges(matiereChanges);
      },
      (err) => {
        logError('Error fetching matiere stock changes', err);
      }
    );

    return unsubscribe;
  }, [company?.id]);

  // Combine matieres with stock info (calculate stock from batches only - single source of truth)
  const matiereStocks = useMemo<MatiereStockInfo[]>(() => {
    return matieres.map(matiere => {
      const matiereBatches = batches.filter(b => b.matiereId === matiere.id);
      const matiereStockChanges = stockChanges.filter(sc => sc.matiereId === matiere.id);
      
      // Calculate stock ONLY from batches (single source of truth, like products)
      const effectiveStock = matiereBatches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);

      return {
        matiereId: matiere.id,
        matiereName: matiere.name,
        currentStock: effectiveStock,
        unit: matiere.unit || undefined,
        costPrice: matiere.costPrice,
        category: matiere.refCategorie,
        batches: matiereBatches,
        stockChanges: matiereStockChanges
      };
    });
  }, [matieres, batches, stockChanges]);

  return {
    matiereStocks,
    batches,
    stockChanges,
    loading,
    error
  };
};

