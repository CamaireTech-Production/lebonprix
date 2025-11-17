import type { StockBatch } from '../types/models';

export type InventoryMethod = 'FIFO' | 'LIFO';

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
 */
export const getAvailableStockBatches = (
  batches: StockBatch[],
  method: InventoryMethod = 'FIFO'
): StockBatch[] => {
  return batches
    .filter(batch => batch.remainingQuantity > 0 && batch.status === 'active')
    .sort((a, b) => {
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
  supplierId?: string,
  isOwnPurchase?: boolean,
  isCredit?: boolean
): Omit<StockBatch, 'id'> => {
  return {
    productId,
    quantity,
    costPrice,
    supplierId,
    isOwnPurchase,
    isCredit,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    userId,
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