// Charge service - Unified charge management (company-scoped, no productionId)
import type { Charge } from '../../../types/models';
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
  updateDoc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError } from '@utils/core/logger';
import { createAuditLog } from '../shared';
import { createFinanceEntry } from '../finance/financeService';

const COLLECTION_NAME = 'charges';

// ============================================================================
// CHARGE SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to all charges for a company (both fixed and custom)
 */
export const subscribeToCharges = (
  companyId: string,
  callback: (charges: Charge[]) => void
): (() => void) => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const charges = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Charge[];
      callback(charges);
    },
    (error) => {
      logError('Error subscribing to charges', error);
      callback([]);
    }
  );
};

/**
 * Subscribe to fixed charges for a company (type="fixed")
 */
export const subscribeToFixedCharges = (
  companyId: string,
  callback: (charges: Charge[]) => void
): (() => void) => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('companyId', '==', companyId),
    where('type', '==', 'fixed'),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const charges = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Charge[];
      callback(charges);
    },
    (error) => {
      logError('Error subscribing to fixed charges', error);
      callback([]);
    }
  );
};

/**
 * Subscribe to custom charges for a company (type="custom")
 */
export const subscribeToCustomCharges = (
  companyId: string,
  callback: (charges: Charge[]) => void
): (() => void) => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('companyId', '==', companyId),
    where('type', '==', 'custom'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const charges = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Charge[];
      callback(charges);
    },
    (error) => {
      logError('Error subscribing to custom charges', error);
      callback([]);
    }
  );
};

// ============================================================================
// CHARGE CRUD OPERATIONS
// ============================================================================

/**
 * Create a new charge (fixed or custom)
 */
export const createCharge = async (
  data: Omit<Charge, 'id' | 'createdAt' | 'updatedAt'>,
  companyId: string,
  createdBy?: import('../../../types/models').EmployeeRef | null
): Promise<Charge> => {
  try {
    // Validate charge data
    if (!data.name || data.name.trim() === '') {
      throw new Error('Charge name is required');
    }

    if (!data.amount || data.amount <= 0) {
      throw new Error('Charge amount must be greater than 0');
    }

    if (!data.type || (data.type !== 'fixed' && data.type !== 'custom')) {
      throw new Error('Charge type must be either "fixed" or "custom"');
    }

    const batch = writeBatch(db);

    // Prepare date
    let chargeDate: any;
    if (data.date) {
      if (data.date instanceof Date) {
        chargeDate = Timestamp.fromDate(data.date);
      } else if (data.date.seconds) {
        chargeDate = data.date;
      } else {
        chargeDate = Timestamp.fromDate(new Date(data.date as any));
      }
    } else {
      chargeDate = serverTimestamp();
    }

    const userId = data.userId || companyId;

    // Build chargeData object, excluding undefined values
    // Build chargeData object, explicitly setting each field to avoid undefined values
    const chargeData: any = {
      name: data.name.trim(),
      type: data.type,
      amount: data.amount,
      date: chargeDate,
      companyId,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Only include description if provided and not empty
    if (data.description && data.description.trim()) {
      chargeData.description = data.description.trim();
    }

    // Category: use provided value or default to 'other', but always include it
    chargeData.category = (data.category && data.category.trim()) ? data.category.trim() : 'other';

    // Include isActive for fixed charges
    if (data.type === 'fixed') {
      chargeData.isActive = data.isActive !== undefined ? data.isActive : true;
    }

    // Add createdBy if provided
    if (createdBy) {
      chargeData.createdBy = createdBy;
    }

    // Set isActive for fixed charges (default true)
    if (data.type === 'fixed' && data.isActive === undefined) {
      chargeData.isActive = true;
    }

    const chargeRef = doc(collection(db, COLLECTION_NAME));
    batch.set(chargeRef, chargeData);

    // Create FinanceEntry for this charge (optional - can be disabled)
    let financeEntryId: string | undefined;
    try {
      const financeEntry = await createFinanceEntry({
        userId,
        companyId,
        sourceType: 'expense',
        sourceId: chargeRef.id,
        type: `charge_${data.type}_${data.category}`,
        amount: -Math.abs(data.amount), // Negative for expenses
        description: `Charge: ${data.description}`,
        date: chargeDate,
        isDeleted: false
      });
      financeEntryId = financeEntry.id;

      // Link finance entry to charge
      batch.update(chargeRef, {
        financeEntryId
      });
    } catch (error) {
      // Finance entry creation is optional, log but don't fail
      logError('Error creating finance entry for charge', error);
    }

    // Create audit log
    createAuditLog(batch, 'create', 'charge', chargeRef.id, chargeData, userId);

    await batch.commit();

    const now = Date.now() / 1000;
    const result: Charge = {
      id: chargeRef.id,
      name: data.name.trim(),
      type: data.type,
      amount: data.amount,
      date: chargeDate,
      financeEntryId: financeEntryId,
      companyId,
      userId,
      createdAt: { seconds: now, nanoseconds: 0 },
      updatedAt: { seconds: now, nanoseconds: 0 },
      category: (data.category && data.category.trim()) ? data.category.trim() : 'other'
    };

    // Only include description if provided
    if (data.description && data.description.trim()) {
      result.description = data.description.trim();
    }

    // Include createdBy if provided
    if (createdBy) {
      result.createdBy = createdBy;
    }

    // Include isActive for fixed charges
    if (data.type === 'fixed') {
      result.isActive = data.isActive !== undefined ? data.isActive : true;
    }

    return result;
  } catch (error) {
    logError('Error creating charge', error);
    throw error;
  }
};

/**
 * Update an existing charge
 */
export const updateCharge = async (
  id: string,
  data: Partial<Charge>,
  companyId: string
): Promise<void> => {
  try {
    const chargeRef = doc(db, COLLECTION_NAME, id);
    const chargeSnap = await getDoc(chargeRef);

    if (!chargeSnap.exists()) {
      throw new Error('Charge not found');
    }

    const currentData = chargeSnap.data() as Charge;
    if (currentData.companyId !== companyId) {
      throw new Error('Unauthorized: Charge belongs to different company');
    }

    const batch = writeBatch(db);

    // Build updateData object, excluding undefined values
    const updateData: any = {
      updatedAt: serverTimestamp()
    };

    // Only include fields that are actually provided (not undefined)
    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.description !== undefined) {
      // Only include description if it's not empty
      if (data.description.trim()) {
        updateData.description = data.description.trim();
      } else {
        // If description is explicitly set to empty, we can delete it or leave it empty
        // For now, we'll set it to empty string (Firestore allows empty strings)
        updateData.description = '';
      }
    }
    if (data.amount !== undefined) {
      updateData.amount = data.amount;
    }
    if (data.category !== undefined) {
      updateData.category = data.category.trim() || 'other';
    }
    if (data.type !== undefined) {
      updateData.type = data.type;
    }
    if (data.isActive !== undefined && data.type === 'fixed') {
      updateData.isActive = data.isActive;
    }

    // Handle date conversion if provided
    if (data.date) {
      if (data.date instanceof Date) {
        updateData.date = Timestamp.fromDate(data.date);
      } else if (data.date.seconds) {
        updateData.date = data.date;
      } else {
        updateData.date = Timestamp.fromDate(new Date(data.date as any));
      }
    }

    // Update FinanceEntry if amount changed
    if (data.amount !== undefined && currentData.financeEntryId) {
      try {
        const { updateFinanceEntry } = await import('../finance/financeService');
        await updateFinanceEntry(currentData.financeEntryId, {
          amount: -Math.abs(data.amount),
          description: data.description ? `Charge: ${data.description}` : undefined
        });
      } catch (error) {
        logError('Error updating finance entry for charge', error);
      }
    }

    // Remove undefined fields
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    batch.update(chargeRef, updateData);

    // Create audit log
    const auditUserId = currentData.userId || companyId;
    createAuditLog(batch, 'update', 'charge', id, updateData, auditUserId);

    await batch.commit();
  } catch (error) {
    logError('Error updating charge', error);
    throw error;
  }
};

/**
 * Delete a charge
 */
export const deleteCharge = async (
  id: string,
  companyId: string
): Promise<void> => {
  try {
    const chargeRef = doc(db, COLLECTION_NAME, id);
    const chargeSnap = await getDoc(chargeRef);

    if (!chargeSnap.exists()) {
      throw new Error('Charge not found');
    }

    const currentData = chargeSnap.data() as Charge;
    if (currentData.companyId !== companyId) {
      throw new Error('Unauthorized: Charge belongs to different company');
    }

    const batch = writeBatch(db);

    // Soft delete FinanceEntry if exists
    if (currentData.financeEntryId) {
      try {
        const { softDeleteFinanceEntry } = await import('../finance/financeService');
        await softDeleteFinanceEntry(currentData.financeEntryId);
      } catch (error) {
        logError('Error soft deleting finance entry for charge', error);
      }
    }

    // Delete charge document
    batch.delete(chargeRef);

    // Create audit log
    const auditUserId = currentData.userId || companyId;
    createAuditLog(batch, 'delete', 'charge', id, {}, auditUserId);

    await batch.commit();
  } catch (error) {
    logError('Error deleting charge', error);
    throw error;
  }
};

/**
 * Get a single charge by ID
 */
export const getCharge = async (
  id: string,
  companyId: string
): Promise<Charge | null> => {
  try {
    const chargeRef = doc(db, COLLECTION_NAME, id);
    const chargeSnap = await getDoc(chargeRef);

    if (!chargeSnap.exists()) {
      return null;
    }

    const chargeData = chargeSnap.data() as Charge;
    if (chargeData.companyId !== companyId) {
      throw new Error('Unauthorized: Charge belongs to different company');
    }

    return {
      id: chargeSnap.id,
      ...chargeData
    };
  } catch (error) {
    logError('Error getting charge', error);
    throw error;
  }
};

// ============================================================================
// CHARGE QUERY FUNCTIONS
// ============================================================================

/**
 * Get all fixed charges for a company (active only)
 */
export const getFixedCharges = async (
  companyId: string
): Promise<Charge[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('companyId', '==', companyId),
      where('type', '==', 'fixed'),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as Charge[];
  } catch (error) {
    logError('Error getting fixed charges', error);
    throw error;
  }
};

/**
 * Get all custom charges for a company
 */
export const getCustomCharges = async (
  companyId: string
): Promise<Charge[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('companyId', '==', companyId),
      where('type', '==', 'custom'),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as Charge[];
  } catch (error) {
    logError('Error getting custom charges', error);
    throw error;
  }
};

/**
 * Get all charges for a company (both fixed and custom)
 */
export const getAllCharges = async (
  companyId: string
): Promise<Charge[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as Charge[];
  } catch (error) {
    logError('Error getting all charges', error);
    throw error;
  }
};

/**
 * Get charges by IDs (for fetching multiple charges at once)
 */
export const getChargesByIds = async (
  chargeIds: string[],
  companyId: string
): Promise<Charge[]> => {
  try {
    if (chargeIds.length === 0) {
      return [];
    }

    // Firestore 'in' query limit is 10, so we need to batch
    const batches: Promise<Charge[]>[] = [];
    for (let i = 0; i < chargeIds.length; i += 10) {
      const batch = chargeIds.slice(i, i + 10);
      const q = query(
        collection(db, COLLECTION_NAME),
        where('__name__', 'in', batch),
        where('companyId', '==', companyId)
      );
      
      batches.push(
        getDocs(q).then(snapshot =>
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
          })) as Charge[]
        )
      );
    }

    const results = await Promise.all(batches);
    return results.flat();
  } catch (error) {
    logError('Error getting charges by IDs', error);
    throw error;
  }
};

