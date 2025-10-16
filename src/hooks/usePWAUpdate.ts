import { useState, useEffect } from 'react';

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
    if ('serviceWorker' in navigator) {
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
                    // New content is available
                    setUpdateState(prev => ({
                      ...prev,
                      isUpdateAvailable: true,
                      registration,
                    }));
                  }
                });
              }
            });

            // Check if there's already an update waiting
            if (registration.waiting) {
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
