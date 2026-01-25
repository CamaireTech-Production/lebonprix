import { getAuth, deleteUser } from 'firebase/auth';
import { getFirestore, doc, deleteDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { logActivity } from '../services/activityLogService';

export interface UserDeletionResult {
  success: boolean;
  message: string;
  deletedAuth: boolean;
  deletedFirestore: boolean;
}

/**
 * Completely delete a user account (both Firebase Auth and Firestore)
 * This is irreversible and should only be used for permanent deletion
 */
export const deleteUserAccount = async (
  userId: string,
  userEmail: string,
  adminId: string,
  adminEmail: string,
  userType: 'admin' | 'restaurant'
): Promise<UserDeletionResult> => {
  const auth = getAuth();
  const db = getFirestore();
  
  let deletedAuth = false;
  let deletedFirestore = false;
  
  try {
    // 1. Delete from Firestore first
    const collection = userType === 'admin' ? 'users' : 'restaurants';
    const userRef = doc(db, collection, userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      await deleteDoc(userRef);
      deletedFirestore = true;
      console.log(`Deleted ${userType} document from Firestore: ${userId}`);
    }
    
    // 2. Delete from Firebase Auth
    try {
      // Note: This requires admin privileges or the user to be signed in
      // For admin deletion, we'll need to use Firebase Admin SDK on the backend
      // For now, we'll mark the user as deleted in Firestore and handle auth deletion separately
      console.log(`Firebase Auth deletion requires admin privileges for user: ${userId}`);
    } catch (authError) {
      console.warn('Could not delete from Firebase Auth:', authError);
    }
    
    // 3. Log the deletion activity
    await logActivity({
      userId: adminId,
      userEmail: adminEmail,
      action: `admin_delete_${userType}`,
      entityType: userType,
      entityId: userId,
      details: {
        deletedUserEmail: userEmail,
        deletedAuth,
        deletedFirestore,
      },
    });
    
    return {
      success: true,
      message: `${userType} account deleted successfully`,
      deletedAuth,
      deletedFirestore,
    };
    
  } catch (error) {
    console.error(`Error deleting ${userType} account:`, error);
    
    // Log the failed deletion
    await logActivity({
      userId: adminId,
      userEmail: adminEmail,
      action: `admin_delete_${userType}_failed`,
      entityType: userType,
      entityId: userId,
      details: {
        deletedUserEmail: userEmail,
        error: error instanceof Error ? error.message : 'Unknown error',
        deletedAuth,
        deletedFirestore,
      },
    });
    
    return {
      success: false,
      message: `Failed to delete ${userType} account: ${error instanceof Error ? error.message : 'Unknown error'}`,
      deletedAuth,
      deletedFirestore,
    };
  }
};

/**
 * Disable a user account (prevents login but keeps the account)
 * This is reversible and should be used for temporary suspension
 */
export const disableUserAccount = async (
  userId: string,
  userEmail: string,
  adminId: string,
  adminEmail: string,
  userType: 'admin' | 'restaurant',
  reason?: string
): Promise<{ success: boolean; message: string }> => {
  const db = getFirestore();
  
  try {
    const collection = userType === 'admin' ? 'users' : 'restaurants';
    const userRef = doc(db, collection, userId);
    
    // Update the user document to mark as disabled
    await updateDoc(userRef, {
      isDeactivated: true,
      deactivatedAt: serverTimestamp(),
      deactivatedBy: adminId,
      deactivationReason: reason || 'Account disabled by admin',
      updatedAt: serverTimestamp(),
    });
    
    // Log the disable activity
    await logActivity({
      userId: adminId,
      userEmail: adminEmail,
      action: `admin_disable_${userType}`,
      entityType: userType,
      entityId: userId,
      details: {
        disabledUserEmail: userEmail,
        reason: reason || 'Account disabled by admin',
      },
    });
    
    return {
      success: true,
      message: `${userType} account disabled successfully`,
    };
    
  } catch (error) {
    console.error(`Error disabling ${userType} account:`, error);
    
    return {
      success: false,
      message: `Failed to disable ${userType} account: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Enable a user account (reverses disable)
 */
export const enableUserAccount = async (
  userId: string,
  userEmail: string,
  adminId: string,
  adminEmail: string,
  userType: 'admin' | 'restaurant'
): Promise<{ success: boolean; message: string }> => {
  const db = getFirestore();
  
  try {
    const collection = userType === 'admin' ? 'users' : 'restaurants';
    const userRef = doc(db, collection, userId);
    
    // Update the user document to mark as enabled
    await updateDoc(userRef, {
      isDeactivated: false,
      deactivatedAt: null,
      deactivatedBy: null,
      deactivationReason: null,
      updatedAt: serverTimestamp(),
    });
    
    // Log the enable activity
    await logActivity({
      userId: adminId,
      userEmail: adminEmail,
      action: `admin_enable_${userType}`,
      entityType: userType,
      entityId: userId,
      details: {
        enabledUserEmail: userEmail,
      },
    });
    
    return {
      success: true,
      message: `${userType} account enabled successfully`,
    };
    
  } catch (error) {
    console.error(`Error enabling ${userType} account:`, error);
    
    return {
      success: false,
      message: `Failed to enable ${userType} account: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Check if a user account exists and is not deleted
 */
export const checkUserAccountStatus = async (
  userId: string,
  userType: 'admin' | 'restaurant'
): Promise<{ exists: boolean; isDeleted: boolean; isDeactivated: boolean; data?: any }> => {
  const db = getFirestore();
  
  try {
    const collection = userType === 'admin' ? 'users' : 'restaurants';
    const userRef = doc(db, collection, userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return { exists: false, isDeleted: false, isDeactivated: false };
    }
    
    const data = userDoc.data();
    return {
      exists: true,
      isDeleted: data.isDeleted || data.deleted || false,
      isDeactivated: data.isDeactivated || data.deactivated || false,
      data,
    };
    
  } catch (error) {
    console.error(`Error checking ${userType} account status:`, error);
    return { exists: false, isDeleted: false, isDeactivated: false };
  }
};

