// Production Flow service
import type { ProductionFlow } from '../../../types/models';
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

const COLLECTION_NAME = 'productionFlows';

// ============================================================================
// PRODUCTION FLOW SUBSCRIPTIONS
// ============================================================================

export const subscribeToProductionFlows = (
  companyId: string,
  callback: (flows: ProductionFlow[]) => void
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
      const flows = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as ProductionFlow[];
      callback(flows);
    },
    (error) => {
      logError('Error subscribing to production flows', error);
      callback([]);
    }
  );
};

// ============================================================================
// PRODUCTION FLOW CRUD OPERATIONS
// ============================================================================

export const createProductionFlow = async (
  data: Omit<ProductionFlow, 'id' | 'createdAt' | 'updatedAt'>,
  companyId: string,
  createdBy?: import('../../../types/models').EmployeeRef | null
): Promise<ProductionFlow> => {
  try {
    // Validate flow data
    if (!data.name || data.name.trim() === '') {
      throw new Error('Flow name is required');
    }

    if (!data.stepIds || data.stepIds.length === 0) {
      throw new Error('Flow must have at least one step');
    }

    // Get current authenticated user
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    const currentUserId = auth.currentUser?.uid;
    
    if (!currentUserId) {
      throw new Error('User must be authenticated to create a production flow');
    }

    const batch = writeBatch(db);

    // Build flow data, filtering out undefined values (Firebase doesn't accept undefined)
    const flowData: any = {
      name: data.name,
      companyId,
      userId: currentUserId, // Set userId from authenticated user
      isDefault: data.isDefault || false,
      isActive: data.isActive !== false,
      stepIds: data.stepIds,
      stepCount: data.stepIds.length,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Only include optional fields if they have values
    if (data.description) {
      flowData.description = data.description;
    }
    if (data.estimatedDuration !== undefined) {
      flowData.estimatedDuration = data.estimatedDuration;
    }

    if (createdBy) {
      flowData.createdBy = createdBy;
    }

    // If this is set as default, unset other defaults
    if (data.isDefault) {
      const existingDefaultsQuery = query(
        collection(db, COLLECTION_NAME),
        where('companyId', '==', companyId),
        where('isDefault', '==', true),
        where('isActive', '==', true)
      );

      const existingDefaultsSnapshot = await getDocs(existingDefaultsQuery);
      existingDefaultsSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          isDefault: false,
          updatedAt: serverTimestamp()
        });
      });
    }

    const flowRef = doc(collection(db, COLLECTION_NAME));
    batch.set(flowRef, flowData);

    // Update usage count for each step
    for (const stepId of data.stepIds) {
      const stepRef = doc(db, 'productionFlowSteps', stepId);
      const stepSnap = await getDoc(stepRef);
      if (stepSnap.exists()) {
        const currentUsage = stepSnap.data().usageCount || 0;
        batch.update(stepRef, {
          usageCount: currentUsage + 1,
          updatedAt: serverTimestamp()
        });
      }
    }

    // Create audit log
    const auditUserId = data.userId || companyId;
    createAuditLog(batch, 'create', 'productionFlow', flowRef.id, flowData, auditUserId);

    await batch.commit();

    const now = Date.now() / 1000;
    const result: ProductionFlow = {
      id: flowRef.id,
      name: data.name,
      companyId,
      isDefault: data.isDefault || false,
      isActive: data.isActive !== false,
      stepIds: data.stepIds,
      stepCount: data.stepIds.length,
      createdAt: { seconds: now, nanoseconds: 0 } as any,
      updatedAt: { seconds: now, nanoseconds: 0 } as any
    };

    if (data.description) {
      result.description = data.description;
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
    logError('Error creating production flow', error);
    throw error;
  }
};

export const updateProductionFlow = async (
  id: string,
  data: Partial<ProductionFlow>,
  companyId: string
): Promise<void> => {
  try {
    const flowRef = doc(db, COLLECTION_NAME, id);
    const flowSnap = await getDoc(flowRef);

    if (!flowSnap.exists()) {
      throw new Error('Flow not found');
    }

    const currentData = flowSnap.data() as ProductionFlow;
    if (currentData.companyId !== companyId) {
      throw new Error('Unauthorized: Flow belongs to different company');
    }

    const batch = writeBatch(db);

    // If setting as default, unset other defaults
    if (data.isDefault === true) {
      const existingDefaultsQuery = query(
        collection(db, COLLECTION_NAME),
        where('companyId', '==', companyId),
        where('isDefault', '==', true),
        where('isActive', '==', true)
      );

      const existingDefaultsSnapshot = await getDocs(existingDefaultsQuery);
      existingDefaultsSnapshot.docs.forEach((doc) => {
        if (doc.id !== id) {
          batch.update(doc.ref, {
            isDefault: false,
            updatedAt: serverTimestamp()
          });
        }
      });
    }

    // Update usage counts if stepIds changed
    if (data.stepIds) {
      const oldStepIds = currentData.stepIds || [];
      const newStepIds = data.stepIds;

      // Decrement usage for removed steps
      const removedSteps = oldStepIds.filter((stepId) => !newStepIds.includes(stepId));
      for (const stepId of removedSteps) {
        const stepRef = doc(db, 'productionFlowSteps', stepId);
        const stepSnap = await getDoc(stepRef);
        if (stepSnap.exists()) {
          const currentUsage = stepSnap.data().usageCount || 0;
          batch.update(stepRef, {
            usageCount: Math.max(0, currentUsage - 1),
            updatedAt: serverTimestamp()
          });
        }
      }

      // Increment usage for added steps
      const addedSteps = newStepIds.filter((stepId) => !oldStepIds.includes(stepId));
      for (const stepId of addedSteps) {
        const stepRef = doc(db, 'productionFlowSteps', stepId);
        const stepSnap = await getDoc(stepRef);
        if (stepSnap.exists()) {
          const currentUsage = stepSnap.data().usageCount || 0;
          batch.update(stepRef, {
            usageCount: currentUsage + 1,
            updatedAt: serverTimestamp()
          });
        }
      }

      // Update stepCount
      data.stepCount = newStepIds.length;
    }

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

    batch.update(flowRef, updateData);

    // Create audit log
    const auditUserId = currentData.userId || companyId;
    createAuditLog(batch, 'update', 'productionFlow', id, updateData, auditUserId);

    await batch.commit();
  } catch (error) {
    logError('Error updating production flow', error);
    throw error;
  }
};

export const deleteProductionFlow = async (
  id: string,
  companyId: string
): Promise<void> => {
  try {
    const flowRef = doc(db, COLLECTION_NAME, id);
    const flowSnap = await getDoc(flowRef);

    if (!flowSnap.exists()) {
      throw new Error('Flow not found');
    }

    const currentData = flowSnap.data() as ProductionFlow;
    if (currentData.companyId !== companyId) {
      throw new Error('Unauthorized: Flow belongs to different company');
    }

    // Check if flow is used in any productions
    const productionsQuery = query(
      collection(db, 'productions'),
      where('companyId', '==', companyId),
      where('flowId', '==', id),
      where('isClosed', '==', false)
    );

    const productionsSnapshot = await getDocs(productionsQuery);
    if (!productionsSnapshot.empty) {
      throw new Error('Cannot delete flow: It is used in one or more active productions');
    }

    const batch = writeBatch(db);

    // Decrement usage count for steps
    const stepIds = currentData.stepIds || [];
    for (const stepId of stepIds) {
      const stepRef = doc(db, 'productionFlowSteps', stepId);
      const stepSnap = await getDoc(stepRef);
      if (stepSnap.exists()) {
        const currentUsage = stepSnap.data().usageCount || 0;
        batch.update(stepRef, {
          usageCount: Math.max(0, currentUsage - 1),
          updatedAt: serverTimestamp()
        });
      }
    }

    // Soft delete by setting isActive to false
    batch.update(flowRef, {
      isActive: false,
      updatedAt: serverTimestamp()
    });

    // Create audit log
    const auditUserId = currentData.userId || companyId;
    createAuditLog(batch, 'delete', 'productionFlow', id, { isActive: false }, auditUserId);

    await batch.commit();
  } catch (error) {
    logError('Error deleting production flow', error);
    throw error;
  }
};

export const getProductionFlow = async (
  id: string,
  companyId: string
): Promise<ProductionFlow | null> => {
  try {
    const flowRef = doc(db, COLLECTION_NAME, id);
    const flowSnap = await getDoc(flowRef);

    if (!flowSnap.exists()) {
      return null;
    }

    const flowData = flowSnap.data() as ProductionFlow;
    if (flowData.companyId !== companyId) {
      throw new Error('Unauthorized: Flow belongs to different company');
    }

    return {
      id: flowSnap.id,
      ...flowData
    };
  } catch (error) {
    logError('Error getting production flow', error);
    throw error;
  }
};

export const getDefaultProductionFlow = async (
  companyId: string
): Promise<ProductionFlow | null> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('companyId', '==', companyId),
      where('isDefault', '==', true),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }

    const flowDoc = snapshot.docs[0];
    return {
      id: flowDoc.id,
      ...flowDoc.data()
    } as ProductionFlow;
  } catch (error) {
    logError('Error getting default production flow', error);
    return null;
  }
};

