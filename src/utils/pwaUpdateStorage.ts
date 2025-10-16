// PWA Update localStorage management
const PWA_UPDATE_KEYS = {
  CURRENT_VERSION: 'pwa_current_version',
  LAST_UPDATE_CHECK: 'pwa_last_update_check',
  UPDATE_DISMISSED: 'pwa_update_dismissed',
  UPDATE_CONFIRMED: 'pwa_update_confirmed',
  SERVICE_WORKER_VERSION: 'pwa_sw_version',
  UPDATE_AVAILABLE: 'pwa_update_available'
} as const;

// Get current app version from build time or use a fallback
const getCurrentAppVersion = (): string => {
  // Try to get version from package.json or build info
  // For now, we'll use a timestamp-based version
  return import.meta.env.VITE_APP_VERSION || `v${Date.now()}`;
};

// Get service worker version (we'll use registration scope as version)
const getServiceWorkerVersion = (registration: ServiceWorkerRegistration): string => {
  return registration.scope || 'default';
};

export const PWAUpdateStorage = {
  // Check if user has already handled the current update
  hasUserHandledUpdate: (): boolean => {
    try {
      const lastVersion = localStorage.getItem(PWA_UPDATE_KEYS.CURRENT_VERSION);
      const currentVersion = getCurrentAppVersion();
      const updateConfirmed = localStorage.getItem(PWA_UPDATE_KEYS.UPDATE_CONFIRMED);
      const updateDismissed = localStorage.getItem(PWA_UPDATE_KEYS.UPDATE_DISMISSED);
      
      console.log('PWA Update Check:', {
        lastVersion,
        currentVersion,
        updateConfirmed,
        updateDismissed,
        hasHandled: lastVersion === currentVersion && (updateConfirmed === 'true' || updateDismissed === 'true')
      });
      
      // If user confirmed or dismissed the current version, don't show again
      if (lastVersion === currentVersion && (updateConfirmed === 'true' || updateDismissed === 'true')) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking update state:', error);
      return false;
    }
  },

  // Mark update as confirmed by user
  markUpdateAsConfirmed: (registration?: ServiceWorkerRegistration): void => {
    try {
      const currentVersion = getCurrentAppVersion();
      const swVersion = registration ? getServiceWorkerVersion(registration) : 'unknown';
      
      localStorage.setItem(PWA_UPDATE_KEYS.UPDATE_CONFIRMED, 'true');
      localStorage.setItem(PWA_UPDATE_KEYS.CURRENT_VERSION, currentVersion);
      localStorage.setItem(PWA_UPDATE_KEYS.SERVICE_WORKER_VERSION, swVersion);
      localStorage.removeItem(PWA_UPDATE_KEYS.UPDATE_DISMISSED); // Clear dismissed state
      localStorage.removeItem(PWA_UPDATE_KEYS.UPDATE_AVAILABLE); // Clear available state
      
      console.log('Update marked as confirmed:', { currentVersion, swVersion });
    } catch (error) {
      console.error('Error marking update as confirmed:', error);
    }
  },

  // Mark update as dismissed by user
  markUpdateAsDismissed: (): void => {
    try {
      const currentVersion = getCurrentAppVersion();
      
      localStorage.setItem(PWA_UPDATE_KEYS.UPDATE_DISMISSED, 'true');
      localStorage.setItem(PWA_UPDATE_KEYS.CURRENT_VERSION, currentVersion);
      localStorage.setItem(PWA_UPDATE_KEYS.LAST_UPDATE_CHECK, Date.now().toString());
      
      console.log('Update marked as dismissed for version:', currentVersion);
    } catch (error) {
      console.error('Error marking update as dismissed:', error);
    }
  },

  // Mark that an update is available
  markUpdateAsAvailable: (registration: ServiceWorkerRegistration): void => {
    try {
      const swVersion = getServiceWorkerVersion(registration);
      
      localStorage.setItem(PWA_UPDATE_KEYS.UPDATE_AVAILABLE, 'true');
      localStorage.setItem(PWA_UPDATE_KEYS.SERVICE_WORKER_VERSION, swVersion);
      localStorage.setItem(PWA_UPDATE_KEYS.LAST_UPDATE_CHECK, Date.now().toString());
      
      console.log('Update marked as available:', swVersion);
    } catch (error) {
      console.error('Error marking update as available:', error);
    }
  },

  // Check if update is available and not yet handled
  isUpdateAvailableAndNotHandled: (): boolean => {
    try {
      const updateAvailable = localStorage.getItem(PWA_UPDATE_KEYS.UPDATE_AVAILABLE) === 'true';
      const hasHandled = PWAUpdateStorage.hasUserHandledUpdate();
      
      return updateAvailable && !hasHandled;
    } catch (error) {
      console.error('Error checking if update is available:', error);
      return false;
    }
  },

  // Clear all update state (useful for testing or reset)
  clearUpdateState: (): void => {
    try {
      Object.values(PWA_UPDATE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      console.log('PWA update state cleared');
    } catch (error) {
      console.error('Error clearing update state:', error);
    }
  },

  // Get current update state for debugging
  getUpdateState: () => {
    try {
      return {
        currentVersion: localStorage.getItem(PWA_UPDATE_KEYS.CURRENT_VERSION),
        lastUpdateCheck: localStorage.getItem(PWA_UPDATE_KEYS.LAST_UPDATE_CHECK),
        updateDismissed: localStorage.getItem(PWA_UPDATE_KEYS.UPDATE_DISMISSED),
        updateConfirmed: localStorage.getItem(PWA_UPDATE_KEYS.UPDATE_CONFIRMED),
        serviceWorkerVersion: localStorage.getItem(PWA_UPDATE_KEYS.SERVICE_WORKER_VERSION),
        updateAvailable: localStorage.getItem(PWA_UPDATE_KEYS.UPDATE_AVAILABLE),
        hasHandled: PWAUpdateStorage.hasUserHandledUpdate()
      };
    } catch (error) {
      console.error('Error getting update state:', error);
      return {};
    }
  },

  // Debug method - expose to window for testing
  debug: () => {
    if (typeof window !== 'undefined') {
      (window as any).PWAUpdateDebug = {
        getState: PWAUpdateStorage.getUpdateState,
        clearState: PWAUpdateStorage.clearUpdateState,
        markConfirmed: PWAUpdateStorage.markUpdateAsConfirmed,
        markDismissed: PWAUpdateStorage.markUpdateAsDismissed
      };
      console.log('PWA Update Debug tools available at window.PWAUpdateDebug');
    }
  }
};
