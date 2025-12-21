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
import type { Product, StockBatch, StockChange } from '../../../types/models';

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
  
  batch.update(productRef, {
    stock: currentProduct.stock + quantity,
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
  
  // Create supplier debt if credit purchase
  if (supplierId && isCredit && !isOwnPurchase) {
    const debtAmount = quantity * costPrice;
    const debtRef = doc(collection(db, 'finances'));
    const debtData = {
      id: debtRef.id,
      userId,
      companyId, // Ensure companyId is set
      sourceType: 'supplier',
      sourceId: supplierId,
      type: 'supplier_debt',
      amount: debtAmount,
      description: `Credit purchase for ${quantity} units of product ${currentProduct.name}`,
      date: serverTimestamp(),
      isDeleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      supplierId,
      batchId: stockBatchRef.id
    };
    batch.set(debtRef, debtData);
  }
  
  await batch.commit();
};

/**
 * Manual adjustment with batch selection and cost price modification
 */
export const adjustStockManually = async (
  productId: string,
  batchId: string,
  quantityChange: number,
  newCostPrice: number | undefined,
  companyId: string,
  notes?: string
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
  
  // Get userId from batch for audit
  const userId = batchData.userId || companyId;
  
  // Update batch
  const newRemainingQuantity = batchData.remainingQuantity + quantityChange;
  if (newRemainingQuantity < 0) {
    throw new Error('Batch remaining quantity cannot be negative');
  }
  
  const batchUpdates: any = {
    remainingQuantity: newRemainingQuantity,
    status: newRemainingQuantity === 0 ? 'depleted' : 'active',
    updatedAt: serverTimestamp()
  };
  
  if (newCostPrice !== undefined) {
    batchUpdates.costPrice = newCostPrice;
  }
  
  if (notes) {
    batchUpdates.notes = notes;
  }
  
  batch.update(batchRef, batchUpdates);
  
  // Update product stock
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
  
  batch.update(productRef, {
    stock: currentProduct.stock + quantityChange,
    updatedAt: serverTimestamp()
  });
  
  // Create stock change record
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
  
  // Handle supplier debt adjustment for credit purchases
  if (batchData.supplierId && batchData.isCredit && !batchData.isOwnPurchase) {
    const debtChange = quantityChange * (newCostPrice || batchData.costPrice);
    
    if (debtChange !== 0) {
      const debtRef = doc(collection(db, 'finances'));
      const debtData = {
        id: debtRef.id,
        userId,
        companyId, // Ensure companyId is set
        sourceType: 'supplier',
        sourceId: batchData.supplierId,
        type: debtChange > 0 ? 'supplier_debt' : 'supplier_refund',
        amount: Math.abs(debtChange),
        description: `Stock adjustment: ${quantityChange > 0 ? '+' : ''}${quantityChange} units of product ${currentProduct.name}`,
        date: serverTimestamp(),
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        supplierId: batchData.supplierId,
        batchId
      };
      batch.set(debtRef, debtData);
    }
  }
  
  await batch.commit();
};

/**
 * Damage adjustment - reduces stock without affecting supplier debt
 */
export const adjustStockForDamage = async (
  productId: string,
  batchId: string,
  damagedQuantity: number,
  companyId: string,
  notes?: string
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
  
  // Get userId from batch for audit
  const userId = batchData.userId || companyId;
  
  // Update batch
  const newRemainingQuantity = batchData.remainingQuantity - damagedQuantity;
  if (newRemainingQuantity < 0) {
    throw new Error('Batch remaining quantity cannot be negative');
  }
  
  // Calculate total damaged quantity (existing + new)
  const totalDamagedQuantity = (batchData.damagedQuantity || 0) + damagedQuantity;
  
  batch.update(batchRef, {
    remainingQuantity: newRemainingQuantity,
    damagedQuantity: totalDamagedQuantity,
    status: newRemainingQuantity === 0 ? 'depleted' : 'active',
    updatedAt: serverTimestamp(),
    ...(notes && { notes })
  });
  
  // Update product stock
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
  
  batch.update(productRef, {
    stock: currentProduct.stock - damagedQuantity,
    updatedAt: serverTimestamp()
  });
  
  // Create stock change record for damage
  const stockChangeRef = doc(collection(db, 'stockChanges'));
  const stockChangeData = {
    id: stockChangeRef.id,
    type: batchData.type || 'product', // Use batch type or default to product
    productId,
    change: -damagedQuantity,
    reason: 'damage' as StockChange['reason'],
    ...(batchData.supplierId && { supplierId: batchData.supplierId }),
    ...(batchData.isOwnPurchase !== undefined && { isOwnPurchase: batchData.isOwnPurchase }),
    ...(batchData.isCredit !== undefined && { isCredit: batchData.isCredit }),
    costPrice: batchData.costPrice,
    batchId,
    createdAt: serverTimestamp(),
    userId,
    companyId // Ensure companyId is set
  };
  batch.set(stockChangeRef, stockChangeData);
  
  // Note: No supplier debt adjustment for damage - debt remains unchanged
  
  await batch.commit();
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
 * Bulk adjustment for multiple batches in a single transaction
 */
export const adjustMultipleBatchesManually = async (
  productId: string,
  adjustments: Array<{
    batchId: string;
    quantityChange: number;
    newCostPrice?: number;
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
  const financeEntries: Array<any> = [];
  
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
    
    // Update batch
    const newRemainingQuantity = batchData.remainingQuantity + adjustment.quantityChange;
    if (newRemainingQuantity < 0) {
      throw new Error(`Batch ${adjustment.batchId} remaining quantity cannot be negative`);
    }
    
    const batchUpdates_item: any = {
      remainingQuantity: newRemainingQuantity,
      status: newRemainingQuantity === 0 ? 'depleted' : 'active',
      updatedAt: serverTimestamp()
    };
    
    if (adjustment.newCostPrice !== undefined) {
      batchUpdates_item.costPrice = adjustment.newCostPrice;
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
    
    // Handle supplier debt adjustment for credit purchases
    if (batchData.supplierId && batchData.isCredit && !batchData.isOwnPurchase) {
      const debtChange = adjustment.quantityChange * (adjustment.newCostPrice || batchData.costPrice);
      
      if (debtChange !== 0) {
        const debtRef = doc(collection(db, 'finances'));
        const debtData = {
          id: debtRef.id,
          userId,
          sourceType: 'supplier',
          sourceId: batchData.supplierId,
          type: debtChange > 0 ? 'supplier_debt' : 'supplier_refund',
          amount: Math.abs(debtChange),
          description: `Bulk stock adjustment: ${adjustment.quantityChange > 0 ? '+' : ''}${adjustment.quantityChange} units of product ${currentProduct.name}`,
          date: serverTimestamp(),
          isDeleted: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          supplierId: batchData.supplierId
        };
        financeEntries.push({ ref: debtRef, data: debtData });
      }
    }
  }
  
  // Apply all batch updates
  batchUpdates.forEach(({ ref, updates }) => {
    batch.update(ref, updates);
  });
  
  // Update product total stock
  batch.update(productRef, {
    stock: currentProduct.stock + totalStockChange,
    updatedAt: serverTimestamp()
  });
  
  // Add all stock changes
  stockChanges.forEach(({ ref, data }) => {
    batch.set(ref, data);
  });
  
  // Add all finance entries
  financeEntries.forEach(({ ref, data }) => {
    batch.set(ref, data);
  });
  
  // Commit all changes in a single transaction
  await batch.commit();
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
  const financeEntries: Array<any> = [];
  
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
    
    // Handle debt management for manual adjustments
    if (adjustment.scenario !== 'damage') {
      await handleBatchDebtManagement(
        batch,
        batchData,
        adjustment,
        newRemainingQuantity,
        finalCostPrice,
        currentProduct,
        companyId
      );
    }
    // For damage scenario: debts remain unchanged as specified
  }
  
  // Apply all batch updates
  batchUpdates.forEach(({ ref, updates }) => {
    batch.update(ref, updates);
  });
  
  // Update product total stock
  batch.update(productRef, {
    stock: currentProduct.stock + totalStockChange,
    updatedAt: serverTimestamp()
  });
  
  // Add all stock changes
  stockChanges.forEach(({ ref, data }) => {
    batch.set(ref, data);
  });
  
  // Add all finance entries
  financeEntries.forEach(({ ref, data }) => {
    batch.set(ref, data);
  });
  
  // Commit all changes in a single transaction
  await batch.commit();
}; 

/**
 * Dedicated function to handle debt management for batch adjustments
 * Implements the three scenarios:
 * 1. Own purchase → Supplier credit: Create new debt
 * 2. Supplier credit → Supplier credit: Update existing debt
 * 3. Supplier credit → Own purchase: Delete debt and refunds
 */
const handleBatchDebtManagement = async (
  batch: any,
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
  newRemainingQuantity: number,
  finalCostPrice: number,
  currentProduct: Product,
  companyId: string
): Promise<void> => {
  
  // Get userId for audit
  const userId = batchData.userId || companyId;
  
  // Determine the new supplier ID
  const newSupplierId = adjustment.newSupplierId;
  
  // Find existing debt and refund entries for this specific batch
  let existingDebts: any[] = [];
  let existingRefunds: any[] = [];
  
  // Get debts/refunds for this specific batch
  const batchDebtQuery = query(
    collection(db, 'finances'),
    where('companyId', '==', companyId),
    where('sourceType', '==', 'supplier'),
    where('batchId', '==', adjustment.batchId),
    where('type', '==', 'supplier_debt'),
    where('isDeleted', '==', false)
  );
  
  const batchRefundQuery = query(
    collection(db, 'finances'),
    where('companyId', '==', companyId),
    where('sourceType', '==', 'supplier'),
    where('batchId', '==', adjustment.batchId),
    where('type', '==', 'supplier_refund'),
    where('isDeleted', '==', false)
  );
  
  const [batchDebtSnapshot, batchRefundSnapshot] = await Promise.all([
    getDocs(batchDebtQuery),
    getDocs(batchRefundQuery)
  ]);
  
  existingDebts = batchDebtSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  existingRefunds = batchRefundSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Calculate current net debt (debt - refunds)
  const totalDebt = existingDebts.reduce((sum, debt) => sum + debt.amount, 0);
  const totalRefunds = existingRefunds.reduce((sum, refund) => sum + refund.amount, 0);
  const currentNetDebt = totalDebt - totalRefunds;
  
  // Scenario 3: Changing to own purchase or paid supplier
  if (adjustment.newSupplyType === 'ownPurchase' || 
      (adjustment.newSupplyType === 'fromSupplier' && adjustment.newPaymentType === 'paid')) {
    
    // Soft delete all existing debt and refund entries for this batch
    existingDebts.forEach(debt => {
      const debtRef = doc(db, 'finances', debt.id);
      batch.update(debtRef, { 
        isDeleted: true, 
        updatedAt: serverTimestamp(),
        description: `Debt deleted due to manual adjustment - batch ${adjustment.batchId}`
      });
    });
    
    existingRefunds.forEach(refund => {
      const refundRef = doc(db, 'finances', refund.id);
      batch.update(refundRef, { 
        isDeleted: true, 
        updatedAt: serverTimestamp(),
        description: `Refund deleted due to manual adjustment - batch ${adjustment.batchId}`
      });
    });
    
    console.log(`Scenario 3: Deleted ${existingDebts.length} debts and ${existingRefunds.length} refunds for batch ${adjustment.batchId}`);
    
  } else if (adjustment.newSupplyType === 'fromSupplier' && adjustment.newPaymentType === 'credit') {
    // Scenarios 1 & 2: Changing to credit supplier
    
    // Calculate new debt amount based on new remaining quantity
    const newDebtAmount = newRemainingQuantity * finalCostPrice;
    
    // Since we're now working with batch-specific debts, we should have at most one debt per batch
    if (existingDebts.length > 0) {
      // Scenario 2: Update existing debt entry (same supplier, different qty/cost)
      const existingDebt = existingDebts[0]; // Should be only one debt per batch
      const debtRef = doc(db, 'finances', existingDebt.id);
      batch.update(debtRef, { 
        amount: newDebtAmount,
        updatedAt: serverTimestamp(),
        description: `Manual adjustment debt update for batch ${adjustment.batchId} - Product: ${currentProduct.name}`
      });
      
      // If new debt is less than current net debt, create a refund for the difference
      if (newDebtAmount < currentNetDebt) {
        const refundAmount = currentNetDebt - newDebtAmount;
        const refundRef = doc(collection(db, 'finances'));
        const refundData = {
          id: refundRef.id,
          userId,
          sourceType: 'supplier',
          sourceId: newSupplierId,
          type: 'supplier_refund',
          amount: refundAmount,
          description: `Manual adjustment refund for batch ${adjustment.batchId} - Product: ${currentProduct.name}`,
          date: serverTimestamp(),
          isDeleted: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          supplierId: newSupplierId,
          refundedDebtId: existingDebt.id,
          batchId: adjustment.batchId
        };
        batch.set(refundRef, refundData);
      }
      
      console.log(`Scenario 2: Updated existing debt from ${currentNetDebt} to ${newDebtAmount} for batch ${adjustment.batchId}`);
      
    } else {
      // Scenario 1: Create new debt entry (own purchase to supplier credit)
      
      // Create new debt entry
      const newDebtRef = doc(collection(db, 'finances'));
      const newDebtData = {
        id: newDebtRef.id,
        userId,
        sourceType: 'supplier',
        sourceId: newSupplierId,
        type: 'supplier_debt',
        amount: newDebtAmount,
        description: `Manual adjustment debt creation for batch ${adjustment.batchId} - Product: ${currentProduct.name}`,
        date: serverTimestamp(),
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        supplierId: newSupplierId,
        batchId: adjustment.batchId
      };
      batch.set(newDebtRef, newDebtData);
      
      console.log(`Scenario 1: Created new debt of ${newDebtAmount} for batch ${adjustment.batchId}`);
    }
  }
};