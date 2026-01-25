// Finance service for Restoflow
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
  addDoc,
  updateDoc,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import type { FinanceEntry, FinanceSourceType } from '../../../types/geskap';

// ============================================================================
// FINANCE ENTRY SUBSCRIPTIONS
// ============================================================================

export const subscribeToFinanceEntries = (
  restaurantId: string,
  callback: (entries: FinanceEntry[]) => void,
  limitCount: number = 100
): (() => void) => {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'restaurants', restaurantId, 'finances'),
    where('isDeleted', '==', false),
    orderBy('date', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FinanceEntry[];
    callback(entries);
  }, (error) => {
    console.error('Error in finance entries subscription:', error);
    callback([]);
  });
};

export const subscribeToFinanceEntriesByType = (
  restaurantId: string,
  sourceType: FinanceSourceType,
  callback: (entries: FinanceEntry[]) => void
): (() => void) => {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'restaurants', restaurantId, 'finances'),
    where('sourceType', '==', sourceType),
    where('isDeleted', '==', false),
    orderBy('date', 'desc'),
    limit(50)
  );

  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FinanceEntry[];
    callback(entries);
  }, (error) => {
    console.error('Error in finance entries by type subscription:', error);
    callback([]);
  });
};

// ============================================================================
// FINANCE ENTRY CRUD OPERATIONS
// ============================================================================

export const createFinanceEntry = async (
  entry: Omit<FinanceEntry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<FinanceEntry> => {
  const entryData: any = {
    ...entry,
    isDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  // Handle date field
  if (entry.date) {
    if (entry.date instanceof Date) {
      entryData.date = Timestamp.fromDate(entry.date as Date);
    } else if ((entry.date as any).seconds) {
      entryData.date = entry.date;
    } else {
      entryData.date = Timestamp.fromDate(new Date(entry.date as any));
    }
  } else {
    entryData.date = serverTimestamp();
  }

  const docRef = await addDoc(
    collection(db, 'restaurants', entry.restaurantId, 'finances'),
    entryData
  );

  return {
    id: docRef.id,
    ...entry,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  };
};

export const updateFinanceEntry = async (
  restaurantId: string,
  entryId: string,
  updates: Partial<FinanceEntry>
): Promise<void> => {
  const entryRef = doc(db, 'restaurants', restaurantId, 'finances', entryId);

  const updateData: any = {
    ...updates,
    updatedAt: serverTimestamp()
  };

  if (updates.date !== undefined) {
    if (updates.date instanceof Date) {
      updateData.date = Timestamp.fromDate(updates.date as Date);
    } else if (updates.date && typeof updates.date === 'object' && 'seconds' in updates.date) {
      updateData.date = updates.date;
    } else {
      updateData.date = Timestamp.fromDate(new Date(updates.date as any));
    }
  }

  await updateDoc(entryRef, updateData);
};

export const softDeleteFinanceEntry = async (
  restaurantId: string,
  entryId: string
): Promise<void> => {
  const entryRef = doc(db, 'restaurants', restaurantId, 'finances', entryId);
  await updateDoc(entryRef, {
    isDeleted: true,
    updatedAt: serverTimestamp()
  });
};

// ============================================================================
// FINANCE QUERIES
// ============================================================================

export const getFinanceEntriesByDateRange = async (
  restaurantId: string,
  startDate: Date,
  endDate: Date
): Promise<FinanceEntry[]> => {
  const startTimestamp = Timestamp.fromDate(startDate);
  const endTimestamp = Timestamp.fromDate(endDate);

  const q = query(
    collection(db, 'restaurants', restaurantId, 'finances'),
    where('isDeleted', '==', false),
    where('date', '>=', startTimestamp),
    where('date', '<=', endTimestamp),
    orderBy('date', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as FinanceEntry[];
};

export const getFinanceEntriesBySource = async (
  restaurantId: string,
  sourceType: FinanceSourceType,
  sourceId: string
): Promise<FinanceEntry[]> => {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'finances'),
    where('sourceType', '==', sourceType),
    where('sourceId', '==', sourceId),
    where('isDeleted', '==', false)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as FinanceEntry[];
};

// ============================================================================
// FINANCE CALCULATIONS
// ============================================================================

export const calculateFinanceSummary = async (
  restaurantId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  byType: Record<string, number>;
}> => {
  const entries = await getFinanceEntriesByDateRange(restaurantId, startDate, endDate);

  let totalIncome = 0;
  let totalExpenses = 0;
  const byType: Record<string, number> = {};

  for (const entry of entries) {
    const amount = entry.amount || 0;

    if (amount >= 0) {
      totalIncome += amount;
    } else {
      totalExpenses += Math.abs(amount);
    }

    const type = entry.type || 'other';
    byType[type] = (byType[type] || 0) + amount;
  }

  return {
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
    byType
  };
};

export const calculateDailyRevenue = async (
  restaurantId: string,
  date: Date
): Promise<number> => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const entries = await getFinanceEntriesByDateRange(restaurantId, startOfDay, endOfDay);

  return entries
    .filter(entry => entry.amount > 0)
    .reduce((sum, entry) => sum + entry.amount, 0);
};

export const calculateMonthlyRevenue = async (
  restaurantId: string,
  year: number,
  month: number
): Promise<{ revenue: number; expenses: number; profit: number }> => {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const summary = await calculateFinanceSummary(restaurantId, startDate, endDate);

  return {
    revenue: summary.totalIncome,
    expenses: summary.totalExpenses,
    profit: summary.netProfit
  };
};

// ============================================================================
// SYNC FUNCTIONS (for keeping finance in sync with other entities)
// ============================================================================

export const syncFinanceEntryWithSale = async (
  restaurantId: string,
  saleId: string,
  amount: number,
  userId: string,
  description?: string
): Promise<void> => {
  // Check if finance entry already exists for this sale
  const existing = await getFinanceEntriesBySource(restaurantId, 'sale', saleId);

  if (existing.length > 0) {
    // Update existing entry
    await updateFinanceEntry(restaurantId, existing[0].id, {
      amount,
      description: description || existing[0].description
    });
  } else {
    // Create new entry
    await createFinanceEntry({
      userId,
      restaurantId,
      sourceType: 'sale',
      sourceId: saleId,
      type: 'sale_revenue',
      amount,
      description: description || 'Sale revenue',
      date: { seconds: Date.now() / 1000, nanoseconds: 0 },
      isDeleted: false
    });
  }
};

export const syncFinanceEntryWithExpense = async (
  restaurantId: string,
  expenseId: string,
  amount: number,
  userId: string,
  description?: string,
  date?: any
): Promise<void> => {
  // Check if finance entry already exists for this expense
  const existing = await getFinanceEntriesBySource(restaurantId, 'expense', expenseId);

  const entryAmount = -Math.abs(amount); // Expenses are negative

  if (existing.length > 0) {
    // Update existing entry
    await updateFinanceEntry(restaurantId, existing[0].id, {
      amount: entryAmount,
      description: description || existing[0].description
    });
  } else {
    // Create new entry
    await createFinanceEntry({
      userId,
      restaurantId,
      sourceType: 'expense',
      sourceId: expenseId,
      type: 'expense',
      amount: entryAmount,
      description: description || 'Expense',
      date: date || { seconds: Date.now() / 1000, nanoseconds: 0 },
      isDeleted: false
    });
  }
};
