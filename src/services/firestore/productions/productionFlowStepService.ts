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

    const batch = writeBatch(db);

    const stepData: any = {
      ...data,
      companyId,
      isActive: data.isActive !== false,
      usageCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (createdBy) {
      stepData.createdBy = createdBy;
    }

    const stepRef = doc(collection(db, COLLECTION_NAME));
    batch.set(stepRef, stepData);

    // Create audit log
    const auditUserId = data.userId || companyId;
    createAuditLog(batch, 'create', 'productionFlowStep', stepRef.id, stepData, auditUserId);

    await batch.commit();

    const now = Date.now() / 1000;
    return {
      id: stepRef.id,
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
      estimatedDuration: data.estimatedDuration,
      companyId,
      userId: data.userId,
      isActive: data.isActive !== false,
      usageCount: 0,
      createdAt: { seconds: now, nanoseconds: 0 },
      updatedAt: { seconds: now, nanoseconds: 0 },
      createdBy: createdBy || undefined
    };
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

