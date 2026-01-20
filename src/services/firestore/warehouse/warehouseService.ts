// Warehouse Service
// Manages product warehouses
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError } from '@utils/core/logger';
import { validateWarehouse } from '../../../utils/validation/shopWarehouseValidation';
import type { Warehouse, EmployeeRef } from '../../../types/models';

// ============================================================================
// WAREHOUSE CRUD OPERATIONS
// ============================================================================

/**
 * Create a new warehouse
 */
export const createWarehouse = async (
  data: Omit<Warehouse, 'id' | 'createdAt' | 'updatedAt'>,
  companyId: string,
  createdBy?: EmployeeRef | null
): Promise<Warehouse> => {
  try {
    // Validate warehouse data
    const validation = validateWarehouse(data, false);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    if (validation.warnings.length > 0) {
      console.warn('Warehouse validation warnings:', validation.warnings);
    }

    if (!data.name || data.name.trim() === '') {
      throw new Error('Warehouse name is required');
    }

    const batch = writeBatch(db);
    const warehouseRef = doc(collection(db, 'warehouses'));

    const now = serverTimestamp();
    const warehouseData: any = {
      id: warehouseRef.id,
      name: data.name.trim(),
      companyId,
      userId: data.userId || companyId,
      isDefault: data.isDefault || false,
      createdAt: now,
      updatedAt: now,
    };

    if (data.location) warehouseData.location = data.location;
    if (data.address) warehouseData.address = data.address;
    if (createdBy) warehouseData.createdBy = createdBy;

    batch.set(warehouseRef, warehouseData);

    await batch.commit();

    return {
      id: warehouseRef.id,
      ...warehouseData,
      createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
      updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
    } as Warehouse;

  } catch (error) {
    logError('Error creating warehouse', error);
    throw error;
  }
};

/**
 * Update warehouse
 */
export const updateWarehouse = async (
  warehouseId: string,
  updates: Partial<Warehouse>,
  companyId: string
): Promise<void> => {
  try {
    const warehouseRef = doc(db, 'warehouses', warehouseId);
    const warehouseSnap = await getDoc(warehouseRef);

    if (!warehouseSnap.exists()) {
      throw new Error('Warehouse not found');
    }

    const warehouseData = warehouseSnap.data() as Warehouse;
    if (warehouseData.companyId !== companyId) {
      throw new Error('Unauthorized to update this warehouse');
    }

    const updateData: any = {
      ...updates,
      updatedAt: serverTimestamp()
    };

    // Remove id, createdAt, updatedAt from updates
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // Filter out undefined values and convert empty strings to null
    // Firestore doesn't accept undefined, but accepts null
    const filteredUpdateData: any = {};
    for (const key in updateData) {
      const value = updateData[key];
      if (value !== undefined) {
        // Convert empty strings to null for optional string fields
        if (value === '' && (key === 'location' || key === 'address')) {
          filteredUpdateData[key] = null;
        } else {
          filteredUpdateData[key] = value;
        }
      }
    }

    await updateDoc(warehouseRef, filteredUpdateData);

  } catch (error) {
    logError('Error updating warehouse', error);
    throw error;
  }
};

/**
 * Delete warehouse (soft delete or hard delete if not default)
 */
export const deleteWarehouse = async (
  warehouseId: string,
  companyId: string
): Promise<void> => {
  try {
    const warehouseRef = doc(db, 'warehouses', warehouseId);
    const warehouseSnap = await getDoc(warehouseRef);

    if (!warehouseSnap.exists()) {
      throw new Error('Warehouse not found');
    }

    const warehouseData = warehouseSnap.data() as Warehouse;
    if (warehouseData.companyId !== companyId) {
      throw new Error('Unauthorized to delete this warehouse');
    }

    // Check if it's the default warehouse
    if (warehouseData.isDefault) {
      // Check if it's the only warehouse
      const allWarehouses = await getWarehousesByCompany(companyId);
      if (allWarehouses.length === 1) {
        throw new Error('Cannot delete the default warehouse when it is the only warehouse');
      }
    }

    await deleteDoc(warehouseRef);

  } catch (error) {
    logError('Error deleting warehouse', error);
    throw error;
  }
};

/**
 * Get warehouse by ID
 */
export const getWarehouseById = async (warehouseId: string): Promise<Warehouse | null> => {
  try {
    const warehouseRef = doc(db, 'warehouses', warehouseId);
    const warehouseSnap = await getDoc(warehouseRef);

    if (!warehouseSnap.exists()) {
      return null;
    }

    return {
      id: warehouseSnap.id,
      ...warehouseSnap.data()
    } as Warehouse;

  } catch (error) {
    logError('Error getting warehouse', error);
    throw error;
  }
};

/**
 * Get all warehouses for a company
 */
export const getWarehousesByCompany = async (companyId: string): Promise<Warehouse[]> => {
  try {
    const q = query(
      collection(db, 'warehouses'),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Warehouse[];

  } catch (error) {
    logError('Error getting warehouses by company', error);
    throw error;
  }
};

/**
 * Get default warehouse for a company
 */
export const getDefaultWarehouse = async (companyId: string): Promise<Warehouse | null> => {
  try {
    const q = query(
      collection(db, 'warehouses'),
      where('companyId', '==', companyId),
      where('isDefault', '==', true),
      limit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }

    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    } as Warehouse;

  } catch (error) {
    logError('Error getting default warehouse', error);
    throw error;
  }
};

// ============================================================================
// SUBSCRIPTION FUNCTIONS
// ============================================================================

/**
 * Subscribe to warehouses for a company
 */
export const subscribeToWarehouses = (
  companyId: string,
  callback: (warehouses: Warehouse[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const q = query(
    collection(db, 'warehouses'),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const warehouses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Warehouse[];
      callback(warehouses);
    },
    (error) => {
      logError('Error subscribing to warehouses', error);
      if (onError) {
        onError(new Error(error.message));
      }
    }
  );
};

