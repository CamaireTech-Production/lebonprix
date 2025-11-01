// src/services/storage/SalesManager.ts
import LocalStorageService from '../localStorageService';
import type { Sale } from '../../types/models';

class SalesManager {
  private static readonly STORAGE_KEY_PREFIX = 'sales_';
  private static readonly TTL = 3 * 60 * 1000; // 3 minutes (sales change frequently)

  /**
   * Generate storage key for company's sales
   */
  static getKey(companyId: string): string {
    return `${this.STORAGE_KEY_PREFIX}${companyId}`;
  }

  /**
   * Load sales from localStorage
   */
  static load(companyId: string): Sale[] | null {
    const key = this.getKey(companyId);
    return LocalStorageService.get<Sale[]>(key);
  }

  /**
   * Save sales to localStorage
   */
  static save(companyId: string, sales: Sale[]): void {
    const key = this.getKey(companyId);
    LocalStorageService.set(key, sales, this.TTL, companyId);
  }

  /**
   * Check if sales need sync
   */
  static needsSync(companyId: string): boolean {
    const key = this.getKey(companyId);
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
   * Remove sales from localStorage
   */
  static remove(companyId: string): void {
    const key = this.getKey(companyId);
    LocalStorageService.remove(key);
  }

  /**
   * Check if sales exist in localStorage
   */
  static exists(companyId: string): boolean {
    const key = this.getKey(companyId);
    return LocalStorageService.has(key);
  }

  /**
   * Get sales storage info
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

export default SalesManager;
