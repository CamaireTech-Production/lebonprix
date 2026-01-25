/**
 * Stock Validation Utilities
 * 
 * Utilities for validating material stock availability
 * when creating or adding articles to productions.
 */

import type { ProductionMaterial } from '../../types/models';
import { getMatiereStockInfo } from '@services/firestore/stock/stockService';

/**
 * Stock validation status for a material
 */
export interface MaterialStockStatus {
  matiereId: string;
  matiereName: string;
  required: number;
  available: number;
  unit: string;
  status: 'out_of_stock' | 'low_stock' | 'sufficient';
  shortage?: number; // How much is missing (if out of stock)
}

/**
 * Stock validation result
 */
export interface StockValidationResult {
  isValid: boolean; // True if all materials have sufficient stock
  warnings: MaterialStockStatus[]; // Array of material statuses
  hasOutOfStock: boolean; // True if any material is out of stock
  hasLowStock: boolean; // True if any material has low stock (but not out)
}

/**
 * Low stock threshold (percentage of required quantity)
 * If available stock is less than 120% of required, it's considered low stock
 */
const LOW_STOCK_THRESHOLD = 1.2;

/**
 * Validate materials stock availability
 * 
 * Checks if all required materials have sufficient stock available.
 * Note: Stock batches are already company-scoped, so companyId is not needed.
 * 
 * @param materials - Materials to validate
 * @returns Validation result with status for each material
 */
export const validateMaterialsStock = async (
  materials: ProductionMaterial[]
): Promise<StockValidationResult> => {
  const warnings: MaterialStockStatus[] = [];
  let hasOutOfStock = false;
  let hasLowStock = false;

  // Validate each material
  for (const material of materials) {
    if (material.requiredQuantity <= 0) {
      // Skip materials with zero or negative quantity
      continue;
    }

    try {
      // Get stock info for this matiere
      const stockInfo = await getMatiereStockInfo(material.matiereId);
      const available = stockInfo.totalStock;
      const required = material.requiredQuantity;

      let status: 'out_of_stock' | 'low_stock' | 'sufficient';
      let shortage: number | undefined;

      if (available < required) {
        // Out of stock
        status = 'out_of_stock';
        shortage = required - available;
        hasOutOfStock = true;
      } else if (available < required * LOW_STOCK_THRESHOLD) {
        // Low stock (less than 120% of required)
        status = 'low_stock';
        hasLowStock = true;
      } else {
        // Sufficient stock
        status = 'sufficient';
      }

      warnings.push({
        matiereId: material.matiereId,
        matiereName: material.matiereName,
        required,
        available,
        unit: material.unit,
        status,
        shortage
      });
    } catch (error) {
      // If error fetching stock, assume out of stock
      console.error(`Error fetching stock for matiere ${material.matiereId}:`, error);
      warnings.push({
        matiereId: material.matiereId,
        matiereName: material.matiereName,
        required: material.requiredQuantity,
        available: 0,
        unit: material.unit,
        status: 'out_of_stock',
        shortage: material.requiredQuantity
      });
      hasOutOfStock = true;
    }
  }

  return {
    isValid: !hasOutOfStock,
    warnings,
    hasOutOfStock,
    hasLowStock
  };
};

/**
 * Validate materials stock synchronously (using provided stock data)
 * 
 * Useful when stock data is already available (e.g., from hooks)
 * 
 * @param materials - Materials to validate
 * @param stockData - Map of matiereId -> available stock quantity
 * @returns Validation result with status for each material
 */
export const validateMaterialsStockSync = (
  materials: ProductionMaterial[],
  stockData: Map<string, number> // matiereId -> available stock
): StockValidationResult => {
  const warnings: MaterialStockStatus[] = [];
  let hasOutOfStock = false;
  let hasLowStock = false;

  // Validate each material
  for (const material of materials) {
    if (material.requiredQuantity <= 0) {
      // Skip materials with zero or negative quantity
      continue;
    }

    const available = stockData.get(material.matiereId) || 0;
    const required = material.requiredQuantity;

    let status: 'out_of_stock' | 'low_stock' | 'sufficient';
    let shortage: number | undefined;

    if (available < required) {
      // Out of stock
      status = 'out_of_stock';
      shortage = required - available;
      hasOutOfStock = true;
    } else if (available < required * LOW_STOCK_THRESHOLD) {
      // Low stock (less than 120% of required)
      status = 'low_stock';
      hasLowStock = true;
    } else {
      // Sufficient stock
      status = 'sufficient';
    }

    warnings.push({
      matiereId: material.matiereId,
      matiereName: material.matiereName,
      required,
      available,
      unit: material.unit,
      status,
      shortage
    });
  }

  return {
    isValid: !hasOutOfStock,
    warnings,
    hasOutOfStock,
    hasLowStock
  };
};

