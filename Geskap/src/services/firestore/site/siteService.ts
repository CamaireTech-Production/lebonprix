import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
  increment
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError } from '@utils/core/logger';
import type { Company, SiteAnalytics } from '../../../types/models';

const COLLECTION_NAME = 'siteAnalytics';

export interface SEOSettings {
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  ogImage?: string;
  twitterCard?: 'summary' | 'summary_large_image';
}

export interface ViewMetadata {
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
}

/**
 * Get SEO settings from Company document
 */
export const getSiteSettings = async (companyId: string): Promise<SEOSettings | null> => {
  try {
    const companyRef = doc(db, 'companies', companyId);
    const companyDoc = await getDoc(companyRef);
    
    if (!companyDoc.exists()) {
      throw new Error('Company not found');
    }
    
    const companyData = companyDoc.data() as Company;
    return companyData.seoSettings || null;
  } catch (error) {
    logError('Error getting site settings', error);
    throw error;
  }
};

/**
 * Update SEO settings in Company document
 */
export const updateSiteSettings = async (
  companyId: string,
  settings: SEOSettings
): Promise<void> => {
  try {
    const companyRef = doc(db, 'companies', companyId);
    
    // Use updateDoc to only update the seoSettings field
    await updateDoc(companyRef, {
      seoSettings: settings,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    logError('Error updating site settings', error);
    throw error;
  }
};

/**
 * Get today's date string in YYYY-MM-DD format
 */
const getTodayDateString = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

/**
 * Detect device type from user agent
 */
const detectDeviceType = (userAgent?: string): 'desktop' | 'mobile' | 'tablet' => {
  if (!userAgent) return 'desktop';
  
  const ua = userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
};

/**
 * Track catalogue view - creates or updates daily analytics
 */
export const trackCatalogueView = async (
  companyId: string,
  metadata: ViewMetadata
): Promise<void> => {
  try {
    const dateString = getTodayDateString();
    const docId = `${companyId}_${dateString}`;
    const analyticsRef = doc(db, COLLECTION_NAME, docId);
    
    // Check if document exists
    const existingDoc = await getDoc(analyticsRef);
    
    const deviceType = metadata.deviceType || detectDeviceType(metadata.userAgent);
    const referrer = metadata.referrer || 'direct';
    
    if (existingDoc.exists()) {
      // Update existing document
      const existingData = existingDoc.data() as SiteAnalytics;
      
      // Increment views
      // For unique visitors, we'd need to track sessions - simplified for now
      const batch = writeBatch(db);
      
      batch.update(analyticsRef, {
        views: increment(1),
        uniqueVisitors: increment(1), // Simplified - in production, track unique sessions
        updatedAt: serverTimestamp()
      });
      
      // Update device types array
      const deviceTypes = existingData.deviceTypes || [];
      const deviceTypeIndex = deviceTypes.findIndex(dt => dt.type === deviceType);
      
      if (deviceTypeIndex >= 0) {
        // Update existing device type count
        const updatedDeviceTypes = [...deviceTypes];
        updatedDeviceTypes[deviceTypeIndex] = {
          ...updatedDeviceTypes[deviceTypeIndex],
          count: updatedDeviceTypes[deviceTypeIndex].count + 1
        };
        batch.update(analyticsRef, {
          deviceTypes: updatedDeviceTypes
        });
      } else {
        // Add new device type
        batch.update(analyticsRef, {
          deviceTypes: [...deviceTypes, { type: deviceType, count: 1 }]
        });
      }
      
      // Update referrers array
      const referrers = existingData.referrers || [];
      const referrerIndex = referrers.findIndex(r => r.source === referrer);
      
      if (referrerIndex >= 0) {
        const updatedReferrers = [...referrers];
        updatedReferrers[referrerIndex] = {
          ...updatedReferrers[referrerIndex],
          count: updatedReferrers[referrerIndex].count + 1
        };
        batch.update(analyticsRef, {
          referrers: updatedReferrers
        });
      } else {
        batch.update(analyticsRef, {
          referrers: [...referrers, { source: referrer, count: 1 }]
        });
      }
      
      await batch.commit();
    } else {
      // Create new document
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const newAnalytics: Omit<SiteAnalytics, 'id'> = {
        companyId,
        date: Timestamp.fromDate(today),
        views: 1,
        uniqueVisitors: 1,
        popularProducts: [],
        referrers: [{ source: referrer, count: 1 }],
        deviceTypes: [{ type: deviceType, count: 1 }],
        userId: companyId, // Legacy field
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp
      };
      
      await setDoc(analyticsRef, newAnalytics);
    }
  } catch (error) {
    logError('Error tracking catalogue view', error);
    // Don't throw - analytics tracking should not break the app
    console.error('Failed to track catalogue view:', error);
  }
};

/**
 * Track individual product view
 */
export const trackProductView = async (
  companyId: string,
  productId: string,
  productName: string,
  metadata: ViewMetadata
): Promise<void> => {
  try {
    // First track the catalogue view
    await trackCatalogueView(companyId, metadata);
    
    // Then update product-specific analytics
    const dateString = getTodayDateString();
    const docId = `${companyId}_${dateString}`;
    const analyticsRef = doc(db, COLLECTION_NAME, docId);
    
    const existingDoc = await getDoc(analyticsRef);
    
    if (existingDoc.exists()) {
      const existingData = existingDoc.data() as SiteAnalytics;
      const popularProducts = existingData.popularProducts || [];
      
      const productIndex = popularProducts.findIndex(p => p.productId === productId);
      
      const batch = writeBatch(db);
      
      if (productIndex >= 0) {
        // Update existing product view count
        const updatedProducts = [...popularProducts];
        updatedProducts[productIndex] = {
          ...updatedProducts[productIndex],
          views: updatedProducts[productIndex].views + 1
        };
        batch.update(analyticsRef, {
          popularProducts: updatedProducts,
          updatedAt: serverTimestamp()
        });
      } else {
        // Add new product
        batch.update(analyticsRef, {
          popularProducts: [...popularProducts, {
            productId,
            productName,
            views: 1
          }],
          updatedAt: serverTimestamp()
        });
      }
      
      await batch.commit();
    }
  } catch (error) {
    logError('Error tracking product view', error);
    // Don't throw - analytics tracking should not break the app
    console.error('Failed to track product view:', error);
  }
};

/**
 * Get site analytics for a date range
 */
export const getSiteAnalytics = async (
  companyId: string,
  dateRange: { from: Date; to: Date }
): Promise<SiteAnalytics[]> => {
  try {
    const fromTimestamp = Timestamp.fromDate(dateRange.from);
    const toTimestamp = Timestamp.fromDate(dateRange.to);
    
    const q = query(
      collection(db, COLLECTION_NAME),
      where('companyId', '==', companyId),
      where('date', '>=', fromTimestamp),
      where('date', '<=', toTimestamp),
      orderBy('date', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as SiteAnalytics[];
  } catch (error) {
    logError('Error getting site analytics', error);
    throw error;
  }
};

/**
 * Subscribe to site analytics for real-time updates
 */
export const subscribeToSiteAnalytics = (
  companyId: string,
  dateRange: { from: Date; to: Date },
  callback: (analytics: SiteAnalytics[]) => void
): (() => void) => {
  try {
    const fromTimestamp = Timestamp.fromDate(dateRange.from);
    const toTimestamp = Timestamp.fromDate(dateRange.to);
    
    const q = query(
      collection(db, COLLECTION_NAME),
      where('companyId', '==', companyId),
      where('date', '>=', fromTimestamp),
      where('date', '<=', toTimestamp),
      orderBy('date', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const analytics = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SiteAnalytics[];
      callback(analytics);
    }, (error) => {
      logError('Error subscribing to site analytics', error);
    });
  } catch (error) {
    logError('Error setting up site analytics subscription', error);
    // Return no-op unsubscribe function
    return () => {};
  }
};

