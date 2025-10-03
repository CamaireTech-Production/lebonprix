// src/services/backgroundSync.ts
import { subscribeToProducts, subscribeToSales, subscribeToExpenses, getFinanceEntryTypes } from './firestore';
import ProductsManager from './storage/ProductsManager';
import SalesManager from './storage/SalesManager';
import ExpensesManager from './storage/ExpensesManager';
import FinanceEntryTypesManager from './storage/FinanceEntryTypesManager';
import FinancialCategoriesManager from './storage/FinancialCategoriesManager';
import type { Product, Sale, Expense, FinanceEntryType } from '../types/models';

class BackgroundSyncService {
  private static syncInProgress = new Set<string>();
  private static syncCallbacks = new Map<string, (data: any) => void>();

  /**
   * Sync products in background
   */
  static async syncProducts(userId: string, onUpdate?: (products: Product[]) => void): Promise<void> {
    const key = `products_${userId}`;
    
    // Prevent duplicate syncs
    if (this.syncInProgress.has(key)) {
      console.log(`🔄 Products sync already in progress for user: ${userId}`);
      return;
    }

    this.syncInProgress.add(key);
    
    if (onUpdate) {
      this.syncCallbacks.set(key, onUpdate);
    }

    try {
      console.log(`🔄 Starting background sync for products: ${userId}`);
      
      // Check if sync is needed
      if (!ProductsManager.needsSync(userId)) {
        console.log(`✅ Products data is fresh, skipping sync: ${userId}`);
        return;
      }

      // Subscribe to Firebase for fresh data
      const unsubscribe = subscribeToProducts(userId, (freshProducts) => {
        console.log(`📡 Received fresh products from Firebase: ${freshProducts.length} items`);
        
        // Get current local data
        const localProducts = ProductsManager.load(userId);
        
        // Check if data has actually changed
        if (localProducts && !ProductsManager.hasChanged(localProducts, freshProducts)) {
          console.log(`✅ Products data unchanged, updating sync timestamp only`);
          ProductsManager.updateLastSync(userId);
          return;
        }

        // Data has changed, update localStorage
        console.log(`🔄 Products data changed, updating localStorage`);
        ProductsManager.save(userId, freshProducts);
        
        // Notify callback if provided
        const callback = this.syncCallbacks.get(key);
        if (callback) {
          callback(freshProducts);
        }
        
        // Clean up
        unsubscribe();
        this.syncInProgress.delete(key);
        this.syncCallbacks.delete(key);
      });

      // Set timeout to prevent hanging syncs
      setTimeout(() => {
        if (this.syncInProgress.has(key)) {
          console.warn(`⏰ Products sync timeout for user: ${userId}`);
          unsubscribe();
          this.syncInProgress.delete(key);
          this.syncCallbacks.delete(key);
        }
      }, 30000); // 30 second timeout

    } catch (error) {
      console.error(`❌ Background sync failed for products: ${userId}`, error);
      this.syncInProgress.delete(key);
      this.syncCallbacks.delete(key);
    }
  }

  /**
   * Force immediate sync for products
   */
  static async forceSyncProducts(userId: string, onUpdate?: (products: Product[]) => void): Promise<void> {
    console.log(`🚀 Force syncing products for user: ${userId}`);
    
    // Remove from localStorage to force fresh fetch
    ProductsManager.remove(userId);
    
    // Start sync
    await this.syncProducts(userId, onUpdate);
  }

  /**
   * Check if sync is in progress
   */
  static isSyncing(userId: string): boolean {
    return this.syncInProgress.has(`products_${userId}`);
  }

  /**
   * Sync sales in background
   */
  static async syncSales(userId: string, onUpdate?: (sales: Sale[]) => void): Promise<void> {
    const key = `sales_${userId}`;
    
    // Prevent duplicate syncs
    if (this.syncInProgress.has(key)) {
      console.log(`🔄 Sales sync already in progress for user: ${userId}`);
      return;
    }

    this.syncInProgress.add(key);
    
    if (onUpdate) {
      this.syncCallbacks.set(key, onUpdate);
    }

    try {
      console.log(`🔄 Starting background sync for sales: ${userId}`);
      
      // Check if sync is needed
      if (!SalesManager.needsSync(userId)) {
        console.log(`✅ Sales data is fresh, skipping sync: ${userId}`);
        return;
      }

      // Subscribe to Firebase for fresh data
      const unsubscribe = subscribeToSales(userId, (freshSales) => {
        console.log(`📡 Received fresh sales from Firebase: ${freshSales.length} items`);
        
        // Get current local data
        const localSales = SalesManager.load(userId);
        
        // Check if data has actually changed
        if (localSales && !SalesManager.hasChanged(localSales, freshSales)) {
          console.log(`✅ Sales data unchanged, updating sync timestamp only`);
          SalesManager.updateLastSync(userId);
          return;
        }

        // Data has changed, update localStorage
        console.log(`🔄 Sales data changed, updating localStorage`);
        SalesManager.save(userId, freshSales);
        
        // Notify callback if provided
        const callback = this.syncCallbacks.get(key);
        if (callback) {
          callback(freshSales);
        }
        
        // Clean up
        unsubscribe();
        this.syncInProgress.delete(key);
        this.syncCallbacks.delete(key);
      });

      // Set timeout to prevent hanging syncs
      setTimeout(() => {
        if (this.syncInProgress.has(key)) {
          console.warn(`⏰ Sales sync timeout for user: ${userId}`);
          unsubscribe();
          this.syncInProgress.delete(key);
          this.syncCallbacks.delete(key);
        }
      }, 30000); // 30 second timeout

    } catch (error) {
      console.error(`❌ Background sync failed for sales: ${userId}`, error);
      this.syncInProgress.delete(key);
      this.syncCallbacks.delete(key);
    }
  }

  /**
   * Force immediate sync for sales
   */
  static async forceSyncSales(userId: string, onUpdate?: (sales: Sale[]) => void): Promise<void> {
    console.log(`🚀 Force syncing sales for user: ${userId}`);
    
    // Remove from localStorage to force fresh fetch
    SalesManager.remove(userId);
    
    // Start sync
    await this.syncSales(userId, onUpdate);
  }

  /**
   * Check if sales sync is in progress
   */
  static isSyncingSales(userId: string): boolean {
    return this.syncInProgress.has(`sales_${userId}`);
  }

  /**
   * Sync expenses in background
   */
  static async syncExpenses(userId: string, onUpdate?: (expenses: Expense[]) => void): Promise<void> {
    const key = `expenses_${userId}`;
    
    // Prevent duplicate syncs
    if (this.syncInProgress.has(key)) {
      console.log(`🔄 Expenses sync already in progress for user: ${userId}`);
      return;
    }

    this.syncInProgress.add(key);
    
    if (onUpdate) {
      this.syncCallbacks.set(key, onUpdate);
    }

    try {
      console.log(`🔄 Starting background sync for expenses: ${userId}`);
      
      // Check if sync is needed
      if (!ExpensesManager.needsSync(userId)) {
        console.log(`✅ Expenses data is fresh, skipping sync: ${userId}`);
        return;
      }

      // Subscribe to Firebase for fresh data
      const unsubscribe = subscribeToExpenses(userId, (freshExpenses) => {
        console.log(`📡 Received fresh expenses from Firebase: ${freshExpenses.length} items`);
        
        // Get current local data
        const localExpenses = ExpensesManager.load(userId);
        
        // Check if data has actually changed
        if (localExpenses && !ExpensesManager.hasChanged(localExpenses, freshExpenses)) {
          console.log(`✅ Expenses data unchanged, updating sync timestamp only`);
          ExpensesManager.updateLastSync(userId);
          return;
        }

        // Data has changed, update localStorage
        console.log(`🔄 Expenses data changed, updating localStorage`);
        ExpensesManager.save(userId, freshExpenses);
        
        // Notify callback if provided
        const callback = this.syncCallbacks.get(key);
        if (callback) {
          callback(freshExpenses);
        }
        
        // Clean up
        unsubscribe();
        this.syncInProgress.delete(key);
        this.syncCallbacks.delete(key);
      });

      // Set timeout to prevent hanging syncs
      setTimeout(() => {
        if (this.syncInProgress.has(key)) {
          console.warn(`⏰ Expenses sync timeout for user: ${userId}`);
          unsubscribe();
          this.syncInProgress.delete(key);
          this.syncCallbacks.delete(key);
        }
      }, 30000); // 30 second timeout

    } catch (error) {
      console.error(`❌ Background sync failed for expenses: ${userId}`, error);
      this.syncInProgress.delete(key);
      this.syncCallbacks.delete(key);
    }
  }

  /**
   * Force immediate sync for expenses
   */
  static async forceSyncExpenses(userId: string, onUpdate?: (expenses: Expense[]) => void): Promise<void> {
    console.log(`🚀 Force syncing expenses for user: ${userId}`);
    
    // Remove from localStorage to force fresh fetch
    ExpensesManager.remove(userId);
    
    // Start sync
    await this.syncExpenses(userId, onUpdate);
  }

  /**
   * Check if expenses sync is in progress
   */
  static isSyncingExpenses(userId: string): boolean {
    return this.syncInProgress.has(`expenses_${userId}`);
  }

  /**
   * Sync finance entry types in background (static reference data)
   */
  static async syncFinanceEntryTypes(userId: string, onUpdate?: (entryTypes: FinanceEntryType[]) => void): Promise<void> {
    const key = `finance_entry_types_${userId}`;
    
    // Prevent duplicate syncs
    if (this.syncInProgress.has(key)) {
      console.log(`🔄 Finance entry types sync already in progress for user: ${userId}`);
      return;
    }

    this.syncInProgress.add(key);
    
    if (onUpdate) {
      this.syncCallbacks.set(key, onUpdate);
    }

    try {
      console.log(`🔄 Starting background sync for finance entry types: ${userId}`);
      
      // Check if sync is needed
      if (!FinanceEntryTypesManager.needsSync(userId)) {
        console.log(`✅ Finance entry types data is fresh, skipping sync: ${userId}`);
        return;
      }

      // Fetch fresh data from Firebase
      const freshEntryTypes = await getFinanceEntryTypes(userId);
      console.log(`📡 Received fresh finance entry types from Firebase: ${freshEntryTypes.length} items`);
      
      // Get current local data
      const localEntryTypes = FinanceEntryTypesManager.load(userId);
      
      // Check if data has actually changed
      if (localEntryTypes && !FinanceEntryTypesManager.hasChanged(localEntryTypes, freshEntryTypes)) {
        console.log(`✅ Finance entry types data unchanged, updating sync timestamp only`);
        FinanceEntryTypesManager.updateLastSync(userId);
        return;
      }

      // Data has changed, update localStorage
      console.log(`🔄 Finance entry types data changed, updating localStorage`);
      FinanceEntryTypesManager.save(userId, freshEntryTypes);
      
      // Notify callback if provided
      const callback = this.syncCallbacks.get(key);
      if (callback) {
        callback(freshEntryTypes);
      }
      
    } catch (error) {
      console.error(`❌ Background sync failed for finance entry types: ${userId}`, error);
    } finally {
      this.syncInProgress.delete(key);
      this.syncCallbacks.delete(key);
    }
  }

  /**
   * Force immediate sync for finance entry types
   */
  static async forceSyncFinanceEntryTypes(userId: string, onUpdate?: (entryTypes: FinanceEntryType[]) => void): Promise<void> {
    console.log(`🚀 Force syncing finance entry types for user: ${userId}`);
    
    // Remove from localStorage to force fresh fetch
    FinanceEntryTypesManager.remove(userId);
    
    // Start sync
    await this.syncFinanceEntryTypes(userId, onUpdate);
  }

  /**
   * Check if finance entry types sync is in progress
   */
  static isSyncingFinanceEntryTypes(userId: string): boolean {
    return this.syncInProgress.has(`finance_entry_types_${userId}`);
  }

  /**
   * Sync financial categories in background (static reference data)
   */
  static async syncFinancialCategories(userId: string, onUpdate?: (categories: any[]) => void): Promise<void> {
    const key = `financial_categories_${userId}`;
    
    // Prevent duplicate syncs
    if (this.syncInProgress.has(key)) {
      console.log(`🔄 Financial categories sync already in progress for user: ${userId}`);
      return;
    }

    this.syncInProgress.add(key);
    
    if (onUpdate) {
      this.syncCallbacks.set(key, onUpdate);
    }

    try {
      console.log(`🔄 Starting background sync for financial categories: ${userId}`);
      
      // Check if sync is needed
      if (!FinancialCategoriesManager.needsSync(userId)) {
        console.log(`✅ Financial categories data is fresh, skipping sync: ${userId}`);
        return;
      }

      // For now, use default categories (these are static)
      const defaultCategories = FinancialCategoriesManager.getDefaultCategories();
      console.log(`📡 Using default financial categories: ${defaultCategories.length} items`);
      
      // Get current local data
      const localCategories = FinancialCategoriesManager.load(userId);
      
      // Check if data has actually changed
      if (localCategories && !FinancialCategoriesManager.hasChanged(localCategories, defaultCategories)) {
        console.log(`✅ Financial categories data unchanged, updating sync timestamp only`);
        FinancialCategoriesManager.updateLastSync(userId);
        return;
      }

      // Data has changed, update localStorage
      console.log(`🔄 Financial categories data changed, updating localStorage`);
      FinancialCategoriesManager.save(userId, defaultCategories);
      
      // Notify callback if provided
      const callback = this.syncCallbacks.get(key);
      if (callback) {
        callback(defaultCategories);
      }
      
    } catch (error) {
      console.error(`❌ Background sync failed for financial categories: ${userId}`, error);
    } finally {
      this.syncInProgress.delete(key);
      this.syncCallbacks.delete(key);
    }
  }

  /**
   * Force immediate sync for financial categories
   */
  static async forceSyncFinancialCategories(userId: string, onUpdate?: (categories: any[]) => void): Promise<void> {
    console.log(`🚀 Force syncing financial categories for user: ${userId}`);
    
    // Remove from localStorage to force fresh fetch
    FinancialCategoriesManager.remove(userId);
    
    // Start sync
    await this.syncFinancialCategories(userId, onUpdate);
  }

  /**
   * Check if financial categories sync is in progress
   */
  static isSyncingFinancialCategories(userId: string): boolean {
    return this.syncInProgress.has(`financial_categories_${userId}`);
  }

  /**
   * Get sync status for all data types
   */
  static getSyncStatus(userId: string): {
    products: {
      inProgress: boolean;
      lastSync: number | null;
      needsSync: boolean;
    };
    sales: {
      inProgress: boolean;
      lastSync: number | null;
      needsSync: boolean;
    };
    expenses: {
      inProgress: boolean;
      lastSync: number | null;
      needsSync: boolean;
    };
    financeEntryTypes: {
      inProgress: boolean;
      lastSync: number | null;
      needsSync: boolean;
    };
    financialCategories: {
      inProgress: boolean;
      lastSync: number | null;
      needsSync: boolean;
    };
  } {
    return {
      products: {
        inProgress: this.isSyncing(userId),
        lastSync: ProductsManager.getLastSync(userId),
        needsSync: ProductsManager.needsSync(userId)
      },
      sales: {
        inProgress: this.isSyncingSales(userId),
        lastSync: SalesManager.getLastSync(userId),
        needsSync: SalesManager.needsSync(userId)
      },
      expenses: {
        inProgress: this.isSyncingExpenses(userId),
        lastSync: ExpensesManager.getLastSync(userId),
        needsSync: ExpensesManager.needsSync(userId)
      },
      financeEntryTypes: {
        inProgress: this.isSyncingFinanceEntryTypes(userId),
        lastSync: FinanceEntryTypesManager.getLastSync(userId),
        needsSync: FinanceEntryTypesManager.needsSync(userId)
      },
      financialCategories: {
        inProgress: this.isSyncingFinancialCategories(userId),
        lastSync: FinancialCategoriesManager.getLastSync(userId),
        needsSync: FinancialCategoriesManager.needsSync(userId)
      }
    };
  }
}

export default BackgroundSyncService;
