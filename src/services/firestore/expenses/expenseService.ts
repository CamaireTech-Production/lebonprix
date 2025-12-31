// Expense service - extracted from firestore.ts
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
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError, devLog } from '@utils/core/logger';
import type { Expense, ExpenseType } from '../../../types/models';
import { createAuditLog } from '../shared';

// Temporary import from firestore.ts - will be moved to finance/ later
const syncFinanceEntryWithExpense = async (expense: Expense) => {
  const { logWarning } = await import('@utils/core/logger');
  
  if (!expense || !expense.id || !expense.userId || !expense.companyId) {
    logWarning('syncFinanceEntryWithExpense: Invalid expense object received, skipping sync');
    return;
  }

  const q = query(collection(db, 'finances'), where('sourceType', '==', 'expense'), where('sourceId', '==', expense.id));
  const { createFinanceEntry, updateFinanceEntry } = await import('../firestore');
  
  const entry: any = {
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
// EXPENSE SUBSCRIPTIONS
// ============================================================================

export const subscribeToExpenses = (companyId: string, callback: (expenses: Expense[]) => void): (() => void) => {
  const q = query(
    collection(db, 'expenses'),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  
  return onSnapshot(q, (snapshot) => {
    const expenses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Expense[];
    callback(expenses.filter(expense => expense.isAvailable !== false));
  });
};

// ============================================================================
// EXPENSE CRUD OPERATIONS
// ============================================================================

export const createExpense = async (
  data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>,
  companyId: string,
  createdBy?: import('../../../types/models').EmployeeRef | null
): Promise<Expense> => {
  const userId = data.userId || companyId;
  
  let transactionDate: any;
  if (data.date) {
    if (data.date instanceof Date) {
      transactionDate = Timestamp.fromDate(data.date);
    } else if (data.date.seconds) {
      transactionDate = data.date;
    } else {
      transactionDate = Timestamp.fromDate(new Date(data.date as any));
    }
  } else {
    transactionDate = serverTimestamp();
  }
  
  const expenseData: any = {
    ...data,
    date: transactionDate,
    companyId,
    isAvailable: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  if (createdBy) {
    expenseData.createdBy = createdBy;
  }
  
  const expenseRef = await addDoc(collection(db, 'expenses'), expenseData);

  const now = Date.now() / 1000;
  return {
    id: expenseRef.id,
    ...data,
    date: data.date || { seconds: now, nanoseconds: 0 },
    companyId,
    isAvailable: true,
    createdAt: { seconds: now, nanoseconds: 0 },
    updatedAt: { seconds: now, nanoseconds: 0 },
    createdBy: createdBy || undefined
  };
};

export const updateExpense = async (
  id: string,
  data: Partial<Expense>,
  companyId: string
): Promise<void> => {
  const expenseRef = doc(db, 'expenses', id);
  const expenseSnap = await getDoc(expenseRef);
  
  if (!expenseSnap.exists()) {
    throw new Error('Expense not found');
  }

  const expense = expenseSnap.data() as Expense;
  
  const expenseCompanyId = expense.companyId;
  const expenseUserId = expense.userId;
  
  if (expenseCompanyId && expenseCompanyId !== companyId) {
    if (data.userId && expenseUserId && data.userId === expenseUserId) {
      devLog('Migrating expense to new company');
    } else {
      throw new Error('Unauthorized: Expense belongs to different company');
    }
  }
  
  if (!expenseCompanyId && data.userId && expenseUserId && data.userId !== expenseUserId) {
    throw new Error('Unauthorized: Cannot change expense owner');
  }
  
  const userId = expense.userId || data.userId || companyId;
  
  const updateData: any = {
    ...data,
    companyId: companyId,
    updatedAt: serverTimestamp()
  };
  
  if (data.date !== undefined) {
    if (data.date instanceof Date) {
      updateData.date = Timestamp.fromDate(data.date);
    } else if (data.date && typeof data.date === 'object' && 'seconds' in data.date) {
      updateData.date = data.date;
    } else {
      updateData.date = Timestamp.fromDate(new Date(data.date as any));
    }
  }
  
  delete updateData.createdAt;
  
  const batch = writeBatch(db);
  
  batch.update(expenseRef, updateData);
  
  createAuditLog(batch, 'update', 'expense', id, data, userId);
  
  await batch.commit();
  
  const updatedExpense = { 
    ...expense, 
    ...data, 
    id,
    createdAt: expense.createdAt
  };
  await syncFinanceEntryWithExpense(updatedExpense);
};

export const softDeleteExpense = async (expenseId: string, userId: string): Promise<void> => {
  await updateExpense(expenseId, { isAvailable: false }, userId);
  
  const q = query(collection(db, 'finances'), where('sourceType', '==', 'expense'), where('sourceId', '==', expenseId));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const { updateFinanceEntry } = await import('../firestore');
    for (const docSnap of snap.docs) {
      await updateFinanceEntry(docSnap.id, { isDeleted: true });
    }
  }
};

// ============================================================================
// EXPENSE TYPES
// ============================================================================

export const createExpenseType = async (type: Omit<ExpenseType, 'id' | 'createdAt'>): Promise<ExpenseType> => {
  const ref = doc(collection(db, 'expenseTypes'));
  const now = serverTimestamp();
  const data = { ...type, createdAt: now };
  await setDoc(ref, data);
  const snap = await getDoc(ref);
  return { id: ref.id, ...snap.data() } as ExpenseType;
};

export const getExpenseTypes = async (companyId: string): Promise<ExpenseType[]> => {
  await ensureDefaultExpenseTypes();
  
  const defaultSnap = await getDocs(query(collection(db, 'expenseTypes'), where('isDefault', '==', true)));
  const companySnap = await getDocs(query(collection(db, 'expenseTypes'), where('companyId', '==', companyId)));
  const allDocs = [...defaultSnap.docs, ...companySnap.docs];
  const seen = new Set<string>();
  const types: ExpenseType[] = [];
  for (const docSnap of allDocs) {
    if (!seen.has(docSnap.id)) {
      seen.add(docSnap.id);
      types.push({ id: docSnap.id, ...docSnap.data() } as ExpenseType);
    }
  }
  return types;
};

export const updateExpenseType = async (typeId: string, updates: Partial<ExpenseType>): Promise<ExpenseType> => {
  const typeRef = doc(db, 'expenseTypes', typeId);
  const updateData = {
    ...updates,
    updatedAt: serverTimestamp()
  };
  await updateDoc(typeRef, updateData);
  const snap = await getDoc(typeRef);
  return { id: snap.id, ...snap.data() } as ExpenseType;
};

export const deleteExpenseType = async (typeId: string, companyId: string): Promise<void> => {
  const typeRef = doc(db, 'expenseTypes', typeId);
  const typeSnap = await getDoc(typeRef);
  
  if (!typeSnap.exists()) {
    throw new Error('Expense type not found');
  }
  
  const typeData = typeSnap.data() as ExpenseType;
  
  if (typeData.isDefault) {
    throw new Error('Cannot delete default expense types');
  }
  
  const expensesQuery = query(
    collection(db, 'expenses'),
    where('companyId', '==', companyId),
    where('category', '==', typeData.name),
    where('isAvailable', '!=', false)
  );
  const expensesSnap = await getDocs(expensesQuery);
  
  if (!expensesSnap.empty) {
    throw new Error(`Cannot delete expense type: ${expensesSnap.size} expense(s) are using this category`);
  }
  
  await deleteDoc(typeRef);
};

export const getExpenseCountByCategory = async (companyId: string): Promise<Record<string, number>> => {
  const expensesQuery = query(
    collection(db, 'expenses'),
    where('companyId', '==', companyId),
    where('isAvailable', '!=', false)
  );
  const expensesSnap = await getDocs(expensesQuery);
  
  const counts: Record<string, number> = {};
  expensesSnap.forEach((doc) => {
    const expense = doc.data() as Expense;
    const category = expense.category || 'other';
    counts[category] = (counts[category] || 0) + 1;
  });
  
  return counts;
};

export const ensureDefaultExpenseTypes = async (): Promise<void> => {
  const defaultTypes = [
    { name: 'transportation', isDefault: true },
    { name: 'purchase', isDefault: true },
    { name: 'other', isDefault: true }
  ];

  const existingDefaultsQuery = query(
    collection(db, 'expenseTypes'),
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
    const typeRef = doc(collection(db, 'expenseTypes'));
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
    logError('Error creating default expense types', error);
    throw error;
  }
};

