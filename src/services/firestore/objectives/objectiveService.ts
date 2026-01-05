// Objective service - extracted from firestore.ts
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  getDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import type { Objective } from '../../../types/models';
import { createAuditLog } from '../shared';

// ============================================================================
// OBJECTIVE SUBSCRIPTIONS
// ============================================================================

export const subscribeToObjectives = (companyId: string, callback: (objectives: Objective[]) => void): (() => void) => {
  const q = query(
    collection(db, 'objectives'),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const objectives = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Objective[];
    callback(objectives);
  });
};

// ============================================================================
// OBJECTIVE CRUD OPERATIONS
// ============================================================================

export const createObjective = async (
  data: Omit<Objective, 'id' | 'createdAt' | 'updatedAt'>,
  companyId: string
): Promise<Objective> => {
  if (!data.title || !data.targetAmount || !data.metric) {
    throw new Error('Invalid objective data');
  }
  
  const userId = data.userId || companyId;
  const batch = writeBatch(db);
  
  const objectiveRef = doc(collection(db, 'objectives'));
  const objectiveData = {
    ...data,
    userId,
    companyId,
    isAvailable: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  batch.set(objectiveRef, objectiveData);
  
  createAuditLog(batch, 'create', 'objective', objectiveRef.id, objectiveData, userId);
  
  await batch.commit();
  
  return {
    id: objectiveRef.id,
    ...objectiveData,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  };
};

export const updateObjective = async (
  id: string,
  data: Partial<Objective>,
  companyId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const objectiveRef = doc(db, 'objectives', id);
  
  const objectiveSnap = await getDoc(objectiveRef);
  if (!objectiveSnap.exists()) {
    throw new Error('Objective not found');
  }
  
  const objective = objectiveSnap.data() as Objective;
  if (objective.companyId !== companyId) {
    throw new Error('Unauthorized: Objective belongs to different company');
  }
  
  const userId = objective.userId || companyId;
  
  const updateData = {
    ...data,
    updatedAt: serverTimestamp()
  };
  batch.update(objectiveRef, updateData);
  
  const changes = {
    oldValue: objective,
    newValue: { ...objective, ...updateData }
  };
  createAuditLog(batch, 'update', 'objective', id, changes, userId);
  
  await batch.commit();
};

export const deleteObjective = async (objectiveId: string, companyId: string): Promise<void> => {
  const batch = writeBatch(db);
  const objectiveRef = doc(db, 'objectives', objectiveId);
  const objectiveSnap = await getDoc(objectiveRef);
  if (!objectiveSnap.exists()) {
    throw new Error('Objective not found');
  }
  const objective = objectiveSnap.data() as Objective;
  if (objective.companyId !== companyId) {
    throw new Error('Unauthorized: Objective belongs to different company');
  }
  
  const userId = objective.userId || companyId;
  
  batch.update(objectiveRef, {
    isAvailable: false,
    updatedAt: serverTimestamp()
  });
  createAuditLog(batch, 'delete', 'objective', objectiveId, objective, userId);
  await batch.commit();
};

