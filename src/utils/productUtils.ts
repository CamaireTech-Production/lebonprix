import type { StockChange } from '../types/models';

/**
 * Get the latest cost price for a product from its stock changes
 * @param productId - The product ID
 * @param stockChanges - Array of all stock changes
 * @returns The latest cost price or undefined if no stock changes exist
 */
export const getLatestCostPrice = (productId: string, stockChanges: StockChange[]): number | undefined => {
  if (!stockChanges || !Array.isArray(stockChanges)) {
    return undefined;
  }
  
  const productStockChanges = stockChanges
    .filter(sc => sc.productId === productId && sc.costPrice !== undefined && sc.costPrice > 0)
    .sort((a, b) => {
      // Sort by creation time, newest first
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });

  return productStockChanges.length > 0 ? productStockChanges[0].costPrice : undefined;
};
