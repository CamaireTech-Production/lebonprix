// src/services/migrationService.ts
import { MigrationConfig, MigrationResult } from '../types/migration';
import { ImageProcessor } from './imageProcessor';
import { FirebaseStorageService } from './firebaseStorageService';
import { MigrationLogger } from './migrationLogger';
import { db } from './firebase';
import { collection, getDocs, updateDoc, doc, serverTimestamp, query, where } from 'firebase/firestore';

export class ImageMigrationService {
  private config: MigrationConfig;
  private imageProcessor: ImageProcessor;
  private storageService: FirebaseStorageService;
  private logger: MigrationLogger;

  constructor(config: MigrationConfig) {
    this.config = config;
    this.imageProcessor = new ImageProcessor();
    this.storageService = new FirebaseStorageService();
    this.logger = new MigrationLogger();
  }

  async migrateAllProducts(): Promise<MigrationResult[]> {
    this.logger.log('info', 'Starting image migration', { config: this.config });
    
    try {
      // 1. Get all products with images
      const products = await this.getProductsWithImages();
      this.logger.log('info', `Found ${products.length} products to migrate`);
      
      if (products.length === 0) {
        this.logger.log('info', 'No products with images found');
        return [];
      }
      
      // 2. Process in batches
      const results: MigrationResult[] = [];
      for (let i = 0; i < products.length; i += this.config.batchSize) {
        const batch = products.slice(i, i + this.config.batchSize);
        this.logger.log('info', `Processing batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(products.length / this.config.batchSize)}`);
        
        const batchResults = await this.processBatch(batch);
        results.push(...batchResults);
        
        // Rate limiting
        if (i + this.config.batchSize < products.length) {
          await this.delay(1000);
        }
      }
      
      // 3. Generate final report
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      this.logger.log('info', 'Migration completed', {
        total: products.length,
        successful,
        failed,
        successRate: `${((successful / results.length) * 100).toFixed(2)}%`
      });
      
      return results;
    } catch (error) {
      this.logger.log('error', 'Migration failed', { error: error.message });
      throw error;
    }
  }

  private async processBatch(products: any[]): Promise<MigrationResult[]> {
    const promises = products.map(product => this.migrateProduct(product));
    
    // Limit concurrent operations
    const results: MigrationResult[] = [];
    for (let i = 0; i < promises.length; i += this.config.maxConcurrent) {
      const batch = promises.slice(i, i + this.config.maxConcurrent);
      const batchResults = await Promise.allSettled(batch);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            productId: products[i + index].id,
            success: false,
            imagesUploaded: 0,
            errors: [result.reason.message],
            newImageUrls: [],
            processingTime: 0
          });
        }
      });
    }
    
    return results;
  }

  private async migrateProduct(product: any): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      productId: product.id,
      success: false,
      imagesUploaded: 0,
      errors: [],
      newImageUrls: [],
      processingTime: 0
    };
    
    try {
      if (!product.images || product.images.length === 0) {
        result.success = true;
        return result;
      }
      
      this.logger.log('info', `Migrating product: ${product.name} (${product.id})`);
      
      const newImageUrls: string[] = [];
      
      // Process each image
      for (let i = 0; i < product.images.length; i++) {
        try {
          const base64Image = product.images[i];
          
          // Process base64 to blob
          const { blob } = await this.imageProcessor.processBase64Image(base64Image);
          
          // Upload to Firebase Storage
          const uploadResult = await this.storageService.uploadProductImage(
            blob,
            product.userId,
            product.id,
            i
          );
          
          newImageUrls.push(uploadResult.url);
          result.imagesUploaded++;
          
          this.logger.log('info', `Uploaded image ${i + 1}/${product.images.length} for product ${product.id}`);
          
        } catch (error) {
          const errorMsg = `Image ${i}: ${error.message}`;
          result.errors.push(errorMsg);
          this.logger.log('error', errorMsg, { productId: product.id, imageIndex: i });
        }
      }
      
      // Update product document if all images uploaded successfully
      if (newImageUrls.length === product.images.length) {
        if (!this.config.dryRun) {
          await this.updateProductDocument(product.id, newImageUrls);
        }
        result.success = true;
        result.newImageUrls = newImageUrls;
        this.logger.log('info', `Successfully migrated product ${product.id} with ${newImageUrls.length} images`);
      } else {
        result.errors.push('Not all images uploaded successfully');
        this.logger.log('warn', `Partial migration for product ${product.id}: ${newImageUrls.length}/${product.images.length} images uploaded`);
      }
      
    } catch (error) {
      const errorMsg = `Product migration failed: ${error.message}`;
      result.errors.push(errorMsg);
      this.logger.log('error', errorMsg, { productId: product.id });
    } finally {
      result.processingTime = Date.now() - startTime;
    }
    
    return result;
  }

  private async getProductsWithImages(): Promise<any[]> {
    try {
      let q = collection(db, 'products');
      
      // If specific user is provided, filter by userId
      if (this.config.userId) {
        q = query(collection(db, 'products'), where('userId', '==', this.config.userId));
      }
      
      const snapshot = await getDocs(q);
      const products: any[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Only include products that have images array with base64 data
        if (data.images && Array.isArray(data.images) && data.images.length > 0) {
          // Check if images are base64 (not already migrated URLs)
          const hasBase64Images = data.images.some((img: string) => 
            img.startsWith('data:image/') || 
            (!img.startsWith('http') && img.length > 100)
          );
          
          if (hasBase64Images) {
            products.push({
              id: doc.id,
              ...data
            });
          }
        }
      });
      
      return products;
    } catch (error) {
      this.logger.log('error', 'Failed to fetch products', { error: error.message });
      throw error;
    }
  }

  private async updateProductDocument(productId: string, imageUrls: string[]): Promise<void> {
    try {
      const productRef = doc(db, 'products', productId);
      await updateDoc(productRef, {
        images: imageUrls,
        migratedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      this.logger.log('info', `Updated product document ${productId} with ${imageUrls.length} image URLs`);
    } catch (error) {
      this.logger.log('error', `Failed to update product document ${productId}`, { error: error.message });
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getLogger(): MigrationLogger {
    return this.logger;
  }
}
