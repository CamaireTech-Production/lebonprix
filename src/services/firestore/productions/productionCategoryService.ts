// Production Category service
import type { ProductionCategory } from '../../../types/models';
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
import { db } from '../../core/firebase';
import { logError } from '@utils/core/logger';
import { createAuditLog } from '../shared';

const COLLECTION_NAME = 'productionCategories';

// ============================================================================
// PRODUCTION CATEGORY SUBSCRIPTIONS
// ============================================================================

export const subscribeToProductionCategories = (
  companyId: string,
  callback: (categories: ProductionCategory[]) => void
): (() => void) => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('companyId', '==', companyId),
    where('isActive', '==', true),
    orderBy('name', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const categories = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as ProductionCategory[];
      callback(categories);
    },
    (error) => {
      logError('Error subscribing to production categories', error);
      callback([]);
    }
  );
};

// ============================================================================
// PRODUCTION CATEGORY CRUD OPERATIONS
// ============================================================================

export const createProductionCategory = async (
  data: Omit<ProductionCategory, 'id' | 'createdAt' | 'updatedAt'>,
  companyId: string,
  createdBy?: import('../../../types/models').EmployeeRef | null
): Promise<ProductionCategory> => {
  try {
    // Validate category data
    if (!data.name || data.name.trim() === '') {
      throw new Error('Category name is required');
    }

    const batch = writeBatch(db);

    // Build category data, filtering out undefined values (Firebase doesn't accept undefined)
    const categoryData: any = {
      name: data.name,
      companyId,
      isActive: data.isActive !== false,
      productionCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Only include optional fields if they have values
    if (data.description) {
      categoryData.description = data.description;
    }
    if (data.image) {
      categoryData.image = data.image;
    }
    if (data.imagePath) {
      categoryData.imagePath = data.imagePath;
    }
    if (data.userId) {
      categoryData.userId = data.userId;
    }

    if (createdBy) {
      categoryData.createdBy = createdBy;
    }

    const categoryRef = doc(collection(db, COLLECTION_NAME));
    batch.set(categoryRef, categoryData);

    // Create audit log
    const auditUserId = data.userId || companyId;
    createAuditLog(batch, 'create', 'productionCategory', categoryRef.id, categoryData, auditUserId);

    await batch.commit();

    const now = Date.now() / 1000;
    const result: ProductionCategory = {
      id: categoryRef.id,
      name: data.name,
      companyId,
      isActive: data.isActive !== false,
      productionCount: 0,
      createdAt: { seconds: now, nanoseconds: 0 } as any,
      updatedAt: { seconds: now, nanoseconds: 0 } as any
    };

    if (data.description) {
      result.description = data.description;
    }
    if (data.image) {
      result.image = data.image;
    }
    if (data.imagePath) {
      result.imagePath = data.imagePath;
    }
    if (data.userId) {
      result.userId = data.userId;
    }
    if (createdBy) {
      result.createdBy = createdBy;
    }

    return result;
  } catch (error) {
    logError('Error creating production category', error);
    throw error;
  }
};

export const updateProductionCategory = async (
  id: string,
  data: Partial<ProductionCategory>,
  companyId: string
): Promise<void> => {
  try {
    const categoryRef = doc(db, COLLECTION_NAME, id);
    const categorySnap = await getDoc(categoryRef);

    if (!categorySnap.exists()) {
      throw new Error('Category not found');
    }

    const currentData = categorySnap.data() as ProductionCategory;
    if (currentData.companyId !== companyId) {
      throw new Error('Unauthorized: Category belongs to different company');
    }

    const batch = writeBatch(db);

    const updateData: any = {
      ...data,
      updatedAt: serverTimestamp()
    };

    // Remove undefined fields
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    batch.update(categoryRef, updateData);

    // Create audit log
    const auditUserId = currentData.userId || companyId;
    createAuditLog(batch, 'update', 'productionCategory', id, updateData, auditUserId);

    await batch.commit();
  } catch (error) {
    logError('Error updating production category', error);
    throw error;
  }
};

export const deleteProductionCategory = async (
  id: string,
  companyId: string
): Promise<void> => {
  try {
    const categoryRef = doc(db, COLLECTION_NAME, id);
    const categorySnap = await getDoc(categoryRef);

    if (!categorySnap.exists()) {
      throw new Error('Category not found');
    }

    const currentData = categorySnap.data() as ProductionCategory;
    if (currentData.companyId !== companyId) {
      throw new Error('Unauthorized: Category belongs to different company');
    }

    // Check if category is used in any productions
    const productionsQuery = query(
      collection(db, 'productions'),
      where('companyId', '==', companyId),
      where('categoryId', '==', id),
      where('isClosed', '==', false)
    );

    const productionsSnapshot = await getDocs(productionsQuery);
    if (!productionsSnapshot.empty) {
      throw new Error('Cannot delete category: It is used in one or more active productions');
    }

    const batch = writeBatch(db);

    // Soft delete by setting isActive to false
    batch.update(categoryRef, {
      isActive: false,
      updatedAt: serverTimestamp()
    });

    // Create audit log
    const auditUserId = currentData.userId || companyId;
    createAuditLog(batch, 'delete', 'productionCategory', id, { isActive: false }, auditUserId);

    await batch.commit();
  } catch (error) {
    logError('Error deleting production category', error);
    throw error;
  }
};

export const getProductionCategory = async (
  id: string,
  companyId: string
): Promise<ProductionCategory | null> => {
  try {
    const categoryRef = doc(db, COLLECTION_NAME, id);
    const categorySnap = await getDoc(categoryRef);

    if (!categorySnap.exists()) {
      return null;
    }

    const categoryData = categorySnap.data() as ProductionCategory;
    if (categoryData.companyId !== companyId) {
      throw new Error('Unauthorized: Category belongs to different company');
    }

    return {
      id: categorySnap.id,
      ...categoryData
    };
  } catch (error) {
    logError('Error getting production category', error);
    throw error;
  }
};

export const updateProductionCategoryCount = async (
  categoryId: string,
  companyId: string,
  increment: boolean = true
): Promise<void> => {
  try {
    const categoryRef = doc(db, COLLECTION_NAME, categoryId);
    const categorySnap = await getDoc(categoryRef);

    if (!categorySnap.exists()) {
      return;
    }

    const currentData = categorySnap.data() as ProductionCategory;
    if (currentData.companyId !== companyId) {
      return;
    }

    const currentCount = currentData.productionCount || 0;
    const newCount = increment ? currentCount + 1 : Math.max(0, currentCount - 1);

    await updateDoc(categoryRef, {
      productionCount: newCount,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    logError('Error updating production category count', error);
  }
};

