import {
  collection,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import type { Product, Matiere, StockBatch, StockChange, BatchAdjustment } from '../../../types/models';
import { createStockChange, getMatiereStockBatches } from './stockService';
import { addSupplierDebt, addSupplierRefund, removeSupplierDebtEntry, getSupplierDebt } from '../suppliers/supplierDebtService';
import { logError } from '@utils/core/logger';

/**
 * Enhanced restock with new cost price and batch creation
 */
export const restockProduct = async (
  productId: string,
  quantity: number,
  costPrice: number,
  companyId: string,
  supplierId?: string,
  isOwnPurchase?: boolean,
  isCredit?: boolean,
  notes?: string
): Promise<void> => {
  const batch = writeBatch(db);
  
  // Get product to verify companyId and get userId
  const productRef = doc(db, 'products', productId);
  const productSnap = await getDoc(productRef);
  if (!productSnap.exists()) {
    throw new Error('Product not found');
  }
  
  const currentProduct = productSnap.data() as Product;
  // Verify product belongs to company
  if (currentProduct.companyId !== companyId) {
    throw new Error('Unauthorized to update this product');
  }
  
  // Get userId from product for audit
  const userId = currentProduct.userId || companyId;
  
  // Create new stock batch
  const stockBatchRef = doc(collection(db, 'stockBatches'));
  const stockBatchData = {
    id: stockBatchRef.id,
    type: 'product' as const, // Always product for product restock
    productId,
    quantity,
    costPrice,
    ...(supplierId && { supplierId }),
    ...(isOwnPurchase !== undefined && { isOwnPurchase }),
    ...(isCredit !== undefined && { isCredit }),
    createdAt: serverTimestamp(),
    userId,
    companyId, // Ensure companyId is set
    remainingQuantity: quantity,
    status: 'active',
    ...(notes && { notes })
  };
  batch.set(stockBatchRef, stockBatchData);
  
  // Don't update product.stock - batches are the source of truth
  batch.update(productRef, {
    updatedAt: serverTimestamp()
  });
  
  // Create stock change record
  const stockChangeRef = doc(collection(db, 'stockChanges'));
  const stockChangeData = {
    id: stockChangeRef.id,
    type: 'product' as const, // Always product for product restock
    productId,
    change: quantity,
    reason: 'restock' as StockChange['reason'],
    ...(supplierId && { supplierId }),
    ...(isOwnPurchase !== undefined && { isOwnPurchase }),
    ...(isCredit !== undefined && { isCredit }),
    costPrice,
    batchId: stockBatchRef.id,
    createdAt: serverTimestamp(),
    userId,
    companyId // Ensure companyId is set
  };
  batch.set(stockChangeRef, stockChangeData);
  
  await batch.commit();
  
  // Create supplier debt if credit purchase (after batch commit)
  if (supplierId && isCredit && !isOwnPurchase && stockBatchRef) {
    try {
      const debtAmount = quantity * costPrice;
      await addSupplierDebt(
        supplierId,
        debtAmount,
        `Credit purchase for ${quantity} units of product ${currentProduct.name}`,
        companyId,
        stockBatchRef.id
      );
    } catch (error) {
      logError('Error creating supplier debt after restock', error);
      // Don't throw - stock was restocked successfully, debt can be fixed manually
    }
  }
};

/**
 * Restock matiere - Add new stock
 * If costPrice is provided and > 0, creates a finance entry for the expense
 */
export const restockMatiere = async (
  matiereId: string,
  quantity: number,
  companyId: string,
  notes?: string,
  costPrice?: number,
  supplierId?: string,
  isOwnPurchase?: boolean,
  isCredit?: boolean
): Promise<void> => {
  const batch = writeBatch(db);
  
  // Get matiere to verify companyId and get userId
  const matiereRef = doc(db, 'matieres', matiereId);
  const matiereSnap = await getDoc(matiereRef);
  if (!matiereSnap.exists()) {
    throw new Error('Matiere not found');
  }
  
  const currentMatiere = matiereSnap.data() as Matiere;
  // Verify matiere belongs to company
  if (currentMatiere.companyId !== companyId) {
    throw new Error('Unauthorized to update this matiere');
  }
  
  // Get userId from matiere for audit
  const userId = currentMatiere.userId || companyId;
  
  // Use provided costPrice, or get latest batch cost price, or fallback to matiere's costPrice, or 0
  let actualCostPrice = 0;
  if (costPrice && costPrice > 0) {
    actualCostPrice = costPrice;
  } else {
    // Fetch latest batch cost price as fallback (same logic as in ProductRestockModal)
    try {
      const batches = await getMatiereStockBatches(matiereId);
      if (batches.length > 0 && batches[0].costPrice > 0) {
        actualCostPrice = batches[0].costPrice;
      } else if (currentMatiere.costPrice > 0) {
        actualCostPrice = currentMatiere.costPrice;
      }
    } catch (error) {
      logError('Error fetching latest batch cost price for matiere restock', error);
      // If fetch fails, try matiere's costPrice as fallback
      if (currentMatiere.costPrice > 0) {
        actualCostPrice = currentMatiere.costPrice;
      }
    }
  }
  
  // Create new stock batch
  const stockBatchRef = doc(collection(db, 'stockBatches'));
  const stockBatchData = {
    id: stockBatchRef.id,
    type: 'matiere' as const, // Always matiere for matiere restock
    matiereId,
    quantity,
    costPrice: actualCostPrice, // Use actual cost price if provided
    ...(supplierId && { supplierId }),
    ...(isOwnPurchase !== undefined && { isOwnPurchase }),
    ...(isCredit !== undefined && { isCredit }),
    createdAt: serverTimestamp(),
    userId,
    companyId, // Ensure companyId is set
    remainingQuantity: quantity,
    status: 'active',
    ...(notes && { notes })
  };
  batch.set(stockBatchRef, stockBatchData);
  
  // Create stock change record
  createStockChange(
    batch,
    matiereId,
    quantity,
    'restock',
    userId,
    companyId,
    'matiere', // Set type to matiere
    supplierId, // Include supplier if provided
    isOwnPurchase, // Include own purchase flag
    isCredit, // Include credit flag
    actualCostPrice > 0 ? actualCostPrice : undefined, // Include cost price if provided
    stockBatchRef.id
  );
  
  // Create finance entry if cost price is provided
  if (actualCostPrice > 0) {
    const financeRef = doc(collection(db, 'finances'));
    const financeData = {
      id: financeRef.id,
      userId,
      companyId,
      sourceType: 'matiere' as const,
      sourceId: matiereId,
      type: 'matiere_purchase',
      amount: -Math.abs(quantity * actualCostPrice), // Negative for expense
      description: `Réapprovisionnement de ${quantity} ${currentMatiere.unit || 'unité'} de ${currentMatiere.name}`,
      date: serverTimestamp(),
      isDeleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      batchId: stockBatchRef.id // Link to stock batch
    };
    batch.set(financeRef, financeData);
  }
  
  await batch.commit();
  
  // Create supplier debt if credit purchase (after batch commit)
  if (supplierId && isCredit && !isOwnPurchase && stockBatchRef) {
    try {
      const debtAmount = quantity * actualCostPrice;
      await addSupplierDebt(
        supplierId,
        debtAmount,
        `Credit purchase for ${quantity} ${currentMatiere.unit || 'units'} of matiere ${currentMatiere.name}`,
        companyId,
        stockBatchRef.id
      );
    } catch (error) {
      logError('Error creating supplier debt after matiere restock', error);
      // Don't throw - stock was restocked successfully, debt can be fixed manually
    }
  }
};

/**
 * UNIFIED BATCH ADJUSTMENT FUNCTION
 * This is the main function that handles all types of batch adjustments:
 * - quantity_correction: Correct the total quantity of a batch (e.g., 10 → 6)
 * - remaining_adjustment: Adjust only the remaining quantity
 * - damage: Record damaged/lost inventory
 * - cost_correction: Update cost price only
 * - combined: Multiple adjustments at once
 */
export const adjustBatchUnified = async (
  itemId: string, // productId or matiereId
  itemType: 'product' | 'matiere',
  adjustment: BatchAdjustment,
  companyId: string
): Promise<void> => {
  const batch = writeBatch(db);
  
  // Get batch details
  const batchRef = doc(db, 'stockBatches', adjustment.batchId);
  const batchSnap = await getDoc(batchRef);
  if (!batchSnap.exists()) {
    throw new Error('Stock batch not found');
  }
  
  const batchData = batchSnap.data() as StockBatch;
  
  // Verify batch belongs to company
  if (batchData.companyId !== companyId) {
    throw new Error('Unauthorized: Batch belongs to different company');
  }
  
  // Verify batch type matches
  if (batchData.type !== itemType) {
    throw new Error(`Batch type mismatch: expected ${itemType}, got ${batchData.type}`);
  }
  
  // Verify batch belongs to the item
  if (itemType === 'product' && batchData.productId !== itemId) {
    throw new Error('Batch does not belong to this product');
  }
  if (itemType === 'matiere' && batchData.matiereId !== itemId) {
    throw new Error('Batch does not belong to this matiere');
  }
  
  // Get userId from batch for audit
  const userId = batchData.userId || companyId;
  
  // Get item details for descriptions
  let itemName = '';
  let itemUnit = '';
  if (itemType === 'product') {
    const productRef = doc(db, 'products', itemId);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) {
      throw new Error('Product not found');
    }
    const product = productSnap.data() as Product;
    if (product.companyId !== companyId) {
      throw new Error('Unauthorized: Product belongs to different company');
    }
    itemName = product.name;
  } else {
    const matiereRef = doc(db, 'matieres', itemId);
    const matiereSnap = await getDoc(matiereRef);
    if (!matiereSnap.exists()) {
      throw new Error('Matiere not found');
    }
    const matiere = matiereSnap.data() as Matiere;
    if (matiere.companyId !== companyId) {
      throw new Error('Unauthorized: Matiere belongs to different company');
    }
    itemName = matiere.name;
    itemUnit = matiere.unit || 'unité';
  }
  
  // Calculate new batch values based on adjustment type
  let newQuantity = batchData.quantity;
  let newRemainingQuantity = batchData.remainingQuantity;
  let newCostPrice = batchData.costPrice;
  let newDamagedQuantity = batchData.damagedQuantity || 0;
  let stockChangeDelta = 0;
  
  // Process adjustment based on type
  switch (adjustment.adjustmentType) {
    case 'quantity_correction':
      // Correct total quantity (e.g., 10 → 6)
      if (adjustment.newTotalQuantity === undefined) {
        throw new Error('newTotalQuantity is required for quantity_correction');
      }
      if (adjustment.newTotalQuantity < 0) {
        throw new Error('New total quantity cannot be negative');
      }
      
      newQuantity = adjustment.newTotalQuantity;
      // Adjust remaining quantity proportionally, but ensure it doesn't exceed new total
      const usedQuantity = batchData.quantity - batchData.remainingQuantity;
      newRemainingQuantity = Math.max(0, newQuantity - usedQuantity);
      
      // Calculate stock change delta
      stockChangeDelta = newRemainingQuantity - batchData.remainingQuantity;
      break;
      
    case 'remaining_adjustment':
      // Adjust only remaining quantity (delta)
      if (adjustment.remainingQuantityDelta === undefined) {
        throw new Error('remainingQuantityDelta is required for remaining_adjustment');
      }
      
      newRemainingQuantity = batchData.remainingQuantity + adjustment.remainingQuantityDelta;
      if (newRemainingQuantity < 0) {
        throw new Error('Remaining quantity cannot be negative');
      }
      // If new remaining exceeds total, update total too
      if (newRemainingQuantity > batchData.quantity) {
        newQuantity = newRemainingQuantity;
      }
      
      stockChangeDelta = adjustment.remainingQuantityDelta;
      break;
      
    case 'damage':
      // Record damage
      if (adjustment.damageQuantity === undefined || adjustment.damageQuantity <= 0) {
        throw new Error('damageQuantity must be a positive number for damage adjustment');
      }
      if (adjustment.damageQuantity > batchData.remainingQuantity) {
        throw new Error(`Damage quantity (${adjustment.damageQuantity}) cannot exceed remaining quantity (${batchData.remainingQuantity})`);
      }
      
      newRemainingQuantity = batchData.remainingQuantity - adjustment.damageQuantity;
      newDamagedQuantity = (batchData.damagedQuantity || 0) + adjustment.damageQuantity;
      stockChangeDelta = -adjustment.damageQuantity;
      break;
      
    case 'cost_correction':
      // Update cost price only
      if (adjustment.newCostPrice === undefined) {
        throw new Error('newCostPrice is required for cost_correction');
      }
      if (adjustment.newCostPrice < 0) {
        throw new Error('Cost price cannot be negative');
      }
      
      newCostPrice = adjustment.newCostPrice;
      // No quantity changes
      stockChangeDelta = 0;
      break;
      
    case 'combined':
      // Handle multiple adjustments
      if (adjustment.newTotalQuantity !== undefined) {
        if (adjustment.newTotalQuantity < 0) {
          throw new Error('New total quantity cannot be negative');
        }
        newQuantity = adjustment.newTotalQuantity;
        const usedQty = batchData.quantity - batchData.remainingQuantity;
        newRemainingQuantity = Math.max(0, newQuantity - usedQty);
      }
      
      if (adjustment.remainingQuantityDelta !== undefined) {
        newRemainingQuantity = (newRemainingQuantity || batchData.remainingQuantity) + adjustment.remainingQuantityDelta;
        if (newRemainingQuantity < 0) {
          throw new Error('Remaining quantity cannot be negative');
        }
        if (newRemainingQuantity > newQuantity) {
          newQuantity = newRemainingQuantity;
        }
      }
      
      if (adjustment.damageQuantity !== undefined && adjustment.damageQuantity > 0) {
        if (adjustment.damageQuantity > (newRemainingQuantity || batchData.remainingQuantity)) {
          throw new Error('Damage quantity cannot exceed remaining quantity');
        }
        newRemainingQuantity = (newRemainingQuantity || batchData.remainingQuantity) - adjustment.damageQuantity;
        newDamagedQuantity = (batchData.damagedQuantity || 0) + adjustment.damageQuantity;
      }
      
      if (adjustment.newCostPrice !== undefined) {
        if (adjustment.newCostPrice < 0) {
          throw new Error('Cost price cannot be negative');
        }
        newCostPrice = adjustment.newCostPrice;
      }
      
      // Calculate final stock change delta
      stockChangeDelta = newRemainingQuantity - batchData.remainingQuantity;
      break;
  }
  
  // Update batch
  const batchUpdates: any = {
    remainingQuantity: newRemainingQuantity,
    quantity: newQuantity,
    costPrice: newCostPrice,
    status: newRemainingQuantity === 0 ? 'depleted' : 'active',
    updatedAt: serverTimestamp()
  };
  
  // Update damaged quantity if applicable
  if (adjustment.adjustmentType === 'damage' || adjustment.adjustmentType === 'combined') {
    batchUpdates.damagedQuantity = newDamagedQuantity;
  }
  
  // Update notes if provided
  if (adjustment.notes) {
    batchUpdates.notes = adjustment.notes;
  }
  
  batch.update(batchRef, batchUpdates);
  
  // Update item (product or matiere) - just update timestamp
  const itemRef = itemType === 'product' 
    ? doc(db, 'products', itemId)
    : doc(db, 'matieres', itemId);
  batch.update(itemRef, {
    updatedAt: serverTimestamp()
  });
  
  // Create stock change record
  // Determine the reason for StockChange
  let stockChangeReason: StockChange['reason'] = 'manual_adjustment';
  if (adjustment.adjustmentType === 'damage') {
    stockChangeReason = 'damage';
  } else if (adjustment.adjustmentType === 'cost_correction') {
    stockChangeReason = 'cost_correction';
  } else if (adjustment.adjustmentType === 'quantity_correction') {
    stockChangeReason = 'quantity_correction';
  }
  
  // Only create stock change if quantity changed (not for cost_correction only)
  if (stockChangeDelta !== 0 || adjustment.adjustmentType === 'cost_correction') {
    const stockChangeRef = doc(collection(db, 'stockChanges'));
    const stockChangeData: StockChange = {
      id: stockChangeRef.id,
      type: itemType,
      ...(itemType === 'product' ? { productId: itemId } : { matiereId: itemId }),
      change: stockChangeDelta,
      reason: stockChangeReason,
      ...(batchData.supplierId && { supplierId: batchData.supplierId }),
      ...(batchData.isOwnPurchase !== undefined && { isOwnPurchase: batchData.isOwnPurchase }),
      ...(batchData.isCredit !== undefined && { isCredit: batchData.isCredit }),
      costPrice: newCostPrice,
      batchId: adjustment.batchId,
      createdAt: serverTimestamp(),
      userId,
      companyId,
      ...(adjustment.notes && { notes: adjustment.notes }),
      // New unified adjustment fields
      adjustmentType: adjustment.adjustmentType,
      adjustmentReason: adjustment.adjustmentReason,
      ...(adjustment.newTotalQuantity !== undefined && {
        oldQuantity: batchData.quantity,
        newQuantity: adjustment.newTotalQuantity
      }),
      ...(adjustment.newCostPrice !== undefined && {
        oldCostPrice: batchData.costPrice,
        newCostPrice: adjustment.newCostPrice
      })
    };
    batch.set(stockChangeRef, stockChangeData);
  }
  
  await batch.commit();
  
  // Handle supplier debt adjustment (only for products, not for damage, and only if quantity changed)
  if (
    itemType === 'product' &&
    adjustment.adjustmentType !== 'damage' &&
    stockChangeDelta !== 0 &&
    batchData.supplierId &&
    batchData.isCredit &&
    !batchData.isOwnPurchase
  ) {
    try {
      const debtChange = stockChangeDelta * newCostPrice;
      
      if (debtChange > 0) {
        // Increase debt
        await addSupplierDebt(
          batchData.supplierId,
          Math.abs(debtChange),
          `Stock adjustment: +${stockChangeDelta} units of ${itemName}`,
          companyId,
          adjustment.batchId
        );
      } else if (debtChange < 0) {
        // Decrease debt (refund)
        const supplierDebt = await getSupplierDebt(batchData.supplierId, companyId);
        if (supplierDebt && supplierDebt.outstanding > 0) {
          const refundAmount = Math.min(Math.abs(debtChange), supplierDebt.outstanding);
          await addSupplierRefund(
            batchData.supplierId,
            refundAmount,
            `Stock adjustment: ${stockChangeDelta} units of ${itemName}`,
            companyId
          );
        }
      }
    } catch (error) {
      logError('Error adjusting supplier debt after batch adjustment', error);
      // Don't throw - stock was adjusted successfully, debt can be fixed manually
    }
  }
};

/**
 * Manual adjustment with batch selection and cost price modification
 * quantityChange can be undefined to only update price without changing quantity
 * @deprecated Use adjustBatchUnified instead
 */
export const adjustStockManually = async (
  productId: string,
  batchId: string,
  quantityChange: number | undefined,
  newCostPrice: number | undefined,
  companyId: string,
  notes?: string,
  adjustmentMode?: 'correction' | 'addition'
): Promise<void> => {
  const batch = writeBatch(db);
  
  // At least one of quantityChange or newCostPrice must be provided
  if (quantityChange === undefined && newCostPrice === undefined) {
    throw new Error('At least one of quantityChange or newCostPrice must be provided');
  }
  
  // Get batch details
  const batchRef = doc(db, 'stockBatches', batchId);
  const batchSnap = await getDoc(batchRef);
  if (!batchSnap.exists()) {
    throw new Error('Stock batch not found');
  }
  
  const batchData = batchSnap.data() as StockBatch;
  // Verify batch belongs to company
  if (batchData.companyId !== companyId) {
    throw new Error('Unauthorized: Batch belongs to different company');
  }
  
  // Verify batch type matches
  if (batchData.type !== 'product' || !batchData.productId || batchData.productId !== productId) {
    throw new Error('Batch does not belong to this product');
  }
  
  // Get userId from batch for audit
  const userId = batchData.userId || companyId;
  
  // Update batch - only update quantity if quantityChange is provided
  const batchUpdates: any = {
    updatedAt: serverTimestamp()
  };
  
  if (quantityChange !== undefined) {
    const newRemainingQuantity = batchData.remainingQuantity + quantityChange;
    if (newRemainingQuantity < 0) {
      throw new Error('Batch remaining quantity cannot be negative');
    }
    batchUpdates.remainingQuantity = newRemainingQuantity;
    batchUpdates.status = newRemainingQuantity === 0 ? 'depleted' : 'active';
    
    // Handle different adjustment modes
    if (adjustmentMode === 'addition') {
      // Addition mode: update both remaining and total quantity
      const newTotalQuantity = batchData.quantity + (quantityChange || 0);
      batchUpdates.quantity = newTotalQuantity;
    } else {
      // Correction mode (default): only update remaining quantity
      // If new remaining quantity exceeds original quantity, update original quantity too
      // This ensures the display shows correct values (e.g., 30/30 instead of 30/23)
      if (newRemainingQuantity > batchData.quantity) {
        batchUpdates.quantity = newRemainingQuantity;
      }
    }
  }
  
  if (newCostPrice !== undefined) {
    batchUpdates.costPrice = newCostPrice;
  }
  
  if (notes) {
    batchUpdates.notes = notes;
  }
  
  batch.update(batchRef, batchUpdates);
  
  // Update product stock only if quantity is being changed
  if (quantityChange !== undefined) {
    const productRef = doc(db, 'products', productId);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) {
      throw new Error('Product not found');
    }
    
    const currentProduct = productSnap.data() as Product;
    // Verify product belongs to company
    if (currentProduct.companyId !== companyId) {
      throw new Error('Unauthorized: Product belongs to different company');
    }
    
    // Don't update product.stock - batches are the source of truth
    batch.update(productRef, {
      updatedAt: serverTimestamp()
    });
    
    // Create stock change record only if quantity changed
    const stockChangeRef = doc(collection(db, 'stockChanges'));
    const stockChangeData = {
      id: stockChangeRef.id,
      type: batchData.type || 'product', // Use batch type or default to product
      productId,
      change: quantityChange,
      reason: 'manual_adjustment' as StockChange['reason'],
      ...(batchData.supplierId && { supplierId: batchData.supplierId }),
      ...(batchData.isOwnPurchase !== undefined && { isOwnPurchase: batchData.isOwnPurchase }),
      ...(batchData.isCredit !== undefined && { isCredit: batchData.isCredit }),
      costPrice: newCostPrice || batchData.costPrice,
      batchId,
      createdAt: serverTimestamp(),
      userId,
      companyId // Ensure companyId is set
    };
    batch.set(stockChangeRef, stockChangeData);
    
    // Note: Supplier debt adjustment will be handled after batch commit (see below)
  }
  
  await batch.commit();
  
  // Handle supplier debt adjustment for credit purchases (after batch commit)
  if (batchData.supplierId && batchData.isCredit && !batchData.isOwnPurchase && quantityChange !== undefined) {
    try {
      // Get product data for name in descriptions
      const productRef = doc(db, 'products', productId);
      const productSnap = await getDoc(productRef);
      if (!productSnap.exists()) {
        throw new Error('Product not found');
      }
      const currentProduct = productSnap.data() as Product;
      
      const debtChange = quantityChange * (newCostPrice || batchData.costPrice);
      
      if (debtChange > 0) {
        // Increase debt
        await addSupplierDebt(
          batchData.supplierId,
          Math.abs(debtChange),
          `Stock adjustment: +${quantityChange} units of product ${currentProduct.name}`,
          companyId,
          batchId
        );
      } else if (debtChange < 0) {
        // Decrease debt (refund)
        // First check if there's outstanding debt
        const supplierDebt = await getSupplierDebt(batchData.supplierId, companyId);
        if (supplierDebt && supplierDebt.outstanding > 0) {
          const refundAmount = Math.min(Math.abs(debtChange), supplierDebt.outstanding);
          await addSupplierRefund(
            batchData.supplierId,
            refundAmount,
            `Stock adjustment: ${quantityChange} units of product ${currentProduct.name}`,
            companyId
          );
        }
      }
    } catch (error) {
      logError('Error adjusting supplier debt after stock adjustment', error);
      // Don't throw - stock was adjusted successfully, debt can be fixed manually
    }
  }
};

/**
 * Manual adjustment for matiere stock (simplified, no cost price adjustment)
 */
export const adjustMatiereStockManually = async (
  matiereId: string,
  batchId: string,
  quantityChange: number,
  companyId: string,
  notes?: string,
  adjustmentMode?: 'correction' | 'addition'
): Promise<void> => {
  const batch = writeBatch(db);
  
  // Get batch details
  const batchRef = doc(db, 'stockBatches', batchId);
  const batchSnap = await getDoc(batchRef);
  if (!batchSnap.exists()) {
    throw new Error('Stock batch not found');
  }
  
  const batchData = batchSnap.data() as StockBatch;
  // Verify batch belongs to company
  if (batchData.companyId !== companyId) {
    throw new Error('Unauthorized: Batch belongs to different company');
  }
  
  // Verify batch type matches
  if (batchData.type !== 'matiere' || !batchData.matiereId || batchData.matiereId !== matiereId) {
    throw new Error('Batch does not belong to this matiere');
  }
  
  // Get userId from batch for audit
  const userId = batchData.userId || companyId;
  
  // Update batch (only quantity, no cost price adjustment for matieres)
  const newRemainingQuantity = batchData.remainingQuantity + quantityChange;
  if (newRemainingQuantity < 0) {
    throw new Error('Batch remaining quantity cannot be negative');
  }
  
  const batchUpdates: any = {
    remainingQuantity: newRemainingQuantity,
    status: newRemainingQuantity === 0 ? 'depleted' : 'active',
    updatedAt: serverTimestamp()
  };
  
  // Handle different adjustment modes
  if (adjustmentMode === 'addition') {
    // Addition mode: update both remaining and total quantity
    const newTotalQuantity = batchData.quantity + quantityChange;
    batchUpdates.quantity = newTotalQuantity;
  } else {
    // Correction mode (default): only update remaining quantity
    // If new remaining quantity exceeds original quantity, update original quantity too
    // This ensures the display shows correct values (e.g., 30/30 instead of 30/23)
    if (newRemainingQuantity > batchData.quantity) {
      batchUpdates.quantity = newRemainingQuantity;
    }
  }
  
  if (notes) {
    batchUpdates.notes = notes;
  }
  
  batch.update(batchRef, batchUpdates);
  
  // Get matiere for name/unit in descriptions
  const matiereRef = doc(db, 'matieres', matiereId);
  const matiereSnap = await getDoc(matiereRef);
  if (!matiereSnap.exists()) {
    throw new Error('Matiere not found');
  }
  
  const currentMatiere = matiereSnap.data() as Matiere;
  // Verify matiere belongs to company
  if (currentMatiere.companyId !== companyId) {
    throw new Error('Unauthorized: Matiere belongs to different company');
  }
  
  // Create stock change record (no supplier, payment, or cost price for matieres)
  createStockChange(
    batch,
    matiereId,
    quantityChange,
    'manual_adjustment',
    userId,
    companyId,
    'matiere', // Set type to matiere
    undefined, // No supplier for matieres
    undefined, // No own purchase flag for matieres
    undefined, // No credit flag for matieres
    undefined, // No cost price for matieres
    batchId
  );
  
  // No supplier debt adjustments for matieres
  
  await batch.commit();
};

/**
 * Damage adjustment - reduces stock without affecting supplier debt
 * @deprecated Use adjustBatchUnified instead
 */
export const adjustStockForDamage = async (
  productId: string,
  batchId: string,
  damagedQuantity: number,
  companyId: string,
  notes?: string
): Promise<void> => {
  // Wrapper for backward compatibility
  await adjustBatchUnified(
    productId,
    'product',
    {
      batchId,
      adjustmentType: 'damage',
      adjustmentReason: 'damage',
      damageQuantity: damagedQuantity,
      notes
    },
    companyId
  );
};

/**
 * Damage adjustment for matiere - reduces stock without affecting supplier debt
 * @deprecated Use adjustBatchUnified instead
 */
export const adjustMatiereStockForDamage = async (
  matiereId: string,
  batchId: string,
  damagedQuantity: number,
  companyId: string,
  notes?: string
): Promise<void> => {
  // Wrapper for backward compatibility
  await adjustBatchUnified(
    matiereId,
    'matiere',
    {
      batchId,
      adjustmentType: 'damage',
      adjustmentReason: 'damage',
      damageQuantity: damagedQuantity,
      notes
    },
    companyId
  );
};

/**
 * Get available batches for a product (for adjustment selection)
 */
export const getProductBatchesForAdjustment = async (productId: string): Promise<StockBatch[]> => {
  const batchesSnapshot = await getDocs(
    query(
      collection(db, 'stockBatches'),
      where('type', '==', 'product'),
      where('productId', '==', productId),
      where('status', 'in', ['active', 'corrected']),
      orderBy('createdAt', 'desc')
    )
  );
  
  return batchesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as StockBatch[];
};

/**
 * Get available batches for a matiere (for adjustment selection)
 */
export const getMatiereBatchesForAdjustment = async (matiereId: string): Promise<StockBatch[]> => {
  const batchesSnapshot = await getDocs(
    query(
      collection(db, 'stockBatches'),
      where('type', '==', 'matiere'),
      where('matiereId', '==', matiereId),
      where('status', 'in', ['active', 'corrected']),
      orderBy('createdAt', 'desc')
    )
  );
  
  return batchesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as StockBatch[];
};

/**
 * Bulk adjustment for multiple batches in a single transaction
 * quantityChange can be undefined to only update price without changing quantity
 */
export const adjustMultipleBatchesManually = async (
  productId: string,
  adjustments: Array<{
    batchId: string;
    quantityChange?: number; // undefined means no quantity change
    newCostPrice?: number;
    notes?: string;
  }>,
  companyId: string
): Promise<void> => {
  const batch = writeBatch(db);
  
  // Validate that at least one adjustment has a change
  const hasAnyChange = adjustments.some(adj => adj.quantityChange !== undefined || adj.newCostPrice !== undefined);
  if (!hasAnyChange) {
    throw new Error('At least one adjustment must have quantityChange or newCostPrice');
  }
  
  // Get product details first
  const productRef = doc(db, 'products', productId);
  const productSnap = await getDoc(productRef);
  if (!productSnap.exists()) {
    throw new Error('Product not found');
  }
  
  const currentProduct = productSnap.data() as Product;
  // Verify product belongs to company
  if (currentProduct.companyId !== companyId) {
    throw new Error('Unauthorized: Product belongs to different company');
  }
  
  // Get userId from product for audit
  const userId = currentProduct.userId || companyId;
  
  let totalStockChange = 0;
  const batchUpdates: Array<{ ref: any; updates: any }> = [];
  const stockChanges: Array<any> = [];
  
  // Process each adjustment
  for (const adjustment of adjustments) {
    // At least one of quantityChange or newCostPrice must be provided for each adjustment
    if (adjustment.quantityChange === undefined && adjustment.newCostPrice === undefined) {
      continue; // Skip adjustments with no changes
    }
    
    // Get batch details
    const batchRef = doc(db, 'stockBatches', adjustment.batchId);
    const batchSnap = await getDoc(batchRef);
    if (!batchSnap.exists()) {
      throw new Error(`Stock batch ${adjustment.batchId} not found`);
    }
    
    const batchData = batchSnap.data() as StockBatch;
    // Verify batch belongs to company
    if (batchData.companyId !== companyId) {
      throw new Error(`Unauthorized: Batch ${adjustment.batchId} belongs to different company`);
    }
    
    // Update batch - only update quantity if quantityChange is provided
    const batchUpdates_item: any = {
      updatedAt: serverTimestamp()
    };
    
    if (adjustment.quantityChange !== undefined) {
      const newRemainingQuantity = batchData.remainingQuantity + adjustment.quantityChange;
      if (newRemainingQuantity < 0) {
        throw new Error(`Batch ${adjustment.batchId} remaining quantity cannot be negative`);
      }
      batchUpdates_item.remainingQuantity = newRemainingQuantity;
      batchUpdates_item.status = newRemainingQuantity === 0 ? 'depleted' : 'active';
      
      // If new remaining quantity exceeds original quantity, update original quantity too
      if (newRemainingQuantity > batchData.quantity) {
        batchUpdates_item.quantity = newRemainingQuantity;
      }
      
      totalStockChange += adjustment.quantityChange;
    }
    
    if (adjustment.newCostPrice !== undefined) {
      batchUpdates_item.costPrice = adjustment.newCostPrice;
    }
    
    if (adjustment.notes) {
      batchUpdates_item.notes = adjustment.notes;
    }
    
    batchUpdates.push({ ref: batchRef, updates: batchUpdates_item });
    
    // Create stock change record only if quantity changed
    if (adjustment.quantityChange !== undefined) {
      const stockChangeRef = doc(collection(db, 'stockChanges'));
      const stockChangeData = {
        id: stockChangeRef.id,
        type: batchData.type || 'product', // Use batch type or default to product
        productId,
        change: adjustment.quantityChange,
        reason: 'manual_adjustment' as StockChange['reason'],
        ...(batchData.supplierId && { supplierId: batchData.supplierId }),
        ...(batchData.isOwnPurchase !== undefined && { isOwnPurchase: batchData.isOwnPurchase }),
        ...(batchData.isCredit !== undefined && { isCredit: batchData.isCredit }),
        costPrice: adjustment.newCostPrice || batchData.costPrice,
        batchId: adjustment.batchId,
        createdAt: serverTimestamp(),
        userId,
        companyId // Ensure companyId is set
      };
      stockChanges.push({ ref: stockChangeRef, data: stockChangeData });
      
      // Note: Supplier debt adjustment will be handled after batch commit (see below)
    }
  }
  
  // Apply all batch updates
  batchUpdates.forEach(({ ref, updates }) => {
    batch.update(ref, updates);
  });
  
  // Don't update product.stock - batches are the source of truth
  if (totalStockChange !== 0) {
    batch.update(productRef, {
      updatedAt: serverTimestamp()
    });
  }
  
  // Add all stock changes
  stockChanges.forEach(({ ref, data }) => {
    batch.set(ref, data);
  });
  
  // Commit all changes in a single transaction
  await batch.commit();
  
  // Handle supplier debt adjustments after batch commit
  for (const adjustment of adjustments) {
    // Get batch details again (after commit)
    const batchRef = doc(db, 'stockBatches', adjustment.batchId);
    const batchSnap = await getDoc(batchRef);
    if (!batchSnap.exists()) continue;
    
    const batchData = batchSnap.data() as StockBatch;
    if (batchData.supplierId && batchData.isCredit && !batchData.isOwnPurchase && adjustment.quantityChange !== undefined) {
      try {
        const debtChange = adjustment.quantityChange * (adjustment.newCostPrice || batchData.costPrice);
        
        if (debtChange > 0) {
          // Increase debt
          await addSupplierDebt(
            batchData.supplierId,
            Math.abs(debtChange),
            `Bulk stock adjustment: +${adjustment.quantityChange} units of product ${currentProduct.name}`,
            companyId,
            adjustment.batchId
          );
        } else if (debtChange < 0) {
          // Decrease debt (refund)
          const supplierDebt = await getSupplierDebt(batchData.supplierId, companyId);
          if (supplierDebt && supplierDebt.outstanding > 0) {
            const refundAmount = Math.min(Math.abs(debtChange), supplierDebt.outstanding);
            await addSupplierRefund(
              batchData.supplierId,
              refundAmount,
              `Bulk stock adjustment: ${adjustment.quantityChange} units of product ${currentProduct.name}`,
              companyId
            );
          }
        }
      } catch (error) {
        logError(`Error adjusting supplier debt for batch ${adjustment.batchId}`, error);
        // Don't throw - stock was adjusted successfully, debt can be fixed manually
      }
    }
  }
};

/**
 * Enhanced batch adjustment with comprehensive purchase method editing and debt management
 */
export const adjustBatchWithDebtManagement = async (
  productId: string,
  adjustments: Array<{
    batchId: string;
    quantityChange: number;
    newCostPrice?: number;
    newSupplyType: 'ownPurchase' | 'fromSupplier';
    newSupplierId?: string;
    newPaymentType: 'paid' | 'credit';
    scenario: 'adjustment' | 'damage';
    notes?: string;
  }>,
  companyId: string
): Promise<void> => {
  const batch = writeBatch(db);
  
  // Get product details first
  const productRef = doc(db, 'products', productId);
  const productSnap = await getDoc(productRef);
  if (!productSnap.exists()) {
    throw new Error('Product not found');
  }
  
  const currentProduct = productSnap.data() as Product;
  // Verify product belongs to company
  if (currentProduct.companyId !== companyId) {
    throw new Error('Unauthorized: Product belongs to different company');
  }
  
  // Get userId from product for audit
  const userId = currentProduct.userId || companyId;
  
  let totalStockChange = 0;
  const batchUpdates: Array<{ ref: any; updates: any }> = [];
  const stockChanges: Array<any> = [];
  
  // Process each adjustment
  for (const adjustment of adjustments) {
    // Get batch details
    const batchRef = doc(db, 'stockBatches', adjustment.batchId);
    const batchSnap = await getDoc(batchRef);
    if (!batchSnap.exists()) {
      throw new Error(`Stock batch ${adjustment.batchId} not found`);
    }
    
    const batchData = batchSnap.data() as StockBatch;
    // Verify batch belongs to company
    if (batchData.companyId !== companyId) {
      throw new Error(`Unauthorized: Batch ${adjustment.batchId} belongs to different company`);
    }
    
    // Calculate new values based on scenario
    let newQuantity = batchData.quantity;
    let newRemainingQuantity = batchData.remainingQuantity;
    
    if (adjustment.scenario === 'damage') {
      // For damage: only reduce remaining quantity
      newRemainingQuantity = batchData.remainingQuantity + adjustment.quantityChange;
      if (newRemainingQuantity < 0) {
        throw new Error(`Batch ${adjustment.batchId} remaining quantity cannot be negative`);
      }
    } else {
      // For manual adjustment: update total quantity and recalculate remaining
      newQuantity = batchData.quantity + adjustment.quantityChange;
      const usedQuantity = batchData.quantity - batchData.remainingQuantity;
      newRemainingQuantity = newQuantity - usedQuantity;
      
      if (newQuantity < 0) {
        throw new Error(`Batch ${adjustment.batchId} total quantity cannot be negative`);
      }
      if (newRemainingQuantity < 0) {
        throw new Error(`Batch ${adjustment.batchId} remaining quantity cannot be negative`);
      }
    }
    
    const finalCostPrice = adjustment.scenario === 'damage' ? batchData.costPrice : (adjustment.newCostPrice || batchData.costPrice);
    
    // Update batch with comprehensive changes
    const batchUpdates_item: any = {
      quantity: newQuantity,
      remainingQuantity: newRemainingQuantity,
      status: newRemainingQuantity === 0 ? 'depleted' : 'active',
      costPrice: finalCostPrice,
      isOwnPurchase: adjustment.newSupplyType === 'ownPurchase',
      isCredit: adjustment.newPaymentType === 'credit',
      updatedAt: serverTimestamp()
    };
    
    if (adjustment.newSupplierId) {
      batchUpdates_item.supplierId = adjustment.newSupplierId;
    }
    
    if (adjustment.notes) {
      batchUpdates_item.notes = adjustment.notes;
    }
    
    batchUpdates.push({ ref: batchRef, updates: batchUpdates_item });
    totalStockChange += adjustment.quantityChange;
    
    // Create stock change record
    const stockChangeRef = doc(collection(db, 'stockChanges'));
    const stockChangeData = {
      id: stockChangeRef.id,
      type: batchData.type || 'product', // Use batch type or default to product
      productId,
      change: adjustment.quantityChange,
      reason: adjustment.scenario === 'damage' ? 'damage' : 'manual_adjustment',
      ...(adjustment.newSupplierId && { supplierId: adjustment.newSupplierId }),
      isOwnPurchase: adjustment.newSupplyType === 'ownPurchase',
      isCredit: adjustment.newPaymentType === 'credit',
      costPrice: finalCostPrice,
      batchId: adjustment.batchId,
      createdAt: serverTimestamp(),
      userId,
      companyId // Ensure companyId is set
    };
    stockChanges.push({ ref: stockChangeRef, data: stockChangeData });
    
    // Note: Debt management will be handled after batch commit (see below)
    // For damage scenario: debts remain unchanged as specified
  }
  
  // Apply all batch updates
  batchUpdates.forEach(({ ref, updates }) => {
    batch.update(ref, updates);
  });
  
  // Don't update product.stock - batches are the source of truth
  batch.update(productRef, {
    updatedAt: serverTimestamp()
  });
  
  // Add all stock changes
  stockChanges.forEach(({ ref, data }) => {
    batch.set(ref, data);
  });
  
  // Commit all changes in a single transaction
  await batch.commit();
  
  // Handle supplier debt management after batch commit (only for non-damage scenarios)
  for (const adjustment of adjustments) {
    if (adjustment.scenario === 'damage') {
      continue; // For damage scenario: debts remain unchanged
    }
    
    const batchRef = doc(db, 'stockBatches', adjustment.batchId);
    const batchSnap = await getDoc(batchRef);
    if (!batchSnap.exists()) continue;
    
    const batchData = batchSnap.data() as StockBatch;
    await handleBatchDebtManagement(
      batchData,
      adjustment,
      currentProduct,
      companyId
    );
  }
}; 

/**
 * Dedicated function to handle debt management for batch adjustments
 * Implements the three scenarios:
 * 1. Own purchase → Supplier credit: Create new debt
 * 2. Supplier credit → Supplier credit: Update existing debt
 * 3. Supplier credit → Own purchase: Delete debt and refunds
 * 
 * NOTE: This function is called AFTER the batch commits, so it uses the new supplier debt service
 */
const handleBatchDebtManagement = async (
  batchData: StockBatch,
  adjustment: {
    batchId: string;
    quantityChange: number;
    newCostPrice?: number;
    newSupplyType: 'ownPurchase' | 'fromSupplier';
    newSupplierId?: string;
    newPaymentType: 'paid' | 'credit';
    scenario: 'adjustment' | 'damage';
    notes?: string;
  },
  currentProduct: Product,
  companyId: string
): Promise<void> => {
  try {
    // Get the batch again to get updated remaining quantity
    const batchRef = doc(db, 'stockBatches', adjustment.batchId);
    const batchSnap = await getDoc(batchRef);
    if (!batchSnap.exists()) return;
    
    const updatedBatchData = batchSnap.data() as StockBatch;
    const newRemainingQuantity = updatedBatchData.remainingQuantity;
    const finalCostPrice = adjustment.newCostPrice || updatedBatchData.costPrice;
    const newSupplierId = adjustment.newSupplierId;
    
    // Get supplier debt for the old supplier (if exists)
    const oldSupplierId = batchData.supplierId;
    const oldSupplierDebt = oldSupplierId ? await getSupplierDebt(oldSupplierId, companyId) : null;
    
    // Find entries related to this batch
    const batchDebtEntries = oldSupplierDebt?.entries.filter(e => e.batchId === adjustment.batchId && e.type === 'debt') || [];
    const batchRefundEntries = oldSupplierDebt?.entries.filter(e => e.batchId === adjustment.batchId && e.type === 'refund') || [];
    
    // Calculate current net debt for this batch
    const batchDebtAmount = batchDebtEntries.reduce((sum, e) => sum + e.amount, 0);
    const batchRefundAmount = batchRefundEntries.reduce((sum, e) => sum + e.amount, 0);
    const currentBatchNetDebt = batchDebtAmount - batchRefundAmount;
    
    // Scenario 3: Changing to own purchase or paid supplier
    if (adjustment.newSupplyType === 'ownPurchase' || 
        (adjustment.newSupplyType === 'fromSupplier' && adjustment.newPaymentType === 'paid')) {
      
      // Remove all debt entries for this batch
      if (oldSupplierId && batchDebtEntries.length > 0) {
        for (const entry of batchDebtEntries) {
          await removeSupplierDebtEntry(oldSupplierId, entry.id, companyId);
        }
        // If there were refunds, we need to adjust them too
        // For simplicity, we'll create a new debt entry to offset the refunds
        if (batchRefundAmount > 0) {
          await addSupplierDebt(
            oldSupplierId,
            batchRefundAmount,
            `Debt adjustment: Removing batch ${adjustment.batchId} refunds`,
            companyId,
            adjustment.batchId
          );
        }
      }
      
      console.log(`Scenario 3: Removed debts for batch ${adjustment.batchId}`);
      
    } else if (adjustment.newSupplyType === 'fromSupplier' && adjustment.newPaymentType === 'credit' && newSupplierId) {
      // Scenarios 1 & 2: Changing to credit supplier
      
      // Calculate new debt amount based on new remaining quantity
      const newDebtAmount = newRemainingQuantity * finalCostPrice;
      
      if (oldSupplierId && batchDebtEntries.length > 0) {
        // Scenario 2: Update existing debt (same or different supplier)
        // Remove old entries for this batch
        for (const entry of [...batchDebtEntries, ...batchRefundEntries]) {
          await removeSupplierDebtEntry(oldSupplierId, entry.id, companyId);
        }
        
        // If supplier changed, we need to handle the old supplier separately
        if (oldSupplierId !== newSupplierId) {
          // Old supplier: create refund for the removed debt
          if (currentBatchNetDebt > 0) {
            await addSupplierRefund(
              oldSupplierId,
              currentBatchNetDebt,
              `Batch ${adjustment.batchId} transferred to another supplier`,
              companyId
            );
          }
        }
        
        // Create new debt entry for new supplier (or same supplier with new amount)
        if (newDebtAmount > 0) {
          await addSupplierDebt(
            newSupplierId,
            newDebtAmount,
            `Manual adjustment debt for batch ${adjustment.batchId} - Product: ${currentProduct.name}`,
            companyId,
            adjustment.batchId
          );
        }
        
        console.log(`Scenario 2: Updated debt from ${currentBatchNetDebt} to ${newDebtAmount} for batch ${adjustment.batchId}`);
        
      } else {
        // Scenario 1: Create new debt entry (own purchase to supplier credit)
        if (newDebtAmount > 0) {
          await addSupplierDebt(
            newSupplierId,
            newDebtAmount,
            `Manual adjustment debt creation for batch ${adjustment.batchId} - Product: ${currentProduct.name}`,
            companyId,
            adjustment.batchId
          );
        }
        
        console.log(`Scenario 1: Created new debt of ${newDebtAmount} for batch ${adjustment.batchId}`);
      }
    }
  } catch (error) {
    logError(`Error handling batch debt management for batch ${adjustment.batchId}`, error);
    // Don't throw - stock was adjusted successfully, debt can be fixed manually
  }
};

/**
 * Delete a stock batch with proper validation and cleanup
 * Uses soft delete to preserve data integrity and audit trail
 */
export const deleteStockBatch = async (
  batchId: string,
  companyId: string,
  userId: string
): Promise<void> => {
  const batch = writeBatch(db);
  
  // Get batch details
  const batchRef = doc(db, 'stockBatches', batchId);
  const batchSnap = await getDoc(batchRef);
  if (!batchSnap.exists()) {
    throw new Error('Stock batch not found');
  }
  
  const batchData = batchSnap.data() as StockBatch;
  // Verify batch belongs to company
  if (batchData.companyId !== companyId) {
    throw new Error('Unauthorized: Batch belongs to different company');
  }
  
  // Validation: Can only delete batches with no remaining stock
  if (batchData.remainingQuantity > 0) {
    throw new Error('Cannot delete batch with remaining stock. Please adjust stock to 0 first.');
  }
  
  // Get product/matiere details for descriptions
  let itemDetails: { name: string; type: 'product' | 'matiere' };
  if (batchData.type === 'product' && batchData.productId) {
    const productRef = doc(db, 'products', batchData.productId);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) {
      throw new Error('Associated product not found');
    }
    const product = productSnap.data() as Product;
    itemDetails = { name: product.name, type: 'product' };
  } else if (batchData.type === 'matiere' && batchData.matiereId) {
    const matiereRef = doc(db, 'matieres', batchData.matiereId);
    const matiereSnap = await getDoc(matiereRef);
    if (!matiereSnap.exists()) {
      throw new Error('Associated matiere not found');
    }
    const matiere = matiereSnap.data() as Matiere;
    itemDetails = { name: matiere.name, type: 'matiere' };
  } else {
    throw new Error('Invalid batch type or missing reference');
  }
  
  // Soft delete the batch (preserve data for audit)
  batch.update(batchRef, {
    isDeleted: true,
    status: 'deleted',
    deletedAt: serverTimestamp(),
    deletedBy: userId,
    updatedAt: serverTimestamp()
  });
  
  // Create stock change record for the deletion
  const stockChangeRef = doc(collection(db, 'stockChanges'));
  const stockChangeData = {
    id: stockChangeRef.id,
    type: batchData.type,
    ...(batchData.productId && { productId: batchData.productId }),
    ...(batchData.matiereId && { matiereId: batchData.matiereId }),
    change: 0, // No quantity change for deletion
    reason: 'batch_deletion' as StockChange['reason'],
    ...(batchData.supplierId && { supplierId: batchData.supplierId }),
    ...(batchData.isOwnPurchase !== undefined && { isOwnPurchase: batchData.isOwnPurchase }),
    ...(batchData.isCredit !== undefined && { isCredit: batchData.isCredit }),
    costPrice: batchData.costPrice,
    batchId,
    createdAt: serverTimestamp(),
    userId,
    companyId,
    notes: `Batch deleted: ${batchData.id} - ${itemDetails.name}`
  };
  batch.set(stockChangeRef, stockChangeData);
  
  await batch.commit();
  
  // Handle supplier debt cleanup (after batch commit)
  if (batchData.supplierId && batchData.isCredit && !batchData.isOwnPurchase) {
    try {
      // Check if there's outstanding debt for this batch
      const supplierDebt = await getSupplierDebt(batchData.supplierId, companyId);
      if (supplierDebt && supplierDebt.outstanding > 0) {
        // Note: We don't automatically clear debt on batch deletion to preserve financial records
        // The debt remains as a financial obligation even if the batch is deleted
        logError('Batch deletion warning: Outstanding supplier debt remains for deleted batch', {
          batchId,
          supplierId: batchData.supplierId,
          outstandingDebt: supplierDebt.outstanding
        });
      }
    } catch (error) {
      logError('Error checking supplier debt for deleted batch', error);
      // Don't throw - batch was deleted successfully
    }
  }
};
