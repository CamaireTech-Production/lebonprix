/**
 * Production Migration Utilities
 * 
 * Utilities to migrate existing productions to the new multi-article structure.
 * This ensures backward compatibility with existing production data.
 */

import type { Production, ProductionArticle } from '../../types/models';

/**
 * Generate a unique article ID
 */
export const generateArticleId = (): string => {
  return `article_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Generate article name from production name
 * Format: "{productionName} - Article {index}"
 */
export const generateArticleName = (productionName: string, index: number): string => {
  return `${productionName} - Article ${index}`;
};

/**
 * Migrate existing production to new structure with articles
 * 
 * For existing productions without articles:
 * - Creates a single article from the production
 * - Sets totalArticlesQuantity based on a default quantity (1) or from existing data
 * - Preserves all existing production data
 * 
 * @param production - Existing production to migrate
 * @param defaultQuantity - Default quantity for the article if not specified (default: 1)
 * @returns Production with articles array populated
 */
export const migrateProductionToArticles = (
  production: Production,
  defaultQuantity: number = 1
): Production => {
  // If production already has articles, return as-is
  if (production.articles && production.articles.length > 0) {
    return production;
  }

  // Create a single article from the existing production
  const article: ProductionArticle = {
    id: generateArticleId(),
    name: production.name, // Use production name as article name
    quantity: defaultQuantity,
    status: production.status === 'published' ? 'published' : 
            production.status === 'cancelled' ? 'cancelled' :
            production.status === 'in_progress' ? 'in_progress' :
            production.status === 'ready' ? 'ready' : 'draft',
    currentStepId: production.currentStepId,
    currentStepName: production.currentStepId ? undefined : undefined, // Will be populated from flow if needed
    publishedProductId: production.publishedProductId,
    publishedAt: production.isPublished && production.publishedProductId 
      ? (production.updatedAt || production.createdAt)
      : undefined,
    publishedBy: production.isPublished ? production.userId : undefined,
    description: production.description,
    images: production.images
  };

  // Calculate total articles quantity
  const totalArticlesQuantity = defaultQuantity;

  // Return production with articles array
  return {
    ...production,
    articles: [article],
    totalArticlesQuantity,
    publishedArticlesCount: production.isPublished ? 1 : 0
  };
};

/**
 * Batch migrate multiple productions
 * 
 * @param productions - Array of productions to migrate
 * @param defaultQuantity - Default quantity for articles if not specified (default: 1)
 * @returns Array of migrated productions
 */
export const batchMigrateProductions = (
  productions: Production[],
  defaultQuantity: number = 1
): Production[] => {
  return productions.map(production => 
    migrateProductionToArticles(production, defaultQuantity)
  );
};

/**
 * Check if a production needs migration
 * 
 * @param production - Production to check
 * @returns true if production needs migration (no articles array or empty articles)
 */
export const needsMigration = (production: Production): boolean => {
  return !production.articles || production.articles.length === 0;
};

