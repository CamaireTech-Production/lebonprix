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
  Timestamp,
  runTransaction
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

    const batch = writeBatch(db);

    // Calculate initial cost (charges will be added when production is created with charges)
    const chargesTotal = (data.charges || []).reduce((sum, charge) => sum + (charge.amount || 0), 0);
    const calculatedCostPrice = calculateProductionCost(data.materials || [], data.charges || []);

    // Build production data, excluding undefined values
    const productionData: any = {
      name: data.name,
      reference: data.reference || '',
      companyId,
      status: 'draft',
      stateHistory: [],
      calculatedCostPrice,
      isCostValidated: false,
      isPublished: false,
      isClosed: false,
      charges: data.charges || [],
      materials: data.materials || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Only include optional fields if they have values
    if (data.description) {
      productionData.description = data.description;
    }
    if (data.categoryId) {
      productionData.categoryId = data.categoryId;
    }
    if (data.images && data.images.length > 0) {
      productionData.images = data.images;
    }
    if (data.imagePaths && data.imagePaths.length > 0) {
      productionData.imagePaths = data.imagePaths;
    }
    if (createdBy) {
      productionData.createdBy = createdBy;
    }

    // Handle flow mode vs simple mode
    if (data.flowId) {
      // Flow mode: Validate flow exists and get it
      const flow = await getProductionFlow(data.flowId, companyId);
      if (!flow) {
        throw new Error('Flow not found');
      }

      if (!flow.stepIds || flow.stepIds.length === 0) {
        throw new Error('Flow must have at least one step');
      }

      // Set initial step (first step in flow)
      const initialStepId = data.currentStepId || flow.stepIds[0];

      // Validate currentStepId is in flow
      if (!flow.stepIds.includes(initialStepId)) {
        throw new Error('Current step must be in the selected flow');
      }

      productionData.flowId = data.flowId;
      productionData.currentStepId = initialStepId;

      // Create initial state change for flow mode
      const initialStateChangeData: any = {
        id: `state-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        toStepId: initialStepId,
        toStepName: '', // Will be populated when reading
        changedBy: data.userId || companyId,
        timestamp: Timestamp.now()
      };
      const initialStateChange: ProductionStateChange = initialStateChangeData as ProductionStateChange;
      productionData.stateHistory = [initialStateChange];
    } else {
      // Simple mode: No flow, use status-based state history
      // Create initial state change for simple mode
      const initialStateChangeData: any = {
        id: `state-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        toStatus: 'draft',
        changedBy: data.userId || companyId,
        timestamp: Timestamp.now()
      };
      const initialStateChange: ProductionStateChange = initialStateChangeData as ProductionStateChange;
      productionData.stateHistory = [initialStateChange];
    }

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
    const initialStateChange = productionData.stateHistory[0];
    
    const returnData: any = {
      id: productionRef.id,
      name: data.name,
      reference: data.reference || '',
      companyId,
      status: 'draft',
      stateHistory: [initialStateChange],
      calculatedCostPrice,
      isCostValidated: false,
      isPublished: false,
      isClosed: false,
      charges: data.charges || [],
      materials: data.materials || [],
      createdAt: { seconds: now, nanoseconds: 0 },
      updatedAt: { seconds: now, nanoseconds: 0 },
      userId: data.userId || companyId
    };

    // Only include optional fields if they have values
    if (data.description) {
      returnData.description = data.description;
    }
    if (data.categoryId) {
      returnData.categoryId = data.categoryId;
    }
    if (data.images && data.images.length > 0) {
      returnData.images = data.images;
    }
    if (data.imagePaths && data.imagePaths.length > 0) {
      returnData.imagePaths = data.imagePaths;
    }
    if (data.flowId) {
      returnData.flowId = data.flowId;
    }
    if (data.flowId && productionData.currentStepId) {
      returnData.currentStepId = productionData.currentStepId;
    }
    if (createdBy) {
      returnData.createdBy = createdBy;
    }

    return returnData as Production;
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
    if (data.materials !== undefined || data.charges !== undefined) {
      const materials = data.materials !== undefined ? data.materials : currentData.materials;
      const charges = data.charges !== undefined ? data.charges : currentData.charges;

      // Calculate charges total from production.charges array (snapshots)
      let chargesTotal = 0;
      if (data.charges && data.charges.length > 0) {
        chargesTotal = data.charges.reduce((sum, charge) => {
          return sum + (charge.amount || 0);
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

/**
 * Change production status (for productions WITHOUT flow)
 */
export const changeProductionStatus = async (
  id: string,
  newStatus: 'draft' | 'in_progress' | 'ready' | 'published' | 'cancelled' | 'closed',
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
      throw new Error('Cannot change status of closed production');
    }

    if (currentData.flowId) {
      throw new Error('This production uses a flow. Use changeProductionState instead.');
    }

    const batch = writeBatch(db);

    // Create state change record (simple mode - status-based)
    const stateChangeData: any = {
      id: `state-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      toStatus: newStatus,
      changedBy: userId,
      timestamp: Timestamp.now()
    };

    // Add optional fields only if they have values
    if (currentData.status) {
      stateChangeData.fromStatus = currentData.status;
    }
    if (note && note.trim()) {
      stateChangeData.note = note.trim();
    }

    const stateChange: ProductionStateChange = stateChangeData as ProductionStateChange;

    // Update production
    batch.update(productionRef, {
      status: newStatus,
      stateHistory: arrayUnion(stateChange),
      updatedAt: serverTimestamp()
    });

    // Create audit log
    createAuditLog(batch, 'update', 'production', id, {
      statusChange: {
        from: currentData.status,
        to: newStatus
      }
    }, userId);

    await batch.commit();
  } catch (error) {
    logError('Error changing production status', error);
    throw error;
  }
};

/**
 * Change production state (for productions WITH flow)
 * Automatically detects mode and routes to appropriate function
 */
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

    // If no flow, this function shouldn't be called
    if (!currentData.flowId) {
      throw new Error('This production does not use a flow. Use changeProductionStatus instead.');
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

    // Create state change record (flow mode - step-based)
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

    // Note: Charges are now stored as snapshots in production.charges array
    // We don't delete the charge documents themselves when deleting a production
    // as charges can be reused across multiple productions

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
  const productionRef = doc(db, COLLECTION_NAME, productionId);
  let productId: string | null = null;

  try {
    // STEP 1: Atomic transaction to acquire lock and verify state
    await runTransaction(db, async (transaction) => {
      const productionSnap = await transaction.get(productionRef);
      
      if (!productionSnap.exists()) {
        throw new Error('Production not found');
      }

      const production = productionSnap.data() as Production;

      // Verify company ownership
      if (production.companyId !== companyId) {
        throw new Error('Unauthorized: Production belongs to different company');
      }

      // Check if closed
      if (production.isClosed) {
        throw new Error('Production is already closed');
      }

      // Check if currently being published (atomic check)
      if (production.isPublishing) {
        throw new Error('Production is currently being published. Please wait...');
      }

      // Check if already published
      if (production.isPublished) {
        if (production.publishedProductId) {
          // Product already exists, return it after transaction
          productId = production.publishedProductId;
          throw new Error('ALREADY_PUBLISHED'); // Special error to handle gracefully
        }
        // Inconsistent state: isPublished but no productId
        throw new Error('Production was in inconsistent state. Please try again.');
      }

      // Atomically acquire the lock
      transaction.update(productionRef, {
        isPublishing: true,
        updatedAt: serverTimestamp()
      });
    });

    // If product already exists, return it
    if (productId) {
      const { getDoc } = await import('firebase/firestore');
      const productRef = doc(db, 'products', productId);
      const productSnap = await getDoc(productRef);
      if (productSnap.exists()) {
        const existingProduct = { id: productSnap.id, ...productSnap.data() } as import('../../../types/models').Product;
        const production = await getProduction(productionId, companyId);
        if (!production) throw new Error('Production not found');
        return { production, product: existingProduct };
      }
    }

    // STEP 2: Get production data (after lock is acquired)
    const production = await getProduction(productionId, companyId);
    if (!production) {
      throw new Error('Production not found');
    }

    // STEP 3: Validate stock availability
    const { getAvailableStockBatches } = await import('../stock/stockService');
    for (const material of production.materials) {
      const availableBatches = await getAvailableStockBatches(material.matiereId, companyId, 'matiere');
      const totalAvailable = availableBatches.reduce((sum, batch) => sum + batch.remainingQuantity, 0);
      
      if (totalAvailable < material.requiredQuantity) {
        const unit = material.unit || 'unité';
        throw new Error(
          `Insufficient stock for ${material.matiereName}. Required: ${material.requiredQuantity} ${unit}, Available: ${totalAvailable} ${unit}`
        );
      }
    }

    // STEP 4: Consume materials from stock
    const { consumeStockFromBatches } = await import('../stock/stockService');
    const { createStockChange } = await import('../stock/stockService');
    
    const consumedMaterials: Array<{
      matiereId: string;
      matiereName: string;
      consumedQuantity: number;
      batchIds: string[];
    }> = [];

    const materialsBatch = writeBatch(db);
    
    for (const material of production.materials) {
      const inventoryResult = await consumeStockFromBatches(
        materialsBatch,
        material.matiereId,
        companyId,
        material.requiredQuantity,
        'FIFO',
        'matiere'
      );

      // Create stock change for each consumed batch
      for (const consumedBatch of inventoryResult.consumedBatches) {
        createStockChange(
          materialsBatch,
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

    // Commit materials consumption
    await materialsBatch.commit();

    // STEP 5: Get employee reference for createdBy
    const { getCurrentEmployeeRef } = await import('@utils/business/employeeUtils');
    const { getUserById } = await import('@services/utilities/userService');
    
    let createdBy = null;
    try {
      const userData = await getUserById(userId);
      createdBy = getCurrentEmployeeRef(null, { uid: userId } as any, true, userData);
    } catch (error) {
      console.error('Error fetching user data for createdBy:', error);
    }

    // STEP 6: Create product
    const { createProduct } = await import('../products/productService');
    const product = await createProduct(
      {
        name: productData.name,
        reference: production.reference,
        category: productData.category,
        sellingPrice: productData.sellingPrice,
        cataloguePrice: productData.cataloguePrice ?? productData.sellingPrice,
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

    // STEP 7: Update production with all final data (close production)
    const closeBatch = writeBatch(db);

    // Create final state change
    const finalStateChangeData: any = {
      id: `state-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      changedBy: userId,
      timestamp: Timestamp.now(),
      note: 'Production publiée en produit'
    };
    
    if (production.flowId) {
      finalStateChangeData.toStepId = production.currentStepId || '';
      finalStateChangeData.toStepName = 'Publié';
      if (production.currentStepId) {
        finalStateChangeData.fromStepId = production.currentStepId;
        finalStateChangeData.fromStepName = '';
      }
    } else {
      finalStateChangeData.fromStatus = production.status;
      finalStateChangeData.toStatus = 'published';
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

    // Build catalogData without undefined values
    const catalogData: any = {
      name: productData.name,
      sellingPrice: productData.sellingPrice,
      cataloguePrice: productData.cataloguePrice ?? productData.sellingPrice,
      barCode: product.barCode,
      isVisible: productData.isVisible
    };
    
    if (productData.category) {
      catalogData.category = productData.category;
    }
    if (productData.description) {
      catalogData.description = productData.description;
    }

    // Update production with all final data
    closeBatch.update(productionRef, {
      status: 'closed',
      isClosed: true,
      isPublished: true,
      isPublishing: false, // Release the lock
      publishedProductId: product.id,
      validatedCostPrice: productData.costPrice,
      isCostValidated: true,
      closedAt: serverTimestamp(),
      closedBy: userId,
      catalogData: catalogData,
      materials: updatedMaterials,
      stateHistory: arrayUnion(finalStateChange),
      updatedAt: serverTimestamp()
    });

    // Create audit log
    createAuditLog(closeBatch, 'update', 'production', productionId, {
      action: 'published',
      productId: product.id
    }, userId);

    // Commit final update
    await closeBatch.commit();

    // STEP 8: Return result (no need to re-read, we have all the data)
    const finalProduction: Production = {
      ...production,
      status: 'closed',
      isClosed: true,
      isPublished: true,
      isPublishing: false,
      publishedProductId: product.id,
      validatedCostPrice: productData.costPrice,
      isCostValidated: true,
      closedBy: userId,
      catalogData: catalogData,
      materials: updatedMaterials,
      stateHistory: [...(production.stateHistory || []), finalStateChange],
      updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
    };

    return {
      production: finalProduction,
      product
    };
  } catch (error: any) {
    // ROLLBACK: Release publishing lock if error occurred (except if already published)
    if (error.message !== 'ALREADY_PUBLISHED') {
      try {
        const rollbackBatch = writeBatch(db);
        rollbackBatch.update(productionRef, {
          isPublishing: false,
          updatedAt: serverTimestamp()
        });
        await rollbackBatch.commit();
      } catch (rollbackError) {
        logError('Error during rollback (releasing publishing lock)', rollbackError);
      }
    }
    
    // If already published, don't log as error
    if (error.message !== 'ALREADY_PUBLISHED') {
      logError('Error publishing production', error);
    }
    
    throw error;
  }
};

