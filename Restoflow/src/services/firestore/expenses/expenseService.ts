// Expense service for Restoflow
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
  deleteDoc,
  setDoc,
  Timestamp,
  limit
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import type { Expense, ExpenseType, EmployeeRef } from '../../../types/geskap';
import { createAuditLog } from '../shared';
import { DEFAULT_EXPENSE_CATEGORIES } from '../../../types/geskap';

// ============================================================================
// EXPENSE SUBSCRIPTIONS
// ============================================================================

export const subscribeToExpenses = (
  restaurantId: string,
  callback: (expenses: Expense[]) => void
): (() => void) => {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'restaurants', restaurantId, 'expenses'),
    orderBy('createdAt', 'desc'),
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {
    const expenses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Expense[];
    callback(expenses.filter(expense => expense.isAvailable !== false));
  }, (error) => {
    console.error('Error in expenses subscription:', error);
    callback([]);
  });
};

// ============================================================================
// EXPENSE CRUD OPERATIONS
// ============================================================================

export const createExpense = async (
  data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>,
  restaurantId: string,
  createdBy?: EmployeeRef | null
): Promise<Expense> => {
  let transactionDate: any;
  if (data.date) {
    if (data.date instanceof Date) {
      transactionDate = Timestamp.fromDate(data.date as Date);
    } else if ((data.date as any).seconds) {
      transactionDate = data.date;
    } else {
      transactionDate = Timestamp.fromDate(new Date(data.date as any));
    }
  } else {
    transactionDate = serverTimestamp();
  }

  const expenseData: any = {
    description: data.description,
    amount: data.amount,
    category: data.category,
    date: transactionDate,
    userId: data.userId,
    restaurantId,
    isAvailable: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (data.image) expenseData.image = data.image;
  if (data.imagePath) expenseData.imagePath = data.imagePath;
  if (createdBy) expenseData.createdBy = createdBy;

  const expenseRef = await addDoc(
    collection(db, 'restaurants', restaurantId, 'expenses'),
    expenseData
  );

  const now = Date.now() / 1000;
  return {
    id: expenseRef.id,
    ...data,
    date: data.date || { seconds: now, nanoseconds: 0 },
    restaurantId,
    isAvailable: true,
    createdAt: { seconds: now, nanoseconds: 0 },
    updatedAt: { seconds: now, nanoseconds: 0 },
    createdBy: createdBy || undefined
  };
};

export const updateExpense = async (
  id: string,
  data: Partial<Expense>,
  restaurantId: string
): Promise<void> => {
  const expenseRef = doc(db, 'restaurants', restaurantId, 'expenses', id);
  const expenseSnap = await getDoc(expenseRef);

  if (!expenseSnap.exists()) {
    throw new Error('Expense not found');
  }

  const expense = expenseSnap.data() as Expense;
  const userId = expense.userId || restaurantId;

  const updateData: any = {
    ...data,
    updatedAt: serverTimestamp()
  };

  if (data.date !== undefined) {
    if (data.date instanceof Date) {
      updateData.date = Timestamp.fromDate(data.date as Date);
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
};

export const softDeleteExpense = async (
  expenseId: string,
  restaurantId: string
): Promise<void> => {
  await updateExpense(expenseId, { isAvailable: false }, restaurantId);
};

export const softDeleteExpenseWithImage = async (
  expense: Expense,
  restaurantId: string
): Promise<void> => {
  // Delete image from storage if it exists
  if (expense.imagePath) {
    try {
      // Import storage service dynamically
      const { deleteImage } = await import('../../storage');
      await deleteImage(expense.imagePath);
    } catch (error) {
      console.warn('Failed to delete expense image:', error);
      // Continue with expense deletion even if image deletion fails
    }
  }

  await softDeleteExpense(expense.id, restaurantId);
};

// ============================================================================
// EXPENSE TYPES / CATEGORIES
// ============================================================================

const initializeRestaurantExpenseTypes = async (restaurantId: string): Promise<void> => {
  const batch = writeBatch(db);

  for (const category of DEFAULT_EXPENSE_CATEGORIES) {
    const typeRef = doc(collection(db, 'restaurants', restaurantId, 'expenseTypes'));
    batch.set(typeRef, {
      id: typeRef.id,
      name: category.name,
      restaurantId,
      isDefault: category.isDefault,
      createdAt: serverTimestamp()
    });
  }

  await batch.commit();
};

export const getExpenseTypes = async (restaurantId: string): Promise<ExpenseType[]> => {
  const snapshot = await getDocs(
    collection(db, 'restaurants', restaurantId, 'expenseTypes')
  );

  const types = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as ExpenseType[];

  // If no categories exist, initialize defaults
  if (types.length === 0) {
    await initializeRestaurantExpenseTypes(restaurantId);
    return getExpenseTypes(restaurantId);
  }

  return types;
};

export const subscribeToExpenseTypes = (
  restaurantId: string,
  callback: (types: ExpenseType[]) => void
): (() => void) => {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'restaurants', restaurantId, 'expenseTypes'),
    orderBy('name')
  );

  return onSnapshot(q, (snapshot) => {
    const types = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ExpenseType[];

    // Initialize if empty
    if (types.length === 0) {
      initializeRestaurantExpenseTypes(restaurantId).then(() => {
        // Re-fetch will be handled by the subscription
      });
    } else {
      callback(types);
    }
  }, (error) => {
    console.error('Error in expense types subscription:', error);
    callback([]);
  });
};

export const createExpenseType = async (
  restaurantId: string,
  name: string
): Promise<ExpenseType> => {
  const ref = doc(collection(db, 'restaurants', restaurantId, 'expenseTypes'));
  const data = {
    id: ref.id,
    name,
    restaurantId,
    isDefault: false,
    createdAt: serverTimestamp()
  };

  await setDoc(ref, data);

  return {
    ...data,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  } as ExpenseType;
};

export const updateExpenseType = async (
  restaurantId: string,
  typeId: string,
  updates: Partial<ExpenseType>
): Promise<void> => {
  const typeRef = doc(db, 'restaurants', restaurantId, 'expenseTypes', typeId);
  await updateDoc(typeRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
};

export const deleteExpenseType = async (
  restaurantId: string,
  typeId: string
): Promise<void> => {
  // Check if type is in use
  const expensesQuery = query(
    collection(db, 'restaurants', restaurantId, 'expenses'),
    where('isAvailable', '!=', false)
  );
  const expensesSnap = await getDocs(expensesQuery);

  const typeRef = doc(db, 'restaurants', restaurantId, 'expenseTypes', typeId);
  const typeSnap = await getDoc(typeRef);

  if (!typeSnap.exists()) {
    throw new Error('Expense type not found');
  }

  const typeData = typeSnap.data();
  const expensesUsingType = expensesSnap.docs.filter(
    d => d.data().category === typeData.name
  );

  if (expensesUsingType.length > 0) {
    throw new Error(`Cannot delete: ${expensesUsingType.length} expense(s) are using this category`);
  }

  await deleteDoc(typeRef);
};

export const getExpenseCountByCategory = async (
  restaurantId: string
): Promise<Record<string, number>> => {
  const expensesQuery = query(
    collection(db, 'restaurants', restaurantId, 'expenses'),
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
