// src/utils/dataCache.ts
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class DataCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  /**
   * Set data in cache with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    };
    
    this.cache.set(key, entry);
  }

  /**
   * Get data from cache if not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Remove specific key from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
    }
  }
}

// Create singleton instance
export const dataCache = new DataCache();

// Clean expired entries every 2 minutes
setInterval(() => {
  dataCache.cleanExpired();
}, 2 * 60 * 1000);

// Cache key generators (using companyId for data isolation)
export const cacheKeys = {
  products: (companyId: string) => `products_${companyId}`,
  sales: (companyId: string) => `sales_${companyId}`,
  expenses: (companyId: string) => `expenses_${companyId}`,
  stockChanges: (companyId: string) => `stockChanges_${companyId}`,
  suppliers: (companyId: string) => `suppliers_${companyId}`,
  categories: (companyId: string) => `categories_${companyId}`,
  company: (companyId: string) => `company_${companyId}`,
  dashboard: (companyId: string) => `dashboard_${companyId}`,
  searchProducts: (companyId: string, query: string, category: string) => 
    `search_products_${companyId}_${query}_${category}`,
  salesAnalytics: (companyId: string, dateRange: string) => 
    `sales_analytics_${companyId}_${dateRange}`
};

// Cache invalidation utilities (using companyId)
export const invalidateCompanyCache = (companyId: string) => {
  const keysToInvalidate = [
    cacheKeys.products(companyId),
    cacheKeys.sales(companyId),
    cacheKeys.expenses(companyId),
    cacheKeys.stockChanges(companyId),
    cacheKeys.suppliers(companyId),
    cacheKeys.categories(companyId),
    cacheKeys.company(companyId),
    cacheKeys.dashboard(companyId)
  ];
  
  keysToInvalidate.forEach(key => {
    dataCache.delete(key);
  });
  
};

// Keep invalidateUserCache for backward compatibility (deprecated)
export const invalidateUserCache = (companyId: string) => invalidateCompanyCache(companyId);

export const invalidateSpecificCache = (companyId: string, dataType: 'products' | 'sales' | 'expenses' | 'stockChanges' | 'suppliers' | 'categories' | 'company' | 'dashboard') => {
  const key = cacheKeys[dataType](companyId);
  dataCache.delete(key);
};

export default dataCache;

