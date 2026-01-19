// Shop Service
// Manages retail locations (shops)
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
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError } from '@utils/core/logger';
import type { Shop, EmployeeRef } from '../../../types/models';
import type { Timestamp } from '../../../types/models';

// ============================================================================
// SHOP CRUD OPERATIONS
// ============================================================================

/**
 * Create a new shop
 */
export const createShop = async (
  data: Omit<Shop, 'id' | 'createdAt' | 'updatedAt'>,
  companyId: string,
  createdBy?: EmployeeRef | null
): Promise<Shop> => {
  try {
    if (!data.name || data.name.trim() === '') {
      throw new Error('Shop name is required');
    }

    const batch = writeBatch(db);
    const shopRef = doc(collection(db, 'shops'));

    const now = serverTimestamp();
    const shopData: any = {
      id: shopRef.id,
      name: data.name.trim(),
      companyId,
      userId: data.userId || companyId,
      isDefault: data.isDefault || false,
      createdAt: now,
      updatedAt: now,
    };

    if (data.location) shopData.location = data.location;
    if (data.address) shopData.address = data.address;
    if (data.phone) shopData.phone = data.phone;
    if (data.email) shopData.email = data.email;
    if (data.managerId) shopData.managerId = data.managerId;
    if (data.assignedUsers && data.assignedUsers.length > 0) shopData.assignedUsers = data.assignedUsers;
    if (data.catalogueSettings) shopData.catalogueSettings = data.catalogueSettings;
    if (createdBy) shopData.createdBy = createdBy;

    batch.set(shopRef, shopData);

    await batch.commit();

    return {
      id: shopRef.id,
      ...shopData,
      createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
      updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
    } as Shop;

  } catch (error) {
    logError('Error creating shop', error);
    throw error;
  }
};

/**
 * Update shop
 */
export const updateShop = async (
  shopId: string,
  updates: Partial<Shop>,
  companyId: string
): Promise<void> => {
  try {
    const shopRef = doc(db, 'shops', shopId);
    const shopSnap = await getDoc(shopRef);

    if (!shopSnap.exists()) {
      throw new Error('Shop not found');
    }

    const shopData = shopSnap.data() as Shop;
    if (shopData.companyId !== companyId) {
      throw new Error('Unauthorized to update this shop');
    }

    const updateData: any = {
      ...updates,
      updatedAt: serverTimestamp()
    };

    // Remove id, createdAt, updatedAt from updates
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    await updateDoc(shopRef, updateData);

  } catch (error) {
    logError('Error updating shop', error);
    throw error;
  }
};

/**
 * Delete shop (soft delete or hard delete if not default)
 */
export const deleteShop = async (
  shopId: string,
  companyId: string
): Promise<void> => {
  try {
    const shopRef = doc(db, 'shops', shopId);
    const shopSnap = await getDoc(shopRef);

    if (!shopSnap.exists()) {
      throw new Error('Shop not found');
    }

    const shopData = shopSnap.data() as Shop;
    if (shopData.companyId !== companyId) {
      throw new Error('Unauthorized to delete this shop');
    }

    // Check if it's the default shop
    if (shopData.isDefault) {
      // Check if it's the only shop
      const allShops = await getShopsByCompany(companyId);
      if (allShops.length === 1) {
        throw new Error('Cannot delete the default shop when it is the only shop');
      }
    }

    await deleteDoc(shopRef);

  } catch (error) {
    logError('Error deleting shop', error);
    throw error;
  }
};

/**
 * Get shop by ID
 */
export const getShopById = async (shopId: string): Promise<Shop | null> => {
  try {
    const shopRef = doc(db, 'shops', shopId);
    const shopSnap = await getDoc(shopRef);

    if (!shopSnap.exists()) {
      return null;
    }

    return {
      id: shopSnap.id,
      ...shopSnap.data()
    } as Shop;

  } catch (error) {
    logError('Error getting shop', error);
    throw error;
  }
};

/**
 * Get all shops for a company
 */
export const getShopsByCompany = async (companyId: string): Promise<Shop[]> => {
  try {
    const q = query(
      collection(db, 'shops'),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Shop[];

  } catch (error) {
    logError('Error getting shops by company', error);
    throw error;
  }
};

/**
 * Get default shop for a company
 */
export const getDefaultShop = async (companyId: string): Promise<Shop | null> => {
  try {
    const q = query(
      collection(db, 'shops'),
      where('companyId', '==', companyId),
      where('isDefault', '==', true),
      orderBy('createdAt', 'asc'),
      limit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }

    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    } as Shop;

  } catch (error) {
    logError('Error getting default shop', error);
    throw error;
  }
};

/**
 * Assign user to shop
 */
export const assignUserToShop = async (
  shopId: string,
  userId: string,
  companyId: string
): Promise<void> => {
  try {
    const shopRef = doc(db, 'shops', shopId);
    const shopSnap = await getDoc(shopRef);

    if (!shopSnap.exists()) {
      throw new Error('Shop not found');
    }

    const shopData = shopSnap.data() as Shop;
    if (shopData.companyId !== companyId) {
      throw new Error('Unauthorized');
    }

    await updateDoc(shopRef, {
      assignedUsers: arrayUnion(userId),
      updatedAt: serverTimestamp()
    });

  } catch (error) {
    logError('Error assigning user to shop', error);
    throw error;
  }
};

/**
 * Remove user from shop
 */
export const removeUserFromShop = async (
  shopId: string,
  userId: string,
  companyId: string
): Promise<void> => {
  try {
    const shopRef = doc(db, 'shops', shopId);
    const shopSnap = await getDoc(shopRef);

    if (!shopSnap.exists()) {
      throw new Error('Shop not found');
    }

    const shopData = shopSnap.data() as Shop;
    if (shopData.companyId !== companyId) {
      throw new Error('Unauthorized');
    }

    await updateDoc(shopRef, {
      assignedUsers: arrayRemove(userId),
      updatedAt: serverTimestamp()
    });

  } catch (error) {
    logError('Error removing user from shop', error);
    throw error;
  }
};

/**
 * Get shops assigned to a user
 */
export const getUserShops = async (
  userId: string,
  companyId: string
): Promise<Shop[]> => {
  try {
    const q = query(
      collection(db, 'shops'),
      where('companyId', '==', companyId),
      where('assignedUsers', 'array-contains', userId),
      orderBy('createdAt', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Shop[];

  } catch (error) {
    logError('Error getting user shops', error);
    throw error;
  }
};

