// Production Charge service
import type { ProductionCharge } from '../../../types/models';
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
import { logError } from '@utils/core/logger';
import { createAuditLog } from '../shared';
import { createFinanceEntry } from '../finance/financeService';

const COLLECTION_NAME = 'productionCharges';

// ============================================================================
// PRODUCTION CHARGE SUBSCRIPTIONS
// ============================================================================

export const subscribeToProductionCharges = (
  productionId: string,
  companyId: string,
  callback: (charges: ProductionCharge[]) => void
): (() => void) => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('productionId', '==', productionId),
    where('companyId', '==', companyId),
    orderBy('date', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const charges = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as ProductionCharge[];
      callback(charges);
    },
    (error) => {
      logError('Error subscribing to production charges', error);
      callback([]);
    }
  );
};

// ============================================================================
// PRODUCTION CHARGE CRUD OPERATIONS
// ============================================================================

export const createProductionCharge = async (
  data: Omit<ProductionCharge, 'id' | 'createdAt' | 'updatedAt'>,
  companyId: string,
  createdBy?: import('../../../types/models').EmployeeRef | null
): Promise<ProductionCharge> => {
  try {
    // Validate charge data
    if (!data.description || data.description.trim() === '') {
      throw new Error('Charge description is required');
    }

    if (!data.amount || data.amount <= 0) {
      throw new Error('Charge amount must be greater than 0');
    }

    if (!data.productionId) {
      throw new Error('Production ID is required');
    }

    // Get current authenticated user
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    const currentUserId = auth.currentUser?.uid;
    
    if (!currentUserId) {
      throw new Error('User must be authenticated to create a production charge');
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

    const chargeData: any = {
      ...data,
      date: chargeDate,
      companyId,
      userId: currentUserId, // Set userId from authenticated user (override data.userId if provided)
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (createdBy) {
      chargeData.createdBy = createdBy;
    }

    const chargeRef = doc(collection(db, COLLECTION_NAME));
    batch.set(chargeRef, chargeData);

    // Create FinanceEntry for this charge
    const financeEntry = await createFinanceEntry({
      userId: data.userId || companyId,
      companyId,
      sourceType: 'expense', // Using expense type for production charges
      sourceId: chargeRef.id,
      type: `production_charge_${data.category}`,
      amount: -Math.abs(data.amount), // Negative for expenses
      description: `Production Charge: ${data.description}`,
      date: chargeDate,
      isDeleted: false
    });

    // Link finance entry to charge
    batch.update(chargeRef, {
      financeEntryId: financeEntry.id
    });

    // Update production chargeIds array and recalculate cost
    const productionRef = doc(db, 'productions', data.productionId);
    const productionSnap = await getDoc(productionRef);
    if (productionSnap.exists()) {
      const productionData = productionSnap.data();
      const currentChargeIds = productionData.chargeIds || [];
      if (!currentChargeIds.includes(chargeRef.id)) {
        // Recalculate production cost
        const { calculateMaterialsCost } = await import('./productionService');
        const materialsCost = calculateMaterialsCost(productionData.materials || []);
        const newChargeIds = [...currentChargeIds, chargeRef.id];
        
        // Get existing charges total (before adding new one)
        let existingChargesTotal = 0;
        if (currentChargeIds.length > 0) {
          const chargesQuery = query(
            collection(db, COLLECTION_NAME),
            where('productionId', '==', data.productionId),
            where('companyId', '==', companyId)
          );
          const chargesSnapshot = await getDocs(chargesQuery);
          existingChargesTotal = chargesSnapshot.docs.reduce((sum, doc) => {
            const chargeData = doc.data();
            return sum + (chargeData.amount || 0);
          }, 0);
        }
        
        // Add new charge amount to total
        const chargesTotal = existingChargesTotal + data.amount;
        
        batch.update(productionRef, {
          chargeIds: newChargeIds,
          calculatedCostPrice: materialsCost + chargesTotal,
          updatedAt: serverTimestamp()
        });
      }
    }

    // Create audit log
    const auditUserId = data.userId || companyId;
    createAuditLog(batch, 'create', 'productionCharge', chargeRef.id, chargeData, auditUserId);

    await batch.commit();

    const now = Date.now() / 1000;
    return {
      id: chargeRef.id,
      ...data,
      date: chargeDate,
      financeEntryId: financeEntry.id,
      companyId,
      createdAt: { seconds: now, nanoseconds: 0 },
      updatedAt: { seconds: now, nanoseconds: 0 },
      createdBy: createdBy || undefined
    };
  } catch (error) {
    logError('Error creating production charge', error);
    throw error;
  }
};

export const updateProductionCharge = async (
  id: string,
  data: Partial<ProductionCharge>,
  companyId: string
): Promise<void> => {
  try {
    const chargeRef = doc(db, COLLECTION_NAME, id);
    const chargeSnap = await getDoc(chargeRef);

    if (!chargeSnap.exists()) {
      throw new Error('Charge not found');
    }

    const currentData = chargeSnap.data() as ProductionCharge;
    if (currentData.companyId !== companyId) {
      throw new Error('Unauthorized: Charge belongs to different company');
    }

    const batch = writeBatch(db);

    const updateData: any = {
      ...data,
      updatedAt: serverTimestamp()
    };

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
      const { updateFinanceEntry } = await import('../finance/financeService');
      await updateFinanceEntry(currentData.financeEntryId, {
        amount: -Math.abs(data.amount),
        description: data.description ? `Production Charge: ${data.description}` : undefined
      });
    }

    // Recalculate production cost if amount changed
    if (data.amount !== undefined) {
      const productionRef = doc(db, 'productions', currentData.productionId);
      const productionSnap = await getDoc(productionRef);
      if (productionSnap.exists()) {
        const productionData = productionSnap.data();
        const { calculateMaterialsCost } = await import('./productionService');
        const materialsCost = calculateMaterialsCost(productionData.materials || []);
        
        // Get all charges for this production
        const chargesQuery = query(
          collection(db, COLLECTION_NAME),
          where('productionId', '==', currentData.productionId),
          where('companyId', '==', companyId)
        );
        const chargesSnapshot = await getDocs(chargesQuery);
        const chargesTotal = chargesSnapshot.docs.reduce((sum, doc) => {
          const chargeData = doc.data();
          // Use updated amount for this charge, others use existing amount
          if (doc.id === id) {
            return sum + (data.amount || 0);
          }
          return sum + (chargeData.amount || 0);
        }, 0);
        
        batch.update(productionRef, {
          calculatedCostPrice: materialsCost + chargesTotal,
          updatedAt: serverTimestamp()
        });
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
    createAuditLog(batch, 'update', 'productionCharge', id, updateData, auditUserId);

    await batch.commit();
  } catch (error) {
    logError('Error updating production charge', error);
    throw error;
  }
};

export const deleteProductionCharge = async (
  id: string,
  companyId: string
): Promise<void> => {
  try {
    const chargeRef = doc(db, COLLECTION_NAME, id);
    const chargeSnap = await getDoc(chargeRef);

    if (!chargeSnap.exists()) {
      throw new Error('Charge not found');
    }

    const currentData = chargeSnap.data() as ProductionCharge;
    if (currentData.companyId !== companyId) {
      throw new Error('Unauthorized: Charge belongs to different company');
    }

    const batch = writeBatch(db);

    // Soft delete FinanceEntry if exists
    if (currentData.financeEntryId) {
      const { softDeleteFinanceEntry } = await import('../finance/financeService');
      await softDeleteFinanceEntry(currentData.financeEntryId);
    }

    // Remove from production chargeIds array and recalculate cost
    const productionRef = doc(db, 'productions', currentData.productionId);
    const productionSnap = await getDoc(productionRef);
    if (productionSnap.exists()) {
      const productionData = productionSnap.data();
      const currentChargeIds = productionData.chargeIds || [];
      const updatedChargeIds = currentChargeIds.filter((chargeId: string) => chargeId !== id);
      
      // Recalculate production cost
      const { calculateMaterialsCost } = await import('./productionService');
      const materialsCost = calculateMaterialsCost(productionData.materials || []);
      
      // Get remaining charges
      const chargesQuery = query(
        collection(db, COLLECTION_NAME),
        where('productionId', '==', currentData.productionId),
        where('companyId', '==', companyId)
      );
      const chargesSnapshot = await getDocs(chargesQuery);
      const chargesTotal = chargesSnapshot.docs.reduce((sum, doc) => {
        const chargeData = doc.data();
        return sum + (chargeData.amount || 0);
      }, 0);
      
      batch.update(productionRef, {
        chargeIds: updatedChargeIds,
        calculatedCostPrice: materialsCost + chargesTotal,
        updatedAt: serverTimestamp()
      });
    }

    // Delete charge document
    batch.delete(chargeRef);

    // Create audit log
    const auditUserId = currentData.userId || companyId;
    createAuditLog(batch, 'delete', 'productionCharge', id, {}, auditUserId);

    await batch.commit();
  } catch (error) {
    logError('Error deleting production charge', error);
    throw error;
  }
};

export const getProductionCharge = async (
  id: string,
  companyId: string
): Promise<ProductionCharge | null> => {
  try {
    const chargeRef = doc(db, COLLECTION_NAME, id);
    const chargeSnap = await getDoc(chargeRef);

    if (!chargeSnap.exists()) {
      return null;
    }

    const chargeData = chargeSnap.data() as ProductionCharge;
    if (chargeData.companyId !== companyId) {
      throw new Error('Unauthorized: Charge belongs to different company');
    }

    return {
      id: chargeSnap.id,
      ...chargeData
    };
  } catch (error) {
    logError('Error getting production charge', error);
    throw error;
  }
};

