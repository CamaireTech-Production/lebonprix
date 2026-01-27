// Real-time Stock Monitoring Hook
// Monitors stock changes and triggers alerts when stock falls below threshold
import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@services/core/firebase';
import { logError } from '@utils/core/logger';
import { checkAndAlertProductStock, checkAndAlertMatiereStock } from '@services/notifications/stockAlertService';
import type { StockBatch } from '../../types/models';

interface StockMonitoringOptions {
  enabled?: boolean; // Enable/disable monitoring
  debounceMs?: number; // Debounce time in milliseconds (default: 3000)
}

/**
 * Hook to monitor stock changes in real-time and trigger alerts
 * 
 * This hook:
 * 1. Subscribes to stock batch changes for the company
 * 2. Debounces rapid changes (waits 3 seconds after last change)
 * 3. Checks stock levels against company threshold
 * 4. Triggers alerts when stock is low or out
 */
export const useStockMonitoring = (options: StockMonitoringOptions = {}) => {
  const { company } = useAuth();
  const { enabled = true, debounceMs = 3000 } = options;
  
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckedRef = useRef<Set<string>>(new Set()); // Track items checked in current batch
  const companyThresholdRef = useRef<number>(10);

  // Update company threshold when company changes
  useEffect(() => {
    if (company?.lowStockThreshold !== undefined) {
      companyThresholdRef.current = company.lowStockThreshold;
    } else {
      companyThresholdRef.current = 10; // Default
    }
  }, [company?.lowStockThreshold]);

  // Function to check stock for a specific item
  const checkStockForItem = useCallback(async (
    itemId: string,
    itemType: 'product' | 'matiere',
    companyId: string,
    threshold: number
  ) => {
    try {
      // Prevent checking the same item multiple times in quick succession
      const checkKey = `${itemType}_${itemId}`;
      if (lastCheckedRef.current.has(checkKey)) {
        return;
      }
      lastCheckedRef.current.add(checkKey);

      if (itemType === 'product') {
        await checkAndAlertProductStock(itemId, companyId, threshold);
      } else {
        await checkAndAlertMatiereStock(itemId, companyId, threshold);
      }

      // Remove from checked set after a delay to allow re-checking if stock changes again
      setTimeout(() => {
        lastCheckedRef.current.delete(checkKey);
      }, 5000);
    } catch (error) {
      logError('Error checking stock for item', error);
      lastCheckedRef.current.delete(`${itemType}_${itemId}`);
    }
  }, []);

  // Function to process stock changes (debounced) - use ref to avoid recreation
  const processStockChangesRef = useRef<((batches: StockBatch[]) => void) | null>(null);
  
  useEffect(() => {
    processStockChangesRef.current = (batches: StockBatch[]) => {
      if (!company?.id || !enabled) return;

      const threshold = companyThresholdRef.current;

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new debounce timer
      debounceTimerRef.current = setTimeout(() => {
        // Group batches by item (product or matiere)
        const itemsToCheck = new Map<string, { type: 'product' | 'matiere'; id: string }>();

        batches.forEach(batch => {
          if (batch.status !== 'active' || batch.isDeleted) return;

          if (batch.type === 'product' && batch.productId) {
            itemsToCheck.set(`product_${batch.productId}`, {
              type: 'product',
              id: batch.productId
            });
          } else if (batch.type === 'matiere' && batch.matiereId) {
            itemsToCheck.set(`matiere_${batch.matiereId}`, {
              type: 'matiere',
              id: batch.matiereId
            });
          }
        });

        // Check stock for each unique item
        itemsToCheck.forEach(({ type, id }) => {
          checkStockForItem(id, type, company.id, threshold).catch(error => {
            logError(`Error checking stock for ${type} ${id}`, error);
          });
        });
      }, debounceMs);
    };
  }, [company?.id, enabled, debounceMs, checkStockForItem]);

  // Subscribe to stock batch changes
  useEffect(() => {
    if (!company?.id || !enabled) {
      return;
    }

    let isMounted = true;
    let unsubscribeFn: (() => void) | null = null;
    let isUnsubscribing = false;

    const setupListener = () => {
      try {
        const q = query(
          collection(db, 'stockBatches'),
          where('companyId', '==', company.id),
          where('status', '==', 'active')
        );

        unsubscribeFn = onSnapshot(
          q,
          (snapshot) => {
            // Double-check mounted state and unsubscribe flag
            if (!isMounted || isUnsubscribing || !processStockChangesRef.current) {
              return;
            }

            try {
              const batches = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as StockBatch[];

              // Process changes (will be debounced)
              if (processStockChangesRef.current) {
                processStockChangesRef.current(batches);
              }
            } catch (error) {
              // Silently handle errors in callback to prevent breaking the listener
              if (isMounted && !isUnsubscribing) {
                logError('Error processing stock changes', error);
              }
            }
          },
          (error) => {
            // Only log if still mounted and not unsubscribing
            if (isMounted && !isUnsubscribing) {
              logError('Error in stock monitoring subscription', error);
            }
          }
        );
      } catch (error) {
        if (isMounted) {
          logError('Error setting up stock monitoring subscription', error);
        }
      }
    };

    // Small delay to ensure previous listener is fully cleaned up
    const setupTimer = setTimeout(setupListener, 100);

    return () => {
      isMounted = false;
      isUnsubscribing = true;
      
      // Clear setup timer if still pending
      clearTimeout(setupTimer);
      
      // Clean up listener
      if (unsubscribeFn) {
        try {
          unsubscribeFn();
        } catch (error) {
          // Ignore errors during cleanup - listener might already be closed
        }
        unsubscribeFn = null;
      }
      
      // Clean up debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [company?.id, enabled]); // Removed processStockChanges from deps to prevent recreation

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      lastCheckedRef.current.clear();
    };
  }, []);
};

