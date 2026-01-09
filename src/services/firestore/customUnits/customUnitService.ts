// Custom Unit service - Manage custom units per company
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
  Timestamp
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError, logWarning } from '@utils/core/logger';
import type { CustomUnit } from '../../../types/models';
import { createAuditLog } from '../shared';
import { UNITS } from '@utils/core/units';

// ============================================================================
// CUSTOM UNIT SUBSCRIPTIONS
// ============================================================================

export const subscribeToCustomUnits = (
  companyId: string,
  callback: (units: CustomUnit[]) => void
): (() => void) => {
  const q = query(
    collection(db, 'customUnits'),
    where('companyId', '==', companyId),
    orderBy('label', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const units = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter((unit) => unit.isDeleted !== true) as CustomUnit[];
      callback(units);
    },
    (error) => {
      logError('Error subscribing to custom units', error);
      callback([]);
    }
  );
};

// ============================================================================
// CUSTOM UNIT CRUD OPERATIONS
// ============================================================================

export const createCustomUnit = async (
  data: Omit<CustomUnit, 'id' | 'createdAt' | 'updatedAt'>,
  companyId: string,
  createdBy?: import('../../../types/models').EmployeeRef | null
): Promise<CustomUnit> => {
  try {
    // Validate required fields
    if (!data.value || !data.label) {
      throw new Error('Invalid custom unit data: value and label are required');
    }

    // Normalize value (lowercase, replace spaces with underscores)
    const normalizedValue = data.value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    if (!normalizedValue) {
      throw new Error('Invalid unit value: must contain at least one alphanumeric character');
    }

    // Check if value already exists in standard units
    const standardUnit = UNITS.find((u) => u.value === normalizedValue);
    if (standardUnit) {
      throw new Error(`Cette unité est réservée. Utilisez "${standardUnit.label}" à la place.`);
    }

    // Check if custom unit already exists for this company
    const existingQuery = query(
      collection(db, 'customUnits'),
      where('companyId', '==', companyId),
      where('value', '==', normalizedValue),
      where('isDeleted', '!=', true)
    );
    const existingSnapshot = await getDocs(existingQuery);

    if (!existingSnapshot.empty) {
      throw new Error('Cette unité personnalisée existe déjà pour votre entreprise');
    }

    const batch = writeBatch(db);
    const userId = data.userId || companyId;

    const unitRef = doc(collection(db, 'customUnits'));
    const unitData: any = {
      value: normalizedValue,
      label: data.label.trim(),
      companyId,
      isDeleted: false,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (createdBy) {
      unitData.createdBy = createdBy;
    }

    batch.set(unitRef, unitData);
    createAuditLog(batch, 'create', 'customUnit', unitRef.id, unitData, userId);

    await batch.commit();

    return {
      id: unitRef.id,
      ...unitData,
      createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
      updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
    };
  } catch (error) {
    logError('Error creating custom unit', error);
    throw error;
  }
};

export const updateCustomUnit = async (
  id: string,
  data: Partial<CustomUnit>,
  companyId: string
): Promise<void> => {
  try {
    const batch = writeBatch(db);
    const unitRef = doc(db, 'customUnits', id);

    const unitSnap = await getDoc(unitRef);
    if (!unitSnap.exists()) {
      throw new Error('Custom unit not found');
    }

    const currentUnit = unitSnap.data() as CustomUnit;
    if (currentUnit.companyId !== companyId) {
      throw new Error('Unauthorized: Custom unit belongs to different company');
    }

    const userId = currentUnit.userId || companyId;

    // If value is being updated, normalize and check for conflicts
    if (data.value && data.value !== currentUnit.value) {
      const normalizedValue = data.value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');

      // Check if value already exists in standard units
      const standardUnit = UNITS.find((u) => u.value === normalizedValue);
      if (standardUnit) {
        throw new Error(`Cette unité est réservée. Utilisez "${standardUnit.label}" à la place.`);
      }

      // Check if custom unit already exists for this company
      const existingQuery = query(
        collection(db, 'customUnits'),
        where('companyId', '==', companyId),
        where('value', '==', normalizedValue),
        where('isDeleted', '!=', true)
      );
      const existingSnapshot = await getDocs(existingQuery);

      if (!existingSnapshot.empty && existingSnapshot.docs[0].id !== id) {
        throw new Error('Cette unité personnalisée existe déjà pour votre entreprise');
      }

      data.value = normalizedValue;
    }

    // Build updateData object, excluding undefined values
    const updateData: any = {
      updatedAt: serverTimestamp()
    };

    if (data.value !== undefined) updateData.value = data.value;
    if (data.label !== undefined) updateData.label = data.label.trim();

    batch.update(unitRef, updateData);
    createAuditLog(batch, 'update', 'customUnit', id, updateData, userId);

    await batch.commit();
  } catch (error) {
    logError('Error updating custom unit', error);
    throw error;
  }
};

export const deleteCustomUnit = async (id: string, companyId: string): Promise<void> => {
  try {
    const batch = writeBatch(db);
    const unitRef = doc(db, 'customUnits', id);

    const unitSnap = await getDoc(unitRef);
    if (!unitSnap.exists()) {
      throw new Error('Custom unit not found');
    }

    const currentUnit = unitSnap.data() as CustomUnit;
    if (currentUnit.companyId !== companyId) {
      throw new Error('Unauthorized: Custom unit belongs to different company');
    }

    const userId = currentUnit.userId || companyId;

    // Soft delete
    batch.update(unitRef, {
      isDeleted: true,
      updatedAt: serverTimestamp()
    });

    createAuditLog(batch, 'delete', 'customUnit', id, currentUnit, userId);

    await batch.commit();
  } catch (error) {
    logError('Error deleting custom unit', error);
    throw error;
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const getCustomUnits = async (companyId: string): Promise<CustomUnit[]> => {
  try {
    const q = query(
      collection(db, 'customUnits'),
      where('companyId', '==', companyId),
      orderBy('label', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter((unit) => unit.isDeleted !== true) as CustomUnit[];
  } catch (error) {
    logError('Error getting custom units', error);
    return [];
  }
};

export const searchCustomUnits = (units: CustomUnit[], query: string): CustomUnit[] => {
  if (!query || query.trim() === '') {
    return units;
  }

  const lowerQuery = query.toLowerCase().trim();

  return units.filter(
    (unit) =>
      unit.value.toLowerCase().includes(lowerQuery) ||
      unit.label.toLowerCase().includes(lowerQuery)
  );
};

