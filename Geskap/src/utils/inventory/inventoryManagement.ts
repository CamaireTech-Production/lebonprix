import type { StockBatch } from '../../types/models';

export type InventoryMethod = 'FIFO' | 'LIFO' | 'CMUP';

export interface ConsumedBatch {
  batchId: string;
  costPrice: number;
  consumedQuantity: number;
  remainingQuantity: number;
}

export interface InventoryResult {
  consumedBatches: ConsumedBatch[];
  totalCost: number;
  averageCostPrice: number;
  primaryBatchId: string;
}

/**
 * Get available stock batches for a product, sorted by inventory method
 * Note: CMUP doesn't require sorting, but we still filter for consistency
 */
export const getAvailableStockBatches = (
  batches: StockBatch[],
  method: InventoryMethod = 'FIFO'
): StockBatch[] => {
  const availableBatches = batches.filter(batch => batch.remainingQuantity > 0 && batch.status === 'active');
  
  // CMUP doesn't need sorting - we use weighted average
  if (method === 'CMUP') {
    return availableBatches;
  }
  
  return availableBatches.sort((a, b) => {
    if (method === 'FIFO') {
      // FIFO: Oldest first (by creation time)
      return (a.createdAt.seconds || 0) - (b.createdAt.seconds || 0);
    } else {
      // LIFO: Newest first (by creation time)
      return (b.createdAt.seconds || 0) - (a.createdAt.seconds || 0);
    }
  });
};

/**
 * Calculate weighted average cost (CMUP) from available batches
 */
const calculateWeightedAverageCost = (batches: StockBatch[]): number => {
  let totalValue = 0;
  let totalQuantity = 0;
  
  for (const batch of batches) {
    totalValue += batch.costPrice * batch.remainingQuantity;
    totalQuantity += batch.remainingQuantity;
  }
  
  return totalQuantity > 0 ? totalValue / totalQuantity : 0;
};

/**
 * Consume stock from batches using specified inventory method
 */
export const consumeStockFromBatches = (
  batches: StockBatch[],
  quantity: number,
  method: InventoryMethod = 'FIFO'
): InventoryResult => {
  const availableBatches = getAvailableStockBatches(batches, method);
  
  if (availableBatches.length === 0) {
    throw new Error('No available stock batches found');
  }
  
  // Check total available stock
  const totalAvailable = availableBatches.reduce((sum, batch) => sum + batch.remainingQuantity, 0);
  if (totalAvailable < quantity) {
    throw new Error(`Insufficient stock available. Need ${quantity}, available ${totalAvailable}`);
  }
  
  // CMUP: Use weighted average cost for all consumed units
  if (method === 'CMUP') {
    const weightedAverageCost = calculateWeightedAverageCost(availableBatches);
    let remainingQuantity = quantity;
    const consumedBatches: ConsumedBatch[] = [];
    
    // Consume proportionally from all batches
    for (const batch of availableBatches) {
      if (remainingQuantity <= 0) break;
      
      // Calculate proportional consumption based on batch's share of total stock
      const batchProportion = batch.remainingQuantity / totalAvailable;
      const proportionalQuantity = Math.min(
        Math.ceil(quantity * batchProportion),
        batch.remainingQuantity,
        remainingQuantity
      );
      
      const consumeQuantity = Math.min(remainingQuantity, proportionalQuantity, batch.remainingQuantity);
      const newRemainingQuantity = batch.remainingQuantity - consumeQuantity;
      
      consumedBatches.push({
        batchId: batch.id,
        costPrice: weightedAverageCost, // Use weighted average for CMUP
        consumedQuantity: consumeQuantity,
        remainingQuantity: newRemainingQuantity
      });
      
      remainingQuantity -= consumeQuantity;
    }
    
    // If there's still remaining quantity, consume from batches in order
    if (remainingQuantity > 0) {
      for (const batch of availableBatches) {
        if (remainingQuantity <= 0) break;
        
        const alreadyConsumed = consumedBatches.find(cb => cb.batchId === batch.id);
        const availableFromBatch = alreadyConsumed 
          ? batch.remainingQuantity - alreadyConsumed.consumedQuantity
          : batch.remainingQuantity;
        
        if (availableFromBatch > 0) {
          const consumeQuantity = Math.min(remainingQuantity, availableFromBatch);
          
          if (alreadyConsumed) {
            alreadyConsumed.consumedQuantity += consumeQuantity;
            alreadyConsumed.remainingQuantity -= consumeQuantity;
          } else {
            const newRemainingQuantity = batch.remainingQuantity - consumeQuantity;
            consumedBatches.push({
              batchId: batch.id,
              costPrice: weightedAverageCost,
              consumedQuantity: consumeQuantity,
              remainingQuantity: newRemainingQuantity
            });
          }
          
          remainingQuantity -= consumeQuantity;
        }
      }
    }
    
    const totalCost = weightedAverageCost * quantity;
    const primaryBatchId = consumedBatches.length > 0 ? consumedBatches[0].batchId : '';
    
    return {
      consumedBatches,
      totalCost,
      averageCostPrice: weightedAverageCost,
      primaryBatchId
    };
  }
  
  // FIFO/LIFO: Sequential consumption
  let remainingQuantity = quantity;
  const consumedBatches: ConsumedBatch[] = [];
  let totalCost = 0;
  let totalConsumedQuantity = 0;
  
  for (const batch of availableBatches) {
    if (remainingQuantity <= 0) break;
    
    const consumeQuantity = Math.min(remainingQuantity, batch.remainingQuantity);
    const newRemainingQuantity = batch.remainingQuantity - consumeQuantity;
    
    consumedBatches.push({
      batchId: batch.id,
      costPrice: batch.costPrice,
      consumedQuantity: consumeQuantity,
      remainingQuantity: newRemainingQuantity
    });
    
    totalCost += batch.costPrice * consumeQuantity;
    totalConsumedQuantity += consumeQuantity;
    remainingQuantity -= consumeQuantity;
  }
  
  if (remainingQuantity > 0) {
    throw new Error(`Insufficient stock available. Need ${quantity}, available ${quantity - remainingQuantity}`);
  }
  
  const averageCostPrice = totalConsumedQuantity > 0 ? totalCost / totalConsumedQuantity : 0;
  const primaryBatchId = consumedBatches.length > 0 ? consumedBatches[0].batchId : '';
  
  return {
    consumedBatches,
    totalCost,
    averageCostPrice,
    primaryBatchId
  };
};

/**
 * Create a new stock batch
 */
export const createStockBatch = (
  productId: string,
  quantity: number,
  costPrice: number,
  userId: string,
  companyId: string,
  supplierId?: string,
  isOwnPurchase?: boolean,
  isCredit?: boolean
): Omit<StockBatch, 'id'> => {
  return {
    type: 'product',
    productId,
    quantity,
    costPrice,
    supplierId,
    isOwnPurchase,
    isCredit,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    userId,
    companyId,
    remainingQuantity: quantity,
    status: 'active'
  };
};

/**
 * Validate stock batch data
 */
export const validateStockBatch = (batch: Partial<StockBatch>): string[] => {
  const errors: string[] = [];
  
  if (!batch.productId) errors.push('Product ID is required');
  if (!batch.quantity || batch.quantity <= 0) errors.push('Quantity must be greater than 0');
  if (!batch.costPrice || batch.costPrice <= 0) errors.push('Cost price must be greater than 0');
  if (!batch.userId) errors.push('User ID is required');
  
  return errors;
};

/**
 * Format cost price for display
 */
export const formatCostPrice = (costPrice: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XAF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(costPrice);
};

/**
 * Format stock quantity for display
 */
export const formatStockQuantity = (quantity: number): string => {
  return new Intl.NumberFormat('fr-FR').format(quantity);
};

/**
 * Get batch status display text
 */
export const getBatchStatusText = (status: StockBatch['status']): string => {
  switch (status) {
    case 'active':
      return 'Active';
    case 'depleted':
      return 'Depleted';
    case 'corrected':
      return 'Corrected';
    default:
      return 'Unknown';
  }
};

/**
 * Get batch status color for UI
 */
export const getBatchStatusColor = (status: StockBatch['status']): 'success' | 'warning' | 'error' | 'info' | 'default' => {
  switch (status) {
    case 'active':
      return 'success';
    case 'depleted':
      return 'default';
    case 'corrected':
      return 'warning';
    default:
      return 'default';
  }
}; 