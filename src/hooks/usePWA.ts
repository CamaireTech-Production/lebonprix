import { useState, useEffect, useCallback, useRef } from 'react';

interface PWAState {
  isInstalled: boolean;
  isOnline: boolean;
  isInstallable: boolean;
  hasUpdate: boolean;
  isCheckingUpdate: boolean;
}

const LAST_NOTIFIED_VERSION_KEY = 'pwa_last_notified_version';
const UPDATE_CHECK_INTERVAL = 10000; // 10 seconds - faster update detection

export const usePWA = () => {
  const [pwaState, setPwaState] = useState<PWAState>({
    isInstalled: false,
    isOnline: true,
    isInstallable: false,
    hasUpdate: false,
    isCheckingUpdate: false,
  });

  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const isMountedRef = useRef(true);

  // Function to detect and notify about updates
  const detectUpdate = useCallback((newWorker: ServiceWorker, currentController: ServiceWorker | null) => {
    if (!isMountedRef.current) return;

    // Get version URLs for comparison
    const currentVersion = currentController?.scriptURL || '';
    const newVersion = newWorker.scriptURL || '';

    // Only notify if it's actually a different version
    if (currentVersion && newVersion && currentVersion !== newVersion) {
      // Check if we already notified about this version
      const lastNotified = localStorage.getItem(LAST_NOTIFIED_VERSION_KEY);
      
      if (lastNotified !== newVersion) {
        console.log('[PWA] Update detected - New version:', newVersion);
        console.log('[PWA] Current version:', currentVersion);
        
        // Real update detected, show notification
        setPwaState(prev => ({
          ...prev,
          hasUpdate: true,
          isCheckingUpdate: false,
        }));
        
        // Store the version we're notifying about
        localStorage.setItem(LAST_NOTIFIED_VERSION_KEY, newVersion);
      }
    }
  }, []);

  // Function to check for updates with safeguards
  const checkForUpdate = useCallback(async () => {
    if (!navigator.onLine || !('serviceWorker' in navigator)) {
      return;
    }

    try {
      setPwaState(prev => ({ ...prev, isCheckingUpdate: true }));
      
      const reg = await navigator.serviceWorker.getRegistration();
      
      if (!reg) {
        setPwaState(prev => ({ ...prev, isCheckingUpdate: false }));
        return;
      }

      setRegistration(reg);

      // Force update check by calling registration.update()
      // This ensures we check for new service worker versions
      await reg.update().catch(err => {
        console.warn('[PWA] Update check warning:', err);
      });

      // Check for updates in multiple states (installing, waiting, or already activated)
      const currentController = navigator.serviceWorker.controller;
      
      // Check if there's an installing service worker (new update being installed)
      if (reg.installing) {
        console.log('[PWA] Service worker installing detected');
        detectUpdate(reg.installing, currentController);
        return;
      }

      // Check if there's a waiting service worker (update installed but waiting)
      if (reg.waiting && currentController) {
        console.log('[PWA] Service worker waiting detected');
        detectUpdate(reg.waiting, currentController);
        return;
      }

      // If no installing or waiting worker, clear update state
      setPwaState(prev => ({
        ...prev,
        hasUpdate: false,
        isCheckingUpdate: false,
      }));
    } catch (error) {
      console.error('[PWA] Error checking for updates:', error);
      setPwaState(prev => ({ ...prev, isCheckingUpdate: false }));
    }
  }, [detectUpdate]);

  // Function to trigger update
  const updateApp = useCallback(() => {
    if (!registration) {
      console.error('[PWA] No service worker registration found');
      return;
    }

    // With skipWaiting: true, the service worker might be in installing or already activated
    // Try to send SKIP_WAITING message if there's a waiting worker
    if (registration.waiting) {
      console.log('[PWA] Triggering update - sending SKIP_WAITING message to waiting worker');
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else if (registration.installing) {
      console.log('[PWA] Service worker is installing - will activate automatically with skipWaiting');
      // With skipWaiting: true, it will activate automatically
    } else {
      console.log('[PWA] No waiting or installing service worker - update may have already activated');
      // Update might have already activated, just reload to get new content
      window.location.reload();
      return;
    }

    // Clear update state
    setPwaState(prev => ({
      ...prev,
      hasUpdate: false,
    }));

    // Clear version tracking
    localStorage.removeItem(LAST_NOTIFIED_VERSION_KEY);

    // Listen for controller change and reload immediately
    // With skipWaiting: true, the new service worker should activate immediately
    const handleControllerChange = () => {
      console.log('[PWA] Controller changed - reloading page to apply update');
      window.location.reload();
    };

    // Listen for controllerchange - this fires when new SW takes control
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange, { once: true });
    
    // Also set a timeout as fallback (in case controllerchange doesn't fire)
    // This should rarely be needed with skipWaiting: true, but it's a safety net
    setTimeout(() => {
      if (navigator.serviceWorker.controller) {
        console.log('[PWA] Fallback reload after update');
        window.location.reload();
      }
    }, 1000);
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
    isMountedRef.current = true;
    
    if (!('serviceWorker' in navigator)) {
      return;
    }

    // Track registration and handlers for cleanup
    let currentRegistration: ServiceWorkerRegistration | null = null;
    let updateFoundHandler: (() => void) | null = null;
    let stateChangeHandler: (() => void) | null = null;
    let controllerChangeHandler: (() => void) | null = null;
    let currentWorker: ServiceWorker | null = null;

    // Immediate check for updates on app load (critical for detecting updates)
    // Use a small delay to ensure service worker is registered
    const immediateCheck = setTimeout(() => {
      if (isMountedRef.current && navigator.onLine) {
        console.log('[PWA] Initial update check on app load');
        checkForUpdate();
      }
    }, 1000);

    // Set up periodic checks (every 10 seconds for faster detection)
    const intervalId = setInterval(() => {
      if (navigator.onLine && isMountedRef.current) {
        checkForUpdate();
      }
    }, UPDATE_CHECK_INTERVAL);

    // Check for updates when tab becomes visible (user returns to app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && isMountedRef.current) {
        console.log('[PWA] Tab became visible - checking for updates');
        checkForUpdate();
      }
    };

    // Check for updates when window regains focus
    const handleFocus = () => {
      if (navigator.onLine && isMountedRef.current) {
        checkForUpdate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Listen for controllerchange event - fires when a new service worker takes control
    // This is important with skipWaiting: true since updates activate immediately
    controllerChangeHandler = () => {
      if (!isMountedRef.current) {
        return;
      }
      
      console.log('[PWA] controllerchange event - new service worker took control');
      
      // Check if there's a new service worker that just activated
      navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg || !isMountedRef.current) return;
        
        const newController = navigator.serviceWorker.controller;
        if (newController) {
          // Get the previous version from localStorage to compare
          const lastNotified = localStorage.getItem(LAST_NOTIFIED_VERSION_KEY);
          const currentVersion = newController.scriptURL;
          
          // If we have a stored version and it's different, this is a new update
          if (lastNotified && lastNotified !== currentVersion) {
            console.log('[PWA] New service worker activated - update available');
            setPwaState(prev => ({
              ...prev,
              hasUpdate: true,
            }));
          }
        }
      });
    };

    navigator.serviceWorker.addEventListener('controllerchange', controllerChangeHandler);

    // Listen for service worker registration and updates
    navigator.serviceWorker.getRegistration().then(reg => {
      // Don't proceed if component unmounted
      if (!isMountedRef.current) {
        return;
      }
      
      if (reg) {
        currentRegistration = reg;
        setRegistration(reg);

        // Create named handler for updatefound event so it can be removed
        updateFoundHandler = () => {
          if (!isMountedRef.current) {
            return;
          }
          
          console.log('[PWA] updatefound event fired - new service worker detected');
          const newWorker = reg.installing;
          
          if (newWorker) {
            currentWorker = newWorker;
            const currentController = navigator.serviceWorker.controller;
            
            // Immediately check if this is a different version (during installing phase)
            if (currentController) {
              detectUpdate(newWorker, currentController);
            }
            
            // Create named handler for statechange event so it can be removed
            stateChangeHandler = () => {
              // Don't proceed if component unmounted
              if (!isMountedRef.current) {
                return;
              }
              
              console.log('[PWA] Service worker state changed:', newWorker.state);
              
              // Detect update at multiple states since skipWaiting might activate immediately
              const currentController = navigator.serviceWorker.controller;
              
              // Check during installing, installed, or activating states
              if (newWorker.state === 'installing' || newWorker.state === 'installed' || newWorker.state === 'activating') {
                if (currentController) {
                  detectUpdate(newWorker, currentController);
                }
              }
              
              // If it reached activated state, the update has been applied
              if (newWorker.state === 'activated') {
                console.log('[PWA] New service worker activated');
                // Clear update state since it's now active
                setPwaState(prev => ({
                  ...prev,
                  hasUpdate: false,
                }));
              }
            };
            
            newWorker.addEventListener('statechange', stateChangeHandler);
            
            // Also check current state immediately (in case we missed the event)
            if (newWorker.state === 'installing' || newWorker.state === 'installed' || newWorker.state === 'activating') {
              if (currentController) {
                detectUpdate(newWorker, currentController);
              }
            }
          }
        };

        // Listen for updatefound event
        reg.addEventListener('updatefound', updateFoundHandler);

        // Check for existing installing/waiting workers immediately
        if (reg.installing) {
          console.log('[PWA] Found installing service worker on registration');
          const currentController = navigator.serviceWorker.controller;
          if (currentController) {
            detectUpdate(reg.installing, currentController);
          }
        }
        
        if (reg.waiting) {
          console.log('[PWA] Found waiting service worker on registration');
          const currentController = navigator.serviceWorker.controller;
          if (currentController) {
            detectUpdate(reg.waiting, currentController);
          }
        }

        // Manually trigger update check immediately
        reg.update().catch(err => {
          if (isMountedRef.current) {
            console.error('[PWA] Error updating service worker:', err);
          }
        });
      }
    });

    return () => {
      // Mark as unmounted
      isMountedRef.current = false;
      
      // Clear timeout
      clearTimeout(immediateCheck);
      
      // Clear interval
      clearInterval(intervalId);
      
      // Remove visibility and focus listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      
      // Remove controllerchange listener
      if (controllerChangeHandler) {
        navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeHandler);
      }
      
      // Remove event listeners
      if (currentWorker && stateChangeHandler) {
        currentWorker.removeEventListener('statechange', stateChangeHandler);
      }
      
      if (currentRegistration && updateFoundHandler) {
        currentRegistration.removeEventListener('updatefound', updateFoundHandler);
      }
    };
  }, [checkForUpdate, detectUpdate]);

  return {
    ...pwaState,
    updateApp,
  };
};
