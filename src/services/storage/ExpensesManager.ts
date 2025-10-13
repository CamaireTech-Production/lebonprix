// src/services/storage/ExpensesManager.ts
import LocalStorageService from '../localStorageService';
import type { Expense } from '../../types/models';

class ExpensesManager {
  private static readonly STORAGE_KEY_PREFIX = 'expenses_';
  private static readonly TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Generate storage key for user's expenses
   */
  static getKey(userId: string): string {
    return `${this.STORAGE_KEY_PREFIX}${userId}`;
  }

  /**
   * Load expenses from localStorage
   */
  static load(userId: string): Expense[] | null {
    const key = this.getKey(userId);
    return LocalStorageService.get<Expense[]>(key);
  }

  /**
   * Save expenses to localStorage
   */
  static save(userId: string, expenses: Expense[]): void {
    const key = this.getKey(userId);
    LocalStorageService.set(key, expenses, this.TTL, userId);
  }

  /**
   * Check if expenses need sync
   */
  static needsSync(userId: string): boolean {
    const key = this.getKey(userId);
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
   * Remove expenses from localStorage
   */
  static remove(userId: string): void {
    const key = this.getKey(userId);
    LocalStorageService.remove(key);
  }

  /**
   * Check if expenses exist in localStorage
   */
  static exists(userId: string): boolean {
    const key = this.getKey(userId);
    return LocalStorageService.has(key);
  }

  /**
   * Get expenses storage info
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

export default ExpensesManager;
