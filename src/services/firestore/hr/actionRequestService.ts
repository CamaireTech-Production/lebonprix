import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
  limit
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError } from '@utils/core/logger';
import type { ActionRequest, ActionRequestStatus, GrantType } from '../../../types/models';

const ACTION_REQUESTS_COLLECTION = 'actionRequests';

/**
 * Generate a unique ID for Action Request
 */
const generateActionRequestId = (): string => {
  return `ar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create a new Action Request
 */
export async function createActionRequest(
  companyId: string,
  data: {
    requesterId: string;
    requesterName: string;
    requesterEmail?: string;
    requestedAction: string;
    resource: string;
    resourceId?: string;
    resourceName?: string;
    reason?: string;
  }
): Promise<ActionRequest> {
  try {
    const id = generateActionRequestId();
    const ref = doc(db, ACTION_REQUESTS_COLLECTION, id);

    const actionRequest: ActionRequest = {
      id,
      companyId,
      requesterId: data.requesterId,
      requesterName: data.requesterName,
      requesterEmail: data.requesterEmail,
      requestedAction: data.requestedAction,
      resource: data.resource,
      resourceId: data.resourceId,
      resourceName: data.resourceName,
      reason: data.reason,
      status: 'pending',
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
    };

    // Remove undefined values
    const cleanedRequest = Object.fromEntries(
      Object.entries(actionRequest).filter(([_, value]) => value !== undefined)
    ) as ActionRequest;

    await setDoc(ref, cleanedRequest);
    return cleanedRequest;
  } catch (error) {
    logError('Error creating action request', error);
    throw error;
  }
}

/**
 * Get all action requests for a company
 */
export async function getActionRequests(
  companyId: string,
  status?: ActionRequestStatus
): Promise<ActionRequest[]> {
  try {
    let q = query(
      collection(db, ACTION_REQUESTS_COLLECTION),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );

    if (status) {
      q = query(
        collection(db, ACTION_REQUESTS_COLLECTION),
        where('companyId', '==', companyId),
        where('status', '==', status),
        orderBy('createdAt', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as ActionRequest);
  } catch (error) {
    logError('Error fetching action requests', error);
    throw error;
  }
}

/**
 * Get pending action requests count for a company
 */
export async function getPendingRequestsCount(companyId: string): Promise<number> {
  try {
    const q = query(
      collection(db, ACTION_REQUESTS_COLLECTION),
      where('companyId', '==', companyId),
      where('status', '==', 'pending')
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    logError('Error getting pending requests count', error);
    return 0;
  }
}

/**
 * Get action requests by requester
 */
export async function getActionRequestsByRequester(
  companyId: string,
  requesterId: string
): Promise<ActionRequest[]> {
  try {
    const q = query(
      collection(db, ACTION_REQUESTS_COLLECTION),
      where('companyId', '==', companyId),
      where('requesterId', '==', requesterId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as ActionRequest);
  } catch (error) {
    logError('Error fetching action requests by requester', error);
    throw error;
  }
}

/**
 * Get a single action request by ID
 */
export async function getActionRequestById(requestId: string): Promise<ActionRequest | null> {
  try {
    const ref = doc(db, ACTION_REQUESTS_COLLECTION, requestId);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as ActionRequest) : null;
  } catch (error) {
    logError('Error fetching action request by ID', error);
    throw error;
  }
}

/**
 * Approve an action request
 */
export async function approveActionRequest(
  requestId: string,
  reviewerId: string,
  reviewerName: string,
  grantType: GrantType = 'one_time',
  reviewNote?: string,
  expiresInHours?: number
): Promise<void> {
  try {
    const ref = doc(db, ACTION_REQUESTS_COLLECTION, requestId);

    const updateData: any = {
      status: 'approved',
      reviewedBy: reviewerId,
      reviewedByName: reviewerName,
      reviewedAt: serverTimestamp(),
      grantType,
      reviewNote,
      updatedAt: serverTimestamp(),
    };

    // Set expiration for one-time grants
    if (grantType === 'one_time' && expiresInHours) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);
      updateData.expiresAt = expiresAt;
    }

    // Remove undefined values
    const cleanedUpdate = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    );

    await updateDoc(ref, cleanedUpdate);
  } catch (error) {
    logError('Error approving action request', error);
    throw error;
  }
}

/**
 * Reject an action request
 */
export async function rejectActionRequest(
  requestId: string,
  reviewerId: string,
  reviewerName: string,
  reviewNote?: string
): Promise<void> {
  try {
    const ref = doc(db, ACTION_REQUESTS_COLLECTION, requestId);

    await updateDoc(ref, {
      status: 'rejected',
      reviewedBy: reviewerId,
      reviewedByName: reviewerName,
      reviewedAt: serverTimestamp(),
      reviewNote: reviewNote || null,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logError('Error rejecting action request', error);
    throw error;
  }
}

/**
 * Delete an action request
 */
export async function deleteActionRequest(requestId: string): Promise<void> {
  try {
    const ref = doc(db, ACTION_REQUESTS_COLLECTION, requestId);
    await deleteDoc(ref);
  } catch (error) {
    logError('Error deleting action request', error);
    throw error;
  }
}

/**
 * Subscribe to action requests in real-time
 */
export function subscribeToActionRequests(
  companyId: string,
  callback: (requests: ActionRequest[]) => void,
  status?: ActionRequestStatus
): Unsubscribe {
  let q = query(
    collection(db, ACTION_REQUESTS_COLLECTION),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );

  if (status) {
    q = query(
      collection(db, ACTION_REQUESTS_COLLECTION),
      where('companyId', '==', companyId),
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    );
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const requests: ActionRequest[] = snapshot.docs.map(doc => doc.data() as ActionRequest);
      callback(requests);
    },
    (error) => {
      logError(`Error in subscribeToActionRequests listener for company ${companyId}`, error);
    }
  );
}

/**
 * Subscribe to pending action requests count
 */
export function subscribeToPendingRequestsCount(
  companyId: string,
  callback: (count: number) => void
): Unsubscribe {
  const q = query(
    collection(db, ACTION_REQUESTS_COLLECTION),
    where('companyId', '==', companyId),
    where('status', '==', 'pending')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.size);
    },
    (error) => {
      logError(`Error in subscribeToPendingRequestsCount listener for company ${companyId}`, error);
    }
  );
}

/**
 * Check if user has a pending request for a specific action
 */
export async function hasPendingRequest(
  companyId: string,
  requesterId: string,
  requestedAction: string,
  resource: string,
  resourceId?: string
): Promise<boolean> {
  try {
    let q = query(
      collection(db, ACTION_REQUESTS_COLLECTION),
      where('companyId', '==', companyId),
      where('requesterId', '==', requesterId),
      where('requestedAction', '==', requestedAction),
      where('resource', '==', resource),
      where('status', '==', 'pending'),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) return false;

    // If resourceId is provided, check for exact match
    if (resourceId) {
      return snapshot.docs.some(doc => doc.data().resourceId === resourceId);
    }

    return true;
  } catch (error) {
    logError('Error checking for pending request', error);
    return false;
  }
}

/**
 * Check if user has an approved (non-expired) request for a specific action
 */
export async function hasApprovedRequest(
  companyId: string,
  requesterId: string,
  requestedAction: string,
  resource: string,
  resourceId?: string
): Promise<boolean> {
  try {
    const q = query(
      collection(db, ACTION_REQUESTS_COLLECTION),
      where('companyId', '==', companyId),
      where('requesterId', '==', requesterId),
      where('requestedAction', '==', requestedAction),
      where('resource', '==', resource),
      where('status', '==', 'approved'),
      limit(10)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) return false;

    const now = new Date();

    for (const docSnap of snapshot.docs) {
      const request = docSnap.data() as ActionRequest;

      // Check resourceId if provided
      if (resourceId && request.resourceId !== resourceId) {
        continue;
      }

      // Check if permanent grant
      if (request.grantType === 'permanent') {
        return true;
      }

      // Check if one-time grant is still valid
      if (request.grantType === 'one_time' && request.expiresAt) {
        const expiresAt = new Date((request.expiresAt as any).seconds * 1000);
        if (expiresAt > now) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    logError('Error checking for approved request', error);
    return false;
  }
}
