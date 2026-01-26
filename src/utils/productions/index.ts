/**
 * Production Utilities
 * 
 * Centralized exports for all production-related utilities.
 */

// Migration utilities
export {
  generateArticleId,
  generateArticleName,
  migrateProductionToArticles,
  batchMigrateProductions,
  needsMigration
} from './migration';

// Material calculation utilities
export {
  calculateMaterialsPerUnit,
  calculateMaterialsForArticle,
  calculateMaterialsForArticleFromProduction,
  calculateMaterialsCost,
  calculateCostPerUnit,
  type MaterialWithPerUnit
} from './materialCalculations';

// Stock validation utilities
export {
  validateMaterialsStock,
  validateMaterialsStockSync,
  type MaterialStockStatus,
  type StockValidationResult
} from './stockValidation';

// Article utilities
export {
  calculateTotalArticlesQuantity,
  getArticleName,
  getArticleById,
  getPublishedArticlesCount,
  areAllArticlesPublished,
  getArticlesByStatus,
  getArticlesReadyForPublish
} from './articleUtils';

// User tracking migration utilities
export {
  migrateProductionsUserTracking,
  migrateProductionCategoriesUserTracking,
  migrateProductionFlowsUserTracking,
  migrateProductionFlowStepsUserTracking,
  migrateProductionChargesUserTracking,
  migrateAllProductionUserTracking
} from './migrateUserTracking';

// Flow validation utilities
export {
  validateProductionFlowCompletion,
  validateArticleFlowCompletion,
  canPublishProduction
} from './flowValidation';

