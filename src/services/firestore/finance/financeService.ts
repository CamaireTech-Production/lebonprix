// Finance service - extracted from firestore.ts
import {
  collection,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  serverTimestamp,
  writeBatch,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError, logWarning } from '@utils/core/logger';
import type { FinanceEntry, FinanceEntryType, Sale, Expense } from '../../../types/models';
import { createAuditLog } from '../shared';

// Temporary imports from other services - will be updated after refactoring
const softDeleteSale = async (saleId: string, companyId: string): Promise<void> => {
  const { softDeleteSale: deleteSale } = await import('../sales/saleService');
  await deleteSale(saleId, companyId);
};

const softDeleteExpense = async (expenseId: string, userId: string): Promise<void> => {
  const { softDeleteExpense: deleteExpense } = await import('../expenses/expenseService');
  await deleteExpense(expenseId, userId);
};

// ============================================================================
// FINANCE ENTRY CRUD OPERATIONS
// ============================================================================

export const createFinanceEntry = async (entry: Omit<FinanceEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<FinanceEntry> => {
  const ref = doc(collection(db, 'finances'));
  const now = serverTimestamp();
  
  const data = { 
    ...entry, 
    isDeleted: entry.isDeleted !== undefined ? entry.isDeleted : false,
    createdAt: now, 
    updatedAt: now 
  };
  
  if (entry.sourceType === 'manual' && entry.type === 'sortie') {
    if (data.amount >= 0) {
      logWarning('Sortie amount should be negative, fixing it');
      data.amount = -Math.abs(data.amount);
    }
  }
  
  if (entry.sourceType === 'manual') {
    const batch = writeBatch(db);
    batch.set(ref, data);
    await createAuditLog(
      batch,
      'create',
      'finance',
      ref.id,
      { all: { oldValue: null, newValue: data } },
      entry.userId
    );
    
    await batch.commit();
  } else {
    await setDoc(ref, data);
  }
  
  const snap = await getDoc(ref);
  const savedData = snap.data();
  
  return { id: ref.id, ...savedData } as FinanceEntry;
};

export const updateFinanceEntry = async (id: string, data: Partial<FinanceEntry>): Promise<void> => {
  const ref = doc(db, 'finances', id);
  
  if (data.type === 'sortie' && data.amount !== undefined) {
    if (data.amount >= 0) {
      data.amount = -Math.abs(data.amount);
    }
  }
  
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
};

export const softDeleteFinanceEntry = async (id: string): Promise<void> => {
  await updateFinanceEntry(id, { isDeleted: true });
};

export const softDeleteFinanceEntryWithCascade = async (financeEntryId: string): Promise<void> => {
  const ref = doc(db, 'finances', financeEntryId);
  const entrySnap = await getDoc(ref);
  if (!entrySnap.exists()) return;
  const entry = entrySnap.data() as FinanceEntry;
  
  await updateFinanceEntry(financeEntryId, { isDeleted: true });
  
  if (entry.sourceType === 'sale' && entry.sourceId) {
    await softDeleteSale(entry.sourceId, entry.companyId);
  } else if (entry.sourceType === 'expense' && entry.sourceId) {
    await softDeleteExpense(entry.sourceId, entry.companyId);
  }
  
  if (entry.type === 'debt') {
    let q = query(collection(db, 'finances'), where('type', '==', 'refund'), where('refundedDebtId', '==', financeEntryId));
    let snap = await getDocs(q);
    if (!snap.empty) {
      for (const docSnap of snap.docs) {
        await updateFinanceEntry(docSnap.id, { isDeleted: true });
      }
    } else {
      const allRefundsSnap = await getDocs(query(collection(db, 'finances'), where('type', '==', 'refund')));
      for (const docSnap of allRefundsSnap.docs) {
        const refund = docSnap.data();
        if (refund.refundedDebtId && String(refund.refundedDebtId) === String(financeEntryId)) {
          await updateFinanceEntry(docSnap.id, { isDeleted: true });
        }
      }
    }
  }
};

// ============================================================================
// SYNC WITH SALES/EXPENSES
// ============================================================================

export const syncFinanceEntryWithSale = async (sale: Sale) => {
  if (!sale || !sale.id || !sale.userId || !sale.companyId) {
    logWarning('syncFinanceEntryWithSale: Invalid sale object received, skipping sync');
    return;
  }

  const q = query(collection(db, 'finances'), where('sourceType', '==', 'sale'), where('sourceId', '==', sale.id));
  const snap = await getDocs(q);
  const entry: Omit<FinanceEntry, 'id' | 'createdAt' | 'updatedAt'> = {
    userId: sale.userId,
    companyId: sale.companyId,
    sourceType: 'sale',
    sourceId: sale.id,
    type: 'sale',
    amount: sale.totalAmount,
    description: `Sale to ${sale.customerInfo.name}`,
    date: sale.createdAt,
    isDeleted: sale.isAvailable === false,
  };
  if (snap.empty) {
    await createFinanceEntry(entry);
  } else {
    const docId = snap.docs[0].id;
    await updateFinanceEntry(docId, entry);
  }
};

export const syncFinanceEntryWithExpense = async (expense: Expense) => {
  if (!expense || !expense.id || !expense.userId || !expense.companyId) {
    logWarning('syncFinanceEntryWithExpense: Invalid expense object received, skipping sync');
    return;
  }

  const q = query(collection(db, 'finances'), where('sourceType', '==', 'expense'), where('sourceId', '==', expense.id));
  const entry: Omit<FinanceEntry, 'id' | 'createdAt' | 'updatedAt'> = {
    userId: expense.userId,
    companyId: expense.companyId,
    sourceType: 'expense',
    sourceId: expense.id,
    type: 'expense',
    amount: -Math.abs(expense.amount),
    description: expense.description,
    date: expense.date || expense.createdAt,
    isDeleted: expense.isAvailable === false,
  };
  const snap = await getDocs(q);
  if (snap.empty) {
    await createFinanceEntry(entry);
  } else {
    const docId = snap.docs[0].id;
    await updateFinanceEntry(docId, entry);
  }
};

// ============================================================================
// FINANCE ENTRY TYPES
// ============================================================================

export const createFinanceEntryType = async (type: Omit<FinanceEntryType, 'id' | 'createdAt'>): Promise<FinanceEntryType> => {
  const ref = doc(collection(db, 'financeEntryTypes'));
  const now = serverTimestamp();
  const data = { ...type, createdAt: now };
  await setDoc(ref, data);
  const snap = await getDoc(ref);
  return { id: ref.id, ...snap.data() } as FinanceEntryType;
};

export const getFinanceEntryTypes = async (userId: string): Promise<FinanceEntryType[]> => {
  const defaultSnap = await getDocs(query(collection(db, 'financeEntryTypes'), where('isDefault', '==', true)));
  const userSnap = await getDocs(query(collection(db, 'financeEntryTypes'), where('userId', '==', userId)));
  const allDocs = [...defaultSnap.docs, ...userSnap.docs];
  const seen = new Set();
  const types: FinanceEntryType[] = [];
  for (const doc of allDocs) {
    if (!seen.has(doc.id)) {
      seen.add(doc.id);
      types.push({ id: doc.id, ...doc.data() } as FinanceEntryType);
    }
  }
  return types;
};

export const ensureDefaultFinanceEntryTypes = async (): Promise<void> => {
  const defaultTypes = [
    { name: 'loan', isDefault: true },
    { name: 'expense', isDefault: true },
    { name: 'sale', isDefault: true },
    { name: 'refund', isDefault: true },
    { name: 'debt', isDefault: true },
    { name: 'supplier_debt', isDefault: true },
    { name: 'supplier_refund', isDefault: true },
    { name: 'sortie', isDefault: true },
    { name: 'other', isDefault: true }
  ];

  const existingDefaultsQuery = query(
    collection(db, 'financeEntryTypes'),
    where('isDefault', '==', true)
  );
  const existingDefaultsSnap = await getDocs(existingDefaultsQuery);
  
  const existingTypeNames = new Set(
    existingDefaultsSnap.docs.map(doc => doc.data().name)
  );
  
  const missingTypes = defaultTypes.filter(type => !existingTypeNames.has(type.name));
  
  if (missingTypes.length === 0) {
    return;
  }
  
  const batch = writeBatch(db);
  
  for (const typeData of missingTypes) {
    const typeRef = doc(collection(db, 'financeEntryTypes'));
    const newType = {
      id: typeRef.id,
      name: typeData.name,
      isDefault: true,
      createdAt: serverTimestamp()
    };
    batch.set(typeRef, newType);
  }
  
  try {
    await batch.commit();
  } catch (error) {
    logError('Error creating default finance entry types', error);
    throw error;
  }
};

