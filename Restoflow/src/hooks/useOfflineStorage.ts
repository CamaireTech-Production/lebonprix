import { useCallback } from 'react';

export function useOfflineStorage() {
  // Get parsed array from localStorage
  const getData = useCallback((key: string): any[] => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }, []);

  // Set array to localStorage
  const setData = useCallback((key: string, data: any[]): void => {
    localStorage.setItem(key, JSON.stringify(data));
  }, []);

  // Queue an action
  const queueAction = useCallback((action: { type: string; payload: any; timestamp: number }): void => {
    const actions = getData('queuedActions');
    actions.push(action);
    setData('queuedActions', actions);
  }, [getData, setData]);

  // Get all queued actions
  const getQueuedActions = useCallback((): { type: string; payload: any; timestamp: number }[] => {
    return getData('queuedActions');
  }, [getData]);

  // Clear all queued actions
  const clearQueuedActions = useCallback((): void => {
    setData('queuedActions', []);
  }, [setData]);

  return { getData, setData, queueAction, getQueuedActions, clearQueuedActions };
}
