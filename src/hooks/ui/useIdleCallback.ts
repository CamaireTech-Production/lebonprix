import { useEffect, useRef } from 'react';

/**
 * Hook to execute a callback when the browser is idle
 * Useful for deferring heavy calculations
 */
export const useIdleCallback = (
  callback: () => void,
  deps: React.DependencyList
) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const executeCallback = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          callbackRef.current();
        });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          callbackRef.current();
        }, 100);
      }
    };

    // Execute immediately on mount, then defer subsequent calls
    const timeoutId = setTimeout(executeCallback, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, deps);
};

