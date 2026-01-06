// Production Flow Step service
import type { ProductionFlowStep } from '../../../types/models';
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
import { logError } from '@utils/core/logger';
import { createAuditLog } from '../shared';

const COLLECTION_NAME = 'productionFlowSteps';

// ============================================================================
// PRODUCTION FLOW STEP SUBSCRIPTIONS
// ============================================================================

export const subscribeToProductionFlowSteps = (
  companyId: string,
  callback: (steps: ProductionFlowStep[]) => void
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
      const steps = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as ProductionFlowStep[];
      callback(steps);
    },
    (error) => {
      logError('Error subscribing to production flow steps', error);
      callback([]);
    }
  );
};

// ============================================================================
// PRODUCTION FLOW STEP CRUD OPERATIONS
// ============================================================================

export const createProductionFlowStep = async (
  data: Omit<ProductionFlowStep, 'id' | 'createdAt' | 'updatedAt'>,
  companyId: string,
  createdBy?: import('../../../types/models').EmployeeRef | null
): Promise<ProductionFlowStep> => {
  try {
    // Validate step data
    if (!data.name || data.name.trim() === '') {
      throw new Error('Flow step name is required');
    }

    // Get current authenticated user
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    const currentUserId = auth.currentUser?.uid;
    
    if (!currentUserId) {
      throw new Error('User must be authenticated to create a production flow step');
    }

    const batch = writeBatch(db);

    // Build step data, filtering out undefined values (Firebase doesn't accept undefined)
    const stepData: any = {
      name: data.name,
      companyId,
      userId: currentUserId, // Set userId from authenticated user
      isActive: data.isActive !== false,
      usageCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Only include optional fields if they have values
    if (data.description) {
      stepData.description = data.description;
    }
    if (data.image) {
      stepData.image = data.image;
    }
    if (data.imagePath) {
      stepData.imagePath = data.imagePath;
    }
    if (data.estimatedDuration !== undefined) {
      stepData.estimatedDuration = data.estimatedDuration;
    }

    if (createdBy) {
      stepData.createdBy = createdBy;
    }

    const stepRef = doc(collection(db, COLLECTION_NAME));
    batch.set(stepRef, stepData);

    // Create audit log
    createAuditLog(batch, 'create', 'productionFlowStep', stepRef.id, stepData, currentUserId);

    await batch.commit();

    const now = Date.now() / 1000;
    const result: ProductionFlowStep = {
      id: stepRef.id,
      name: data.name,
      companyId,
      isActive: data.isActive !== false,
      usageCount: 0,
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
    if (data.estimatedDuration !== undefined) {
      result.estimatedDuration = data.estimatedDuration;
    }
    if (data.userId) {
      result.userId = data.userId;
    }
    if (createdBy) {
      result.createdBy = createdBy;
    }

    return result;
  } catch (error) {
    logError('Error creating production flow step', error);
    throw error;
  }
};

export const updateProductionFlowStep = async (
  id: string,
  data: Partial<ProductionFlowStep>,
  companyId: string
): Promise<void> => {
  try {
    const stepRef = doc(db, COLLECTION_NAME, id);
    const stepSnap = await getDoc(stepRef);

    if (!stepSnap.exists()) {
      throw new Error('Flow step not found');
    }

    const currentData = stepSnap.data() as ProductionFlowStep;
    if (currentData.companyId !== companyId) {
      throw new Error('Unauthorized: Flow step belongs to different company');
    }

    const batch = writeBatch(db);

    // Build update data, filtering out undefined values (Firebase doesn't accept undefined)
    const updateData: any = {
      updatedAt: serverTimestamp()
    };

    // Only include fields that are being updated
    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.description !== undefined) {
      if (data.description === null || data.description === '') {
        // Remove description field if explicitly set to empty/null
        updateData.description = null;
      } else {
        updateData.description = data.description;
      }
    }
    if (data.image !== undefined) {
      updateData.image = data.image;
    }
    if (data.imagePath !== undefined) {
      updateData.imagePath = data.imagePath;
    }
    if (data.estimatedDuration !== undefined) {
      updateData.estimatedDuration = data.estimatedDuration;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    // Remove undefined fields
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    batch.update(stepRef, updateData);

    // Create audit log
    const auditUserId = currentData.userId || companyId;
    createAuditLog(batch, 'update', 'productionFlowStep', id, updateData, auditUserId);

    await batch.commit();
  } catch (error) {
    logError('Error updating production flow step', error);
    throw error;
  }
};

export const deleteProductionFlowStep = async (
  id: string,
  companyId: string
): Promise<void> => {
  try {
    const stepRef = doc(db, COLLECTION_NAME, id);
    const stepSnap = await getDoc(stepRef);

    if (!stepSnap.exists()) {
      throw new Error('Flow step not found');
    }

    const currentData = stepSnap.data() as ProductionFlowStep;
    if (currentData.companyId !== companyId) {
      throw new Error('Unauthorized: Flow step belongs to different company');
    }

    // Check if step is used in any active flows
    const flowsQuery = query(
      collection(db, 'productionFlows'),
      where('companyId', '==', companyId),
      where('isActive', '==', true)
    );

    const flowsSnapshot = await getDocs(flowsQuery);
    const isUsed = flowsSnapshot.docs.some((flowDoc) => {
      const flowData = flowDoc.data();
      return flowData.stepIds && flowData.stepIds.includes(id);
    });

    if (isUsed) {
      throw new Error('Cannot delete flow step: It is used in one or more active flows');
    }

    const batch = writeBatch(db);

    // Soft delete by setting isActive to false
    batch.update(stepRef, {
      isActive: false,
      updatedAt: serverTimestamp()
    });

    // Create audit log
    const auditUserId = currentData.userId || companyId;
    createAuditLog(batch, 'delete', 'productionFlowStep', id, { isActive: false }, auditUserId);

    await batch.commit();
  } catch (error) {
    logError('Error deleting production flow step', error);
    throw error;
  }
};

export const getProductionFlowStep = async (
  id: string,
  companyId: string
): Promise<ProductionFlowStep | null> => {
  try {
    const stepRef = doc(db, COLLECTION_NAME, id);
    const stepSnap = await getDoc(stepRef);

    if (!stepSnap.exists()) {
      return null;
    }

    const stepData = stepSnap.data() as ProductionFlowStep;
    if (stepData.companyId !== companyId) {
      throw new Error('Unauthorized: Flow step belongs to different company');
    }

    return {
      ...stepData,
      id: stepSnap.id
    };
  } catch (error) {
    logError('Error getting production flow step', error);
    throw error;
  }
};

