// FCM Token Management Service
// Handles Firebase Cloud Messaging token registration and management
import { getToken, onMessage, Messaging } from 'firebase/messaging';
import { messaging } from '@services/core/firebase';
import { collection, doc, setDoc, getDoc, deleteDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@services/core/firebase';
import { logError } from '@utils/core/logger';

export interface FCMToken {
  id: string;
  userId: string;
  token: string;
  deviceInfo?: {
    userAgent: string;
    platform: string;
  };
  createdAt: any;
  updatedAt: any;
}

/**
 * Request browser notification permission
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    throw new Error('This browser does not support notifications');
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    throw new Error('Notification permission was previously denied. Please enable it in your browser settings.');
  }

  // Request permission
  const permission = await Notification.requestPermission();
  return permission;
};

/**
 * Get FCM token for the current user
 */
export const getFCMToken = async (): Promise<string | null> => {
  if (!messaging) {
    console.warn('[FCM] Messaging not initialized');
    return null;
  }

  try {
    // Check if service worker is registered
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      
      // Get FCM token
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || '',
        serviceWorkerRegistration: registration
      });

      if (token) {
        return token;
      } else {
        console.warn('[FCM] No registration token available. Request permission to generate one.');
        return null;
      }
    } else {
      console.warn('[FCM] Service worker not supported');
      return null;
    }
  } catch (error) {
    logError('Error getting FCM token', error);
    return null;
  }
};

/**
 * Save FCM token to Firestore
 */
export const saveFCMToken = async (userId: string, token: string): Promise<void> => {
  try {
    if (!userId || !token) {
      throw new Error('UserId and token are required');
    }

    // Get device info
    const deviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform
    };

    // Create token document ID (use token hash or userId_token)
    const tokenId = `${userId}_${token.substring(0, 20)}`;

    const tokenRef = doc(db, 'users', userId, 'fcmTokens', tokenId);
    
    await setDoc(tokenRef, {
      id: tokenId,
      userId,
      token,
      deviceInfo,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    console.log('[FCM] Token saved successfully');
  } catch (error) {
    logError('Error saving FCM token', error);
    throw error;
  }
};

/**
 * Get all FCM tokens for a user
 */
export const getUserFCMTokens = async (userId: string): Promise<FCMToken[]> => {
  try {
    const tokensRef = collection(db, 'users', userId, 'fcmTokens');
    const snapshot = await getDocs(tokensRef);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FCMToken[];
  } catch (error) {
    logError('Error getting user FCM tokens', error);
    return [];
  }
};

/**
 * Delete FCM token
 */
export const deleteFCMToken = async (userId: string, tokenId: string): Promise<void> => {
  try {
    const tokenRef = doc(db, 'users', userId, 'fcmTokens', tokenId);
    await deleteDoc(tokenRef);
    console.log('[FCM] Token deleted successfully');
  } catch (error) {
    logError('Error deleting FCM token', error);
    throw error;
  }
};

/**
 * Delete all FCM tokens for a user (on logout)
 */
export const deleteAllUserFCMTokens = async (userId: string): Promise<void> => {
  try {
    const tokens = await getUserFCMTokens(userId);
    await Promise.all(tokens.map(token => deleteFCMToken(userId, token.id)));
    console.log('[FCM] All tokens deleted for user');
  } catch (error) {
    logError('Error deleting all user FCM tokens', error);
  }
};

/**
 * Initialize FCM and request permission + get token
 */
export const initializeFCM = async (userId: string): Promise<string | null> => {
  try {
    // Request notification permission
    const permission = await requestNotificationPermission();
    
    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission not granted');
      return null;
    }

    // Get FCM token
    const token = await getFCMToken();
    
    if (token) {
      // Save token to Firestore
      await saveFCMToken(userId, token);
      return token;
    }

    return null;
  } catch (error) {
    logError('Error initializing FCM', error);
    return null;
  }
};

/**
 * Set up foreground message handler
 * This handles notifications when the app is in the foreground
 */
export const setupForegroundMessageHandler = (callback: (payload: any) => void): (() => void) | null => {
  if (!messaging) {
    console.warn('[FCM] Messaging not initialized');
    return null;
  }

  try {
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[FCM] Message received in foreground:', payload);
      callback(payload);
    });

    return unsubscribe;
  } catch (error) {
    logError('Error setting up foreground message handler', error);
    return null;
  }
};

/**
 * Check if FCM is supported
 */
export const isFCMSupported = (): boolean => {
  return typeof window !== 'undefined' && 
         'serviceWorker' in navigator && 
         'PushManager' in window &&
         messaging !== null;
};

/**
 * Check notification permission status
 */
export const getNotificationPermission = (): NotificationPermission => {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
};

