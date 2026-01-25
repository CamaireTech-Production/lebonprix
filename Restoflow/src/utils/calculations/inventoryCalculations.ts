// Inventory calculations utility for Restoflow
import type { StockBatch, Matiere, Timestamp } from '../../types/geskap';

/**
 * Calculate total stock value
 */
export const calculateStockValue = (batches: StockBatch[]): number => {
  return batches
    .filter((b) => b.status === 'active' && !b.isDeleted)
    .reduce((total, batch) => {
      return total + (batch.remainingQuantity || 0) * (batch.costPrice || 0);
    }, 0);
};

/**
 * Calculate total stock quantity for an item
 */
export const calculateTotalQuantity = (batches: StockBatch[]): number => {
  return batches
    .filter((b) => b.status === 'active' && !b.isDeleted)
    .reduce((total, batch) => total + (batch.remainingQuantity || 0), 0);
};

/**
 * Calculate weighted average cost (CMUP)
 */
export const calculateWeightedAverageCost = (batches: StockBatch[]): number => {
  const activeBatches = batches.filter((b) => b.status === 'active' && !b.isDeleted);
  const totalQuantity = calculateTotalQuantity(activeBatches);

  if (totalQuantity === 0) return 0;

  const totalValue = calculateStockValue(activeBatches);
  return totalValue / totalQuantity;
};

/**
 * Get batches for FIFO consumption (ordered by creation date)
 */
export const getBatchesForFIFO = (batches: StockBatch[]): StockBatch[] => {
  return batches
    .filter((b) => b.status === 'active' && !b.isDeleted && (b.remainingQuantity || 0) > 0)
    .sort((a, b) => {
      const aTime = (a.createdAt as Timestamp)?.seconds || 0;
      const bTime = (b.createdAt as Timestamp)?.seconds || 0;
      return aTime - bTime;
    });
};

/**
 * Get batches for LIFO consumption (ordered by creation date descending)
 */
export const getBatchesForLIFO = (batches: StockBatch[]): StockBatch[] => {
  return batches
    .filter((b) => b.status === 'active' && !b.isDeleted && (b.remainingQuantity || 0) > 0)
    .sort((a, b) => {
      const aTime = (a.createdAt as Timestamp)?.seconds || 0;
      const bTime = (b.createdAt as Timestamp)?.seconds || 0;
      return bTime - aTime;
    });
};

/**
 * Calculate cost of goods to consume using FIFO
 */
export const calculateFIFOCost = (
  batches: StockBatch[],
  quantity: number
): { totalCost: number; consumedBatches: Array<{ batchId: string; quantity: number; cost: number }> } => {
  const fifoBatches = getBatchesForFIFO(batches);
  let remaining = quantity;
  let totalCost = 0;
  const consumedBatches: Array<{ batchId: string; quantity: number; cost: number }> = [];

  for (const batch of fifoBatches) {
    if (remaining <= 0) break;

    const available = batch.remainingQuantity || 0;
    const toConsume = Math.min(available, remaining);

    if (toConsume > 0) {
      const cost = toConsume * (batch.costPrice || 0);
      totalCost += cost;
      consumedBatches.push({
        batchId: batch.id,
        quantity: toConsume,
        cost
      });
      remaining -= toConsume;
    }
  }

  return { totalCost, consumedBatches };
};

/**
 * Check if item has low stock
 */
export const isLowStock = (
  batches: StockBatch[],
  threshold: number
): boolean => {
  const totalQuantity = calculateTotalQuantity(batches);
  return totalQuantity <= threshold;
};

/**
 * Get stock summary for an ingredient
 */
export const getStockSummary = (
  matiere: Matiere,
  batches: StockBatch[]
): {
  name: string;
  unit: string;
  totalQuantity: number;
  totalValue: number;
  averageCost: number;
  batchCount: number;
} => {
  const itemBatches = batches.filter(
    (b) =>
      b.type === 'matiere' &&
      b.matiereId === matiere.id &&
      b.status === 'active' &&
      !b.isDeleted
  );

  return {
    name: matiere.name,
    unit: matiere.unit || 'unit',
    totalQuantity: calculateTotalQuantity(itemBatches),
    totalValue: calculateStockValue(itemBatches),
    averageCost: calculateWeightedAverageCost(itemBatches),
    batchCount: itemBatches.length
  };
};

/**
 * Get items with low stock
 */
export const getLowStockItems = (
  matieres: Matiere[],
  batches: StockBatch[],
  threshold: number = 10
): Array<{ matiere: Matiere; quantity: number }> => {
  return matieres
    .filter((m) => !m.isDeleted)
    .map((matiere) => {
      const itemBatches = batches.filter(
        (b) =>
          b.type === 'matiere' &&
          b.matiereId === matiere.id &&
          b.status === 'active' &&
          !b.isDeleted
      );
      const quantity = calculateTotalQuantity(itemBatches);
      return { matiere, quantity };
    })
    .filter((item) => item.quantity <= threshold)
    .sort((a, b) => a.quantity - b.quantity);
};

/**
 * Calculate inventory turnover rate
 */
export const calculateTurnoverRate = (
  costOfGoodsSold: number,
  averageInventoryValue: number
): number => {
  if (averageInventoryValue === 0) return 0;
  return costOfGoodsSold / averageInventoryValue;
};

/**
 * Get batch expiry warning (for perishable goods)
 */
export const getBatchesNearExpiry = (
  batches: StockBatch[],
  daysThreshold: number = 7
): StockBatch[] => {
  // This would need an expiryDate field on batches
  // For now, return empty - can be extended later
  return [];
};
