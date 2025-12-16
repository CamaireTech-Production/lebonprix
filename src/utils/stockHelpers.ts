import type { Product, StockBatch } from '../types/models';

export interface ProductStockTotals {
  remaining: number;
  total: number;
}

/**
 * Build a per-product stock totals map from a list of batches.
 * remaining: sum of remainingQuantity
 * total: sum of original quantity
 */
export const buildProductStockMap = (
  batches: StockBatch[]
): Map<string, ProductStockTotals> => {
  const map = new Map<string, ProductStockTotals>();

  for (const batch of batches) {
    const key = batch.productId;
    if (!key) continue;

    const current = map.get(key) ?? { remaining: 0, total: 0 };
    const remaining = batch.remainingQuantity ?? 0;
    const total = batch.quantity ?? 0;

    current.remaining += remaining;
    current.total += total;
    map.set(key, current);
  }

  return map;
};

/**
 * Get the effective stock to use in the UI and validations.
 * Prefer batch-based remaining quantity when available; otherwise fall back to product.stock.
 */
export const getEffectiveProductStock = (
  product: Product,
  stockMap: Map<string, ProductStockTotals>
): number => {
  const entry = stockMap.get(product.id);
  if (entry) {
    return entry.remaining;
  }
  return typeof product.stock === 'number' ? product.stock : 0;
};

