// src/services/storage/ExpensesManager.ts
import LocalStorageService from '@services/utilities/localStorageService';
import type { Expense } from '../../types/models';

class ExpensesManager {
  private static readonly STORAGE_KEY_PREFIX = 'expenses_';
  private static readonly TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Generate storage key for company's expenses
   */
  static getKey(companyId: string): string {
    return `${this.STORAGE_KEY_PREFIX}${companyId}`;
  }

  /**
   * Load expenses from localStorage
   */
  static load(companyId: string): Expense[] | null {
    const key = this.getKey(companyId);
    return LocalStorageService.get<Expense[]>(key);
  }

  /**
   * Save expenses to localStorage
   */
  static save(companyId: string, expenses: Expense[]): void {
    const key = this.getKey(companyId);
    LocalStorageService.set(key, expenses, this.TTL, companyId);
  }

  /**
   * Check if expenses need sync
   */
  static needsSync(companyId: string): boolean {
    const key = this.getKey(companyId);
    return LocalStorageService.needsSync(key);
  }

  /**
   * Check if expenses data has changed
   */
  static hasChanged(localExpenses: Expense[], remoteExpenses: Expense[]): boolean {
    return LocalStorageService.hasDataChanged(localExpenses, remoteExpenses);
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
   * Remove expenses from localStorage
   */
  static remove(companyId: string): void {
    const key = this.getKey(companyId);
    LocalStorageService.remove(key);
  }

  /**
   * Check if expenses exist in localStorage
   */
  static exists(companyId: string): boolean {
    const key = this.getKey(companyId);
    return LocalStorageService.has(key);
  }

  /**
   * Get expenses storage info
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

export default ExpensesManager;
