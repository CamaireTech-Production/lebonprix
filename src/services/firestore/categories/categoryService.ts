// Category service - extracted from firestore.ts
import type { Category } from '../../../types/models';
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
  updateDoc
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logWarning } from '@utils/core/logger';
import { createAuditLog } from '../shared';

// ============================================================================
// CATEGORY SUBSCRIPTIONS
// ============================================================================

export const subscribeToCategories = (companyId: string, callback: (categories: Category[]) => void): (() => void) => {
  const q = query(
    collection(db, 'categories'),
    where('companyId', '==', companyId),
    where('isActive', '==', true), // Only get active categories
    orderBy('name', 'asc'),
    limit(100) // Increased limit for categories
  );

  return onSnapshot(q, (snapshot) => {
    const categories = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Category[];
    callback(categories);
  });
};

// ============================================================================
// CATEGORY UTILITIES
// ============================================================================

// Utility function to update category product count
export const updateCategoryProductCount = async (categoryName: string, companyId: string, increment: boolean = true): Promise<void> => {
  if (!categoryName || !companyId) return;

  try {
    // Find the category by name and companyId
    const q = query(
      collection(db, 'categories'),
      where('name', '==', categoryName),
      where('companyId', '==', companyId),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      logWarning('Category not found for company');
      return;
    }

    const categoryDoc = snapshot.docs[0];
    const currentCount = categoryDoc.data().productCount || 0;
    const newCount = increment ? currentCount + 1 : Math.max(0, currentCount - 1);

    await updateDoc(categoryDoc.ref, {
      productCount: newCount,
      updatedAt: serverTimestamp()
    });

  } catch (error) {
    console.error('Error updating category product count:', error);
  }
};

// Utility function to recalculate all category product counts
export const recalculateCategoryProductCounts = async (companyId: string): Promise<void> => {
  try {
    // Get all categories for the company
    const categoriesQuery = query(
      collection(db, 'categories'),
      where('companyId', '==', companyId),
      where('isActive', '==', true)
    );

    const categoriesSnapshot = await getDocs(categoriesQuery);
    const categories = categoriesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Category[];

    // Get all products for the company
    const productsQuery = query(
      collection(db, 'products'),
      where('companyId', '==', companyId),
      where('isDeleted', '==', false),
      where('isVisible', '!=', false) // Include products where isVisible is true or undefined
    );

    const productsSnapshot = await getDocs(productsQuery);
    const products = productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    // Count products per category
    const categoryCounts: { [categoryName: string]: number } = {};
    products.forEach(product => {
      if (product.category) {
        categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
      }
    });

    // Update each category with the correct count
    const batch = writeBatch(db);
    categories.forEach(category => {
      const correctCount = categoryCounts[category.name] || 0;
      if (category.productCount !== correctCount) {
        const categoryRef = doc(db, 'categories', category.id);
        batch.update(categoryRef, {
          productCount: correctCount,
          updatedAt: serverTimestamp()
        });
      }
    });

    await batch.commit();
  } catch (error) {
    console.error('Error recalculating category product counts:', error);
  }
};

// ============================================================================
// CATEGORY CRUD OPERATIONS
// ============================================================================

export const createCategory = async (
  data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>,
  companyId: string,
  createdBy?: import('../../../types/models').EmployeeRef | null
): Promise<Category> => {
  const batch = writeBatch(db);
  
  // Validate category data
  if (!data.name || data.name.trim() === '') {
    throw new Error('Category name is required');
  }
  
  const categoryData: any = {
    ...data,
    companyId, // Ensure companyId is set
    isActive: data.isActive !== false, // Default to true
    productCount: 0, // Initialize with 0 products
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  // Add createdBy if provided
  if (createdBy) {
    categoryData.createdBy = createdBy;
  }
  
  const categoryRef = doc(collection(db, 'categories'));
  batch.set(categoryRef, categoryData);
  
  // Create audit log (use userId from data if available, otherwise use companyId for audit)
  const auditUserId = data.userId || companyId;
  createAuditLog(batch, 'create', 'category', categoryRef.id, categoryData, auditUserId);
  
  await batch.commit();

  return {
    id: categoryRef.id,
    ...categoryData,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  };
};

export const updateCategory = async (
  id: string,
  data: Partial<Category>,
  companyId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const categoryRef = doc(db, 'categories', id);
  
  // Get current category data
  const categorySnap = await getDoc(categoryRef);
  if (!categorySnap.exists()) {
    throw new Error('Category not found');
  }
  
  // Verify companyId matches
  const currentData = categorySnap.data() as Category;
  if (currentData.companyId !== companyId) {
    throw new Error('Unauthorized: Category belongs to different company');
  }
  
  // Get userId from category for audit
  const userId = currentData.userId || companyId;
  
  // Update category data
  const updateData = {
    ...data,
    updatedAt: serverTimestamp()
  };
  
  batch.update(categoryRef, updateData);
  
  // Create audit log
  createAuditLog(batch, 'update', 'category', id, updateData, userId);
  
  await batch.commit();
};

export const deleteCategory = async (
  id: string,
  companyId: string,
  deleteMatieres: boolean = false // If true, hard delete associated matieres
): Promise<{ matiereCount: number; productCount: number }> => {
  const categoryRef = doc(db, 'categories', id);
  
  // Get current category data
  const categorySnap = await getDoc(categoryRef);
  if (!categorySnap.exists()) {
    throw new Error('Category not found');
  }
  
  const currentCategory = categorySnap.data() as Category;
  // Verify companyId matches
  if (currentCategory.companyId !== companyId) {
    throw new Error('Unauthorized: Category belongs to different company');
  }
  
  // Get userId from category for audit
  const userId = currentCategory.userId || companyId;
  
  const matiereCount = currentCategory.matiereCount || 0;
  const productCount = currentCategory.productCount || 0;
  
  // If deleteMatieres is true, delete all associated matieres
  if (deleteMatieres && matiereCount > 0) {
    const batch = writeBatch(db);
    
    // Get all matieres in this category
    const matieresQuery = query(
      collection(db, 'matieres'),
      where('refCategorie', '==', currentCategory.name),
      where('companyId', '==', companyId),
      where('isDeleted', '!=', true)
    );
    const matieresSnapshot = await getDocs(matieresQuery);
    
    // Delete each matiere and its associated data
    for (const matiereDoc of matieresSnapshot.docs) {
      const matiere = matiereDoc.data() as any;
      
      // Delete stock document
      if (matiere.refStock) {
        const stockRef = doc(db, 'stocks', matiere.refStock);
        batch.delete(stockRef);
      }
      
      // Delete all stock batches for this matiere
      const batchesQuery = query(
        collection(db, 'stockBatches'),
        where('matiereId', '==', matiereDoc.id)
      );
      const batchesSnapshot = await getDocs(batchesQuery);
      batchesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      
      // Delete all stock changes for this matiere
      const stockChangesQuery = query(
        collection(db, 'stockChanges'),
        where('matiereId', '==', matiereDoc.id)
      );
      const stockChangesSnapshot = await getDocs(stockChangesQuery);
      stockChangesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      
      // Delete matiere
      batch.delete(matiereDoc.ref);
    }
    
    // Soft delete category by setting isActive to false
    batch.update(categoryRef, {
      isActive: false,
      updatedAt: serverTimestamp()
    });
    
    // Create audit log
    createAuditLog(batch, 'delete', 'category', id, { isActive: false, deletedMatieres: matiereCount }, userId);
    
    await batch.commit();
  } else {
    // Check if category has products or matieres
    if (productCount > 0) {
      throw new Error('Cannot delete category with existing products. Please move or delete products first.');
    }
    if (matiereCount > 0) {
      throw new Error('Cannot delete category with existing matieres. Please delete matieres first or confirm deletion.');
    }
    
    // Soft delete by setting isActive to false
    const batch = writeBatch(db);
    batch.update(categoryRef, {
      isActive: false,
      updatedAt: serverTimestamp()
    });
    
    // Create audit log
    createAuditLog(batch, 'delete', 'category', id, { isActive: false }, userId);
    
    await batch.commit();
  }
  
  return { matiereCount, productCount };
};

export const getCategory = async (id: string, companyId: string): Promise<Category | null> => {
  const categoryRef = doc(db, 'categories', id);
  const categorySnap = await getDoc(categoryRef);
  
  if (!categorySnap.exists()) {
    return null;
  }
  
  // Verify companyId matches
  const categoryData = categorySnap.data();
  if ((categoryData as Category).companyId !== companyId) {
    return null; // Category belongs to different company
  }
  
  // Remove id from categoryData if it exists to avoid duplication
  const { id: _, ...categoryWithoutId } = categoryData as Category & { id?: string };
  
  return {
    id: categorySnap.id,
    ...categoryWithoutId
  } as Category;
};

export const getCompanyCategories = async (companyId: string): Promise<Category[]> => {
  const q = query(
    collection(db, 'categories'),
    where('companyId', '==', companyId),
    where('isActive', '==', true),
    orderBy('name', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Category[];
};

