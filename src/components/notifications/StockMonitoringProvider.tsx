// Stock Monitoring Provider
// Initializes stock monitoring and FCM when user is authenticated
import { useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { useStockMonitoring } from '@hooks/business/useStockMonitoring';
import { initializeFCM, setupForegroundMessageHandler, isFCMSupported } from '@services/notifications/fcmTokenService';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';

/**
 * Provider component that initializes stock monitoring and FCM
 * Should be placed inside AuthProvider to have access to user and company
 */
export const StockMonitoringProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, company } = useAuth();

  // Initialize stock monitoring (only for managers/owners)
  useStockMonitoring({
    enabled: !!company && !!user && (company.userId === user.uid || true) // Enable for all authenticated users with company
  });

  // Initialize FCM for push notifications
  useEffect(() => {
    if (!user || !company) {
      return;
    }

    // Only initialize if FCM is supported
    if (!isFCMSupported()) {
      console.log('[FCM] Not supported in this browser');
      return;
    }

    // Check if permission was already granted
    const permission = Notification.permission;
    if (permission === 'granted') {
      // Initialize FCM
      initializeFCM(user.uid).then(token => {
        if (token) {
          console.log('[FCM] Token initialized successfully');
        }
      }).catch(error => {
        console.error('[FCM] Error initializing:', error);
      });
    } else if (permission === 'default') {
      // Permission not yet requested - will be requested when user interacts
      console.log('[FCM] Permission not yet requested');
    }

    // Set up foreground message handler
    const unsubscribe = setupForegroundMessageHandler((payload) => {
      console.log('[FCM] Foreground message received:', payload);
      
      // Show notification in app (browser notification will be handled by service worker)
      if (payload.notification) {
        // You can show a toast or in-app notification here
        // For now, the service worker will handle the browser notification
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, company]);

  return <>{children}</>;
};

