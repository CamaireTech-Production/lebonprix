import type { Product, StockChange } from '../types/models';

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

/**
 * Get the average cost price for a product from its stock changes
 * @param productId - The product ID
 * @param stockChanges - Array of all stock changes
 * @returns The average cost price or undefined if no stock changes exist
 */
export const getAverageCostPrice = (productId: string, stockChanges: StockChange[]): number | undefined => {
  if (!stockChanges || !Array.isArray(stockChanges)) {
    return undefined;
  }
  
  const productStockChanges = stockChanges
    .filter(sc => sc.productId === productId && sc.costPrice !== undefined && sc.costPrice > 0 && sc.change > 0);

  if (productStockChanges.length === 0) return undefined;

  const totalCost = productStockChanges.reduce((sum, sc) => sum + (sc.costPrice! * sc.change), 0);
  const totalQuantity = productStockChanges.reduce((sum, sc) => sum + sc.change, 0);

  return totalQuantity > 0 ? totalCost / totalQuantity : undefined;
};

/**
 * Get the weighted average cost price for a product (more accurate for inventory valuation)
 * @param productId - The product ID
 * @param stockChanges - Array of all stock changes
 * @returns The weighted average cost price or undefined if no stock changes exist
 */
export const getWeightedAverageCostPrice = (productId: string, stockChanges: StockChange[]): number | undefined => {
  if (!stockChanges || !Array.isArray(stockChanges)) {
    return undefined;
  }
  
  const productStockChanges = stockChanges
    .filter(sc => sc.productId === productId && sc.costPrice !== undefined && sc.costPrice > 0)
    .sort((a, b) => {
      // Sort by creation time, oldest first for proper calculation
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeA - timeB;
    });

  if (productStockChanges.length === 0) return undefined;

  let totalCost = 0;
  let totalQuantity = 0;

  // Calculate weighted average considering stock changes over time
  for (const change of productStockChanges) {
    if (change.change > 0) {
      // Adding stock
      totalCost += change.costPrice! * change.change;
      totalQuantity += change.change;
    } else {
      // Removing stock (sales, adjustments)
      const avgCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;
      totalCost += avgCost * change.change; // Use average cost for removed stock
      totalQuantity += change.change;
    }
  }

  return totalQuantity > 0 ? totalCost / totalQuantity : undefined;
};

/**
 * Calculate profit for a product based on current selling price and latest cost price
 * @param product - The product
 * @param stockChanges - Array of all stock changes
 * @returns The profit amount or undefined if cost price is not available
 */
export const calculateProductProfit = (product: Product, stockChanges: StockChange[]): number | undefined => {
  if (!stockChanges || !Array.isArray(stockChanges)) {
    return undefined;
  }
  
  const costPrice = getLatestCostPrice(product.id, stockChanges);
  if (costPrice === undefined || costPrice === 0) return undefined;
  
  return product.sellingPrice - costPrice;
};

/**
 * Calculate profit margin for a product
 * @param product - The product
 * @param stockChanges - Array of all stock changes
 * @returns The profit margin percentage or undefined if cost price is not available
 */
export const calculateProductProfitMargin = (product: Product, stockChanges: StockChange[]): number | undefined => {
  if (!stockChanges || !Array.isArray(stockChanges)) {
    return undefined;
  }
  
  const costPrice = getLatestCostPrice(product.id, stockChanges);
  if (costPrice === undefined || costPrice === 0) return undefined;
  
  return ((product.sellingPrice - costPrice) / costPrice) * 100;
};

/**
 * Get cost price display value with fallback options
 * @param productId - The product ID
 * @param stockChanges - Array of all stock changes
 * @returns The cost price to display, prioritizing latest, then weighted average, then 0
 */
export const getDisplayCostPrice = (productId: string, stockChanges: StockChange[]): number => {
  if (!stockChanges || !Array.isArray(stockChanges)) {
    return 0;
  }
  
  // Try latest cost price first
  const latestCost = getLatestCostPrice(productId, stockChanges);
  if (latestCost !== undefined && latestCost > 0) {
    return latestCost;
  }

  // Fall back to weighted average
  const avgCost = getWeightedAverageCostPrice(productId, stockChanges);
  if (avgCost !== undefined && avgCost > 0) {
    return avgCost;
  }

  // Fall back to simple average
  const simpleAvgCost = getAverageCostPrice(productId, stockChanges);
  if (simpleAvgCost !== undefined && simpleAvgCost > 0) {
    return simpleAvgCost;
  }

  return 0;
}; 