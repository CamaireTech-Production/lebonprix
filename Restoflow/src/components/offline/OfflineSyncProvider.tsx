import React, { createContext, useContext, useEffect, useState } from 'react';
import { offlineSyncManager, SyncStatus } from '../../storage/offlineSync';
import { useDataMigration } from '../../hooks/useOfflineSync';

interface OfflineSyncContextType {
  syncStatus: SyncStatus;
  syncNow: () => Promise<void>;
  isOnline: () => boolean;
  isSyncing: () => boolean;
  migrating: boolean;
  migrationProgress: number;
  migrationError: Error | null;
  startMigration: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextType | undefined>(undefined);

export const useOfflineSyncContext = () => {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error('useOfflineSyncContext must be used within an OfflineSyncProvider');
  }
  return context;
};

interface OfflineSyncProviderProps {
  children: React.ReactNode;
}

export const OfflineSyncProvider: React.FC<OfflineSyncProviderProps> = ({ children }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(offlineSyncManager.getStatus());
  const { migrating, progress, error, migrateFromLocalStorage } = useDataMigration();

  // Subscribe to sync status changes
  useEffect(() => {
    const unsubscribe = offlineSyncManager.subscribe(setSyncStatus);
    return unsubscribe;
  }, []);

  // Auto-migrate on first load
  useEffect(() => {
    const checkAndMigrate = async () => {
      try {
        // Check if we need to migrate from localStorage
        const hasLocalStorageData = localStorage.getItem('offline_menuCategories') !== null;
        const hasIndexedDBData = await indexedDBManager.getMetadata('migration_completed');
        
        if (hasLocalStorageData && !hasIndexedDBData) {
          await migrateFromLocalStorage();
        }
      } catch (error) {
        console.error('Migration check failed:', error);
      }
    };

    checkAndMigrate();
  }, [migrateFromLocalStorage]);

  const syncNow = async () => {
    await offlineSyncManager.syncNow();
  };

  const isOnline = () => {
    return offlineSyncManager.isOnline();
  };

  const isSyncing = () => {
    return offlineSyncManager.isSyncing();
  };

  const startMigration = async () => {
    await migrateFromLocalStorage();
  };

  const contextValue: OfflineSyncContextType = {
    syncStatus,
    syncNow,
    isOnline,
    isSyncing,
    migrating,
    migrationProgress: progress,
    migrationError: error,
    startMigration
  };

  return (
    <OfflineSyncContext.Provider value={contextValue}>
      {children}
    </OfflineSyncContext.Provider>
  );
};

