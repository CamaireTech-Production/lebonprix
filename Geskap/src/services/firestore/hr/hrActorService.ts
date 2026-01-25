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
  Timestamp
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError } from '@utils/core/logger';
import type { HRActor, HRActorStatus } from '../../../types/models';

const HR_ACTORS_COLLECTION = 'hrActors';

/**
 * Generate a unique ID for HR Actor
 */
const generateHRActorId = (): string => {
  return `hra_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create a new HR Actor
 */
export async function createHRActor(
  companyId: string,
  createdBy: string,
  data: Omit<HRActor, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'createdBy'>
): Promise<HRActor> {
  try {
    const id = generateHRActorId();
    const ref = doc(db, HR_ACTORS_COLLECTION, id);

    const hrActor: HRActor = {
      id,
      companyId,
      firstName: data.firstName,
      lastName: data.lastName,
      displayName: `${data.firstName} ${data.lastName}`,
      email: data.email,
      phone: data.phone,
      photo: data.photo,
      actorType: data.actorType,
      customActorType: data.customActorType,
      department: data.department,
      position: data.position,
      hireDate: data.hireDate,
      endDate: data.endDate,
      salary: data.salary,
      salaryFrequency: data.salaryFrequency,
      contractType: data.contractType,
      address: data.address,
      city: data.city,
      country: data.country,
      emergencyContact: data.emergencyContact,
      status: data.status || 'active',
      linkedUserId: data.linkedUserId,
      createdBy,
      createdAt: serverTimestamp() as unknown as import('../../../types/models').Timestamp,
      updatedAt: serverTimestamp() as unknown as import('../../../types/models').Timestamp,
    };

    // Remove undefined values to avoid Firestore errors
    const cleanedActor = Object.fromEntries(
      Object.entries(hrActor).filter(([_, value]) => value !== undefined)
    ) as HRActor;

    await setDoc(ref, cleanedActor);
    return cleanedActor;
  } catch (error) {
    logError('Error creating HR Actor', error);
    throw error;
  }
}

/**
 * Get all HR Actors for a company
 */
export async function getHRActors(companyId: string): Promise<HRActor[]> {
  try {
    const q = query(
      collection(db, HR_ACTORS_COLLECTION),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as HRActor);
  } catch (error) {
    logError('Error fetching HR Actors', error);
    throw error;
  }
}

/**
 * Get HR Actors by status
 */
export async function getHRActorsByStatus(
  companyId: string,
  status: HRActorStatus
): Promise<HRActor[]> {
  try {
    const q = query(
      collection(db, HR_ACTORS_COLLECTION),
      where('companyId', '==', companyId),
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as HRActor);
  } catch (error) {
    logError(`Error fetching HR Actors with status ${status}`, error);
    throw error;
  }
}

/**
 * Get a single HR Actor by ID
 */
export async function getHRActorById(actorId: string): Promise<HRActor | null> {
  try {
    const ref = doc(db, HR_ACTORS_COLLECTION, actorId);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as HRActor) : null;
  } catch (error) {
    logError('Error fetching HR Actor by ID', error);
    throw error;
  }
}

/**
 * Update an HR Actor
 */
export async function updateHRActor(
  actorId: string,
  updates: Partial<Omit<HRActor, 'id' | 'companyId' | 'createdAt' | 'createdBy'>>
): Promise<void> {
  try {
    const ref = doc(db, HR_ACTORS_COLLECTION, actorId);

    // Update displayName if firstName or lastName changed
    const updateData: any = {
      ...updates,
      updatedAt: serverTimestamp(),
    };

    if (updates.firstName || updates.lastName) {
      const existingActor = await getHRActorById(actorId);
      if (existingActor) {
        const firstName = updates.firstName || existingActor.firstName;
        const lastName = updates.lastName || existingActor.lastName;
        updateData.displayName = `${firstName} ${lastName}`;
      }
    }

    // Remove undefined values
    const cleanedUpdates = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    );

    await updateDoc(ref, cleanedUpdates);
  } catch (error) {
    logError('Error updating HR Actor', error);
    throw error;
  }
}

/**
 * Archive an HR Actor (soft delete)
 */
export async function archiveHRActor(
  actorId: string,
  archivedBy: string
): Promise<void> {
  try {
    const ref = doc(db, HR_ACTORS_COLLECTION, actorId);
    await updateDoc(ref, {
      status: 'archived',
      archivedAt: serverTimestamp(),
      archivedBy,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logError('Error archiving HR Actor', error);
    throw error;
  }
}

/**
 * Restore an archived HR Actor
 */
export async function restoreHRActor(actorId: string): Promise<void> {
  try {
    const ref = doc(db, HR_ACTORS_COLLECTION, actorId);
    await updateDoc(ref, {
      status: 'active',
      archivedAt: null,
      archivedBy: null,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logError('Error restoring HR Actor', error);
    throw error;
  }
}

/**
 * Permanently delete an HR Actor
 * Use with caution - prefer archiving instead
 */
export async function deleteHRActor(actorId: string): Promise<void> {
  try {
    const ref = doc(db, HR_ACTORS_COLLECTION, actorId);
    await deleteDoc(ref);
  } catch (error) {
    logError('Error deleting HR Actor', error);
    throw error;
  }
}

/**
 * Subscribe to HR Actors changes in real-time
 */
export function subscribeToHRActors(
  companyId: string,
  callback: (actors: HRActor[]) => void
): Unsubscribe {
  const q = query(
    collection(db, HR_ACTORS_COLLECTION),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const actors: HRActor[] = snapshot.docs.map(doc => doc.data() as HRActor);
      callback(actors);
    },
    (error) => {
      logError(`Error in subscribeToHRActors listener for company ${companyId}`, error);
    }
  );
}

/**
 * Subscribe to HR Actors by status in real-time
 */
export function subscribeToHRActorsByStatus(
  companyId: string,
  status: HRActorStatus,
  callback: (actors: HRActor[]) => void
): Unsubscribe {
  const q = query(
    collection(db, HR_ACTORS_COLLECTION),
    where('companyId', '==', companyId),
    where('status', '==', status),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const actors: HRActor[] = snapshot.docs.map(doc => doc.data() as HRActor);
      callback(actors);
    },
    (error) => {
      logError(`Error in subscribeToHRActorsByStatus listener for company ${companyId}`, error);
    }
  );
}

/**
 * Search HR Actors by name or phone
 */
export async function searchHRActors(
  companyId: string,
  searchTerm: string
): Promise<HRActor[]> {
  try {
    // Firestore doesn't support full-text search, so we fetch all and filter client-side
    const actors = await getHRActors(companyId);
    const term = searchTerm.toLowerCase();

    return actors.filter(actor => {
      const fullName = `${actor.firstName} ${actor.lastName}`.toLowerCase();
      const phone = actor.phone?.toLowerCase() || '';
      const email = actor.email?.toLowerCase() || '';
      return fullName.includes(term) || phone.includes(term) || email.includes(term);
    });
  } catch (error) {
    logError('Error searching HR Actors', error);
    throw error;
  }
}

/**
 * Get count of HR Actors by status
 */
export async function getHRActorCounts(companyId: string): Promise<{
  active: number;
  inactive: number;
  archived: number;
  total: number;
}> {
  try {
    const actors = await getHRActors(companyId);
    return {
      active: actors.filter(a => a.status === 'active').length,
      inactive: actors.filter(a => a.status === 'inactive').length,
      archived: actors.filter(a => a.status === 'archived').length,
      total: actors.length,
    };
  } catch (error) {
    logError('Error getting HR Actor counts', error);
    throw error;
  }
}

/**
 * Link an HR Actor to a Firebase user
 */
export async function linkHRActorToUser(
  actorId: string,
  userId: string
): Promise<void> {
  try {
    const ref = doc(db, HR_ACTORS_COLLECTION, actorId);
    await updateDoc(ref, {
      linkedUserId: userId,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logError('Error linking HR Actor to user', error);
    throw error;
  }
}

/**
 * Unlink an HR Actor from a Firebase user
 */
export async function unlinkHRActorFromUser(actorId: string): Promise<void> {
  try {
    const ref = doc(db, HR_ACTORS_COLLECTION, actorId);
    await updateDoc(ref, {
      linkedUserId: null,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logError('Error unlinking HR Actor from user', error);
    throw error;
  }
}
