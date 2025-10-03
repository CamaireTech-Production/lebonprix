// src/services/storage/SalesManager.ts
import LocalStorageService from '../localStorageService';
import type { Sale } from '../../types/models';

class SalesManager {
  private static readonly STORAGE_KEY_PREFIX = 'sales_';
  private static readonly TTL = 3 * 60 * 1000; // 3 minutes (sales change frequently)

  /**
   * Generate storage key for user's sales
   */
  static getKey(userId: string): string {
    return `${this.STORAGE_KEY_PREFIX}${userId}`;
  }

  /**
   * Load sales from localStorage
   */
  static load(userId: string): Sale[] | null {
    const key = this.getKey(userId);
    return LocalStorageService.get<Sale[]>(key);
  }

  /**
   * Save sales to localStorage
   */
  static save(userId: string, sales: Sale[]): void {
    const key = this.getKey(userId);
    LocalStorageService.set(key, sales, this.TTL, userId);
  }

  /**
   * Check if sales need sync
   */
  static needsSync(userId: string): boolean {
    const key = this.getKey(userId);
    return LocalStorageService.needsSync(key);
  }

  /**
   * Check if sales data has changed
   */
  static hasChanged(localSales: Sale[], remoteSales: Sale[]): boolean {
    return LocalStorageService.hasDataChanged(localSales, remoteSales);
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
   * Remove sales from localStorage
   */
  static remove(userId: string): void {
    const key = this.getKey(userId);
    LocalStorageService.remove(key);
  }

  /**
   * Check if sales exist in localStorage
   */
  static exists(userId: string): boolean {
    const key = this.getKey(userId);
    return LocalStorageService.has(key);
  }

  /**
   * Get sales storage info
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

export default SalesManager;
