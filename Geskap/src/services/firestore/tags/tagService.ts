// Tag service - extracted from firestore.ts
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
  writeBatch
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import type { ProductTag } from '../../../types/models';
import { createAuditLog } from '../shared';

// ============================================================================
// TAG SUBSCRIPTIONS
// ============================================================================

export const subscribeToUserTags = (userId: string, callback: (tags: ProductTag[]) => void): (() => void) => {
  const q = query(
    collection(db, 'userTags'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const tags = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ProductTag[];
    callback(tags);
  });
};

// ============================================================================
// TAG CRUD OPERATIONS
// ============================================================================

export const createUserTag = async (
  data: Omit<ProductTag, 'id'>,
  userId: string
): Promise<ProductTag> => {
  const batch = writeBatch(db);
  
  const tagRef = doc(collection(db, 'userTags'));
  const tagData: any = {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  batch.set(tagRef, tagData);
  
  createAuditLog(batch, 'create', 'product', tagRef.id, tagData, userId);
  
  await batch.commit();
  
  return {
    id: tagRef.id,
    name: data.name,
    variations: data.variations
  } as ProductTag;
};

export const updateUserTag = async (
  id: string,
  data: Partial<ProductTag>,
  userId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const tagRef = doc(db, 'userTags', id);
  
  const tagSnap = await getDoc(tagRef);
  if (!tagSnap.exists()) {
    throw new Error('Tag not found');
  }
  
  const tagData = tagSnap.data() as ProductTag & { userId?: string };
  if (tagData.userId && tagData.userId !== userId) {
    throw new Error('Unauthorized to update this tag');
  }
  
  const updateData = {
    ...data,
    updatedAt: serverTimestamp()
  };
  batch.update(tagRef, updateData);
  
  createAuditLog(batch, 'update', 'product', id, updateData, userId);
  
  await batch.commit();
};

export const deleteUserTag = async (tagId: string, userId: string): Promise<void> => {
  const batch = writeBatch(db);
  const tagRef = doc(db, 'userTags', tagId);
  
  const tagSnap = await getDoc(tagRef);
  if (!tagSnap.exists()) {
    throw new Error('Tag not found');
  }
  
  const tagData = tagSnap.data() as ProductTag & { userId?: string };
  if (tagData.userId && tagData.userId !== userId) {
    throw new Error('Unauthorized to delete this tag');
  }
  
  batch.delete(tagRef);
  
  createAuditLog(batch, 'delete', 'product', tagId, tagData, userId);
  
  await batch.commit();
};

export const getUserTags = async (userId: string): Promise<ProductTag[]> => {
  const q = query(
    collection(db, 'userTags'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as ProductTag[];
};

