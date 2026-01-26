import { logError, devLog } from '@utils/core/logger';

/**
 * Initialize native Analytics if running in Capacitor
 * Requires: @capacitor-community/firebase-analytics plugin
 */
export const initializeNativeAnalytics = async (): Promise<boolean> => {
  // Check if Capacitor is available
  let Capacitor: any;
  try {
    Capacitor = (await import('@capacitor/core')).Capacitor;
  } catch (error) {
    // Capacitor not installed, skip native Analytics
    return false;
  }

  if (!Capacitor.isNativePlatform()) {
    return false; // Not native, use web Analytics
  }

  try {
    // Dynamic import to avoid errors if plugin not installed
    const { FirebaseAnalytics } = await import('@capacitor-community/firebase-analytics');
    
    // Initialize native Analytics
    await FirebaseAnalytics.initializeFirebase({
      // Configuration handled by Capacitor plugin
    });

    devLog('[Analytics] Native Analytics initialized');
    return true;
  } catch (error) {
    devLog('[Analytics] Native Analytics not available, using web fallback');
    return false;
  }
};
