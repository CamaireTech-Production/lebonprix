import { useEffect, useRef } from 'react';
import { trackPageVisit } from '../services/visitorTrackingService';

interface UseVisitorTrackingProps {
  restaurantId: string;
  pageType: 'menu' | 'order' | 'daily-menu';
  isDemo?: boolean;
  demoId?: string;
  engagementThreshold?: number; // seconds to wait before counting as visit
}

export const useVisitorTracking = ({
  restaurantId,
  pageType,
  isDemo = false,
  demoId,
  engagementThreshold = 10
}: UseVisitorTrackingProps) => {
  const hasTracked = useRef(false);
  const engagementTimer = useRef<NodeJS.Timeout | null>(null);
  const pageLoadTime = useRef<number>(Date.now());

  useEffect(() => {
    if (!restaurantId || hasTracked.current) return;

    // Start engagement timer
    engagementTimer.current = setTimeout(async () => {
      try {
        // Check if page is still active and user hasn't navigated away
        if (document.visibilityState === 'visible' && !hasTracked.current) {
          // Calculate actual engagement time
          const actualEngagementTime = Math.floor((Date.now() - pageLoadTime.current) / 1000);
          
          // Only track if user has been engaged for the threshold time
          if (actualEngagementTime >= engagementThreshold) {
            console.log('[VisitorTracking] Engagement threshold met', { pageType, restaurantId, actualEngagementTime, isDemo, demoId });
            await trackPageVisit(restaurantId, pageType, isDemo, demoId);
            hasTracked.current = true;
            console.log(`[VisitorTracking] Visitor tracked for ${pageType} after ${actualEngagementTime}s engagement`);
          }
        }
      } catch (error) {
        console.error('[VisitorTracking] Error tracking visitor:', error);
      }
    }, engagementThreshold * 1000);

    // Track page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && engagementTimer.current) {
        clearTimeout(engagementTimer.current);
        engagementTimer.current = null;
      }
    };

    // Track page unload
    const handleBeforeUnload = () => {
      if (engagementTimer.current) {
        clearTimeout(engagementTimer.current);
        engagementTimer.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (engagementTimer.current) {
        clearTimeout(engagementTimer.current);
        engagementTimer.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [restaurantId, pageType, isDemo, demoId, engagementThreshold]);

  // Reset tracking when component unmounts or props change
  useEffect(() => {
    return () => {
      hasTracked.current = false;
      if (engagementTimer.current) {
        clearTimeout(engagementTimer.current);
        engagementTimer.current = null;
      }
    };
  }, [restaurantId, pageType, isDemo, demoId]);
};

