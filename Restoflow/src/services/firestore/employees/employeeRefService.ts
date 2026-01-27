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
import type { EmployeeRef, UserRole } from '../../../types/geskap';

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

  // Use simple query without orderBy to avoid Firestore index issues
  const collectionRef = collection(db, 'restaurants', restaurantId, 'employeeRefs');

  return onSnapshot(collectionRef, (snapshot: any) => {
    const employees = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    })) as EmployeeRef[];

    // Sort client-side to avoid index requirements
    employees.sort((a, b) => {
      const aTime = (a.addedAt as any)?.seconds || 0;
      const bTime = (b.addedAt as any)?.seconds || 0;
      return bTime - aTime;
    });

    callback(employees);
  }, (error: any) => {
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
  try {
    const employeeRef = doc(db, 'restaurants', restaurantId, 'employeeRefs', userId);
    const employeeSnap = await getDoc(employeeRef);

    if (!employeeSnap.exists()) {
      return null;
    }

    const data = employeeSnap.data();
    return {
      id: employeeSnap.id,
      ...data
    } as EmployeeRef;
  } catch (error) {
    console.error(`[getEmployeeRef] Error getting employee for restaurant ${restaurantId}, user ${userId}:`, error);
    return null;
  }
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

/**
 * Find which restaurant an employee belongs to by searching all restaurants
 * This is used during employee login to determine their restaurant context
 */
export const findEmployeeRestaurant = async (
  userId: string
): Promise<{ restaurantId: string; employee: EmployeeRef } | null> => {
  try {
    console.log('[findEmployeeRestaurant] Starting search for userId:', userId);
    // Get all restaurants
    const restaurantsRef = collection(db, 'restaurants');
    const restaurantsSnapshot = await getDocs(restaurantsRef);
    console.log('[findEmployeeRestaurant] Found restaurants:', restaurantsSnapshot.docs.length);

    // Check each restaurant's employeeRefs subcollection
    for (const restaurantDoc of restaurantsSnapshot.docs) {
      const restaurantId = restaurantDoc.id;
      console.log('[findEmployeeRestaurant] Checking restaurant:', restaurantId);
      const employee = await getEmployeeRef(restaurantId, userId);
      
      if (employee) {
        console.log('[findEmployeeRestaurant] Employee found in restaurant:', restaurantId, employee);
        return {
          restaurantId,
          employee
        };
      }
    }

    console.log('[findEmployeeRestaurant] Employee not found in any restaurant');
    return null;
  } catch (error) {
    console.error('[findEmployeeRestaurant] Error finding employee restaurant:', error);
    return null;
  }
};
