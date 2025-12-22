// Production service
import type { Production, ProductionStateChange, ProductionMaterial } from '../../../types/models';
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
  arrayUnion,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError } from '@utils/core/logger';
import { createAuditLog } from '../shared';
import { getProductionFlow } from './productionFlowService';

const COLLECTION_NAME = 'productions';

// ============================================================================
// PRODUCTION SUBSCRIPTIONS
// ============================================================================

export const subscribeToProductions = (
  companyId: string,
  callback: (productions: Production[]) => void
): (() => void) => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const productions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Production[];
      callback(productions);
    },
    (error) => {
      logError('Error subscribing to productions', error);
      callback([]);
    }
  );
};

// ============================================================================
// PRODUCTION CRUD OPERATIONS
// ============================================================================

export const createProduction = async (
  data: Omit<Production, 'id' | 'createdAt' | 'updatedAt' | 'stateHistory' | 'calculatedCostPrice' | 'isCostValidated' | 'isPublished' | 'isClosed'>,
  companyId: string,
  createdBy?: import('../../../types/models').EmployeeRef | null
): Promise<Production> => {
  try {
    // Validate production data
    if (!data.name || data.name.trim() === '') {
      throw new Error('Production name is required');
    }

    if (!data.flowId) {
      throw new Error('Flow ID is required');
    }

    // Validate flow exists and get it
    const flow = await getProductionFlow(data.flowId, companyId);
    if (!flow) {
      throw new Error('Flow not found');
    }

    if (!flow.stepIds || flow.stepIds.length === 0) {
      throw new Error('Flow must have at least one step');
    }

    // Set initial step (first step in flow)
    const initialStepId = flow.stepIds[0];
    if (!data.currentStepId) {
      data.currentStepId = initialStepId;
    }

    // Validate currentStepId is in flow
    if (!flow.stepIds.includes(data.currentStepId)) {
      throw new Error('Current step must be in the selected flow');
    }

    const batch = writeBatch(db);

    // Calculate initial cost
    const calculatedCostPrice = calculateProductionCost(data.materials || [], []);

    const productionData: any = {
      ...data,
      companyId,
      status: 'draft',
      stateHistory: [],
      calculatedCostPrice,
      isCostValidated: false,
      isPublished: false,
      isClosed: false,
      chargeIds: [],
      materials: data.materials || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (createdBy) {
      productionData.createdBy = createdBy;
    }

    // Create initial state change (use Timestamp.now() instead of serverTimestamp() for arrayUnion)
    // Filter out undefined values for Firebase compatibility
    const initialStateChangeData: any = {
      id: `state-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      toStepId: data.currentStepId,
      toStepName: '', // Will be populated when reading
      changedBy: data.userId || companyId,
      timestamp: Timestamp.now()
    };
    const initialStateChange: ProductionStateChange = initialStateChangeData as ProductionStateChange;

    // Include initial state change in production data
    productionData.stateHistory = [initialStateChange];

    const productionRef = doc(collection(db, COLLECTION_NAME));
    batch.set(productionRef, productionData);

    // Update category count if categoryId provided
    if (data.categoryId) {
      const { updateProductionCategoryCount } = await import('./productionCategoryService');
      await updateProductionCategoryCount(data.categoryId, companyId, true);
    }

    // Create audit log
    const auditUserId = data.userId || companyId;
    createAuditLog(batch, 'create', 'production', productionRef.id, productionData, auditUserId);

    await batch.commit();

    const now = Date.now() / 1000;
    return {
      id: productionRef.id,
      ...data,
      companyId,
      status: 'draft',
      stateHistory: [initialStateChange],
      calculatedCostPrice,
      isCostValidated: false,
      isPublished: false,
      isClosed: false,
      chargeIds: [],
      materials: data.materials || [],
      createdAt: { seconds: now, nanoseconds: 0 },
      updatedAt: { seconds: now, nanoseconds: 0 },
      createdBy: createdBy || undefined
    };
  } catch (error) {
    logError('Error creating production', error);
    throw error;
  }
};

export const updateProduction = async (
  id: string,
  data: Partial<Production>,
  companyId: string
): Promise<void> => {
  try {
    const productionRef = doc(db, COLLECTION_NAME, id);
    const productionSnap = await getDoc(productionRef);

    if (!productionSnap.exists()) {
      throw new Error('Production not found');
    }

    const currentData = productionSnap.data() as Production;
    if (currentData.companyId !== companyId) {
      throw new Error('Unauthorized: Production belongs to different company');
    }

    if (currentData.isClosed) {
      throw new Error('Cannot update closed production');
    }

    const batch = writeBatch(db);

    // Recalculate cost if materials or charges changed
    if (data.materials !== undefined || data.chargeIds !== undefined) {
      const materials = data.materials !== undefined ? data.materials : currentData.materials;
      const chargeIds = data.chargeIds !== undefined ? data.chargeIds : currentData.chargeIds;

      // Get charges to calculate total
      let chargesTotal = 0;
      if (chargeIds && chargeIds.length > 0) {
        const chargesQuery = query(
          collection(db, 'productionCharges'),
          where('productionId', '==', id),
          where('companyId', '==', companyId)
        );
        const chargesSnapshot = await getDocs(chargesQuery);
        chargesTotal = chargesSnapshot.docs.reduce((sum, doc) => {
          const chargeData = doc.data();
          return sum + (chargeData.amount || 0);
        }, 0);
      }

      const materialsCost = calculateMaterialsCost(materials);
      data.calculatedCostPrice = materialsCost + chargesTotal;
    }

    const updateData: any = {
      ...data,
      updatedAt: serverTimestamp()
    };

    // Handle category change
    if (data.categoryId !== undefined && data.categoryId !== currentData.categoryId) {
      // Decrement old category
      if (currentData.categoryId) {
        const { updateProductionCategoryCount } = await import('./productionCategoryService');
        await updateProductionCategoryCount(currentData.categoryId, companyId, false);
      }
      // Increment new category
      if (data.categoryId) {
        const { updateProductionCategoryCount } = await import('./productionCategoryService');
        await updateProductionCategoryCount(data.categoryId, companyId, true);
      }
    }

    // Remove undefined fields
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    batch.update(productionRef, updateData);

    // Create audit log
    const auditUserId = currentData.userId || companyId;
    createAuditLog(batch, 'update', 'production', id, updateData, auditUserId);

    await batch.commit();
  } catch (error) {
    logError('Error updating production', error);
    throw error;
  }
};

export const changeProductionState = async (
  id: string,
  newStepId: string,
  companyId: string,
  userId: string,
  note?: string
): Promise<void> => {
  try {
    const productionRef = doc(db, COLLECTION_NAME, id);
    const productionSnap = await getDoc(productionRef);

    if (!productionSnap.exists()) {
      throw new Error('Production not found');
    }

    const currentData = productionSnap.data() as Production;
    if (currentData.companyId !== companyId) {
      throw new Error('Unauthorized: Production belongs to different company');
    }

    if (currentData.isClosed) {
      throw new Error('Cannot change state of closed production');
    }

    // Validate new step is in flow
    const flow = await getProductionFlow(currentData.flowId, companyId);
    if (!flow) {
      throw new Error('Flow not found');
    }

    if (!flow.stepIds.includes(newStepId)) {
      throw new Error('Step is not available in the associated flow');
    }

    // Get step names
    const { getProductionFlowStep } = await import('./productionFlowStepService');
    const currentStep = currentData.currentStepId
      ? await getProductionFlowStep(currentData.currentStepId, companyId)
      : null;
    const newStep = await getProductionFlowStep(newStepId, companyId);

    if (!newStep) {
      throw new Error('New step not found');
    }

    const batch = writeBatch(db);

    // Create state change record (filter out undefined values)
    const stateChangeData: any = {
      id: `state-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      toStepId: newStepId,
      toStepName: newStep.name,
      changedBy: userId,
      timestamp: Timestamp.now() // Use Timestamp.now() instead of serverTimestamp() for arrayUnion
    };

    // Add optional fields only if they have values
    if (currentData.currentStepId) {
      stateChangeData.fromStepId = currentData.currentStepId;
    }
    if (currentStep?.name) {
      stateChangeData.fromStepName = currentStep.name;
    }
    if (note && note.trim()) {
      stateChangeData.note = note.trim();
    }

    const stateChange: ProductionStateChange = stateChangeData as ProductionStateChange;

    // Determine new status
    let newStatus = currentData.status;
    if (currentData.status === 'draft' && newStepId) {
      newStatus = 'in_progress';
    }

    // Update production
    batch.update(productionRef, {
      currentStepId: newStepId,
      status: newStatus,
      stateHistory: arrayUnion(stateChange),
      updatedAt: serverTimestamp()
    });

    // Create audit log
    createAuditLog(batch, 'update', 'production', id, {
      stateChange: {
        from: currentData.currentStepId,
        to: newStepId
      }
    }, userId);

    await batch.commit();
  } catch (error) {
    logError('Error changing production state', error);
    throw error;
  }
};

export const deleteProduction = async (
  id: string,
  companyId: string
): Promise<void> => {
  try {
    const productionRef = doc(db, COLLECTION_NAME, id);
    const productionSnap = await getDoc(productionRef);

    if (!productionSnap.exists()) {
      throw new Error('Production not found');
    }

    const currentData = productionSnap.data() as Production;
    if (currentData.companyId !== companyId) {
      throw new Error('Unauthorized: Production belongs to different company');
    }

    if (currentData.isPublished) {
      throw new Error('Cannot delete published production');
    }

    const batch = writeBatch(db);

    // Update category count
    if (currentData.categoryId) {
      const { updateProductionCategoryCount } = await import('./productionCategoryService');
      await updateProductionCategoryCount(currentData.categoryId, companyId, false);
    }

    // Delete associated charges
    if (currentData.chargeIds && currentData.chargeIds.length > 0) {
      for (const chargeId of currentData.chargeIds) {
        const { deleteProductionCharge } = await import('./productionChargeService');
        try {
          await deleteProductionCharge(chargeId, companyId);
        } catch (error) {
          logError(`Error deleting charge ${chargeId}`, error);
        }
      }
    }

    // Delete production
    batch.delete(productionRef);

    // Create audit log
    const auditUserId = currentData.userId || companyId;
    createAuditLog(batch, 'delete', 'production', id, {}, auditUserId);

    await batch.commit();
  } catch (error) {
    logError('Error deleting production', error);
    throw error;
  }
};

export const getProduction = async (
  id: string,
  companyId: string
): Promise<Production | null> => {
  try {
    const productionRef = doc(db, COLLECTION_NAME, id);
    const productionSnap = await getDoc(productionRef);

    if (!productionSnap.exists()) {
      return null;
    }

    const productionData = productionSnap.data() as Production;
    if (productionData.companyId !== companyId) {
      throw new Error('Unauthorized: Production belongs to different company');
    }

    return {
      id: productionSnap.id,
      ...productionData
    };
  } catch (error) {
    logError('Error getting production', error);
    throw error;
  }
};

// ============================================================================
// PRODUCTION UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate production cost from materials
 */
export const calculateMaterialsCost = (materials: ProductionMaterial[]): number => {
  return materials.reduce((sum, material) => {
    return sum + (material.requiredQuantity * material.costPrice);
  }, 0);
};

/**
 * Calculate total production cost (materials + charges)
 */
export const calculateProductionCost = (
  materials: ProductionMaterial[],
  charges: Array<{ amount: number }>
): number => {
  const materialsCost = calculateMaterialsCost(materials);
  const chargesCost = charges.reduce((sum, charge) => sum + charge.amount, 0);
  return materialsCost + chargesCost;
};

/**
 * Publish production as product
 */
export const publishProduction = async (
  productionId: string,
  productData: {
    name: string;
    category?: string;
    sellingPrice: number;
    cataloguePrice?: number;
    description?: string;
    barCode?: string;
    isVisible: boolean;
    costPrice: number; // This is the validated cost price
  },
  companyId: string,
  userId: string
): Promise<{ production: Production; product: import('../../../types/models').Product }> => {
  try {
    // Get production
    const production = await getProduction(productionId, companyId);
    if (!production) {
      throw new Error('Production not found');
    }

    if (production.isClosed) {
      throw new Error('Production is already closed');
    }

    // Validate stock availability
    const { getAvailableStockBatches } = await import('../stock/stockService');
    for (const material of production.materials) {
      const availableBatches = await getAvailableStockBatches(material.matiereId, 'matiere');
      const totalAvailable = availableBatches.reduce((sum, batch) => sum + batch.remainingQuantity, 0);
      
      if (totalAvailable < material.requiredQuantity) {
        throw new Error(
          `Insufficient stock for ${material.matiereName}. Required: ${material.requiredQuantity} ${material.unit}, Available: ${totalAvailable} ${material.unit}`
        );
      }
    }

    const batch = writeBatch(db);

    // Consume materials from stock
    const { consumeStockFromBatches } = await import('../stock/stockService');
    const { createStockChange } = await import('../stock/stockService');
    
    const consumedMaterials: Array<{
      matiereId: string;
      matiereName: string;
      consumedQuantity: number;
      batchIds: string[];
    }> = [];

    for (const material of production.materials) {
      const inventoryResult = await consumeStockFromBatches(
        batch,
        material.matiereId,
        material.requiredQuantity,
        'FIFO',
        'matiere'
      );

      // Create stock change for each consumed batch
      for (const consumedBatch of inventoryResult.consumedBatches) {
        createStockChange(
          batch,
          material.matiereId,
          -consumedBatch.consumedQuantity,
          'production',
          userId,
          companyId,
          'matiere',
          undefined,
          undefined,
          undefined,
          consumedBatch.costPrice,
          consumedBatch.batchId
        );
      }

      consumedMaterials.push({
        matiereId: material.matiereId,
        matiereName: material.matiereName,
        consumedQuantity: material.requiredQuantity,
        batchIds: inventoryResult.consumedBatches.map(cb => cb.batchId)
      });
    }

    // Create product (after batch commit for materials)
    // We need to commit the batch first to ensure materials are consumed
    await batch.commit();

    const { createProduct } = await import('../products/productService');
    const { getCurrentEmployeeRef } = await import('@utils/business/employeeUtils');
    const { getUserById } = await import('@services/utilities/userService');
    
    // Get employee reference for createdBy
    let createdBy = null;
    try {
      const userData = await getUserById(userId);
      createdBy = getCurrentEmployeeRef(null, { uid: userId } as any, true, userData);
    } catch (error) {
      console.error('Error fetching user data for createdBy:', error);
    }

    const product = await createProduct(
      {
        name: productData.name,
        reference: production.reference,
        category: productData.category,
        sellingPrice: productData.sellingPrice,
        cataloguePrice: productData.cataloguePrice || 0,
        stock: 1, // Published production becomes 1 product unit
        costPrice: productData.costPrice,
        images: production.images || [],
        imagePaths: production.imagePaths || [],
        description: productData.description,
        barCode: productData.barCode,
        isVisible: productData.isVisible,
        tags: [],
        userId,
        enableBatchTracking: true
      },
      companyId,
      {
        isOwnPurchase: true,
        isCredit: false,
        costPrice: productData.costPrice
      },
      createdBy
    );

    // Create new batch for closing production
    const closeBatch = writeBatch(db);

    // Close production
    const productionRef = doc(db, COLLECTION_NAME, productionId);
    // Create final state change (filter out undefined values for Firebase compatibility)
    const finalStateChangeData: any = {
      id: `state-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      toStepId: production.currentStepId || '', // Stay on same step
      toStepName: 'Publié',
      changedBy: userId,
      timestamp: Timestamp.now(), // Use Timestamp.now() instead of serverTimestamp() for arrayUnion
      note: 'Production publiée en produit'
    };
    
    // Add optional fields only if they have values
    if (production.currentStepId) {
      finalStateChangeData.fromStepId = production.currentStepId;
      finalStateChangeData.fromStepName = ''; // Will be populated when reading
    }
    
    const finalStateChange: ProductionStateChange = finalStateChangeData as ProductionStateChange;

    // Update materials with consumed quantities
    const updatedMaterials = production.materials.map(material => {
      const consumed = consumedMaterials.find(cm => cm.matiereId === material.matiereId);
      return {
        ...material,
        consumedQuantity: consumed?.consumedQuantity || 0,
        batchIds: consumed?.batchIds || []
      };
    });

    closeBatch.update(productionRef, {
      status: 'closed',
      isClosed: true,
      isPublished: true,
      publishedProductId: product.id,
      validatedCostPrice: productData.costPrice, // Validate cost with the provided value
      isCostValidated: true, // Mark as validated
      closedAt: serverTimestamp(),
      closedBy: userId,
      catalogData: {
        name: productData.name,
        category: productData.category,
        sellingPrice: productData.sellingPrice,
        cataloguePrice: productData.cataloguePrice,
        description: productData.description,
        barCode: product.barCode,
        isVisible: productData.isVisible
      },
      materials: updatedMaterials,
      stateHistory: arrayUnion(finalStateChange),
      updatedAt: serverTimestamp()
    });

    // Create audit log
    createAuditLog(closeBatch, 'update', 'production', productionId, {
      action: 'published',
      productId: product.id
    }, userId);

    await closeBatch.commit();

    // Get updated production
    const updatedProduction = await getProduction(productionId, companyId);
    if (!updatedProduction) {
      throw new Error('Failed to retrieve updated production');
    }

    return {
      production: updatedProduction,
      product
    };
  } catch (error) {
    logError('Error publishing production', error);
    throw error;
  }
};

