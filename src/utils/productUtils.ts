import type { Product, StockChange } from '../types/models';

/**
 * Get the latest cost price for a product from its stock changes
 * @param productId - The product ID
 * @param stockChanges - Array of all stock changes
 * @returns The latest cost price or undefined if no stock changes exist
 */
export const getLatestCostPrice = (productId: string, stockChanges: StockChange[]): number | undefined => {
  const productStockChanges = stockChanges
    .filter(sc => sc.productId === productId && sc.costPrice !== undefined)
    .sort((a, b) => {
      // Sort by creation time, newest first
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });

  return productStockChanges.length > 0 ? productStockChanges[0].costPrice : undefined;
};

/**
 * Get the average cost price for a product from its stock changes
 * @param productId - The product ID
 * @param stockChanges - Array of all stock changes
 * @returns The average cost price or undefined if no stock changes exist
 */
export const getAverageCostPrice = (productId: string, stockChanges: StockChange[]): number | undefined => {
  const productStockChanges = stockChanges
    .filter(sc => sc.productId === productId && sc.costPrice !== undefined && sc.change > 0);

  if (productStockChanges.length === 0) return undefined;

  const totalCost = productStockChanges.reduce((sum, sc) => sum + (sc.costPrice! * sc.change), 0);
  const totalQuantity = productStockChanges.reduce((sum, sc) => sum + sc.change, 0);

  return totalQuantity > 0 ? totalCost / totalQuantity : undefined;
};

/**
 * Calculate profit for a product based on current selling price and latest cost price
 * @param product - The product
 * @param stockChanges - Array of all stock changes
 * @returns The profit amount or undefined if cost price is not available
 */
export const calculateProductProfit = (product: Product, stockChanges: StockChange[]): number | undefined => {
  const costPrice = getLatestCostPrice(product.id, stockChanges);
  if (costPrice === undefined) return undefined;
  
  return product.sellingPrice - costPrice;
};

/**
 * Calculate profit margin for a product
 * @param product - The product
 * @param stockChanges - Array of all stock changes
 * @returns The profit margin percentage or undefined if cost price is not available
 */
export const calculateProductProfitMargin = (product: Product, stockChanges: StockChange[]): number | undefined => {
  const costPrice = getLatestCostPrice(product.id, stockChanges);
  if (costPrice === undefined || costPrice === 0) return undefined;
  
  return ((product.sellingPrice - costPrice) / costPrice) * 100;
}; 