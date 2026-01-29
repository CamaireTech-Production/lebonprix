/**
 * Shared Subscriptions Manager
 * Uses singleton pattern to share Firebase subscriptions across all components
 * This eliminates duplicate subscriptions without using React Context
 */

import { subscribeToProducts } from './products/productService';
import { subscribeToSales } from './sales/saleService';
import ProductsManager from '@services/storage/ProductsManager';
import SalesManager from '@services/storage/SalesManager';
import BackgroundSyncService from '@services/utilities/backgroundSync';
import type { Product, Sale } from '../../types/models';

interface SubscriptionState<T> {
  data: T[];
  loading: boolean;
  syncing: boolean;
  error: Error | null;
  unsubscribe: (() => void) | null;
  listeners: Set<(data: T[]) => void>;
}

class SharedSubscriptionsManager {
  private productsState: SubscriptionState<Product> = {
    data: [],
    loading: false,
    syncing: false,
    error: null,
    unsubscribe: null,
    listeners: new Set()
  };

  private salesState: SubscriptionState<Sale> = {
    data: [],
    loading: false,
    syncing: false,
    error: null,
    unsubscribe: null,
    listeners: new Set()
  };

  private companyId: string | null = null;

  /**
   * Initialize subscriptions for a company
   */
  initializeProducts(companyId: string): void {
    if (this.companyId === companyId && this.productsState.unsubscribe) {
      // Already initialized for this company
      return;
    }

    // Cleanup previous subscription if company changed
    if (this.productsState.unsubscribe && this.companyId !== companyId) {
      this.productsState.unsubscribe();
      this.productsState.unsubscribe = null;
    }

    this.companyId = companyId;

    // Load from cache first
    const localProducts = ProductsManager.load(companyId);
    if (localProducts && localProducts.length > 0) {
      this.productsState.data = localProducts;
      this.productsState.loading = false;
      this.productsState.syncing = true;
      this.notifyProductsListeners(localProducts);
    } else {
      this.productsState.loading = true;
    }

    // Start background sync
    BackgroundSyncService.syncProducts(companyId, (freshProducts) => {
      this.productsState.data = freshProducts;
      this.productsState.syncing = false;
      this.productsState.loading = false;
      this.notifyProductsListeners(freshProducts);
    });

    // Create single subscription
    const unsubscribe = subscribeToProducts(companyId, (data) => {
      this.productsState.data = data;
      this.productsState.loading = false;
      this.productsState.syncing = false;
      ProductsManager.save(companyId, data);
      this.notifyProductsListeners(data);
    });

    this.productsState.unsubscribe = unsubscribe;
  }

  /**
   * Initialize sales subscription for a company
   */
  initializeSales(companyId: string): void {
    if (this.companyId === companyId && this.salesState.unsubscribe) {
      // Already initialized for this company
      return;
    }

    // Cleanup previous subscription if company changed
    if (this.salesState.unsubscribe && this.companyId !== companyId) {
      this.salesState.unsubscribe();
      this.salesState.unsubscribe = null;
    }

    this.companyId = companyId;

    // Load from cache first
    const localSales = SalesManager.load(companyId);
    if (localSales && localSales.length > 0) {
      this.salesState.data = localSales;
      this.salesState.loading = false;
      this.salesState.syncing = true;
      this.notifySalesListeners(localSales);
    } else {
      this.salesState.loading = true;
    }

    // Start background sync
    BackgroundSyncService.syncSales(companyId, (freshSales) => {
      this.salesState.data = freshSales;
      this.salesState.syncing = false;
      this.salesState.loading = false;
      this.notifySalesListeners(freshSales);
    });

    // Create single subscription
    const unsubscribe = subscribeToSales(companyId, (data) => {
      this.salesState.data = data;
      this.salesState.loading = false;
      this.salesState.syncing = false;
      SalesManager.save(companyId, data);
      this.notifySalesListeners(data);
    });

    this.salesState.unsubscribe = unsubscribe;
  }

  /**
   * Subscribe to products updates
   */
  subscribeToProducts(listener: (data: Product[]) => void): () => void {
    this.productsState.listeners.add(listener);
    
    // Immediately notify with current data if available
    if (this.productsState.data.length > 0) {
      listener(this.productsState.data);
    }

    // Return unsubscribe function
    return () => {
      this.productsState.listeners.delete(listener);
    };
  }

  /**
   * Subscribe to sales updates
   */
  subscribeToSales(listener: (data: Sale[]) => void): () => void {
    this.salesState.listeners.add(listener);
    
    // Immediately notify with current data if available
    if (this.salesState.data.length > 0) {
      listener(this.salesState.data);
    }

    // Return unsubscribe function
    return () => {
      this.salesState.listeners.delete(listener);
    };
  }

  /**
   * Get current products state
   */
  getProductsState(): SubscriptionState<Product> {
    return {
      data: [...this.productsState.data],
      loading: this.productsState.loading,
      syncing: this.productsState.syncing,
      error: this.productsState.error,
      unsubscribe: null, // Don't expose unsubscribe
      listeners: new Set() // Don't expose listeners
    };
  }

  /**
   * Get current sales state
   */
  getSalesState(): SubscriptionState<Sale> {
    return {
      data: [...this.salesState.data],
      loading: this.salesState.loading,
      syncing: this.salesState.syncing,
      error: this.salesState.error,
      unsubscribe: null, // Don't expose unsubscribe
      listeners: new Set() // Don't expose listeners
    };
  }

  /**
   * Notify all products listeners
   */
  private notifyProductsListeners(data: Product[]): void {
    this.productsState.listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in products listener:', error);
      }
    });
  }

  /**
   * Notify all sales listeners
   */
  private notifySalesListeners(data: Sale[]): void {
    this.salesState.listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in sales listener:', error);
      }
    });
  }

  /**
   * Cleanup all subscriptions
   */
  cleanup(): void {
    if (this.productsState.unsubscribe) {
      this.productsState.unsubscribe();
      this.productsState.unsubscribe = null;
    }
    if (this.salesState.unsubscribe) {
      this.salesState.unsubscribe();
      this.salesState.unsubscribe = null;
    }
    this.productsState.listeners.clear();
    this.salesState.listeners.clear();
    this.companyId = null;
  }
}

// Singleton instance
export const sharedSubscriptions = new SharedSubscriptionsManager();

