// Supplier service - extracted from firestore.ts
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
  Timestamp
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import type { Supplier, FinanceEntry } from '../../../types/models';
import { createAuditLog } from '../shared';
import { addSupplierRefund, getSupplierDebt } from './supplierDebtService';

// Temporary import from firestore.ts - will be moved to finance/ later
const createFinanceEntry = async (entry: Omit<FinanceEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<FinanceEntry> => {
  const { createFinanceEntry: createEntry } = await import('../firestore');
  return createEntry(entry);
};

// ============================================================================
// SUPPLIER SUBSCRIPTIONS
// ============================================================================

export const subscribeToSuppliers = (companyId: string, callback: (suppliers: Supplier[]) => void): (() => void) => {
  const q = query(
    collection(db, 'suppliers'),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  
  return onSnapshot(q, (snapshot) => {
    const suppliers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Supplier[];
    callback(suppliers);
  });
};

// ============================================================================
// SUPPLIER CRUD OPERATIONS
// ============================================================================

export const createSupplier = async (
  data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>,
  companyId: string,
  createdBy?: import('../../../types/models').EmployeeRef | null
): Promise<Supplier> => {
  if (!data.name || !data.contact) {
    throw new Error('Invalid supplier data');
  }

  const userId = data.userId || companyId;

  const batch = writeBatch(db);
  
  const supplierRef = doc(collection(db, 'suppliers'));
  const supplierData: any = {
    ...data,
    userId,
    companyId,
    isDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  if (createdBy) {
    supplierData.createdBy = createdBy;
  }
  
  batch.set(supplierRef, supplierData);
  
  createAuditLog(batch, 'create', 'supplier', supplierRef.id, supplierData, userId);
  
  await batch.commit();
  
  return {
    id: supplierRef.id,
    ...supplierData,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  };
};

export const updateSupplier = async (
  id: string,
  data: Partial<Supplier>,
  companyId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const supplierRef = doc(db, 'suppliers', id);
  
  const supplierSnap = await getDoc(supplierRef);
  if (!supplierSnap.exists()) {
    throw new Error('Supplier not found');
  }
  
  const supplier = supplierSnap.data() as Supplier;
  if (supplier.companyId !== companyId) {
    throw new Error('Unauthorized: Supplier belongs to different company');
  }
  
  const userId = supplier.userId || companyId;
  
  const updateData = {
    ...data,
    updatedAt: serverTimestamp()
  };
  batch.update(supplierRef, updateData);
  
  createAuditLog(batch, 'update', 'supplier', id, updateData, userId);
  
  await batch.commit();
};

export const softDeleteSupplier = async (
  id: string,
  companyId: string
): Promise<void> => {
  const batch = writeBatch(db);
  const supplierRef = doc(db, 'suppliers', id);
  
  const supplierSnap = await getDoc(supplierRef);
  if (!supplierSnap.exists()) {
    throw new Error('Supplier not found');
  }
  
  const supplier = supplierSnap.data() as Supplier;
  if (supplier.companyId !== companyId) {
    throw new Error('Unauthorized: Supplier belongs to different company');
  }
  
  const userId = supplier.userId || companyId;
  
  // Check for outstanding debts using the new supplier debt service
  const supplierDebt = await getSupplierDebt(id, companyId);
  if (supplierDebt && supplierDebt.outstanding > 0) {
    throw new Error('Cannot delete supplier with outstanding debts');
  }
  
  batch.update(supplierRef, {
    isDeleted: true,
    updatedAt: serverTimestamp()
  });
  
  createAuditLog(batch, 'delete', 'supplier', id, { isDeleted: { oldValue: false, newValue: true } }, userId);
  
  await batch.commit();
};

// ============================================================================
// SUPPLIER FINANCE OPERATIONS
// ============================================================================

/**
 * Create supplier refund using the new supplier debt service
 * This replaces the old finance entry-based refund system
 * 
 * NOTE: createSupplierDebt has been removed - use addSupplierDebt from supplierDebtService instead
 */
export const createSupplierRefund = async (
  supplierId: string,
  amount: number,
  description: string,
  refundedDebtId: string,
  companyId: string
): Promise<void> => {
  // Use the new supplier debt service instead of creating finance entries
  await addSupplierRefund(
    supplierId,
    amount,
    description,
    companyId,
    refundedDebtId
  );
};

