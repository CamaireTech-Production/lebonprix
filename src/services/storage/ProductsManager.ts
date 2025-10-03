// src/services/storage/ProductsManager.ts
import LocalStorageService from '../localStorageService';
import type { Product } from '../../types/models';

class ProductsManager {
  private static readonly STORAGE_KEY_PREFIX = 'products_';
  private static readonly TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Generate storage key for user's products
   */
  static getKey(userId: string): string {
    return `${this.STORAGE_KEY_PREFIX}${userId}`;
  }

  /**
   * Load products from localStorage
   */
  static load(userId: string): Product[] | null {
    const key = this.getKey(userId);
    return LocalStorageService.get<Product[]>(key);
  }

  /**
   * Save products to localStorage
   */
  static save(userId: string, products: Product[]): void {
    const key = this.getKey(userId);
    LocalStorageService.set(key, products, this.TTL, userId);
  }

  /**
   * Check if products need sync
   */
  static needsSync(userId: string): boolean {
    const key = this.getKey(userId);
    return LocalStorageService.needsSync(key);
  }

  /**
   * Check if products data has changed
   */
  static hasChanged(localProducts: Product[], remoteProducts: Product[]): boolean {
    return LocalStorageService.hasDataChanged(localProducts, remoteProducts);
  }

  /**
   * Update last sync timestamp
   */
  static updateLastSync(userId: string): void {
    const key = this.getKey(userId);
    LocalStorageService.updateLastSync(key);
  }

  /**
   * Get last sync timestamp
   */
  static getLastSync(userId: string): number | null {
    const key = this.getKey(userId);
    return LocalStorageService.getLastSync(key);
  }

  /**
   * Remove products from localStorage
   */
  static remove(userId: string): void {
    const key = this.getKey(userId);
    LocalStorageService.remove(key);
  }

  /**
   * Check if products exist in localStorage
   */
  static exists(userId: string): boolean {
    const key = this.getKey(userId);
    return LocalStorageService.has(key);
  }

  /**
   * Get products storage info
   */
  static getStorageInfo(userId: string): {
    exists: boolean;
    lastSync: number | null;
    needsSync: boolean;
    key: string;
  } {
    const key = this.getKey(userId);
    return {
      exists: LocalStorageService.has(key),
      lastSync: LocalStorageService.getLastSync(key),
      needsSync: LocalStorageService.needsSync(key),
      key
    };
  }
}

export default ProductsManager;
