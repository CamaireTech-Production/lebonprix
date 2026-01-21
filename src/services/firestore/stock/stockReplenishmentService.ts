// Stock Replenishment Request Service
// Handles stock replenishment requests from shops to warehouses
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
  writeBatch
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError } from '@utils/core/logger';
import type { StockReplenishmentRequest, EmployeeRef } from '../../../types/models';
import { 
  notifyReplenishmentRequestCreated,
  notifyReplenishmentRequestFulfilled,
  notifyReplenishmentRequestRejected
} from '../../../utils/notifications/notificationHelpers';

// ============================================================================
// STOCK REPLENISHMENT REQUEST OPERATIONS
// ============================================================================

/**
 * Create a new stock replenishment request
 */
export const createReplenishmentRequest = async (
  data: Omit<StockReplenishmentRequest, 'id' | 'createdAt' | 'updatedAt'>,
  createdBy?: EmployeeRef | null
): Promise<StockReplenishmentRequest> => {
  try {
    if (!data.companyId || !data.shopId || !data.productId || !data.requestedBy) {
      throw new Error('Missing required fields: companyId, shopId, productId, requestedBy');
    }

    if (data.quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    // Validate that shop is active
    const shopRef = doc(db, 'shops', data.shopId);
    const shopSnap = await getDoc(shopRef);
    if (!shopSnap.exists()) {
      throw new Error('Shop not found');
    }
    const shopData = shopSnap.data();
    if (shopData.isActive === false) {
      throw new Error('Cannot create replenishment request from an inactive shop');
    }

    const batch = writeBatch(db);
    const requestRef = doc(collection(db, 'stockReplenishmentRequests'));

    const now = serverTimestamp();
    const requestData: any = {
      id: requestRef.id,
      companyId: data.companyId,
      shopId: data.shopId,
      productId: data.productId,
      quantity: data.quantity,
      requestedBy: data.requestedBy,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };

    if (data.notes) requestData.notes = data.notes;
    if (createdBy) requestData.createdBy = createdBy;

    batch.set(requestRef, requestData);

    await batch.commit();

    const createdRequest = {
      id: requestRef.id,
      ...requestData,
      createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
      updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
    } as StockReplenishmentRequest;

    // Notify managers about the new request (async, don't wait)
    notifyReplenishmentRequestCreated(
      data.companyId,
      requestRef.id,
      data.shopId,
      data.productId,
      data.quantity
    ).catch(err => {
      logError('Error sending notification for replenishment request', err);
    });

    return createdRequest;

  } catch (error) {
    logError('Error creating replenishment request', error);
    throw error;
  }
};

/**
 * Update a replenishment request
 */
export const updateReplenishmentRequest = async (
  requestId: string,
  updates: Partial<Pick<StockReplenishmentRequest, 'status' | 'transferId' | 'fulfilledAt' | 'notes' | 'rejectedReason'>>
): Promise<void> => {
  try {
    const requestRef = doc(db, 'stockReplenishmentRequests', requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      throw new Error('Replenishment request not found');
    }

    const updateData: any = {
      ...updates,
      updatedAt: serverTimestamp()
    };

    // If status is being set to fulfilled, set fulfilledAt
    if (updates.status === 'fulfilled' && !updates.fulfilledAt) {
      updateData.fulfilledAt = serverTimestamp();
    }

    await updateDoc(requestRef, updateData);

  } catch (error) {
    logError('Error updating replenishment request', error);
    throw error;
  }
};

/**
 * Get a single replenishment request by ID
 */
export const getReplenishmentRequest = async (requestId: string): Promise<StockReplenishmentRequest | null> => {
  try {
    const requestRef = doc(db, 'stockReplenishmentRequests', requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      return null;
    }

    return requestSnap.data() as StockReplenishmentRequest;

  } catch (error) {
    logError('Error getting replenishment request', error);
    throw error;
  }
};

/**
 * Get all replenishment requests for a company with optional filters
 */
export const getReplenishmentRequests = async (
  companyId: string,
  filters?: {
    shopId?: string;
    productId?: string;
    status?: StockReplenishmentRequest['status'];
    requestedBy?: string;
  }
): Promise<StockReplenishmentRequest[]> => {
  try {
    let q = query(
      collection(db, 'stockReplenishmentRequests'),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );

    if (filters?.shopId) {
      q = query(q, where('shopId', '==', filters.shopId));
    }

    if (filters?.productId) {
      q = query(q, where('productId', '==', filters.productId));
    }

    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }

    if (filters?.requestedBy) {
      q = query(q, where('requestedBy', '==', filters.requestedBy));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as StockReplenishmentRequest);

  } catch (error) {
    logError('Error getting replenishment requests', error);
    throw error;
  }
};

/**
 * Subscribe to replenishment requests for a company with optional filters
 */
export const subscribeToReplenishmentRequests = (
  companyId: string,
  callback: (requests: StockReplenishmentRequest[]) => void,
  filters?: {
    shopId?: string;
    productId?: string;
    status?: StockReplenishmentRequest['status'];
    requestedBy?: string;
  }
): (() => void) => {
  try {
    let q = query(
      collection(db, 'stockReplenishmentRequests'),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );

    if (filters?.shopId) {
      q = query(q, where('shopId', '==', filters.shopId));
    }

    if (filters?.productId) {
      q = query(q, where('productId', '==', filters.productId));
    }

    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }

    if (filters?.requestedBy) {
      q = query(q, where('requestedBy', '==', filters.requestedBy));
    }

    return onSnapshot(
      q,
      (snapshot) => {
        const requests = snapshot.docs.map(doc => doc.data() as StockReplenishmentRequest);
        callback(requests);
      },
      (error) => {
        logError('Error subscribing to replenishment requests', error);
        callback([]);
      }
    );

  } catch (error) {
    logError('Error setting up replenishment requests subscription', error);
    return () => {}; // Return empty unsubscribe function
  }
};

/**
 * Approve a replenishment request (marks as approved, ready to be fulfilled)
 */
export const approveReplenishmentRequest = async (
  requestId: string
): Promise<void> => {
  await updateReplenishmentRequest(requestId, { status: 'approved' });
};

/**
 * Reject a replenishment request
 */
export const rejectReplenishmentRequest = async (
  requestId: string,
  reason?: string
): Promise<void> => {
  await updateReplenishmentRequest(requestId, {
    status: 'rejected',
    rejectedReason: reason
  });
};

/**
 * Fulfill a replenishment request by creating a transfer and linking it
 */
export const fulfillReplenishmentRequest = async (
  requestId: string,
  transferId: string
): Promise<void> => {
  await updateReplenishmentRequest(requestId, {
    status: 'fulfilled',
    transferId,
    fulfilledAt: serverTimestamp()
  });
};

