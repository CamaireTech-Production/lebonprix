import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import type { ProfitPeriodPreference } from '../types/models';

const COLLECTION_PATH = (companyId: string) => `companies/${companyId}/profitPeriodPreference`;
const DOC_ID = 'preference'; // Single document per company

/**
 * Get profit period preference for a company
 */
export const getProfitPeriodPreference = async (
  companyId: string
): Promise<ProfitPeriodPreference | null> => {
  try {
    const docRef = doc(db, COLLECTION_PATH(companyId), DOC_ID);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        companyId,
        ...data,
      } as ProfitPeriodPreference;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting profit period preference:', error);
    throw error;
  }
};

/**
 * Save profit period preference for a company
 */
export const saveProfitPeriodPreference = async (
  companyId: string,
  userId: string,
  preference: Partial<ProfitPeriodPreference>
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_PATH(companyId), DOC_ID);
    const now = serverTimestamp();
    
    // Check if preference exists
    const existingPref = await getProfitPeriodPreference(companyId);
    
    const dataToSave: any = {
      ...preference,
      companyId,
      updatedBy: userId,
      updatedAt: now,
    };
    
    // CRITICAL FIX: Remove undefined values (Firestore doesn't accept undefined)
    Object.keys(dataToSave).forEach(key => {
      if (dataToSave[key] === undefined) {
        delete dataToSave[key];
      }
    });
    
    if (existingPref) {
      // Update existing preference
      await setDoc(docRef, dataToSave, { merge: true });
    } else {
      // Create new preference
      dataToSave.id = DOC_ID;
      dataToSave.createdAt = now;
      dataToSave.isActive = true;
      await setDoc(docRef, dataToSave);
    }
  } catch (error) {
    console.error('Error saving profit period preference:', error);
    throw error;
  }
};

/**
 * Clear profit period preference (set to all-time)
 */
export const clearProfitPeriodPreference = async (
  companyId: string,
  userId: string
): Promise<void> => {
  try {
    await saveProfitPeriodPreference(companyId, userId, {
      periodStartDate: null,
      periodType: 'all_time',
      isActive: false,
    });
  } catch (error) {
    console.error('Error clearing profit period preference:', error);
    throw error;
  }
};

/**
 * Subscribe to profit period preference changes
 */
export const subscribeToProfitPeriodPreference = (
  companyId: string,
  callback: (preference: ProfitPeriodPreference | null) => void
): Unsubscribe => {
  const docRef = doc(db, COLLECTION_PATH(companyId), DOC_ID);
  
  return onSnapshot(
    docRef,
    (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const preference: ProfitPeriodPreference = {
          id: doc.id,
          companyId,
          ...data,
        } as ProfitPeriodPreference;
        callback(preference);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error('Error subscribing to profit period preference:', error);
      callback(null);
    }
  );
};

