// src/utils/migrationUtils.ts
import { MigrationConfig, MigrationResult } from '../types/migration';
import { ImageMigrationService } from '../services/migrationService';

/**
 * Utility function to run image migration from the application
 */
export async function runImageMigration(config?: Partial<MigrationConfig>): Promise<MigrationResult[]> {
  const defaultConfig: MigrationConfig = {
    batchSize: 10,
    maxConcurrent: 5,
    retryAttempts: 3,
    dryRun: false,
    ...config
  };

  const migrationService = new ImageMigrationService(defaultConfig);
  
  try {
    console.log('🚀 Starting image migration...');
    const results = await migrationService.migrateAllProducts();
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✅ Migration completed: ${successful} successful, ${failed} failed`);
    
    return results;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Utility function to analyze current image storage
 */
export async function analyzeImageStorage(): Promise<{
  totalProducts: number;
  totalImages: number;
  totalSize: number;
  usersWithImages: number;
}> {
  // This would need to be implemented with Firestore queries
  // For now, return a placeholder
  return {
    totalProducts: 0,
    totalImages: 0,
    totalSize: 0,
    usersWithImages: 0
  };
}

/**
 * Utility function to check if a product needs migration
 */
export function needsMigration(product: any): boolean {
  if (!product.images || product.images.length === 0) {
    return false;
  }
  
  // Check if any image is still base64
  return product.images.some((img: string) => 
    img.startsWith('data:image/') || 
    (!img.startsWith('http') && img.length > 100)
  );
}

/**
 * Utility function to get migration status
 */
export function getMigrationStatus(product: any): {
  isMigrated: boolean;
  needsMigration: boolean;
  migratedAt?: Date;
} {
  return {
    isMigrated: !!product.migratedAt,
    needsMigration: needsMigration(product),
    migratedAt: product.migratedAt
  };
}
