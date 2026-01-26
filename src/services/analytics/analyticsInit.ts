import { analytics } from '@services/core/firebase';
import { getAnalyticsPlatform } from '@utils/analytics/platformDetection';
import { logError, devLog } from '@utils/core/logger';
import type { Analytics } from 'firebase/analytics';

/**
 * Initialize Firebase Analytics with platform-specific configuration
 */
export const initializeAnalytics = async (): Promise<Analytics | null> => {
  if (typeof window === 'undefined') {
    return null; // SSR safety
  }

  try {
    const platform = getAnalyticsPlatform();
    devLog('[Analytics] Platform detected:', platform);

    // Get analytics instance from core firebase service
    // It's already initialized, just need to wait for it
    if (analytics) {
      devLog('[Analytics] Analytics initialized successfully', { platform });
      return analytics;
    }

    // If not initialized yet, wait a bit and retry
    await new Promise(resolve => setTimeout(resolve, 100));
    if (analytics) {
      return analytics;
    }

    devLog('[Analytics] Analytics not available');
    return null;
  } catch (error) {
    logError('[Analytics] Initialization error', error);
    return null;
  }
};

/**
 * Check if Analytics is available and ready
 */
export const isAnalyticsReady = (): boolean => {
  return typeof window !== 'undefined' && analytics !== null;
};
