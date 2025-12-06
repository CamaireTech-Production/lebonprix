import { useState, useEffect, useCallback } from 'react';

interface PWAState {
  isInstalled: boolean;
  isOnline: boolean;
  isInstallable: boolean;
  hasUpdate: boolean;
  isCheckingUpdate: boolean;
}

const LAST_NOTIFIED_VERSION_KEY = 'pwa_last_notified_version';
const UPDATE_CHECK_INTERVAL = 60000; // 60 seconds

export const usePWA = () => {
  const [pwaState, setPwaState] = useState<PWAState>({
    isInstalled: false,
    isOnline: true,
    isInstallable: false,
    hasUpdate: false,
    isCheckingUpdate: false,
  });

  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Function to check for updates with safeguards
  const checkForUpdate = useCallback(async () => {
    if (!navigator.onLine || !('serviceWorker' in navigator)) {
      return;
    }

    try {
      const reg = await navigator.serviceWorker.getRegistration();
      
      if (!reg) {
        return;
      }

      setRegistration(reg);

      // Check if there's a waiting service worker AND an active controller
      const hasRealUpdate = 
        reg.waiting !== null &&
        navigator.serviceWorker.controller !== null;

      if (hasRealUpdate && reg.waiting) {
        // Verify it's actually a different version by comparing script URLs
        const currentVersion = navigator.serviceWorker.controller?.scriptURL || '';
        const waitingVersion = reg.waiting.scriptURL || '';

        if (currentVersion !== waitingVersion) {
          // Check if we already notified about this version
          const lastNotified = localStorage.getItem(LAST_NOTIFIED_VERSION_KEY);
          
          if (lastNotified !== waitingVersion) {
            // Real update detected, show notification
            setPwaState(prev => ({
              ...prev,
              hasUpdate: true,
            }));
            
            // Store the version we're notifying about
            localStorage.setItem(LAST_NOTIFIED_VERSION_KEY, waitingVersion);
          }
        }
      } else if (!hasRealUpdate) {
        // No update available, clear state
        setPwaState(prev => ({
          ...prev,
          hasUpdate: false,
        }));
        // Clear old version tracking if no update
        localStorage.removeItem(LAST_NOTIFIED_VERSION_KEY);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  }, []);

  // Function to trigger update
  const updateApp = useCallback(() => {
    if (!registration || !registration.waiting) {
      console.error('No service worker waiting to update');
      return;
    }

    // Send skipWaiting message to the waiting service worker
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Clear update state
    setPwaState(prev => ({
      ...prev,
      hasUpdate: false,
    }));

    // Clear version tracking
    localStorage.removeItem(LAST_NOTIFIED_VERSION_KEY);

    // Listen for controller change and reload
    const handleControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange, { once: true });
  }, [registration]);

  useEffect(() => {
    // Check if app is installed
    const checkInstallStatus = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      
      setPwaState(prev => ({
        ...prev,
        isInstalled: isStandalone || isIOSStandalone,
      }));
    };

    // Check online status
    const updateOnlineStatus = () => {
      setPwaState(prev => ({
        ...prev,
        isOnline: navigator.onLine,
      }));
    };

    // Check if installable
    const checkInstallability = () => {
      const isInstallable = 'serviceWorker' in navigator && 'PushManager' in window;
      setPwaState(prev => ({
        ...prev,
        isInstallable,
      }));
    };

    // Initial checks
    checkInstallStatus();
    updateOnlineStatus();
    checkInstallability();

    // Listen for online/offline events
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setPwaState(prev => ({
        ...prev,
        isInstallable: true,
      }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed
    const handleAppInstalled = () => {
      setPwaState(prev => ({
        ...prev,
        isInstalled: true,
        isInstallable: false,
      }));
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Effect for update detection
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    // Initial check for updates
    checkForUpdate();

    // Set up periodic checks (every 60 seconds)
    const intervalId = setInterval(() => {
      if (navigator.onLine) {
        checkForUpdate();
      }
    }, UPDATE_CHECK_INTERVAL);

    // Listen for service worker registration and updates
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) {
        setRegistration(reg);

        // Listen for updatefound event
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              // When new service worker is installed and there's an active controller
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Verify it's a different version
                const currentVersion = navigator.serviceWorker.controller.scriptURL;
                const waitingVersion = newWorker.scriptURL;

                if (currentVersion !== waitingVersion) {
                  const lastNotified = localStorage.getItem(LAST_NOTIFIED_VERSION_KEY);
                  
                  if (lastNotified !== waitingVersion) {
                    setPwaState(prev => ({
                      ...prev,
                      hasUpdate: true,
                    }));
                    localStorage.setItem(LAST_NOTIFIED_VERSION_KEY, waitingVersion);
                  }
                }
              }
            });
          }
        });

        // Manually trigger update check
        reg.update().catch(err => {
          console.error('Error updating service worker:', err);
        });
      }
    });

    return () => {
      clearInterval(intervalId);
    };
  }, [checkForUpdate]);

  return {
    ...pwaState,
    updateApp,
  };
};
