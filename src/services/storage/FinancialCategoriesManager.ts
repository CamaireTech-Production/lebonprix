// src/services/storage/FinancialCategoriesManager.ts
import localStorageService from '../localStorageService';

// Financial categories are static reference data that rarely change
interface FinancialCategory {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'debt' | 'asset';
  isDefault: boolean;
  userId?: string;
}

const FINANCIAL_CATEGORIES_PREFIX = 'financial_categories_';
const FINANCIAL_CATEGORIES_TTL = 60 * 60 * 1000; // 1 hour - these are very static

class FinancialCategoriesManager {
  static getKey(userId: string): string {
    return `${FINANCIAL_CATEGORIES_PREFIX}${userId}`;
  }

  static load(userId: string): FinancialCategory[] | null {
    return localStorageService.get<FinancialCategory[]>(FinancialCategoriesManager.getKey(userId));
  }

  static save(userId: string, categories: FinancialCategory[]): void {
    localStorageService.set(FinancialCategoriesManager.getKey(userId), categories, FINANCIAL_CATEGORIES_TTL);
  }

  static remove(userId: string): void {
    localStorageService.remove(FinancialCategoriesManager.getKey(userId));
  }

  static needsSync(userId: string): boolean {
    const lastSync = localStorageService.getLastSync(FinancialCategoriesManager.getKey(userId));
    if (!lastSync) return true; // No data or no sync yet
    return (Date.now() - lastSync) > FINANCIAL_CATEGORIES_TTL;
  }

  static updateLastSync(userId: string): void {
    localStorageService.updateLastSync(FinancialCategoriesManager.getKey(userId));
  }

  /**
   * Compares two arrays of financial categories to check for changes.
   */
  static hasChanged(localCategories: FinancialCategory[], remoteCategories: FinancialCategory[]): boolean {
    if (localCategories.length !== remoteCategories.length) {
      return true;
    }
    
    for (let i = 0; i < localCategories.length; i++) {
      if (localCategories[i].id !== remoteCategories[i].id || 
          localCategories[i].name !== remoteCategories[i].name) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get last sync timestamp for categories
   */
  static getLastSync(userId: string): number | null {
    return localStorageService.getLastSync(FinancialCategoriesManager.getKey(userId));
  }

  /**
   * Get default financial categories (static data)
   */
  static getDefaultCategories(): FinancialCategory[] {
    return [
      { id: 'loan', name: 'loan', type: 'debt', isDefault: true },
      { id: 'expense', name: 'expense', type: 'expense', isDefault: true },
      { id: 'sale', name: 'sale', type: 'income', isDefault: true },
      { id: 'refund', name: 'refund', type: 'income', isDefault: true },
      { id: 'debt', name: 'debt', type: 'debt', isDefault: true },
      { id: 'supplier_debt', name: 'supplier_debt', type: 'debt', isDefault: true },
      { id: 'supplier_refund', name: 'supplier_refund', type: 'income', isDefault: true },
      { id: 'sortie', name: 'sortie', type: 'expense', isDefault: true },
      { id: 'other', name: 'other', type: 'asset', isDefault: true }
    ];
  }
}

export default FinancialCategoriesManager;
