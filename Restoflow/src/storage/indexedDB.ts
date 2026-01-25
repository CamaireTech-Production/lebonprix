import { Restaurant, Category, Dish, Order, MediaItem, ActivityLog } from '../types';

// IndexedDB configuration
const DB_NAME = 'RestaurantOrderingSystem';
const DB_VERSION = 1;

// Store names with restaurant scoping
export const STORES = {
  RESTAURANTS: 'restaurants',
  CATEGORIES: 'categories',
  DISHES: 'dishes',
  ORDERS: 'orders',
  MEDIA: 'media',
  ACTIVITY_LOGS: 'activityLogs',
  SYNC_QUEUE: 'syncQueue',
  METADATA: 'metadata'
} as const;

// Database schema interfaces
export interface IndexedDBDocument {
  id: string;
  restaurantId?: string;
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface RestaurantDocument extends IndexedDBDocument {
  data: Restaurant;
}

export interface CategoryDocument extends IndexedDBDocument {
  restaurantId: string;
  data: Category;
}

export interface DishDocument extends IndexedDBDocument {
  restaurantId: string;
  data: Dish;
}

export interface OrderDocument extends IndexedDBDocument {
  restaurantId: string;
  data: Order;
}

export interface MediaDocument extends IndexedDBDocument {
  restaurantId: string;
  data: MediaItem;
}

export interface ActivityLogDocument extends IndexedDBDocument {
  data: ActivityLog;
}

export interface SyncQueueItem extends IndexedDBDocument {
  operation: 'create' | 'update' | 'delete';
  collection: string;
  documentId: string;
  restaurantId?: string;
  data: any;
  timestamp: number;
  retryCount: number;
  lastError?: string;
  status: 'pending' | 'processing' | 'failed' | 'completed';
}

export interface MetadataDocument extends IndexedDBDocument {
  key: string;
  value: any;
  restaurantId?: string;
}

// IndexedDB wrapper class
export class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createStores(db);
      };
    });

    return this.initPromise;
  }

  private createStores(db: IDBDatabase): void {
    // Restaurants store (global)
    if (!db.objectStoreNames.contains(STORES.RESTAURANTS)) {
      const restaurantStore = db.createObjectStore(STORES.RESTAURANTS, { keyPath: 'id' });
      restaurantStore.createIndex('email', 'data.email', { unique: true });
      restaurantStore.createIndex('uid', 'data.uid', { unique: true });
    }

    // Categories store (restaurant-scoped)
    if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
      const categoryStore = db.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' });
      categoryStore.createIndex('restaurantId', 'restaurantId');
      categoryStore.createIndex('parentCategoryId', 'data.parentCategoryId');
      categoryStore.createIndex('status', 'data.status');
    }

    // Dishes store (restaurant-scoped)
    if (!db.objectStoreNames.contains(STORES.DISHES)) {
      const dishStore = db.createObjectStore(STORES.DISHES, { keyPath: 'id' });
      dishStore.createIndex('restaurantId', 'restaurantId');
      dishStore.createIndex('categoryId', 'data.categoryId');
      dishStore.createIndex('status', 'data.status');
    }

    // Orders store (restaurant-scoped)
    if (!db.objectStoreNames.contains(STORES.ORDERS)) {
      const orderStore = db.createObjectStore(STORES.ORDERS, { keyPath: 'id' });
      orderStore.createIndex('restaurantId', 'restaurantId');
      orderStore.createIndex('tableNumber', 'data.tableNumber');
      orderStore.createIndex('status', 'data.status');
      orderStore.createIndex('createdAt', 'data.createdAt');
    }

    // Media store (restaurant-scoped)
    if (!db.objectStoreNames.contains(STORES.MEDIA)) {
      const mediaStore = db.createObjectStore(STORES.MEDIA, { keyPath: 'id' });
      mediaStore.createIndex('restaurantId', 'restaurantId');
      mediaStore.createIndex('type', 'data.type');
    }

    // Activity logs store (global)
    if (!db.objectStoreNames.contains(STORES.ACTIVITY_LOGS)) {
      const activityStore = db.createObjectStore(STORES.ACTIVITY_LOGS, { keyPath: 'id' });
      activityStore.createIndex('userId', 'data.userId');
      activityStore.createIndex('entityType', 'data.entityType');
      activityStore.createIndex('timestamp', 'data.timestamp');
    }

    // Sync queue store
    if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
      const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
      syncStore.createIndex('restaurantId', 'restaurantId');
      syncStore.createIndex('status', 'status');
      syncStore.createIndex('timestamp', 'timestamp');
    }

    // Metadata store
    if (!db.objectStoreNames.contains(STORES.METADATA)) {
      const metadataStore = db.createObjectStore(STORES.METADATA, { keyPath: 'id' });
      metadataStore.createIndex('key', 'key');
      metadataStore.createIndex('restaurantId', 'restaurantId');
    }
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }
    return this.db;
  }

  // Generic CRUD operations
  async create<T extends IndexedDBDocument>(
    storeName: string,
    document: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'version'>
  ): Promise<string> {
    const db = await this.ensureDB();
    const id = crypto.randomUUID();
    const now = Date.now();
    
    const doc: T = {
      ...document,
      id,
      createdAt: now,
      updatedAt: now,
      version: 1
    } as T;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(doc);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(new Error(`Failed to create document in ${storeName}`));
    });
  }

  async getById<T extends IndexedDBDocument>(storeName: string, id: string): Promise<T | null> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(`Failed to get document ${id} from ${storeName}`));
    });
  }

  async getAll<T extends IndexedDBDocument>(
    storeName: string,
    indexName?: string,
    indexValue?: any
  ): Promise<T[]> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = indexName ? store.index(indexName) : store;
      const cursorRequest = indexValue 
        ? request.getAll(indexValue)
        : request.getAll();

      cursorRequest.onsuccess = () => resolve(cursorRequest.result || []);
      cursorRequest.onerror = () => reject(new Error(`Failed to get documents from ${storeName}`));
    });
  }

  async update<T extends IndexedDBDocument>(
    storeName: string,
    id: string,
    updates: Partial<Omit<T, 'id' | 'createdAt' | 'version'>>
  ): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      // First get the existing document
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (!existing) {
          reject(new Error(`Document ${id} not found in ${storeName}`));
          return;
        }

        const updated = {
          ...existing,
          ...updates,
          updatedAt: Date.now(),
          version: existing.version + 1
        };

        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(new Error(`Failed to update document ${id} in ${storeName}`));
      };
      getRequest.onerror = () => reject(new Error(`Failed to get document ${id} from ${storeName}`));
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete document ${id} from ${storeName}`));
    });
  }

  // Restaurant-scoped operations
  async getByRestaurant<T extends IndexedDBDocument>(
    storeName: string,
    restaurantId: string
  ): Promise<T[]> {
    return this.getAll<T>(storeName, 'restaurantId', restaurantId);
  }

  // Batch operations
  async batch(operations: Array<{
    type: 'create' | 'update' | 'delete';
    store: string;
    id?: string;
    data?: any;
  }>): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(Object.values(STORES), 'readwrite');
      
      try {
        for (const op of operations) {
          const store = transaction.objectStore(op.store);
          
          switch (op.type) {
            case 'create':
              if (op.data) {
                const id = crypto.randomUUID();
                const now = Date.now();
                const doc = {
                  ...op.data,
                  id,
                  createdAt: now,
                  updatedAt: now,
                  version: 1
                };
                store.add(doc);
              }
              break;
            case 'update':
              if (op.id && op.data) {
                const getRequest = store.get(op.id);
                getRequest.onsuccess = () => {
                  const existing = getRequest.result;
                  if (existing) {
                    const updated = {
                      ...existing,
                      ...op.data,
                      updatedAt: Date.now(),
                      version: existing.version + 1
                    };
                    store.put(updated);
                  }
                };
              }
              break;
            case 'delete':
              if (op.id) {
                store.delete(op.id);
              }
              break;
          }
        }
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(new Error('Batch operation failed'));
      } catch (error) {
        reject(error);
      }
    });
  }

  // Metadata operations
  async setMetadata(key: string, value: any, restaurantId?: string): Promise<void> {
    const id = restaurantId ? `${restaurantId}_${key}` : key;
    await this.create(STORES.METADATA, {
      id,
      key,
      value,
      restaurantId
    });
  }

  async getMetadata(key: string, restaurantId?: string): Promise<any> {
    const id = restaurantId ? `${restaurantId}_${key}` : key;
    const doc = await this.getById<MetadataDocument>(STORES.METADATA, id);
    return doc?.value;
  }

  // Sync queue operations
  async queueSyncOperation(operation: Omit<SyncQueueItem, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<string> {
    return this.create(STORES.SYNC_QUEUE, {
      ...operation,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    });
  }

  async getPendingSyncOperations(restaurantId?: string): Promise<SyncQueueItem[]> {
    const indexName = restaurantId ? 'restaurantId' : undefined;
    const indexValue = restaurantId;
    return this.getAll<SyncQueueItem>(STORES.SYNC_QUEUE, indexName, indexValue)
      .then(operations => operations.filter(op => op.status === 'pending'));
  }

  async updateSyncOperationStatus(id: string, status: SyncQueueItem['status'], error?: string): Promise<void> {
    const updates: Partial<SyncQueueItem> = { status };
    if (error) {
      updates.lastError = error;
    }
    if (status === 'processing') {
      updates.retryCount = (await this.getById<SyncQueueItem>(STORES.SYNC_QUEUE, id))?.retryCount || 0;
    }
    await this.update(STORES.SYNC_QUEUE, id, updates);
  }

  async incrementSyncRetryCount(id: string): Promise<void> {
    const operation = await this.getById<SyncQueueItem>(STORES.SYNC_QUEUE, id);
    if (operation) {
      await this.update(STORES.SYNC_QUEUE, id, {
        retryCount: operation.retryCount + 1,
        status: 'pending'
      });
    }
  }

  async clearCompletedSyncOperations(): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
      const store = transaction.objectStore(STORES.SYNC_QUEUE);
      const index = store.index('status');
      const request = index.getAll('completed');
      
      request.onsuccess = () => {
        const operations = request.result;
        for (const op of operations) {
          store.delete(op.id);
        }
        resolve();
      };
      request.onerror = () => reject(new Error('Failed to clear completed sync operations'));
    });
  }

  // Utility methods
  async clearAllData(): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(Object.values(STORES), 'readwrite');
      
      for (const storeName of Object.values(STORES)) {
        transaction.objectStore(storeName).clear();
      }
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Failed to clear all data'));
    });
  }

  async getStorageInfo(): Promise<{
    totalSize: number;
    storeSizes: Record<string, number>;
  }> {
    // This is a simplified version - in a real implementation,
    // you'd need to estimate sizes based on stored data
    const storeSizes: Record<string, number> = {};
    let totalSize = 0;
    
    for (const storeName of Object.values(STORES)) {
      const items = await this.getAll(storeName);
      storeSizes[storeName] = items.length;
      totalSize += items.length;
    }
    
    return { totalSize, storeSizes };
  }
}

// Export singleton instance
export const indexedDBManager = new IndexedDBManager();

