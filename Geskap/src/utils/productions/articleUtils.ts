/**
 * Article Utility Functions
 * 
 * General utilities for working with production articles.
 */

import type { ProductionArticle } from '../../types/models';
import { generateArticleName } from './migration';

/**
 * Calculate total articles quantity
 * 
 * Sums up the quantity of all articles in a production.
 * 
 * @param articles - Array of production articles
 * @returns Total quantity of all articles
 */
export const calculateTotalArticlesQuantity = (
  articles: ProductionArticle[]
): number => {
  if (!articles || articles.length === 0) {
    return 0;
  }

  return articles.reduce((total, article) => {
    return total + (article.quantity || 0);
  }, 0);
};

/**
 * Generate article name from production name
 * 
 * If article name is not provided, generates one based on production name and index.
 * 
 * @param productionName - Name of the production
 * @param index - Index of the article (1-based)
 * @param existingName - Optional existing name (if provided, returns as-is)
 * @returns Article name
 */
export const getArticleName = (
  productionName: string,
  index: number,
  existingName?: string
): string => {
  if (existingName && existingName.trim() !== '') {
    return existingName.trim();
  }
  return generateArticleName(productionName, index);
};

/**
 * Get article by ID
 * 
 * @param articles - Array of articles
 * @param articleId - Article ID to find
 * @returns Article or undefined if not found
 */
export const getArticleById = (
  articles: ProductionArticle[],
  articleId: string
): ProductionArticle | undefined => {
  return articles.find(article => article.id === articleId);
};

/**
 * Get published articles count
 * 
 * @param articles - Array of articles
 * @returns Count of published articles
 */
export const getPublishedArticlesCount = (
  articles: ProductionArticle[]
): number => {
  if (!articles || articles.length === 0) {
    return 0;
  }

  return articles.filter(article => article.status === 'published').length;
};

/**
 * Check if all articles are published
 * 
 * @param articles - Array of articles
 * @returns True if all articles have status 'published'
 */
export const areAllArticlesPublished = (
  articles: ProductionArticle[]
): boolean => {
  if (!articles || articles.length === 0) {
    return false;
  }

  return articles.every(article => article.status === 'published');
};

/**
 * Get articles by status
 * 
 * @param articles - Array of articles
 * @param status - Status to filter by
 * @returns Array of articles with the specified status
 */
export const getArticlesByStatus = (
  articles: ProductionArticle[],
  status: ProductionArticle['status']
): ProductionArticle[] => {
  if (!articles || articles.length === 0) {
    return [];
  }

  return articles.filter(article => article.status === status);
};

/**
 * Get articles ready for publishing
 * 
 * Returns articles with status 'ready' or 'in_progress' that can be published.
 * 
 * @param articles - Array of articles
 * @returns Array of articles ready for publishing
 */
export const getArticlesReadyForPublish = (
  articles: ProductionArticle[]
): ProductionArticle[] => {
  if (!articles || articles.length === 0) {
    return [];
  }

  return articles.filter(article => 
    article.status === 'ready' || 
    article.status === 'in_progress'
  );
};

