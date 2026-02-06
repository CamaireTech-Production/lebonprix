// Matiere service - extracted from firestore.ts
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError, logWarning } from '@utils/core/logger';
import type { Matiere, FinanceEntry, StockBatch, EmployeeRef } from '../../../types/models';
import { createAuditLog } from '../shared';
import { createStockChange } from '../stock/stockService';

// ============================================================================
// MATIERE SUBSCRIPTIONS
// ============================================================================

export const subscribeToMatieres = (companyId: string, callback: (matieres: Matiere[]) => void, limitCount?: number): (() => void) => {
  if (!companyId) {
    callback([]);
    return () => { }; // Return empty cleanup function
  }

  try {
    const defaultLimit = 100; // OPTIMIZATION: Default limit to reduce Firebase reads
    const q = query(
      collection(db, 'matieres'),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc'),
      limit(limitCount || defaultLimit)
    );

    let isActive = true;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!isActive) return; // Prevent callback after cleanup
        try {
          const matieres = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Matiere[];
          callback(matieres.filter(matiere => matiere.isDeleted !== true));
        } catch (error) {
          logError('Error processing matieres snapshot', error);
          if (isActive) callback([]);
        }
      },
      (error) => {
        if (!isActive) return; // Prevent callback after cleanup
        logError('Error subscribing to matieres', error);
        callback([]);
      }
    );

    // Return cleanup function that marks as inactive
    return () => {
      isActive = false;
      try {
        unsubscribe();
      } catch (error) {
        // Ignore cleanup errors
      }
    };
  } catch (error) {
    logError('Error setting up matieres subscription', error);
    callback([]);
    return () => { }; // Return empty cleanup function
  }
};

// ============================================================================
// MATIERE CRUD OPERATIONS
// ============================================================================

export const createMatiere = async (
  data: Omit<Matiere, 'id' | 'createdAt' | 'updatedAt'>,
  companyId: string,
  initialStock: number = 0,
  costPrice?: number,
  supplierInfo?: {
    supplierId?: string;
    isOwnPurchase?: boolean;
    isCredit?: boolean;
  },
  createdBy?: EmployeeRef | null
): Promise<Matiere> => {
  try {
    if (!data.name) {
      throw new Error('Invalid matiere data: name is required');
    }

    // Validate category if provided
    if (data.refCategorie) {
      const categoryQuery = query(
        collection(db, 'categories'),
        where('name', '==', data.refCategorie),
        where('companyId', '==', companyId),
        where('type', '==', 'matiere'),
        where('isActive', '==', true)
      );
      const categorySnapshot = await getDocs(categoryQuery);

      if (categorySnapshot.empty) {
        throw new Error(`Category "${data.refCategorie}" not found`);
      }
    }

    const batch = writeBatch(db);

    const userId = data.userId || companyId;

    const matiereRef = doc(collection(db, 'matieres'));

    // Build matiereData object, excluding undefined values (Firestore doesn't support undefined)
    const matiereData: Partial<Matiere> = {
      name: data.name,
      refStock: data.refStock || '',
      companyId,
      userId,
      isDeleted: false,
      costPrice: costPrice || 0,
      createdAt: serverTimestamp() as any, // Cast for Firestore Timestamp vs Model Timestamp
      updatedAt: serverTimestamp() as any
    };

    // Only include optional fields if they have values
    if (data.refCategorie) {
      matiereData.refCategorie = data.refCategorie;
    }
    if (data.description) {
      matiereData.description = data.description;
    }
    if (data.unit) {
      matiereData.unit = data.unit;
    }
    if (data.images && data.images.length > 0) {
      matiereData.images = data.images;
    }
    if (data.imagePaths && data.imagePaths.length > 0) {
      matiereData.imagePaths = data.imagePaths;
    }
    if (createdBy) {
      matiereData.createdBy = createdBy;
    }

    batch.set(matiereRef, matiereData);

    // Create stock batch if initial stock provided (batches are the single source of truth)
    if (initialStock > 0 && costPrice && costPrice > 0) {
      const stockBatchRef = doc(collection(db, 'stockBatches'));
      const stockBatchData: Partial<StockBatch> = {
        id: stockBatchRef.id,
        type: 'matiere' as const, // Always matiere for matiere batches
        matiereId: matiereRef.id,
        quantity: initialStock,
        costPrice,
        remainingQuantity: initialStock,
        status: 'active',
        userId,
        companyId,
        createdAt: serverTimestamp() as any
      };

      if (supplierInfo?.supplierId) stockBatchData.supplierId = supplierInfo.supplierId;
      if (supplierInfo?.isOwnPurchase !== undefined) stockBatchData.isOwnPurchase = supplierInfo.isOwnPurchase;
      if (supplierInfo?.isCredit !== undefined) stockBatchData.isCredit = supplierInfo.isCredit;

      batch.set(stockBatchRef, stockBatchData);

      createStockChange(
        batch,
        matiereRef.id,
        initialStock,
        'creation',
        userId,
        companyId,
        'matiere', // Set type to matiere
        supplierInfo?.supplierId,
        supplierInfo?.isOwnPurchase,
        supplierInfo?.isCredit,
        costPrice,
        stockBatchRef.id,
        undefined,
        undefined
      );

      const financeRef = doc(collection(db, 'finances'));
      const financeData = {
        id: financeRef.id,
        userId,
        companyId,
        sourceType: 'matiere' as const,
        sourceId: matiereRef.id,
        type: 'matiere_purchase',
        amount: -Math.abs(initialStock * costPrice),
        description: `Achat initial de ${initialStock} ${data.unit || 'unité'} de ${data.name}`,
        date: serverTimestamp(),
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(financeRef, financeData);

      if (supplierInfo?.supplierId && supplierInfo.isCredit === true && supplierInfo.isOwnPurchase === false) {
        const debtAmount = initialStock * costPrice;
        const debtRef = doc(collection(db, 'finances'));
        const debtData = {
          id: debtRef.id,
          userId,
          companyId,
          sourceType: 'supplier' as const,
          sourceId: supplierInfo.supplierId,
          type: 'supplier_debt',
          amount: debtAmount,
          description: `Achat crédit de ${initialStock} ${data.unit || 'unité'} de ${data.name}`,
          date: serverTimestamp(),
          isDeleted: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          supplierId: supplierInfo.supplierId,
          batchId: stockBatchRef.id
        };
        batch.set(debtRef, debtData);
      }
    } else if (initialStock > 0) {
      createStockChange(
        batch,
        matiereRef.id,
        initialStock,
        'creation',
        userId,
        companyId,
        'matiere', // Set type to matiere
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
    }

    createAuditLog(batch, 'create', 'matiere', matiereRef.id, matiereData, userId);

    await batch.commit();

    // Update category count only if category is provided
    if (data.refCategorie) {
      try {
        await updateCategoryMatiereCount(data.refCategorie, companyId, true);
      } catch (error) {
        logError('Error updating category matiere count', error);
      }
    }

    return {
      id: matiereRef.id,
      ...matiereData,
      createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
      updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
    } as Matiere;
  } catch (error) {
    logError('Error creating matiere', error);
    throw error;
  }
};

export const updateMatiere = async (
  id: string,
  data: Partial<Matiere>,
  companyId: string
): Promise<void> => {
  try {
    const batch = writeBatch(db);
    const matiereRef = doc(db, 'matieres', id);

    const matiereSnap = await getDoc(matiereRef);
    if (!matiereSnap.exists()) {
      throw new Error('Matiere not found');
    }

    const currentMatiere = matiereSnap.data() as Matiere;
    if (currentMatiere.companyId !== companyId) {
      throw new Error('Unauthorized: Matiere belongs to different company');
    }

    const userId = currentMatiere.userId || companyId;

    if (data.refCategorie && data.refCategorie !== currentMatiere.refCategorie) {
      if (currentMatiere.refCategorie) {
        try {
          await updateCategoryMatiereCount(currentMatiere.refCategorie, companyId, false);
        } catch (error) {
          logError('Error updating old category matiere count', error);
        }
      }

      const categoryQuery = query(
        collection(db, 'categories'),
        where('name', '==', data.refCategorie),
        where('companyId', '==', companyId),
        where('type', '==', 'matiere'),
        where('isActive', '==', true)
      );
      const categorySnapshot = await getDocs(categoryQuery);

      if (categorySnapshot.empty) {
        throw new Error(`Category "${data.refCategorie}" not found`);
      }
    }

    // Build updateData object, excluding undefined values (Firestore doesn't support undefined)
    const updateData: Partial<Matiere> = {
      updatedAt: serverTimestamp() as any
    };

    // Only include fields that are actually provided (not undefined)
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

    if (data.refCategorie && data.refCategorie !== currentMatiere.refCategorie) {
      try {
        await updateCategoryMatiereCount(data.refCategorie, companyId, true);
      } catch (error) {
        logError('Error updating new category matiere count', error);
      }
    }
  } catch (error) {
    logError('Error updating matiere', error);
    throw error;
  }
};

export const deleteMatiere = async (id: string, companyId: string): Promise<void> => {
  try {
    const batch = writeBatch(db);
    const matiereRef = doc(db, 'matieres', id);

    const matiereSnap = await getDoc(matiereRef);
    if (!matiereSnap.exists()) {
      throw new Error('Matiere not found');
    }

    const currentMatiere = matiereSnap.data() as Matiere;
    if (currentMatiere.companyId !== companyId) {
      throw new Error('Unauthorized: Matiere belongs to different company');
    }

    const userId = currentMatiere.userId || companyId;

    // Delete all related stock batches (batches are the single source of truth)
    const batchesQuery = query(
      collection(db, 'stockBatches'),
      where('type', '==', 'matiere'),
      where('matiereId', '==', id)
    );
    const batchesSnapshot = await getDocs(batchesQuery);
    batchesSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    const stockChangesQuery = query(
      collection(db, 'stockChanges'),
      where('type', '==', 'matiere'),
      where('matiereId', '==', id)
    );
    const stockChangesSnapshot = await getDocs(stockChangesQuery);
    stockChangesSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    batch.delete(matiereRef);

    createAuditLog(batch, 'delete', 'matiere', id, currentMatiere, userId);

    await batch.commit();

    if (currentMatiere.refCategorie) {
      try {
        await updateCategoryMatiereCount(currentMatiere.refCategorie, companyId, false);
      } catch (error) {
        logError('Error updating category matiere count after deletion', error);
      }
    }
  } catch (error) {
    logError('Error deleting matiere', error);
    throw error;
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const updateCategoryMatiereCount = async (categoryName: string, companyId: string, increment: boolean = true): Promise<void> => {
  if (!categoryName || !companyId) return;

  try {
    const q = query(
      collection(db, 'categories'),
      where('name', '==', categoryName),
      where('companyId', '==', companyId),
      where('type', '==', 'matiere'),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      logWarning('Category not found for company');
      return;
    }

    const categoryDoc = snapshot.docs[0];
    const currentCount = categoryDoc.data().matiereCount || 0;
    const newCount = increment ? currentCount + 1 : Math.max(0, currentCount - 1);

    await updateDoc(categoryDoc.ref, {
      matiereCount: newCount,
      updatedAt: serverTimestamp()
    });

  } catch (error) {
    console.error('Error updating category matiere count:', error);
  }
};

export const createMatiereFinanceEntry = async (
  matiereId: string,
  quantity: number,
  costPrice: number,
  userId: string,
  companyId: string,
  description: string
): Promise<FinanceEntry> => {
  const { createFinanceEntry } = await import('../finance/financeService');

  const entry: Omit<FinanceEntry, 'id' | 'createdAt' | 'updatedAt'> = {
    userId,
    companyId,
    sourceType: 'matiere',
    sourceId: matiereId,
    type: 'matiere_purchase',
    amount: -Math.abs(quantity * costPrice),
    description,
    date: Timestamp.now(),
    isDeleted: false,
  };

  return createFinanceEntry(entry);
};

