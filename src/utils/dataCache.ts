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
    console.log(`📦 Cached data for key: ${key}`);
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
      console.log(`⏰ Cache expired for key: ${key}`);
      return null;
    }

    console.log(`✅ Cache hit for key: ${key}`);
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
    console.log(`🗑️ Removed cache for key: ${key}`);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    console.log(`🧹 Cleared all cache`);
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
      console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
    }
  }
}

// Create singleton instance
export const dataCache = new DataCache();

// Clean expired entries every 2 minutes
setInterval(() => {
  dataCache.cleanExpired();
}, 2 * 60 * 1000);

// Cache key generators
export const cacheKeys = {
  products: (userId: string) => `products_${userId}`,
  sales: (userId: string) => `sales_${userId}`,
  expenses: (userId: string) => `expenses_${userId}`,
  stockChanges: (userId: string) => `stockChanges_${userId}`,
  suppliers: (userId: string) => `suppliers_${userId}`,
  categories: (userId: string) => `categories_${userId}`,
  company: (userId: string) => `company_${userId}`,
  dashboard: (userId: string) => `dashboard_${userId}`,
  searchProducts: (userId: string, query: string, category: string) => 
    `search_products_${userId}_${query}_${category}`,
  salesAnalytics: (userId: string, dateRange: string) => 
    `sales_analytics_${userId}_${dateRange}`
};

// Cache invalidation utilities
export const invalidateUserCache = (userId: string) => {
  const keysToInvalidate = [
    cacheKeys.products(userId),
    cacheKeys.sales(userId),
    cacheKeys.expenses(userId),
    cacheKeys.stockChanges(userId),
    cacheKeys.suppliers(userId),
    cacheKeys.categories(userId),
    cacheKeys.company(userId),
    cacheKeys.dashboard(userId)
  ];
  
  keysToInvalidate.forEach(key => {
    dataCache.delete(key);
  });
  
  console.log(`🗑️ Invalidated all cache for user: ${userId}`);
};

export const invalidateSpecificCache = (userId: string, dataType: 'products' | 'sales' | 'expenses' | 'stockChanges' | 'suppliers' | 'categories' | 'company' | 'dashboard') => {
  const key = cacheKeys[dataType](userId);
  dataCache.delete(key);
  console.log(`🗑️ Invalidated ${dataType} cache for user: ${userId}`);
};

export default dataCache;

