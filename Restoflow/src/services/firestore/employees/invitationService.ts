// Invitation service for Restoflow
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  addDoc,
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import type { Invitation, InvitationStatus } from '../../../types/geskap';

// ============================================================================
// INVITATION SUBSCRIPTIONS
// ============================================================================

export const subscribeToInvitations = (
  restaurantId: string,
  callback: (invitations: Invitation[]) => void
): (() => void) => {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'restaurants', restaurantId, 'invitations'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const invitations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Invitation[];
    callback(invitations);
  }, (error) => {
    console.error('Error in invitations subscription:', error);
    callback([]);
  });
};

export const subscribeToPendingInvitations = (
  restaurantId: string,
  callback: (invitations: Invitation[]) => void
): (() => void) => {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'restaurants', restaurantId, 'invitations'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const invitations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Invitation[];
    callback(invitations);
  }, (error) => {
    console.error('Error in pending invitations subscription:', error);
    callback([]);
  });
};

// ============================================================================
// INVITATION CRUD OPERATIONS
// ============================================================================

export const createInvitation = async (
  restaurantId: string,
  restaurantName: string,
  invitedBy: string,
  invitedByName: string,
  email: string,
  permissionTemplateId: string,
  additionalInfo?: {
    firstname?: string;
    lastname?: string;
    phone?: string;
  }
): Promise<Invitation> => {
  // Check for existing pending invitation
  const existingQuery = query(
    collection(db, 'restaurants', restaurantId, 'invitations'),
    where('email', '==', email.toLowerCase()),
    where('status', '==', 'pending')
  );

  const existingSnap = await getDocs(existingQuery);
  if (!existingSnap.empty) {
    throw new Error('An invitation already exists for this email');
  }

  // Create expiration date (7 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invitationData: any = {
    restaurantId,
    restaurantName,
    invitedBy,
    invitedByName,
    email: email.toLowerCase(),
    status: 'pending' as InvitationStatus,
    permissionTemplateId,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt)
  };

  if (additionalInfo?.firstname) invitationData.firstname = additionalInfo.firstname;
  if (additionalInfo?.lastname) invitationData.lastname = additionalInfo.lastname;
  if (additionalInfo?.phone) invitationData.phone = additionalInfo.phone;

  const docRef = await addDoc(
    collection(db, 'restaurants', restaurantId, 'invitations'),
    invitationData
  );

  return {
    id: docRef.id,
    ...invitationData,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    expiresAt: { seconds: expiresAt.getTime() / 1000, nanoseconds: 0 }
  };
};

export const updateInvitationStatus = async (
  restaurantId: string,
  invitationId: string,
  status: InvitationStatus
): Promise<void> => {
  const invitationRef = doc(db, 'restaurants', restaurantId, 'invitations', invitationId);

  const updates: any = {
    status,
    updatedAt: serverTimestamp()
  };

  if (status === 'accepted') {
    updates.acceptedAt = serverTimestamp();
  }

  await updateDoc(invitationRef, updates);
};

export const cancelInvitation = async (
  restaurantId: string,
  invitationId: string
): Promise<void> => {
  await updateInvitationStatus(restaurantId, invitationId, 'rejected');
};

export const resendInvitation = async (
  restaurantId: string,
  invitationId: string
): Promise<void> => {
  const invitationRef = doc(db, 'restaurants', restaurantId, 'invitations', invitationId);

  // Extend expiration by 7 days
  const newExpiry = new Date();
  newExpiry.setDate(newExpiry.getDate() + 7);

  await updateDoc(invitationRef, {
    status: 'pending',
    expiresAt: Timestamp.fromDate(newExpiry),
    updatedAt: serverTimestamp()
  });
};

// ============================================================================
// INVITATION QUERIES
// ============================================================================

export const getInvitationByEmail = async (
  restaurantId: string,
  email: string
): Promise<Invitation | null> => {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'invitations'),
    where('email', '==', email.toLowerCase()),
    where('status', '==', 'pending')
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }

  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data()
  } as Invitation;
};

export const getInvitationById = async (
  restaurantId: string,
  invitationId: string
): Promise<Invitation | null> => {
  const invitationRef = doc(db, 'restaurants', restaurantId, 'invitations', invitationId);
  const invitationSnap = await getDoc(invitationRef);

  if (!invitationSnap.exists()) {
    return null;
  }

  return {
    id: invitationSnap.id,
    ...invitationSnap.data()
  } as Invitation;
};

export const getPendingInvitationsForUser = async (
  email: string
): Promise<Invitation[]> => {
  // This requires a collection group query across all restaurants
  // Note: Requires a composite index on invitations collection group
  const q = query(
    collection(db, 'invitations'),
    where('email', '==', email.toLowerCase()),
    where('status', '==', 'pending')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Invitation[];
};

export const cleanupExpiredInvitations = async (
  restaurantId: string
): Promise<number> => {
  const now = Timestamp.now();

  const q = query(
    collection(db, 'restaurants', restaurantId, 'invitations'),
    where('status', '==', 'pending'),
    where('expiresAt', '<', now)
  );

  const snapshot = await getDocs(q);
  const batch = writeBatch(db);

  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, {
      status: 'expired',
      updatedAt: serverTimestamp()
    });
  });

  await batch.commit();
  return snapshot.size;
};
