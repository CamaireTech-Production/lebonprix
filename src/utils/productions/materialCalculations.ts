/**
 * Material Calculation Utilities
 * 
 * Utilities for calculating material requirements per article unit
 * and for specific article quantities in multi-article productions.
 */

import type { ProductionMaterial } from '../../types/models';

/**
 * Extended material interface with per-unit calculations
 */
export interface MaterialWithPerUnit extends ProductionMaterial {
  requiredQuantityPerUnit: number; // Material needed per article unit
  requiredQuantityForTotal: number; // Original total quantity (for reference)
}

/**
 * Calculate materials per article unit
 * 
 * Formula: materialPerUnit = totalMaterialQuantity / totalArticlesQuantity
 * 
 * @param materials - Production materials (for total articles quantity)
 * @param totalArticlesQuantity - Total quantity of all articles
 * @returns Materials with per-unit calculations
 */
export const calculateMaterialsPerUnit = (
  materials: ProductionMaterial[],
  totalArticlesQuantity: number
): MaterialWithPerUnit[] => {
  if (totalArticlesQuantity <= 0) {
    // If no articles, return materials with 0 per unit
    return materials.map(material => ({
      ...material,
      requiredQuantityPerUnit: 0,
      requiredQuantityForTotal: material.requiredQuantity
    }));
  }

  return materials.map(material => ({
    ...material,
    requiredQuantityPerUnit: material.requiredQuantity / totalArticlesQuantity,
    requiredQuantityForTotal: material.requiredQuantity
  }));
};

/**
 * Calculate materials needed for a specific article quantity
 * 
 * Formula: articleMaterials = (productionMaterials / totalArticlesQuantity) * articleQuantity
 * 
 * @param articleQuantity - Quantity of the article to produce
 * @param materialsPerUnit - Materials per unit (from calculateMaterialsPerUnit)
 * @returns Materials required for the article quantity
 */
export const calculateMaterialsForArticle = (
  articleQuantity: number,
  materialsPerUnit: MaterialWithPerUnit[]
): ProductionMaterial[] => {
  if (articleQuantity <= 0) {
    return materialsPerUnit.map(material => ({
      matiereId: material.matiereId,
      matiereName: material.matiereName,
      requiredQuantity: 0,
      unit: material.unit,
      costPrice: material.costPrice
    }));
  }

  return materialsPerUnit.map(material => ({
    matiereId: material.matiereId,
    matiereName: material.matiereName,
    requiredQuantity: material.requiredQuantityPerUnit * articleQuantity,
    unit: material.unit,
    costPrice: material.costPrice
  }));
};

/**
 * Calculate materials for article directly from production materials
 * (Convenience function that combines both calculations)
 * 
 * @param articleQuantity - Quantity of the article to produce
 * @param productionMaterials - Production materials (for total articles)
 * @param totalArticlesQuantity - Total quantity of all articles
 * @returns Materials required for the article quantity
 */
export const calculateMaterialsForArticleFromProduction = (
  articleQuantity: number,
  productionMaterials: ProductionMaterial[],
  totalArticlesQuantity: number
): ProductionMaterial[] => {
  const materialsPerUnit = calculateMaterialsPerUnit(productionMaterials, totalArticlesQuantity);
  return calculateMaterialsForArticle(articleQuantity, materialsPerUnit);
};

/**
 * Calculate total cost for materials
 * 
 * @param materials - Materials to calculate cost for
 * @returns Total cost
 */
export const calculateMaterialsCost = (materials: ProductionMaterial[]): number => {
  return materials.reduce((total, material) => {
    return total + (material.requiredQuantity * material.costPrice);
  }, 0);
};

/**
 * Calculate cost per article unit
 * 
 * @param materialsPerUnit - Materials per unit
 * @returns Cost per article unit
 */
export const calculateCostPerUnit = (materialsPerUnit: MaterialWithPerUnit[]): number => {
  return materialsPerUnit.reduce((total, material) => {
    return total + (material.requiredQuantityPerUnit * material.costPrice);
  }, 0);
};

/**
 * Calculate materials needed for a partial publication
 * 
 * When publishing only part of an article (e.g., 5 out of 10 units),
 * we need to calculate the proportional material consumption.
 * 
 * Formula: materialsForPublish = articleMaterials * (publishQuantity / articleQuantity)
 * 
 * @param articleMaterials - Materials required for the full article quantity
 * @param publishQuantity - Quantity to publish (must be <= articleQuantity)
 * @param articleQuantity - Total quantity of the article
 * @returns Materials required for the partial publication
 */
export const calculateMaterialsForPartialPublish = (
  articleMaterials: ProductionMaterial[],
  publishQuantity: number,
  articleQuantity: number
): ProductionMaterial[] => {
  if (articleQuantity <= 0) {
    throw new Error('Article quantity must be greater than 0');
  }
  
  if (publishQuantity <= 0) {
    throw new Error('Publish quantity must be greater than 0');
  }
  
  if (publishQuantity > articleQuantity) {
    throw new Error('Publish quantity cannot exceed article quantity');
  }
  
  const ratio = publishQuantity / articleQuantity;
  
  return articleMaterials.map(material => ({
    ...material,
    requiredQuantity: material.requiredQuantity * ratio
  }));
};

