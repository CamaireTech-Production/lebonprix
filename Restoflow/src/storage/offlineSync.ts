import { indexedDBManager, SyncQueueItem, STORES } from './indexedDB';
import { FirestoreService } from '../services/firestoreService';
import { Restaurant, Category, Dish, Order, MediaItem, ActivityLog } from '../types';

// Offline sync configuration
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const BATCH_SIZE = 10;

// Sync status tracking
export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSync: number | null;
  pendingOperations: number;
  failedOperations: number;
}

// Conflict resolution strategies
export enum ConflictResolution {
  SERVER_WINS = 'server_wins',
  CLIENT_WINS = 'client_wins',
  MERGE = 'merge',
  MANUAL = 'manual'
}

// Offline sync manager
export class OfflineSyncManager {
  private syncStatus: SyncStatus = {
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSync: null,
    pendingOperations: 0,
    failedOperations: 0
  };

  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupEventListeners();
    this.startPeriodicSync();
  }

  // Event listeners
  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.syncStatus.isOnline = true;
      this.notifyListeners();
      this.syncNow();
    });

    window.addEventListener('offline', () => {
      this.syncStatus.isOnline = false;
      this.notifyListeners();
    });
  }

  // Status management
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.syncStatus);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.syncStatus));
  }

  private async updateStatus(updates: Partial<SyncStatus>): Promise<void> {
    this.syncStatus = { ...this.syncStatus, ...updates };
    this.notifyListeners();
  }

  // Periodic sync
  private startPeriodicSync(): void {
    this.syncInterval = setInterval(() => {
      if (this.syncStatus.isOnline && !this.syncStatus.isSyncing) {
        this.syncNow();
      }
    }, 30000); // Sync every 30 seconds
  }

  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Main sync operation
  async syncNow(): Promise<void> {
    if (!this.syncStatus.isOnline || this.syncStatus.isSyncing) {
      return;
    }

    await this.updateStatus({ isSyncing: true });

    try {
      const pendingOps = await indexedDBManager.getPendingSyncOperations();
      await this.updateStatus({ pendingOperations: pendingOps.length });

      if (pendingOps.length === 0) {
        await this.updateStatus({ 
          isSyncing: false, 
          lastSync: Date.now(),
          pendingOperations: 0,
          failedOperations: 0
        });
        return;
      }

      // Process operations in batches
      const batches = this.createBatches(pendingOps, BATCH_SIZE);
      let completed = 0;
      let failed = 0;

      for (const batch of batches) {
        try {
          await this.processBatch(batch);
          completed += batch.length;
        } catch (error) {
          console.error('Batch sync failed:', error);
          failed += batch.length;
        }
      }

      await this.updateStatus({
        isSyncing: false,
        lastSync: Date.now(),
        pendingOperations: pendingOps.length - completed,
        failedOperations: failed
      });

      // Clean up completed operations
      await indexedDBManager.clearCompletedSyncOperations();

    } catch (error) {
      console.error('Sync failed:', error);
      await this.updateStatus({ 
        isSyncing: false,
        failedOperations: this.syncStatus.failedOperations + 1
      });
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async processBatch(operations: SyncQueueItem[]): Promise<void> {
    const promises = operations.map(op => this.processOperation(op));
    await Promise.allSettled(promises);
  }

  private async processOperation(operation: SyncQueueItem): Promise<void> {
    try {
      await indexedDBManager.updateSyncOperationStatus(operation.id, 'processing');

      switch (operation.collection) {
        case 'restaurants':
          await this.syncRestaurantOperation(operation);
          break;
        case 'categories':
          await this.syncCategoryOperation(operation);
          break;
        case 'dishes':
          await this.syncDishOperation(operation);
          break;
        case 'orders':
          await this.syncOrderOperation(operation);
          break;
        case 'media':
          await this.syncMediaOperation(operation);
          break;
        case 'activityLogs':
          await this.syncActivityLogOperation(operation);
          break;
        default:
          throw new Error(`Unknown collection: ${operation.collection}`);
      }

      await indexedDBManager.updateSyncOperationStatus(operation.id, 'completed');

    } catch (error) {
      console.error(`Operation ${operation.id} failed:`, error);
      
      const shouldRetry = operation.retryCount < MAX_RETRY_ATTEMPTS;
      
      if (shouldRetry) {
        await indexedDBManager.incrementSyncRetryCount(operation.id);
        // Exponential backoff
        setTimeout(() => this.syncNow(), RETRY_DELAY_MS * Math.pow(2, operation.retryCount));
      } else {
        await indexedDBManager.updateSyncOperationStatus(
          operation.id, 
          'failed', 
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
  }

  // Collection-specific sync operations
  private async syncRestaurantOperation(operation: SyncQueueItem): Promise<void> {
    switch (operation.operation) {
      case 'create':
        await FirestoreService.createRestaurant(operation.data);
        break;
      case 'update':
        await FirestoreService.updateRestaurant(operation.documentId, operation.data);
        break;
      case 'delete':
        // Note: Restaurant deletion might not be supported
        throw new Error('Restaurant deletion not supported');
    }
  }

  private async syncCategoryOperation(operation: SyncQueueItem): Promise<void> {
    if (!operation.restaurantId) {
      throw new Error('Restaurant ID required for category operations');
    }

    switch (operation.operation) {
      case 'create':
        await FirestoreService.createCategory(operation.restaurantId, operation.data);
        break;
      case 'update':
        await FirestoreService.updateCategory(operation.restaurantId, operation.documentId, operation.data);
        break;
      case 'delete':
        await FirestoreService.deleteCategory(operation.restaurantId, operation.documentId);
        break;
    }
  }

  private async syncDishOperation(operation: SyncQueueItem): Promise<void> {
    if (!operation.restaurantId) {
      throw new Error('Restaurant ID required for dish operations');
    }

    switch (operation.operation) {
      case 'create':
        await FirestoreService.createDish(operation.restaurantId, operation.data);
        break;
      case 'update':
        await FirestoreService.updateDish(operation.restaurantId, operation.documentId, operation.data);
        break;
      case 'delete':
        await FirestoreService.deleteDish(operation.restaurantId, operation.documentId);
        break;
    }
  }

  private async syncOrderOperation(operation: SyncQueueItem): Promise<void> {
    if (!operation.restaurantId) {
      throw new Error('Restaurant ID required for order operations');
    }

    switch (operation.operation) {
      case 'create':
        await FirestoreService.createOrder(operation.restaurantId, operation.data);
        break;
      case 'update':
        await FirestoreService.updateOrder(operation.restaurantId, operation.documentId, operation.data);
        break;
      case 'delete':
        // Note: Order deletion might not be supported
        throw new Error('Order deletion not supported');
    }
  }

  private async syncMediaOperation(operation: SyncQueueItem): Promise<void> {
    if (!operation.restaurantId) {
      throw new Error('Restaurant ID required for media operations');
    }

    switch (operation.operation) {
      case 'create':
        await FirestoreService.createMedia(operation.restaurantId, operation.data);
        break;
      case 'update':
        await FirestoreService.updateMedia(operation.restaurantId, operation.documentId, operation.data);
        break;
      case 'delete':
        await FirestoreService.deleteMedia(operation.restaurantId, operation.documentId);
        break;
    }
  }

  private async syncActivityLogOperation(operation: SyncQueueItem): Promise<void> {
    switch (operation.operation) {
      case 'create':
        await FirestoreService.logActivity(operation.data);
        break;
      case 'update':
        // Note: Activity logs are typically immutable
        throw new Error('Activity log updates not supported');
      case 'delete':
        // Note: Activity log deletion might not be supported
        throw new Error('Activity log deletion not supported');
    }
  }

  // Offline-first operations
  async createOffline<T extends { id?: string }>(
    collection: string,
    data: Omit<T, 'id'>,
    restaurantId?: string
  ): Promise<string> {
    const id = data.id || crypto.randomUUID();
    
    // Store locally first
    const storeName = this.getStoreName(collection);
    await indexedDBManager.create(storeName, {
      ...data,
      id,
      restaurantId
    });

    // Queue for sync
    await indexedDBManager.queueSyncOperation({
      operation: 'create',
      collection,
      documentId: id,
      restaurantId,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    });

    // Try to sync immediately if online
    if (this.syncStatus.isOnline) {
      this.syncNow();
    }

    return id;
  }

  async updateOffline<T extends { id: string }>(
    collection: string,
    id: string,
    data: Partial<T>,
    restaurantId?: string
  ): Promise<void> {
    // Update locally first
    const storeName = this.getStoreName(collection);
    await indexedDBManager.update(storeName, id, data);

    // Queue for sync
    await indexedDBManager.queueSyncOperation({
      operation: 'update',
      collection,
      documentId: id,
      restaurantId,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    });

    // Try to sync immediately if online
    if (this.syncStatus.isOnline) {
      this.syncNow();
    }
  }

  async deleteOffline(
    collection: string,
    id: string,
    restaurantId?: string
  ): Promise<void> {
    // Delete locally first
    const storeName = this.getStoreName(collection);
    await indexedDBManager.delete(storeName, id);

    // Queue for sync
    await indexedDBManager.queueSyncOperation({
      operation: 'delete',
      collection,
      documentId: id,
      restaurantId,
      data: null,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    });

    // Try to sync immediately if online
    if (this.syncStatus.isOnline) {
      this.syncNow();
    }
  }

  // Data fetching with offline-first approach
  async getOfflineData<T>(
    collection: string,
    restaurantId?: string
  ): Promise<T[]> {
    const storeName = this.getStoreName(collection);
    
    if (restaurantId) {
      return indexedDBManager.getByRestaurant<T>(storeName, restaurantId);
    } else {
      return indexedDBManager.getAll<T>(storeName);
    }
  }

  async getOfflineDataById<T>(
    collection: string,
    id: string
  ): Promise<T | null> {
    const storeName = this.getStoreName(collection);
    return indexedDBManager.getById<T>(storeName, id);
  }

  // Conflict resolution
  async resolveConflict<T>(
    localData: T,
    serverData: T,
    strategy: ConflictResolution = ConflictResolution.SERVER_WINS
  ): Promise<T> {
    switch (strategy) {
      case ConflictResolution.SERVER_WINS:
        return serverData;
      case ConflictResolution.CLIENT_WINS:
        return localData;
      case ConflictResolution.MERGE:
        return this.mergeData(localData, serverData);
      case ConflictResolution.MANUAL:
        // This would typically trigger a UI for manual resolution
        throw new Error('Manual conflict resolution not implemented');
      default:
        return serverData;
    }
  }

  private mergeData<T>(local: T, server: T): T {
    // Simple merge strategy - server data takes precedence for conflicts
    // In a real implementation, this would be more sophisticated
    return { ...local, ...server };
  }

  // Utility methods
  private getStoreName(collection: string): string {
    const mapping: Record<string, string> = {
      'restaurants': STORES.RESTAURANTS,
      'categories': STORES.CATEGORIES,
      'dishes': STORES.DISHES,
      'orders': STORES.ORDERS,
      'media': STORES.MEDIA,
      'activityLogs': STORES.ACTIVITY_LOGS
    };
    
    return mapping[collection] || collection;
  }

  // Cleanup
  async clearAllData(): Promise<void> {
    await indexedDBManager.clearAllData();
    await this.updateStatus({
      pendingOperations: 0,
      failedOperations: 0,
      lastSync: null
    });
  }

  // Getters
  getStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  isOnline(): boolean {
    return this.syncStatus.isOnline;
  }

  isSyncing(): boolean {
    return this.syncStatus.isSyncing;
  }
}

// Export singleton instance
export const offlineSyncManager = new OfflineSyncManager();

