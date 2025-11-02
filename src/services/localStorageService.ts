// src/services/localStorageService.ts
interface StorageMetadata {
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  version: string;
  userId: string;
}

interface StorageEntry<T> {
  data: T;
  metadata: StorageMetadata;
}

class LocalStorageService {
  private static readonly VERSION = '1.0.0';
  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Store data in localStorage with metadata
   */
  static set<T>(key: string, data: T, ttl?: number, userId?: string): void {
    const entry: StorageEntry<T> = {
      data,
      metadata: {
        timestamp: Date.now(),
        ttl: ttl || this.DEFAULT_TTL,
        version: this.VERSION,
        userId: userId || 'unknown'
      }
    };

    // Check data size before storing (2MB limit)
    const dataString = JSON.stringify(entry);
    const dataSize = new Blob([dataString]).size;
    
    if (dataSize > 2 * 1024 * 1024) { // 2MB limit
      console.warn(`⚠️ Data too large for localStorage (${(dataSize / 1024 / 1024).toFixed(2)}MB), skipping cache: ${key}`);
      return;
    }

    try {
      localStorage.setItem(key, dataString);
    } catch (error) {
      console.error(`❌ Failed to store data in localStorage: ${key}`, error);
      
      // If quota exceeded, try to clean up old data
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.cleanupOldData();
        
        // Try again after cleanup
        try {
          localStorage.setItem(key, JSON.stringify(entry));
        } catch (retryError) {
          console.error(`❌ Still failed to store data after cleanup: ${key}`, retryError);
        }
      }
    }
  }

  /**
   * Retrieve data from localStorage if not expired
   */
  static get<T>(key: string): T | null {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const entry: StorageEntry<T> = JSON.parse(stored);
      
      // Check if data is expired
      const now = Date.now();
      const isExpired = now - entry.metadata.timestamp > entry.metadata.ttl;
      
      if (isExpired) {
        this.remove(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error(`❌ Failed to retrieve data from localStorage: ${key}`, error);
      return null;
    }
  }

  /**
   * Check if data exists and is not expired
   */
  static has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Remove data from localStorage
   */
  static remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`❌ Failed to remove data from localStorage: ${key}`, error);
    }
  }

  /**
   * Clean up old data when localStorage quota is exceeded
   */
  static cleanupOldData(): void {
    const keys = Object.keys(localStorage);
    const dataKeys = keys.filter(key => key.startsWith('products_') || key.startsWith('sales_') || key.startsWith('expenses_'));
    
    // Sort by last sync time (oldest first)
    const sortedKeys = dataKeys.sort((a, b) => {
      const lastSyncA = this.getLastSync(a);
      const lastSyncB = this.getLastSync(b);
      return (lastSyncA || 0) - (lastSyncB || 0);
    });

    // Remove oldest 25% of data
    const keysToRemove = sortedKeys.slice(0, Math.ceil(sortedKeys.length * 0.25));
    
    keysToRemove.forEach(key => {
      this.remove(key);
    });

  }

  /**
   * Check if data needs sync based on TTL
   */
  static needsSync(key: string): boolean {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return true;

      const entry: StorageEntry<any> = JSON.parse(stored);
      const now = Date.now();
      const timeSinceLastUpdate = now - entry.metadata.timestamp;
      
      // Consider data stale if it's older than 80% of TTL
      const staleThreshold = entry.metadata.ttl * 0.8;
      return timeSinceLastUpdate > staleThreshold;
    } catch (error) {
      console.error(`❌ Failed to check sync status: ${key}`, error);
      return true;
    }
  }

  /**
   * Get last sync timestamp
   */
  static getLastSync(key: string): number | null {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const entry: StorageEntry<any> = JSON.parse(stored);
      return entry.metadata.timestamp;
    } catch (error) {
      console.error(`❌ Failed to get last sync time: ${key}`, error);
      return null;
    }
  }

  /**
   * Update last sync timestamp
   */
  static updateLastSync(key: string): void {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return;

      const entry: StorageEntry<any> = JSON.parse(stored);
      entry.metadata.timestamp = Date.now();
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      console.error(`❌ Failed to update sync timestamp: ${key}`, error);
    }
  }

  /**
   * Compare two data arrays for changes
   */
  static hasDataChanged<T>(oldData: T[], newData: T[]): boolean {
    if (!oldData || !newData) return true;
    if (oldData.length !== newData.length) return true;

    // Compare by ID and updatedAt fields
    for (let i = 0; i < oldData.length; i++) {
      const oldItem = oldData[i] as any;
      const newItem = newData[i] as any;
      
      if (oldItem.id !== newItem.id) return true;
      if (oldItem.updatedAt?.seconds !== newItem.updatedAt?.seconds) return true;
    }

    return false;
  }

  /**
   * Get storage statistics
   */
  static getStats(): { size: number; keys: string[]; totalSize: number } {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith('products_') || 
      key.startsWith('sales_') || 
      key.startsWith('categories_') || 
      key.startsWith('company_')
    );
    
    const totalSize = keys.reduce((size, key) => {
      const item = localStorage.getItem(key);
      return size + (item ? item.length : 0);
    }, 0);

    return {
      size: keys.length,
      keys,
      totalSize
    };
  }

  /**
   * Clear all application data
   */
  static clearAll(): void {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith('products_') || 
      key.startsWith('sales_') || 
      key.startsWith('categories_') || 
      key.startsWith('company_')
    );
    
    keys.forEach(key => this.remove(key));
  }
}

export default LocalStorageService;
