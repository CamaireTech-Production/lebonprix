import { useState, useEffect } from 'react';
import { PWAUpdateStorage } from '../utils/pwaUpdateStorage';

interface PWAUpdateState {
  isUpdateAvailable: boolean;
  isUpdating: boolean;
  registration: ServiceWorkerRegistration | null;
}

export const usePWAUpdate = () => {
  const [updateState, setUpdateState] = useState<PWAUpdateState>({
    isUpdateAvailable: false,
    isUpdating: false,
    registration: null,
  });

  useEffect(() => {
    // Initialize debug tools in development
    if (import.meta.env.DEV) {
      PWAUpdateStorage.debug();
    }

    if ('serviceWorker' in navigator) {
      // Check if user has already handled the current update
      if (PWAUpdateStorage.hasUserHandledUpdate()) {
        console.log('User has already handled the current update, skipping notification');
        return;
      }

      // Get existing service worker registration (registered by Vite PWA)
      navigator.serviceWorker.getRegistration()
        .then((registration) => {
          if (registration) {
            console.log('PWA Service Worker found:', registration);
            
            // Check for updates immediately
            registration.update();
            
            // Listen for updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New content is available - check if user hasn't handled it
                    if (!PWAUpdateStorage.hasUserHandledUpdate()) {
                      PWAUpdateStorage.markUpdateAsAvailable(registration);
                      setUpdateState(prev => ({
                        ...prev,
                        isUpdateAvailable: true,
                        registration,
                      }));
                    }
                  }
                });
              }
            });

            // Check if there's already an update waiting and not handled
            if (registration.waiting && !PWAUpdateStorage.hasUserHandledUpdate()) {
              PWAUpdateStorage.markUpdateAsAvailable(registration);
              setUpdateState(prev => ({
                ...prev,
                isUpdateAvailable: true,
                registration,
              }));
            }
          } else {
            console.log('No service worker registration found');
          }
        })
        .catch((error) => {
          console.error('PWA Service Worker error:', error);
        });
    }
  }, []);

  const applyUpdate = () => {
    if (updateState.registration?.waiting) {
      setUpdateState(prev => ({ ...prev, isUpdating: true }));
      
      // Mark update as confirmed in localStorage
      PWAUpdateStorage.markUpdateAsConfirmed(updateState.registration);
      
      // Tell the waiting service worker to skip waiting and become active
      updateState.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Listen for the controlling service worker to change
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Service worker controller changed, reloading...');
        // The hard reload is now handled in the component
        // This ensures the service worker update is processed
      });
    }
  };

  const dismissUpdate = () => {
    // Mark update as dismissed in localStorage
    PWAUpdateStorage.markUpdateAsDismissed();
    
    setUpdateState(prev => ({
      ...prev,
      isUpdateAvailable: false,
    }));
  };

  return {
    isUpdateAvailable: updateState.isUpdateAvailable,
    isUpdating: updateState.isUpdating,
    applyUpdate,
    dismissUpdate,
  };
};
