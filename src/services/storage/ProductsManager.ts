// src/services/storage/ProductsManager.ts
import LocalStorageService from '../localStorageService';
import type { Product } from '../../types/models';

class ProductsManager {
  private static readonly STORAGE_KEY_PREFIX = 'products_';
  private static readonly TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Generate storage key for company's products
   */
  static getKey(companyId: string): string {
    return `${this.STORAGE_KEY_PREFIX}${companyId}`;
  }

  /**
   * Load products from localStorage
   */
  static load(companyId: string): Product[] | null {
    const key = this.getKey(companyId);
    return LocalStorageService.get<Product[]>(key);
  }

  /**
   * Save products to localStorage (including images for better UX)
   */
  static save(companyId: string, products: Product[]): void {
    const key = this.getKey(companyId);
    
    // Save products with images for immediate display
    // Modern browsers can handle larger localStorage quotas
    LocalStorageService.set(key, products, this.TTL, companyId);
  }

  /**
   * Check if products need sync
   */
  static needsSync(companyId: string): boolean {
    const key = this.getKey(companyId);
    return LocalStorageService.needsSync(key);
  }

  /**
   * Check if products data has changed (including images)
   */
  static hasChanged(localProducts: Product[], remoteProducts: Product[]): boolean {
    // Compare products with images included for accurate change detection
    return LocalStorageService.hasDataChanged(localProducts, remoteProducts);
  }

  /**
   * Update last sync timestamp
   */
  static updateLastSync(companyId: string): void {
    const key = this.getKey(companyId);
    LocalStorageService.updateLastSync(key);
  }

  /**
   * Get last sync timestamp
   */
  static getLastSync(companyId: string): number | null {
    const key = this.getKey(companyId);
    return LocalStorageService.getLastSync(key);
  }

  /**
   * Remove products from localStorage
   */
  static remove(companyId: string): void {
    const key = this.getKey(companyId);
    LocalStorageService.remove(key);
  }

  /**
   * Check if products exist in localStorage
   */
  static exists(companyId: string): boolean {
    const key = this.getKey(companyId);
    return LocalStorageService.has(key);
  }

  /**
   * Get products storage info
   */
  static getStorageInfo(companyId: string): {
    exists: boolean;
    lastSync: number | null;
    needsSync: boolean;
    key: string;
  } {
    const key = this.getKey(companyId);
    return {
      exists: LocalStorageService.has(key),
      lastSync: LocalStorageService.getLastSync(key),
      needsSync: LocalStorageService.needsSync(key),
      key
    };
  }
}

export default ProductsManager;
