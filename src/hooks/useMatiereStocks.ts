import { useState, useEffect, useMemo } from 'react';
import { onSnapshot, query, where, orderBy, collection, getDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useMatieres } from './useMatieres';
import type { StockBatch, StockChange } from '../types/models';
import { logError } from '../utils/logger';

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
  const [stocks, setStocks] = useState<Record<string, number>>({});
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

    // Firestore doesn't support != null queries well, so we fetch all batches and filter
    // Retirer orderBy pour éviter l'index - trier en mémoire
    const q = query(
      collection(db, 'stockBatches'),
      where('companyId', '==', company.id)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allBatches = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StockBatch[];
        
        // Filter to only matiere batches (those with matiereId and no productId)
        const matiereBatches = allBatches.filter(batch => 
          batch.matiereId && !batch.productId
        );
        
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

    // Firestore doesn't support != null queries well, so we fetch all changes and filter
    // Retirer orderBy pour éviter l'index - trier en mémoire
    const q = query(
      collection(db, 'stockChanges'),
      where('companyId', '==', company.id)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allChanges = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StockChange[];
        
        // Filter to only matiere changes (those with matiereId and no productId)
        const matiereChanges = allChanges.filter(change => 
          change.matiereId && !change.productId
        );
        
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

  // Load stock quantities from stocks collection
  useEffect(() => {
    if (!matieres.length) {
      setStocks({});
      return;
    }

    const loadStocks = async () => {
      const stocksMap: Record<string, number> = {};
      
      for (const matiere of matieres) {
        if (matiere.refStock) {
          try {
            const stockDoc = await getDoc(doc(db, 'stocks', matiere.refStock));
            if (stockDoc.exists()) {
              const stockData = stockDoc.data();
              stocksMap[matiere.id] = stockData.quantity || 0;
            } else {
              stocksMap[matiere.id] = 0;
            }
          } catch (err) {
            logError(`Error loading stock for matiere ${matiere.id}`, err);
            stocksMap[matiere.id] = 0;
          }
        } else {
          stocksMap[matiere.id] = 0;
        }
      }
      
      setStocks(stocksMap);
    };

    loadStocks();
  }, [matieres]);

  // Combine matieres with stock info
  const matiereStocks = useMemo<MatiereStockInfo[]>(() => {
    return matieres.map(matiere => {
      const matiereBatches = batches.filter(b => b.matiereId === matiere.id);
      const matiereStockChanges = stockChanges.filter(sc => sc.matiereId === matiere.id);
      const currentStock = stocks[matiere.id] || 0;
      
      // Calculate stock from batches if available
      const calculatedStock = matiereBatches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
      const effectiveStock = calculatedStock > 0 ? calculatedStock : currentStock;

      return {
        matiereId: matiere.id,
        matiereName: matiere.name,
        currentStock: effectiveStock,
        unit: matiere.unit,
        costPrice: matiere.costPrice,
        category: matiere.refCategorie,
        batches: matiereBatches,
        stockChanges: matiereStockChanges
      };
    });
  }, [matieres, batches, stockChanges, stocks]);

  return {
    matiereStocks,
    batches,
    stockChanges,
    loading,
    error
  };
};

