// Employee Authentication service for Restoflow
// Handles Firebase Auth account creation for employees by restaurant owners
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, secondaryAuth } from '../../../firebase/config';
import type { EmployeeRef, UserRole } from '../../../types/geskap';

// Simple password hashing (for display purposes, actual auth is via Firebase)
const hashPassword = (password: string): string => {
  // In production, this should use a proper hashing algorithm
  // For now, we'll just store it encoded (Firebase handles actual auth)
  return btoa(password);
};

const unhashPassword = (hash: string): string => {
  try {
    return atob(hash);
  } catch {
    return '';
  }
};

/**
 * Create a new employee account with Firebase Auth
 * Owner creates the account and sets the password
 */
export const createEmployeeAccount = async (
  restaurantId: string,
  createdBy: string,
  employeeData: {
    username: string;
    email: string;
    password: string;
    role: UserRole;
    permissionTemplateId?: string;
    phone?: string;
    photo?: string;
  }
): Promise<{ employee: EmployeeRef; firebaseUid: string }> => {
  const { username, email, password, role, permissionTemplateId, phone, photo } = employeeData;

  // Validate password
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  try {
    // Use secondary auth to create user - this doesn't affect the owner's session
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const firebaseUid = userCredential.user.uid;

    // Create employee document in Firestore
    const employeeRef = doc(db, 'restaurants', restaurantId, 'employeeRefs', firebaseUid);

    const employee: Omit<EmployeeRef, 'id'> = {
      username,
      email: email.toLowerCase(),
      role,
      permissionTemplateId,
      phone,
      photo,
      isActive: true,
      passwordHash: hashPassword(password), // Store for owner reference
      addedAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
      createdBy
    };

    await setDoc(employeeRef, {
      ...employee,
      addedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Sign out from secondary auth only - owner stays logged in on primary auth
    await secondaryAuth.signOut();

    return {
      employee: { id: firebaseUid, ...employee } as EmployeeRef,
      firebaseUid
    };
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('This email is already in use. Please use a different email.');
    }
    throw error;
  }
};

/**
 * Reset employee password (owner only)
 */
export const resetEmployeePassword = async (
  restaurantId: string,
  employeeId: string,
  newPassword: string
): Promise<{ email: string; password: string }> => {
  if (newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  // Get employee data
  const employeeRef = doc(db, 'restaurants', restaurantId, 'employeeRefs', employeeId);

  // Update password hash in Firestore
  await setDoc(employeeRef, {
    passwordHash: hashPassword(newPassword),
    updatedAt: serverTimestamp()
  }, { merge: true });

  // Note: We cannot update Firebase Auth password without the user being signed in
  // The employee will need to use password reset link, OR
  // We instruct them to use the new password on next login

  // Return the credentials for owner to give to employee
  const employeeDoc = await import('firebase/firestore').then(m => m.getDoc(employeeRef));
  const employee = employeeDoc.data() as EmployeeRef;

  return {
    email: employee.email,
    password: newPassword
  };
};

/**
 * Get employee password (for owner to view)
 */
export const getEmployeePassword = (passwordHash: string): string => {
  return unhashPassword(passwordHash);
};

/**
 * Deactivate employee account
 */
export const deactivateEmployee = async (
  restaurantId: string,
  employeeId: string
): Promise<void> => {
  const employeeRef = doc(db, 'restaurants', restaurantId, 'employeeRefs', employeeId);

  await setDoc(employeeRef, {
    isActive: false,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

/**
 * Activate employee account
 */
export const activateEmployee = async (
  restaurantId: string,
  employeeId: string
): Promise<void> => {
  const employeeRef = doc(db, 'restaurants', restaurantId, 'employeeRefs', employeeId);

  await setDoc(employeeRef, {
    isActive: true,
    updatedAt: serverTimestamp()
  }, { merge: true });
};
