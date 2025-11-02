// src/services/backgroundSync.ts
import { subscribeToProducts, subscribeToSales, subscribeToExpenses, getFinanceEntryTypes } from './firestore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import ProductsManager from './storage/ProductsManager';
import SalesManager from './storage/SalesManager';
import ExpensesManager from './storage/ExpensesManager';
import FinanceEntryTypesManager from './storage/FinanceEntryTypesManager';
import FinancialCategoriesManager from './storage/FinancialCategoriesManager';
import CompanyManager from './storage/CompanyManager';
import type { Product, Sale, Expense, FinanceEntryType, Company } from '../types/models';

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
      return;
    }

    this.syncInProgress.add(key);
    
    if (onUpdate) {
      this.syncCallbacks.set(key, onUpdate);
    }

    try {
      
      // Check if sync is needed
      if (!ProductsManager.needsSync(userId)) {
        
        // Still notify callback that sync is complete (data is fresh)
        const callback = this.syncCallbacks.get(key);
        if (callback) {
          const localProducts = ProductsManager.load(userId);
          if (localProducts) {
            callback(localProducts);
          }
        }
        
        // Clean up
        this.syncInProgress.delete(key);
        this.syncCallbacks.delete(key);
        return;
      }

      // Subscribe to Firebase for fresh data
      const unsubscribe = subscribeToProducts(userId, (freshProducts) => {
        
        // Get current local data
        const localProducts = ProductsManager.load(userId);
        
        // Check if data has actually changed
        if (localProducts && !ProductsManager.hasChanged(localProducts, freshProducts)) {
          ProductsManager.updateLastSync(userId);
          
          // Still notify callback that sync is complete (even if no data change)
          const callback = this.syncCallbacks.get(key);
          if (callback) {
            callback(freshProducts);
          }
          
          // Clean up
          unsubscribe();
          this.syncInProgress.delete(key);
          this.syncCallbacks.delete(key);
          return;
        }

        // Data has changed, update localStorage
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
      return;
    }

    this.syncInProgress.add(key);
    
    if (onUpdate) {
      this.syncCallbacks.set(key, onUpdate);
    }

    try {
      
      // Check if sync is needed
      if (!SalesManager.needsSync(userId)) {
        
        // Still notify callback that sync is complete (data is fresh)
        const callback = this.syncCallbacks.get(key);
        if (callback) {
          const localSales = SalesManager.load(userId);
          if (localSales) {
            callback(localSales);
          }
        }
        
        // Clean up
        this.syncInProgress.delete(key);
        this.syncCallbacks.delete(key);
        return;
      }

      // Subscribe to Firebase for fresh data
      const unsubscribe = subscribeToSales(userId, (freshSales) => {
        
        // Get current local data
        const localSales = SalesManager.load(userId);
        
        // Check if data has actually changed
        if (localSales && !SalesManager.hasChanged(localSales, freshSales)) {
          SalesManager.updateLastSync(userId);
          
          // Still notify callback that sync is complete (even if no data change)
          const callback = this.syncCallbacks.get(key);
          if (callback) {
            callback(freshSales);
          }
          
          // Clean up
          unsubscribe();
          this.syncInProgress.delete(key);
          this.syncCallbacks.delete(key);
          return;
        }

        // Data has changed, update localStorage
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
      return;
    }

    this.syncInProgress.add(key);
    
    if (onUpdate) {
      this.syncCallbacks.set(key, onUpdate);
    }

    try {
      
      // Check if sync is needed
      if (!ExpensesManager.needsSync(userId)) {
        
        // Still notify callback that sync is complete (data is fresh)
        const callback = this.syncCallbacks.get(key);
        if (callback) {
          const localExpenses = ExpensesManager.load(userId);
          if (localExpenses) {
            callback(localExpenses);
          }
        }
        
        // Clean up
        this.syncInProgress.delete(key);
        this.syncCallbacks.delete(key);
        return;
      }

      // Subscribe to Firebase for fresh data
      const unsubscribe = subscribeToExpenses(userId, (freshExpenses) => {
        
        // Get current local data
        const localExpenses = ExpensesManager.load(userId);
        
        // Check if data has actually changed
        if (localExpenses && !ExpensesManager.hasChanged(localExpenses, freshExpenses)) {
          ExpensesManager.updateLastSync(userId);
          
          // Still notify callback that sync is complete (even if no data change)
          const callback = this.syncCallbacks.get(key);
          if (callback) {
            callback(freshExpenses);
          }
          
          // Clean up
          unsubscribe();
          this.syncInProgress.delete(key);
          this.syncCallbacks.delete(key);
          return;
        }

        // Data has changed, update localStorage
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
      return;
    }

    this.syncInProgress.add(key);
    
    if (onUpdate) {
      this.syncCallbacks.set(key, onUpdate);
    }

    try {
      
      // Check if sync is needed
      if (!FinanceEntryTypesManager.needsSync(userId)) {
        return;
      }

      // Fetch fresh data from Firebase
      const freshEntryTypes = await getFinanceEntryTypes(userId);
      
      // Get current local data
      const localEntryTypes = FinanceEntryTypesManager.load(userId);
      
      // Check if data has actually changed
      if (localEntryTypes && !FinanceEntryTypesManager.hasChanged(localEntryTypes, freshEntryTypes)) {
        FinanceEntryTypesManager.updateLastSync(userId);
        return;
      }

      // Data has changed, update localStorage
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
      return;
    }

    this.syncInProgress.add(key);
    
    if (onUpdate) {
      this.syncCallbacks.set(key, onUpdate);
    }

    try {
      
      // Check if sync is needed
      if (!FinancialCategoriesManager.needsSync(userId)) {
        return;
      }

      // For now, use default categories (these are static)
      const defaultCategories = FinancialCategoriesManager.getDefaultCategories();
      
      // Get current local data
      const localCategories = FinancialCategoriesManager.load(userId);
      
      // Check if data has actually changed
      if (localCategories && !FinancialCategoriesManager.hasChanged(localCategories, defaultCategories)) {
        FinancialCategoriesManager.updateLastSync(userId);
        return;
      }

      // Data has changed, update localStorage
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
   * Sync company data in background
   */
  static async syncCompany(userId: string, onUpdate?: (company: Company) => void): Promise<void> {
    const key = `company_${userId}`;
    
    // Prevent duplicate syncs
    if (this.syncInProgress.has(key)) {
      return;
    }

    this.syncInProgress.add(key);
    
    if (onUpdate) {
      this.syncCallbacks.set(key, onUpdate);
    }

    try {
      
      // Check if sync is needed
      if (!CompanyManager.needsSync(userId)) {
        
        // Still notify callback that sync is complete (data is fresh)
        const callback = this.syncCallbacks.get(key);
        if (callback) {
          const localCompany = CompanyManager.load(userId);
          if (localCompany) {
            callback(localCompany);
          }
        }
        
        // Clean up
        this.syncInProgress.delete(key);
        this.syncCallbacks.delete(key);
        return;
      }

      // Fetch fresh data from Firebase
      const companyDoc = await getDoc(doc(db, 'companies', userId));
      
      if (companyDoc.exists()) {
        const freshCompany = { id: companyDoc.id, ...companyDoc.data() } as Company;
        
        // Get current local data
        const localCompany = CompanyManager.load(userId);
        
        // Check if data has actually changed
        if (localCompany && !CompanyManager.hasChanged(localCompany, freshCompany)) {
          CompanyManager.updateLastSync(userId);
          
          // Still notify callback that sync is complete (even if no data change)
          const callback = this.syncCallbacks.get(key);
          if (callback) {
            callback(freshCompany);
          }
          
          // Clean up
          this.syncInProgress.delete(key);
          this.syncCallbacks.delete(key);
          return;
        }

        // Data has changed, update localStorage
        CompanyManager.save(userId, freshCompany);
        
        // Notify callback if provided
        const callback = this.syncCallbacks.get(key);
        if (callback) {
          callback(freshCompany);
        }
      } else {
      }
      
    } catch (error) {
      console.error(`❌ Background sync failed for company: ${userId}`, error);
    } finally {
      this.syncInProgress.delete(key);
      this.syncCallbacks.delete(key);
    }
  }

  /**
   * Check if company sync is in progress
   */
  static isSyncingCompany(userId: string): boolean {
    return this.syncInProgress.has(`company_${userId}`);
  }

  /**
   * Get sync status for all data types
   */
  static getSyncStatus(userId: string): {
    company: {
      inProgress: boolean;
      lastSync: number | null;
      needsSync: boolean;
    };
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
      company: {
        inProgress: this.isSyncingCompany(userId),
        lastSync: CompanyManager.getLastSync ? CompanyManager.getLastSync(userId) : null,
        needsSync: CompanyManager.needsSync(userId)
      },
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
