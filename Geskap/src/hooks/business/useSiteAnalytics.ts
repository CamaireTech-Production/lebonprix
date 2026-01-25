import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { getSiteAnalytics, subscribeToSiteAnalytics, type SiteAnalytics } from '@services/firestore/site/siteService';
import { startOfMonth } from 'date-fns';

interface UseSiteAnalyticsParams {
  dateRange?: { from: Date; to: Date };
  enableRealtime?: boolean;
}

export const useSiteAnalytics = (params: UseSiteAnalyticsParams = {}) => {
  const { company } = useAuth();
  const { dateRange, enableRealtime = false } = params;
  
  const defaultDateRange = useMemo(() => ({
    from: startOfMonth(new Date()),
    to: new Date()
  }), []);

  const [analytics, setAnalytics] = useState<SiteAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const effectiveDateRange = dateRange || defaultDateRange;

  // Load analytics
  useEffect(() => {
    if (!company?.id) {
      setLoading(false);
      return;
    }

    const loadAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getSiteAnalytics(company.id, effectiveDateRange);
        setAnalytics(data);
      } catch (err: any) {
        console.error('Error loading site analytics:', err);
        setError(err.message || 'Failed to load analytics');
        setAnalytics([]);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [company?.id, effectiveDateRange.from, effectiveDateRange.to]);

  // Real-time subscription
  useEffect(() => {
    if (!company?.id || !enableRealtime) {
      return;
    }

    const unsubscribe = subscribeToSiteAnalytics(
      company.id,
      effectiveDateRange,
      (data) => {
        setAnalytics(data);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [company?.id, enableRealtime, effectiveDateRange.from, effectiveDateRange.to]);

  // Calculate aggregated metrics
  const metrics = useMemo(() => {
    if (analytics.length === 0) {
      return {
        totalViews: 0,
        totalUniqueVisitors: 0,
        averageViewsPerDay: 0,
        popularProducts: [] as Array<{ productId: string; productName: string; views: number }>,
        referrers: [] as Array<{ source: string; count: number }>,
        deviceTypes: [] as Array<{ type: 'desktop' | 'mobile' | 'tablet'; count: number }>
      };
    }

    // Aggregate totals
    const totalViews = analytics.reduce((sum, day) => sum + (day.views || 0), 0);
    const totalUniqueVisitors = analytics.reduce((sum, day) => sum + (day.uniqueVisitors || 0), 0);
    const averageViewsPerDay = analytics.length > 0 ? totalViews / analytics.length : 0;

    // Aggregate popular products across all days
    const productMap = new Map<string, { productName: string; views: number }>();
    analytics.forEach(day => {
      (day.popularProducts || []).forEach(product => {
        const existing = productMap.get(product.productId);
        if (existing) {
          productMap.set(product.productId, {
            productName: product.productName,
            views: existing.views + product.views
          });
        } else {
          productMap.set(product.productId, {
            productName: product.productName,
            views: product.views
          });
        }
      });
    });
    const popularProducts = Array.from(productMap.entries())
      .map(([productId, data]) => ({
        productId,
        ...data
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10); // Top 10

    // Aggregate referrers
    const referrerMap = new Map<string, number>();
    analytics.forEach(day => {
      (day.referrers || []).forEach(ref => {
        const existing = referrerMap.get(ref.source) || 0;
        referrerMap.set(ref.source, existing + ref.count);
      });
    });
    const referrers = Array.from(referrerMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    // Aggregate device types
    const deviceMap = new Map<'desktop' | 'mobile' | 'tablet', number>();
    analytics.forEach(day => {
      (day.deviceTypes || []).forEach(device => {
        const existing = deviceMap.get(device.type) || 0;
        deviceMap.set(device.type, existing + device.count);
      });
    });
    const deviceTypes = Array.from(deviceMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalViews,
      totalUniqueVisitors,
      averageViewsPerDay,
      popularProducts,
      referrers,
      deviceTypes
    };
  }, [analytics]);

  return {
    analytics,
    metrics,
    loading,
    error
  };
};

