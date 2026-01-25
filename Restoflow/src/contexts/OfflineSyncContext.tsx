import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useOfflineDB } from '../hooks/useOfflineDB';
import { fetchAndCacheAll, replayQueuedActions, loadCollectionWithPagination, getCachedData } from '../services/offlineSync';

interface OfflineSyncContextType {
  isOnline: boolean;
  syncing: boolean;
  syncNow: () => Promise<void>;
  lastSync: number | null;
  loadCollection: (collectionName: string, pageSize?: number) => Promise<any>;
  getCachedCollection: (collectionKey: string, pageSize?: number, page?: number) => any;
}

const OfflineSyncContext = createContext<OfflineSyncContextType | undefined>(undefined);

export const OfflineSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  useOfflineDB();
  const syncingRef = useRef(false);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // On startup, only load essential data
  useEffect(() => {
    if (isOnline) {
      // Only load categories and tables initially as they're needed for navigation
      fetchAndCacheAll(undefined, ['offline_menuCategories', 'offline_tables']);
    }
  }, [isOnline]);

  // On reconnect, replay queued actions
  useEffect(() => {
    if (isOnline && !syncingRef.current) {
      syncNow();
    }
  }, [isOnline]);

  const restaurantId = localStorage.getItem('restaurantId') || '';

  const syncNow = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      await replayQueuedActions(restaurantId);
      setLastSync(Date.now());
    } finally {
      setSyncing(false);
      syncingRef.current = false;
    }
  }, [restaurantId]);

  const loadCollection = useCallback(async (collectionName: string, pageSize: number = 20) => {
    if (!isOnline) {
      return getCachedData(collectionName, pageSize);
    }
    return loadCollectionWithPagination(collectionName, pageSize);
  }, [isOnline]);

  const getCachedCollection = useCallback((collectionKey: string, pageSize: number = 20, page: number = 1) => {
    return getCachedData(collectionKey, pageSize, page);
  }, []);

  return (
    <OfflineSyncContext.Provider value={{ 
      isOnline, 
      syncing, 
      syncNow, 
      lastSync,
      loadCollection,
      getCachedCollection
    }}>
      {children}
    </OfflineSyncContext.Provider>
  );
};

export function useOfflineSync() {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) throw new Error('useOfflineSync must be used within OfflineSyncProvider');
  return ctx;
}
