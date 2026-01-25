// useStockBatches hook for Restoflow
import { useState, useEffect, useCallback } from 'react';
import type { StockBatch, StockChange, BatchAdjustment } from '../../types/geskap';
import {
  subscribeToStockBatches,
  subscribeToAllStockBatches,
  subscribeToStockChanges,
  getStockQuantity,
  restockItem,
  consumeStockFIFO,
  adjustBatch,
  deleteBatch
} from '../../services/firestore/stock';

interface UseStockBatchesOptions {
  restaurantId: string;
  userId: string;
  type: 'product' | 'matiere';
  itemId?: string; // Optional - if provided, filter by item
}

interface UseStockBatchesReturn {
  batches: StockBatch[];
  changes: StockChange[];
  loading: boolean;
  error: string | null;
  totalStock: number;
  restock: (
    itemId: string,
    quantity: number,
    costPrice: number,
    supplierInfo?: { supplierId?: string; isOwnPurchase?: boolean; isCredit?: boolean },
    notes?: string
  ) => Promise<void>;
  consume: (
    itemId: string,
    quantity: number,
    reason?: string,
    saleId?: string
  ) => Promise<{ totalCost: number; consumedBatches: Array<{ batchId: string; costPrice: number; consumedQuantity: number }> }>;
  adjustBatch: (adjustment: BatchAdjustment) => Promise<void>;
  deleteBatch: (batchId: string) => Promise<void>;
  getItemStock: (itemId: string) => Promise<number>;
}

export const useStockBatches = ({
  restaurantId,
  userId,
  type,
  itemId
}: UseStockBatchesOptions): UseStockBatchesReturn => {
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [changes, setChanges] = useState<StockChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalStock, setTotalStock] = useState(0);

  // Subscribe to batches
  useEffect(() => {
    if (!restaurantId) {
      setBatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let unsubscribe: () => void;

    if (itemId) {
      unsubscribe = subscribeToStockBatches(restaurantId, type, itemId, (data) => {
        setBatches(data);
        const total = data.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
        setTotalStock(total);
        setLoading(false);
      });
    } else {
      unsubscribe = subscribeToAllStockBatches(restaurantId, type, (data) => {
        setBatches(data);
        setLoading(false);
      });
    }

    return () => unsubscribe();
  }, [restaurantId, type, itemId]);

  // Subscribe to changes if itemId is provided
  useEffect(() => {
    if (!restaurantId || !itemId) {
      setChanges([]);
      return;
    }

    const unsubscribe = subscribeToStockChanges(restaurantId, type, itemId, (data) => {
      setChanges(data);
    });

    return () => unsubscribe();
  }, [restaurantId, type, itemId]);

  const handleRestock = useCallback(
    async (
      targetItemId: string,
      quantity: number,
      costPrice: number,
      supplierInfo?: { supplierId?: string; isOwnPurchase?: boolean; isCredit?: boolean },
      notes?: string
    ) => {
      try {
        await restockItem(restaurantId, type, targetItemId, quantity, costPrice, userId, supplierInfo, notes);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId, type, userId]
  );

  const handleConsume = useCallback(
    async (targetItemId: string, quantity: number, reason?: string, saleId?: string) => {
      try {
        return await consumeStockFIFO(
          restaurantId,
          type,
          targetItemId,
          quantity,
          userId,
          (reason as any) || 'sale',
          saleId
        );
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId, type, userId]
  );

  const handleAdjustBatch = useCallback(
    async (adjustment: BatchAdjustment) => {
      try {
        await adjustBatch(restaurantId, adjustment, userId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId, userId]
  );

  const handleDeleteBatch = useCallback(
    async (batchId: string) => {
      try {
        await deleteBatch(restaurantId, batchId, userId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId, userId]
  );

  const handleGetItemStock = useCallback(
    async (targetItemId: string) => {
      try {
        return await getStockQuantity(restaurantId, type, targetItemId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId, type]
  );

  return {
    batches,
    changes,
    loading,
    error,
    totalStock,
    restock: handleRestock,
    consume: handleConsume,
    adjustBatch: handleAdjustBatch,
    deleteBatch: handleDeleteBatch,
    getItemStock: handleGetItemStock
  };
};
