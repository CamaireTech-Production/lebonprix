// Matiere (Ingredient) service for Restoflow
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
  updateDoc
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import type { Matiere, EmployeeRef, Category, Timestamp } from '../../../types/geskap';
import { createAuditLog } from '../shared';
import { createStockChange, createStockBatch } from '../stock/stockService';

// ============================================================================
// MATIERE SUBSCRIPTIONS
// ============================================================================

export const subscribeToMatieres = (
  restaurantId: string,
  callback: (matieres: Matiere[]) => void
): (() => void) => {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  let isActive = true;

  const q = query(
    collection(db, 'restaurants', restaurantId, 'matieres'),
    orderBy('createdAt', 'desc')
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    if (!isActive) return;
    const matieres = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(m => m.isDeleted !== true) as Matiere[];
    callback(matieres);
  }, (error) => {
    if (!isActive) return;
    console.error('Error in matieres subscription:', error);
    callback([]);
  });

  return () => {
    isActive = false;
    unsubscribe();
  };
};

// ============================================================================
// MATIERE CRUD OPERATIONS
// ============================================================================

export const createMatiere = async (
  data: Omit<Matiere, 'id' | 'createdAt' | 'updatedAt'>,
  restaurantId: string,
  initialStock: number = 0,
  costPrice?: number,
  supplierInfo?: {
    supplierId?: string;
    isOwnPurchase?: boolean;
    isCredit?: boolean;
  },
  createdBy?: EmployeeRef | null
): Promise<Matiere> => {
  if (!data.name) {
    throw new Error('Invalid matiere data: name is required');
  }

  const batch = writeBatch(db);
  const userId = data.userId || restaurantId;

  const matiereRef = doc(collection(db, 'restaurants', restaurantId, 'matieres'));

  const matiereData: any = {
    name: data.name,
    refStock: data.refStock || '',
    restaurantId,
    isDeleted: false,
    costPrice: costPrice || 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (data.refCategorie) matiereData.refCategorie = data.refCategorie;
  if (data.description) matiereData.description = data.description;
  if (data.unit) matiereData.unit = data.unit;
  if (data.images?.length) matiereData.images = data.images;
  if (data.imagePaths?.length) matiereData.imagePaths = data.imagePaths;
  if (createdBy) matiereData.createdBy = createdBy;

  batch.set(matiereRef, matiereData);

  // Create stock batch if initial stock provided
  if (initialStock > 0 && costPrice && costPrice > 0) {
    await createStockBatch(
      batch,
      'matiere',
      matiereRef.id,
      initialStock,
      costPrice,
      userId,
      restaurantId,
      supplierInfo
    );

    createStockChange(
      batch,
      restaurantId,
      matiereRef.id,
      initialStock,
      'creation',
      userId,
      'matiere',
      supplierInfo?.supplierId,
      supplierInfo?.isOwnPurchase,
      supplierInfo?.isCredit,
      costPrice
    );
  } else if (initialStock > 0) {
    createStockChange(
      batch,
      restaurantId,
      matiereRef.id,
      initialStock,
      'creation',
      userId,
      'matiere'
    );
  }

  createAuditLog(batch, 'create', 'matiere', matiereRef.id, matiereData, userId);

  await batch.commit();

  // Update category count
  if (data.refCategorie) {
    await updateCategoryMatiereCount(restaurantId, data.refCategorie, true);
  }

  return {
    id: matiereRef.id,
    ...matiereData,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  };
};

export const updateMatiere = async (
  id: string,
  data: Partial<Matiere>,
  restaurantId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const matiereRef = doc(db, 'restaurants', restaurantId, 'matieres', id);

  const matiereSnap = await getDoc(matiereRef);
  if (!matiereSnap.exists()) {
    throw new Error('Matiere not found');
  }

  const currentMatiere = matiereSnap.data() as Matiere;
  const userId = currentMatiere.userId || restaurantId;

  // Handle category change
  if (data.refCategorie && data.refCategorie !== currentMatiere.refCategorie) {
    if (currentMatiere.refCategorie) {
      await updateCategoryMatiereCount(restaurantId, currentMatiere.refCategorie, false);
    }
    await updateCategoryMatiereCount(restaurantId, data.refCategorie, true);
  }

  const updateData: any = {
    updatedAt: serverTimestamp()
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.refCategorie !== undefined) updateData.refCategorie = data.refCategorie;
  if (data.refStock !== undefined) updateData.refStock = data.refStock;
  if (data.unit !== undefined) updateData.unit = data.unit;
  if (data.costPrice !== undefined) updateData.costPrice = data.costPrice;
  if (data.images !== undefined) updateData.images = data.images;
  if (data.imagePaths !== undefined) updateData.imagePaths = data.imagePaths;
  if (data.isDeleted !== undefined) updateData.isDeleted = data.isDeleted;

  batch.update(matiereRef, updateData);
  createAuditLog(batch, 'update', 'matiere', id, updateData, userId);

  await batch.commit();
};

export const softDeleteMatiere = async (
  id: string,
  restaurantId: string
): Promise<void> => {
  await updateMatiere(id, { isDeleted: true }, restaurantId);
};

export const deleteMatiere = async (
  id: string,
  restaurantId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const matiereRef = doc(db, 'restaurants', restaurantId, 'matieres', id);

  const matiereSnap = await getDoc(matiereRef);
  if (!matiereSnap.exists()) {
    throw new Error('Matiere not found');
  }

  const currentMatiere = matiereSnap.data() as Matiere;
  const userId = currentMatiere.userId || restaurantId;

  // Delete related stock batches
  const batchesQuery = query(
    collection(db, 'restaurants', restaurantId, 'stockBatches'),
    where('type', '==', 'matiere'),
    where('matiereId', '==', id)
  );
  const batchesSnapshot = await getDocs(batchesQuery);
  batchesSnapshot.docs.forEach(doc => batch.delete(doc.ref));

  // Delete stock changes
  const stockChangesQuery = query(
    collection(db, 'restaurants', restaurantId, 'stockChanges'),
    where('type', '==', 'matiere'),
    where('matiereId', '==', id)
  );
  const stockChangesSnapshot = await getDocs(stockChangesQuery);
  stockChangesSnapshot.docs.forEach(doc => batch.delete(doc.ref));

  batch.delete(matiereRef);
  createAuditLog(batch, 'delete', 'matiere', id, currentMatiere, userId);

  await batch.commit();

  // Update category count
  if (currentMatiere.refCategorie) {
    await updateCategoryMatiereCount(restaurantId, currentMatiere.refCategorie, false);
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const updateCategoryMatiereCount = async (
  restaurantId: string,
  categoryName: string,
  increment: boolean = true
): Promise<void> => {
  if (!categoryName || !restaurantId) return;

  const q = query(
    collection(db, 'restaurants', restaurantId, 'categories'),
    where('name', '==', categoryName),
    where('type', '==', 'matiere'),
    where('isActive', '==', true)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    console.warn('Category not found for restaurant');
    return;
  }

  const categoryDoc = snapshot.docs[0];
  const currentCount = categoryDoc.data().matiereCount || 0;
  const newCount = increment ? currentCount + 1 : Math.max(0, currentCount - 1);

  await updateDoc(categoryDoc.ref, {
    matiereCount: newCount,
    updatedAt: serverTimestamp()
  });
};
