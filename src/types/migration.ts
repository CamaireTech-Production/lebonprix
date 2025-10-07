// src/types/migration.ts
export interface MigrationConfig {
  batchSize: number;
  maxConcurrent: number;
  retryAttempts: number;
  dryRun: boolean;
  userId?: string; // Optional: migrate specific user
}

export interface MigrationResult {
  productId: string;
  success: boolean;
  imagesUploaded: number;
  errors: string[];
  newImageUrls: string[];
  processingTime: number;
}

export interface ImageMetadata {
  originalSize: number;
  compressedSize: number;
  format: string;
  dimensions?: { width: number; height: number };
}

export interface StorageResult {
  url: string;
  path: string;
  size: number;
}

export interface MigrationProgress {
  totalProducts: number;
  migratedProducts: number;
  failedProducts: number;
  currentBatch: number;
  estimatedTimeRemaining: number;
  storageUsage: {
    before: number;
    after: number;
    saved: number;
  };
}
