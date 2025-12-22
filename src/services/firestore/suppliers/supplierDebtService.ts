// Supplier Debt Service - New simplified debt tracking system
import {
  collection,
  doc,
  query,
  where,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import type { SupplierDebt, SupplierDebtEntry } from '../../../types/models';
import { createAuditLog } from '../shared';

// ============================================================================
// SUPPLIER DEBT SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to all supplier debts for a company
 */
export const subscribeToSupplierDebts = (
  companyId: string,
  callback: (debts: SupplierDebt[]) => void
): (() => void) => {
  const q = query(
    collection(db, 'supplier_debts'),
    where('companyId', '==', companyId)
  );
  
  return onSnapshot(q, (snapshot) => {
    const debts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as SupplierDebt[];
    callback(debts);
  });
};

/**
 * Subscribe to a specific supplier's debt
 */
export const subscribeToSupplierDebt = (
  supplierId: string,
  companyId: string,
  callback: (debt: SupplierDebt | null) => void
): (() => void) => {
  const debtId = `${supplierId}_${companyId}`;
  const debtRef = doc(db, 'supplier_debts', debtId);
  
  return onSnapshot(debtRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({
        id: snapshot.id,
        ...snapshot.data()
      } as SupplierDebt);
    } else {
      callback(null);
    }
  });
};

// ============================================================================
// SUPPLIER DEBT CRUD OPERATIONS
// ============================================================================

/**
 * Get or create a SupplierDebt document for a supplier
 */
const getOrCreateSupplierDebt = async (
  supplierId: string,
  companyId: string,
  userId: string
): Promise<{ debtRef: any; debtData: SupplierDebt | null }> => {
  const debtId = `${supplierId}_${companyId}`;
  const debtRef = doc(db, 'supplier_debts', debtId);
  const debtSnap = await getDoc(debtRef);
  
  if (debtSnap.exists()) {
    return {
      debtRef,
      debtData: {
        id: debtSnap.id,
        ...debtSnap.data()
      } as SupplierDebt
    };
  }
  
  // Create new document with initial values
  const now = serverTimestamp();
  const initialData: Omit<SupplierDebt, 'id'> = {
    supplierId,
    companyId,
    userId,
    totalDebt: 0,
    totalRefunded: 0,
    outstanding: 0,
    entries: [],
    createdAt: now as any,
    updatedAt: now as any
  };
  
  return {
    debtRef,
    debtData: null // Will be created in batch
  };
};

/**
 * Recalculate totals from entries array
 */
const recalculateTotals = (entries: SupplierDebtEntry[]): {
  totalDebt: number;
  totalRefunded: number;
  outstanding: number;
} => {
  const totalDebt = entries
    .filter(e => e.type === 'debt')
    .reduce((sum, e) => sum + e.amount, 0);
  
  const totalRefunded = entries
    .filter(e => e.type === 'refund')
    .reduce((sum, e) => sum + e.amount, 0);
  
  const outstanding = Math.max(0, totalDebt - totalRefunded);
  
  return { totalDebt, totalRefunded, outstanding };
};

/**
 * Add a debt entry to a supplier
 * Used when stock is purchased on credit
 */
export const addSupplierDebt = async (
  supplierId: string,
  amount: number,
  description: string,
  companyId: string,
  batchId?: string
): Promise<SupplierDebt> => {
  if (!supplierId || !companyId || amount <= 0) {
    throw new Error('Invalid supplier debt data');
  }
  
  const userId = companyId; // Legacy compatibility
  
  const batch = writeBatch(db);
  
  // Get or create supplier debt document
  const { debtRef, debtData } = await getOrCreateSupplierDebt(supplierId, companyId, userId);
  
  // Create new debt entry
  const entryId = doc(collection(db, 'supplier_debts')).id; // Generate ID for entry
  const now = Timestamp.now();
  const newEntry: SupplierDebtEntry = {
    id: entryId,
    type: 'debt',
    amount: Math.abs(amount),
    description: description || 'Supplier debt',
    ...(batchId && { batchId }),
    createdAt: {
      seconds: now.seconds,
      nanoseconds: now.nanoseconds
    }
  };
  
  // Get existing entries or start with empty array
  const existingEntries = debtData?.entries || [];
  const updatedEntries = [...existingEntries, newEntry];
  
  // Recalculate totals
  const { totalDebt, totalRefunded, outstanding } = recalculateTotals(updatedEntries);
  
  // Update or create document
  if (debtData) {
    // Update existing
    batch.update(debtRef, {
      totalDebt,
      totalRefunded,
      outstanding,
      entries: updatedEntries,
      updatedAt: serverTimestamp()
    });
  } else {
    // Create new
    batch.set(debtRef, {
      id: debtRef.id,
      supplierId,
      companyId,
      userId,
      totalDebt,
      totalRefunded,
      outstanding,
      entries: updatedEntries,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
  
  // Create audit log
  createAuditLog(batch, 'update', 'supplier', supplierId, {
    action: 'add_debt',
    amount,
    description,
    batchId
  }, userId);
  
  await batch.commit();
  
  // Return updated document
  const updatedSnap = await getDoc(debtRef);
  return {
    id: updatedSnap.id,
    ...updatedSnap.data()
  } as SupplierDebt;
};

/**
 * Add a refund entry to a supplier
 * Used when paying back supplier debt
 */
export const addSupplierRefund = async (
  supplierId: string,
  amount: number,
  description: string,
  companyId: string,
  refundedDebtId?: string // Optional: link to original debt entry
): Promise<SupplierDebt> => {
  if (!supplierId || !companyId || amount <= 0) {
    throw new Error('Invalid supplier refund data');
  }
  
  const userId = companyId; // Legacy compatibility
  
  const batch = writeBatch(db);
  
  // Get or create supplier debt document
  const { debtRef, debtData } = await getOrCreateSupplierDebt(supplierId, companyId, userId);
  
  if (!debtData) {
    throw new Error('Cannot add refund: No debt record found for supplier');
  }
  
  // Check if outstanding debt is sufficient
  const currentOutstanding = debtData.outstanding || 0;
  if (amount > currentOutstanding) {
    throw new Error(`Refund amount (${amount}) exceeds outstanding debt (${currentOutstanding})`);
  }
  
  // Create new refund entry
  const entryId = doc(collection(db, 'supplier_debts')).id; // Generate ID for entry
  const now = Timestamp.now();
  const newEntry: SupplierDebtEntry = {
    id: entryId,
    type: 'refund',
    amount: Math.abs(amount),
    description: description || 'Supplier refund',
    ...(refundedDebtId && { refundedDebtId }),
    createdAt: {
      seconds: now.seconds,
      nanoseconds: now.nanoseconds
    }
  };
  
  // Add refund to entries
  const updatedEntries = [...debtData.entries, newEntry];
  
  // Recalculate totals
  const { totalDebt, totalRefunded, outstanding } = recalculateTotals(updatedEntries);
  
  // Update document
  batch.update(debtRef, {
    totalDebt,
    totalRefunded,
    outstanding,
    entries: updatedEntries,
    updatedAt: serverTimestamp()
  });
  
  // Create audit log
  createAuditLog(batch, 'update', 'supplier', supplierId, {
    action: 'add_refund',
    amount,
    description,
    refundedDebtId
  }, userId);
  
  await batch.commit();
  
  // Return updated document
  const updatedSnap = await getDoc(debtRef);
  return {
    id: updatedSnap.id,
    ...updatedSnap.data()
  } as SupplierDebt;
};

/**
 * Get supplier debt by supplier ID and company ID
 */
export const getSupplierDebt = async (
  supplierId: string,
  companyId: string
): Promise<SupplierDebt | null> => {
  const debtId = `${supplierId}_${companyId}`;
  const debtRef = doc(db, 'supplier_debts', debtId);
  const debtSnap = await getDoc(debtRef);
  
  if (!debtSnap.exists()) {
    return null;
  }
  
  return {
    id: debtSnap.id,
    ...debtSnap.data()
  } as SupplierDebt;
};

/**
 * Get all supplier debts for a company
 */
export const getSupplierDebts = async (
  companyId: string
): Promise<SupplierDebt[]> => {
  const q = query(
    collection(db, 'supplier_debts'),
    where('companyId', '==', companyId)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as SupplierDebt[];
};

/**
 * Update supplier debt entry (for adjustments)
 * Used when stock batches are adjusted and debt needs to be recalculated
 */
export const updateSupplierDebtEntry = async (
  supplierId: string,
  entryId: string,
  updates: Partial<SupplierDebtEntry>,
  companyId: string
): Promise<SupplierDebt> => {
  if (!supplierId || !entryId || !companyId) {
    throw new Error('Invalid supplier debt entry update data');
  }
  
  const userId = companyId;
  const batch = writeBatch(db);
  
  // Get supplier debt document
  const debtId = `${supplierId}_${companyId}`;
  const debtRef = doc(db, 'supplier_debts', debtId);
  const debtSnap = await getDoc(debtRef);
  
  if (!debtSnap.exists()) {
    throw new Error('Supplier debt not found');
  }
  
  const debtData = debtSnap.data() as SupplierDebt;
  
  // Find and update the entry
  const entryIndex = debtData.entries.findIndex(e => e.id === entryId);
  if (entryIndex === -1) {
    throw new Error('Debt entry not found');
  }
  
  const updatedEntries = [...debtData.entries];
  updatedEntries[entryIndex] = {
    ...updatedEntries[entryIndex],
    ...updates
  };
  
  // Recalculate totals
  const { totalDebt, totalRefunded, outstanding } = recalculateTotals(updatedEntries);
  
  // Update document
  batch.update(debtRef, {
    totalDebt,
    totalRefunded,
    outstanding,
    entries: updatedEntries,
    updatedAt: serverTimestamp()
  });
  
  // Create audit log
  createAuditLog(batch, 'update', 'supplier', supplierId, {
    action: 'update_debt_entry',
    entryId,
    updates
  }, userId);
  
  await batch.commit();
  
  // Return updated document
  const updatedSnap = await getDoc(debtRef);
  return {
    id: updatedSnap.id,
    ...updatedSnap.data()
  } as SupplierDebt;
};

/**
 * Delete a supplier debt entry (soft delete by removing from entries)
 * Used when stock batches are deleted or adjusted
 */
export const removeSupplierDebtEntry = async (
  supplierId: string,
  entryId: string,
  companyId: string
): Promise<SupplierDebt> => {
  if (!supplierId || !entryId || !companyId) {
    throw new Error('Invalid supplier debt entry removal data');
  }
  
  const userId = companyId;
  const batch = writeBatch(db);
  
  // Get supplier debt document
  const debtId = `${supplierId}_${companyId}`;
  const debtRef = doc(db, 'supplier_debts', debtId);
  const debtSnap = await getDoc(debtRef);
  
  if (!debtSnap.exists()) {
    throw new Error('Supplier debt not found');
  }
  
  const debtData = debtSnap.data() as SupplierDebt;
  
  // Remove the entry
  const updatedEntries = debtData.entries.filter(e => e.id !== entryId);
  
  // Recalculate totals
  const { totalDebt, totalRefunded, outstanding } = recalculateTotals(updatedEntries);
  
  // Update document
  batch.update(debtRef, {
    totalDebt,
    totalRefunded,
    outstanding,
    entries: updatedEntries,
    updatedAt: serverTimestamp()
  });
  
  // Create audit log
  createAuditLog(batch, 'update', 'supplier', supplierId, {
    action: 'remove_debt_entry',
    entryId
  }, userId);
  
  await batch.commit();
  
  // Return updated document
  const updatedSnap = await getDoc(debtRef);
  return {
    id: updatedSnap.id,
    ...updatedSnap.data()
  } as SupplierDebt;
};

