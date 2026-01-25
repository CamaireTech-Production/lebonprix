import { useState, useEffect, useCallback } from 'react';
import { offlineSyncManager, SyncStatus, ConflictResolution } from '../storage/offlineSync';
import { indexedDBManager } from '../storage/indexedDB';
import { Restaurant, Category, Dish, Order, MediaItem, ActivityLog } from '../types';

// Hook for offline sync management
export function useOfflineSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(offlineSyncManager.getStatus());

  useEffect(() => {
    const unsubscribe = offlineSyncManager.subscribe(setSyncStatus);
    return unsubscribe;
  }, []);

  const syncNow = useCallback(async () => {
    await offlineSyncManager.syncNow();
  }, []);

  const isOnline = useCallback(() => {
    return offlineSyncManager.isOnline();
  }, []);

  const isSyncing = useCallback(() => {
    return offlineSyncManager.isSyncing();
  }, []);

  return {
    syncStatus,
    syncNow,
    isOnline,
    isSyncing
  };
}

// Hook for offline-first data operations
export function useOfflineData<T>(
  collection: string,
  restaurantId?: string
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await offlineSyncManager.getOfflineData<T>(collection, restaurantId);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load data'));
    } finally {
      setLoading(false);
    }
  }, [collection, restaurantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const create = useCallback(async (item: Omit<T, 'id'>): Promise<string> => {
    try {
      return await offlineSyncManager.createOffline(collection, item, restaurantId);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create item'));
      throw err;
    }
  }, [collection, restaurantId]);

  const update = useCallback(async (id: string, updates: Partial<T>): Promise<void> => {
    try {
      await offlineSyncManager.updateOffline(collection, id, updates, restaurantId);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update item'));
      throw err;
    }
  }, [collection, restaurantId]);

  const remove = useCallback(async (id: string): Promise<void> => {
    try {
      await offlineSyncManager.deleteOffline(collection, id, restaurantId);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete item'));
      throw err;
    }
  }, [collection, restaurantId]);

  const refresh = useCallback(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    error,
    create,
    update,
    remove,
    refresh
  };
}

// Specialized hooks for each data type
export function useOfflineRestaurants() {
  return useOfflineData<Restaurant>('restaurants');
}

export function useOfflineCategories(restaurantId: string) {
  return useOfflineData<Category>('categories', restaurantId);
}

export function useOfflineDishes(restaurantId: string) {
  return useOfflineData<Dish>('dishes', restaurantId);
}

export function useOfflineOrders(restaurantId: string) {
  return useOfflineData<Order>('orders', restaurantId);
}

export function useOfflineMedia(restaurantId: string) {
  return useOfflineData<MediaItem>('media', restaurantId);
}

export function useOfflineActivityLogs() {
  return useOfflineData<ActivityLog>('activityLogs');
}

// Hook for conflict resolution
export function useConflictResolution() {
  const [conflicts, setConflicts] = useState<Array<{
    id: string;
    localData: any;
    serverData: any;
    collection: string;
    restaurantId?: string;
  }>>([]);

  const resolveConflict = useCallback(async (
    conflictId: string,
    strategy: ConflictResolution
  ) => {
    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    try {
      const resolvedData = await offlineSyncManager.resolveConflict(
        conflict.localData,
        conflict.serverData,
        strategy
      );

      // Update the local data with resolved version
      await offlineSyncManager.updateOffline(
        conflict.collection,
        conflictId,
        resolvedData,
        conflict.restaurantId
      );

      // Remove from conflicts list
      setConflicts(prev => prev.filter(c => c.id !== conflictId));
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      throw error;
    }
  }, [conflicts]);

  const addConflict = useCallback((conflict: {
    id: string;
    localData: any;
    serverData: any;
    collection: string;
    restaurantId?: string;
  }) => {
    setConflicts(prev => [...prev, conflict]);
  }, []);

  const clearConflicts = useCallback(() => {
    setConflicts([]);
  }, []);

  return {
    conflicts,
    resolveConflict,
    addConflict,
    clearConflicts
  };
}

// Hook for offline status display
export function useOfflineStatus() {
  const { syncStatus } = useOfflineSync();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!syncStatus.isOnline) {
      setShowBanner(true);
    } else if (syncStatus.isOnline && syncStatus.pendingOperations === 0) {
      setShowBanner(false);
    }
  }, [syncStatus.isOnline, syncStatus.pendingOperations]);

  const dismissBanner = useCallback(() => {
    setShowBanner(false);
  }, []);

  return {
    isOnline: syncStatus.isOnline,
    isSyncing: syncStatus.isSyncing,
    pendingOperations: syncStatus.pendingOperations,
    failedOperations: syncStatus.failedOperations,
    lastSync: syncStatus.lastSync,
    showBanner,
    dismissBanner
  };
}

// Hook for data migration from localStorage
export function useDataMigration() {
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const migrateFromLocalStorage = useCallback(async () => {
    try {
      setMigrating(true);
      setError(null);
      setProgress(0);

      // Check if migration is needed
      const hasIndexedDBData = await indexedDBManager.getMetadata('migration_completed');
      if (hasIndexedDBData) {
        setProgress(100);
        return;
      }

      // Migrate restaurants
      setProgress(10);
      const restaurants = JSON.parse(localStorage.getItem('offline_restaurants') || '[]');
      for (const restaurant of restaurants) {
        await indexedDBManager.create('restaurants', {
          data: restaurant,
          restaurantId: restaurant.id
        });
      }

      // Migrate categories
      setProgress(20);
      const categories = JSON.parse(localStorage.getItem('offline_menuCategories') || '[]');
      for (const category of categories) {
        await indexedDBManager.create('categories', {
          data: category,
          restaurantId: category.restaurantId || 'default'
        });
      }

      // Migrate dishes
      setProgress(40);
      const dishes = JSON.parse(localStorage.getItem('offline_menuItems') || '[]');
      for (const dish of dishes) {
        await indexedDBManager.create('dishes', {
          data: dish,
          restaurantId: dish.restaurantId || 'default'
        });
      }

      // Migrate orders
      setProgress(60);
      const orders = JSON.parse(localStorage.getItem('offline_orders') || '[]');
      for (const order of orders) {
        await indexedDBManager.create('orders', {
          data: order,
          restaurantId: order.restaurantId || 'default'
        });
      }

      // Migrate tables
      setProgress(80);
      const tables = JSON.parse(localStorage.getItem('offline_tables') || '[]');
      for (const table of tables) {
        await indexedDBManager.create('tables', {
          data: table,
          restaurantId: table.restaurantId || 'default'
        });
      }

      // Mark migration as completed
      setProgress(90);
      await indexedDBManager.setMetadata('migration_completed', true);

      // Clear localStorage data
      setProgress(95);
      const keysToRemove = [
        'offline_restaurants',
        'offline_menuCategories',
        'offline_menuItems',
        'offline_orders',
        'offline_tables',
        'offline_actions',
        'queuedActions'
      ];
      
      keysToRemove.forEach(key => localStorage.removeItem(key));

      setProgress(100);

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Migration failed'));
    } finally {
      setMigrating(false);
    }
  }, []);

  return {
    migrating,
    progress,
    error,
    migrateFromLocalStorage
  };
}

// Hook for storage management
export function useStorageManagement() {
  const [storageInfo, setStorageInfo] = useState<{
    totalSize: number;
    storeSizes: Record<string, number>;
  } | null>(null);

  const loadStorageInfo = useCallback(async () => {
    try {
      const info = await indexedDBManager.getStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      console.error('Failed to load storage info:', error);
    }
  }, []);

  const clearAllData = useCallback(async () => {
    try {
      await offlineSyncManager.clearAllData();
      await loadStorageInfo();
    } catch (error) {
      console.error('Failed to clear data:', error);
      throw error;
    }
  }, [loadStorageInfo]);

  useEffect(() => {
    loadStorageInfo();
  }, [loadStorageInfo]);

  return {
    storageInfo,
    loadStorageInfo,
    clearAllData
  };
}

