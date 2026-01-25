// Employee Reference service for Restoflow
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
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import type { EmployeeRef, UserRole, Timestamp } from '../../../types/geskap';

// ============================================================================
// EMPLOYEE REF SUBSCRIPTIONS
// ============================================================================

export const subscribeToEmployeeRefs = (
  restaurantId: string,
  callback: (employees: EmployeeRef[]) => void
): (() => void) => {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'restaurants', restaurantId, 'employeeRefs'),
    orderBy('addedAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const employees = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as EmployeeRef[];
    callback(employees);
  }, (error) => {
    console.error('Error in employee refs subscription:', error);
    callback([]);
  });
};

// ============================================================================
// EMPLOYEE REF CRUD OPERATIONS
// ============================================================================

export const addEmployeeRef = async (
  restaurantId: string,
  userId: string,
  username: string,
  email: string,
  role: UserRole
): Promise<EmployeeRef> => {
  const employeeRef = doc(db, 'restaurants', restaurantId, 'employeeRefs', userId);

  const employeeData: EmployeeRef = {
    id: userId,
    username,
    email,
    role,
    addedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
  };

  await setDoc(employeeRef, {
    ...employeeData,
    addedAt: serverTimestamp()
  });

  return employeeData;
};

export const updateEmployeeRole = async (
  restaurantId: string,
  userId: string,
  newRole: UserRole
): Promise<void> => {
  const employeeRef = doc(db, 'restaurants', restaurantId, 'employeeRefs', userId);
  const employeeSnap = await getDoc(employeeRef);

  if (!employeeSnap.exists()) {
    throw new Error('Employee not found');
  }

  const batch = writeBatch(db);
  batch.update(employeeRef, {
    role: newRole,
    updatedAt: serverTimestamp()
  });

  await batch.commit();
};

export const removeEmployeeRef = async (
  restaurantId: string,
  userId: string
): Promise<void> => {
  const employeeRef = doc(db, 'restaurants', restaurantId, 'employeeRefs', userId);
  await deleteDoc(employeeRef);
};

export const getEmployeeRef = async (
  restaurantId: string,
  userId: string
): Promise<EmployeeRef | null> => {
  const employeeRef = doc(db, 'restaurants', restaurantId, 'employeeRefs', userId);
  const employeeSnap = await getDoc(employeeRef);

  if (!employeeSnap.exists()) {
    return null;
  }

  return {
    id: employeeSnap.id,
    ...employeeSnap.data()
  } as EmployeeRef;
};

export const getEmployeeRefsByRole = async (
  restaurantId: string,
  role: UserRole
): Promise<EmployeeRef[]> => {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'employeeRefs'),
    where('role', '==', role)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as EmployeeRef[];
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const isUserEmployeeOf = async (
  restaurantId: string,
  userId: string
): Promise<boolean> => {
  const employee = await getEmployeeRef(restaurantId, userId);
  return employee !== null;
};

export const getUserRole = async (
  restaurantId: string,
  userId: string
): Promise<UserRole | null> => {
  const employee = await getEmployeeRef(restaurantId, userId);
  return employee?.role || null;
};
