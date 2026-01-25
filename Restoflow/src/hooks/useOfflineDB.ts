import { useCallback } from 'react';

// LocalStorage keys for each collection
const STORE_KEYS = {
  menuCategories: 'offline_menuCategories',
  menuItems: 'offline_menuItems', // Dishes
  tables: 'offline_tables',
  orders: 'offline_orders',
  actions: 'offline_actions',
};

function getLocal(key: string): any[] {
  const data = localStorage.getItem(key);
  try {
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function setLocal(key: string, value: any[]): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function useOfflineDB() {
  // Read all records from a store
  const readAll = useCallback(async (storeName: keyof typeof STORE_KEYS) => {
    return getLocal(STORE_KEYS[storeName]);
  }, []);

  // Add an action to the queue
  const addAction = useCallback(async (action: { type: string; payload: any; timestamp: number }) => {
    const actions: any[] = getLocal(STORE_KEYS.actions);
    // Prevent duplicate actions with the same timestamp/id
    if (!actions.some((a: any) => a.id === action.timestamp)) {
      actions.push({ ...action, id: action.timestamp });
      setLocal(STORE_KEYS.actions, actions);
    }
  }, []);

  // Get all queued actions
  const getQueuedActions = useCallback(async () => {
    return getLocal(STORE_KEYS.actions);
  }, []);

  // Clear an action by timestamp
  const clearAction = useCallback(async (timestamp: number) => {
    const actions: any[] = getLocal(STORE_KEYS.actions).filter((a: any) => a.id !== timestamp);
    setLocal(STORE_KEYS.actions, actions);
  }, []);

  // Write all items to a store (overwrite)
  const writeAll = useCallback(async (storeName: keyof typeof STORE_KEYS, items: any[]) => {
    setLocal(STORE_KEYS[storeName], items);
  }, []);

  return { readAll, addAction, getQueuedActions, clearAction, writeAll };
}
