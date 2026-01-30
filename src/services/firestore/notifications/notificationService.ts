// Notification Service
// Handles user notifications for various events
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  limit
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError } from '@utils/core/logger';
import type { Notification, EmployeeRef } from '../../../types/models';

// ============================================================================
// NOTIFICATION OPERATIONS
// ============================================================================

/**
 * Create a new notification
 */
export const createNotification = async (
  data: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>,
  createdBy?: EmployeeRef | null
): Promise<Notification> => {
  try {
    if (!data.userId || !data.companyId || !data.title || !data.message) {
      throw new Error('Missing required fields: userId, companyId, title, message');
    }

    const batch = writeBatch(db);
    const notificationRef = doc(collection(db, 'notifications'));

    const now = serverTimestamp();
    const notificationData: any = {
      id: notificationRef.id,
      userId: data.userId,
      companyId: data.companyId,
      type: data.type,
      title: data.title,
      message: data.message,
      read: false,
      createdAt: now,
      updatedAt: now
    };

    if (data.data) notificationData.data = data.data;
    if (createdBy) notificationData.createdBy = createdBy;

    batch.set(notificationRef, notificationData);

    await batch.commit();

    return {
      id: notificationRef.id,
      ...notificationData,
      createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
      updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
    } as Notification;

  } catch (error) {
    logError('Error creating notification', error);
    throw error;
  }
};

/**
 * Create multiple notifications for multiple users
 */
export const createNotificationsForUsers = async (
  userIds: string[],
  companyId: string,
  type: Notification['type'],
  title: string,
  message: string,
  data?: Notification['data'],
  createdBy?: EmployeeRef | null
): Promise<void> => {
  try {
    if (userIds.length === 0) return;

    const batch = writeBatch(db);
    const now = serverTimestamp();

    userIds.forEach((userId) => {
      const notificationRef = doc(collection(db, 'notifications'));
      const notificationData: any = {
        id: notificationRef.id,
        userId,
        companyId,
        type,
        title,
        message,
        read: false,
        createdAt: now,
        updatedAt: now
      };

      if (data) notificationData.data = data;
      if (createdBy) notificationData.createdBy = createdBy;

      batch.set(notificationRef, notificationData);
    });

    await batch.commit();

  } catch (error) {
    logError('Error creating notifications for users', error);
    throw error;
  }
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    const notificationSnap = await getDoc(notificationRef);

    if (!notificationSnap.exists()) {
      throw new Error('Notification not found');
    }

    await updateDoc(notificationRef, {
      read: true,
      readAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

  } catch (error) {
    logError('Error marking notification as read', error);
    throw error;
  }
};

/**
 * Mark multiple notifications as read
 */
export const markNotificationsAsRead = async (notificationIds: string[]): Promise<void> => {
  try {
    if (notificationIds.length === 0) return;

    const batch = writeBatch(db);
    const now = serverTimestamp();

    notificationIds.forEach((notificationId) => {
      const notificationRef = doc(db, 'notifications', notificationId);
      batch.update(notificationRef, {
        read: true,
        readAt: now,
        updatedAt: now
      });
    });

    await batch.commit();

  } catch (error) {
    logError('Error marking notifications as read', error);
    throw error;
  }
};

/**
 * Mark all notifications for a user as read
 */
export const markAllNotificationsAsRead = async (userId: string, companyId?: string): Promise<void> => {
  try {
    let q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    if (companyId) {
      q = query(q, where('companyId', '==', companyId));
    }

    const snapshot = await getDocs(q);
    const notificationIds = snapshot.docs.map(doc => doc.id);

    if (notificationIds.length > 0) {
      await markNotificationsAsRead(notificationIds);
    }

  } catch (error) {
    logError('Error marking all notifications as read', error);
    throw error;
  }
};

/**
 * Get a single notification by ID
 */
export const getNotification = async (notificationId: string): Promise<Notification | null> => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    const notificationSnap = await getDoc(notificationRef);

    if (!notificationSnap.exists()) {
      return null;
    }

    return notificationSnap.data() as Notification;

  } catch (error) {
    logError('Error getting notification', error);
    throw error;
  }
};

/**
 * Get all notifications for a user with optional filters
 */
export const getNotifications = async (
  userId: string,
  filters?: {
    companyId?: string;
    read?: boolean;
    type?: Notification['type'];
    limit?: number;
  }
): Promise<Notification[]> => {
  try {
    // OPTIMIZATION: Default limit to reduce Firebase reads if no limit specified
    const defaultLimit = 100; // OPTIMIZATION: Default limit to reduce Firebase reads
    let q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    if (filters?.companyId) {
      q = query(q, where('companyId', '==', filters.companyId));
    }

    if (filters?.read !== undefined) {
      q = query(q, where('read', '==', filters.read));
    }

    if (filters?.type) {
      q = query(q, where('type', '==', filters.type));
    }

    // Apply limit - use filter limit if provided, otherwise use default
    q = query(q, limit(filters?.limit || defaultLimit));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Notification);

  } catch (error) {
    logError('Error getting notifications', error);
    throw error;
  }
};

/**
 * Get unread notifications count for a user
 */
export const getUnreadNotificationsCount = async (
  userId: string,
  companyId?: string
): Promise<number> => {
  try {
    let q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    if (companyId) {
      q = query(q, where('companyId', '==', companyId));
    }

    const snapshot = await getDocs(q);
    return snapshot.size;

  } catch (error) {
    logError('Error getting unread notifications count', error);
    throw error;
  }
};

/**
 * Subscribe to notifications for a user with optional filters
 */
export const subscribeToNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void,
  filters?: {
    companyId?: string;
    read?: boolean;
    type?: Notification['type'];
    limit?: number;
  }
): (() => void) => {
  let isActive = true;
  let unsubscribeFn: (() => void) | null = null;

  try {
    let q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    if (filters?.companyId) {
      q = query(q, where('companyId', '==', filters.companyId));
    }

    if (filters?.read !== undefined) {
      q = query(q, where('read', '==', filters.read));
    }

    if (filters?.type) {
      q = query(q, where('type', '==', filters.type));
    }

    if (filters?.limit) {
      q = query(q, limit(filters.limit));
    }

    unsubscribeFn = onSnapshot(
      q,
      (snapshot) => {
        // Only process if subscription is still active
        if (!isActive) return;
        
        try {
          const notifications = snapshot.docs.map(doc => doc.data() as Notification);
          callback(notifications);
        } catch (error) {
          // Silently handle errors in callback to prevent breaking the listener
          if (isActive) {
            logError('Error processing notifications snapshot', error);
          }
        }
      },
      (error) => {
        // Only log if subscription is still active
        if (isActive) {
          logError('Error subscribing to notifications', error);
          try {
            callback([]);
          } catch (callbackError) {
            // Ignore callback errors during error handling
          }
        }
      }
    );

    // Return unsubscribe function that marks as inactive first
    return () => {
      isActive = false;
      if (unsubscribeFn) {
        try {
          unsubscribeFn();
        } catch (error) {
          // Ignore errors during cleanup - listener might already be closed
        }
        unsubscribeFn = null;
      }
    };

  } catch (error) {
    logError('Error setting up notifications subscription', error);
    isActive = false;
    return () => {}; // Return empty unsubscribe function
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (notificationId: string): Promise<void> => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    const notificationSnap = await getDoc(notificationRef);

    if (!notificationSnap.exists()) {
      throw new Error('Notification not found');
    }

    await updateDoc(notificationRef, {
      updatedAt: serverTimestamp()
    });

    // Soft delete by marking as read and removing from active queries
    // Or use hard delete if preferred
    // await deleteDoc(notificationRef);

  } catch (error) {
    logError('Error deleting notification', error);
    throw error;
  }
};

