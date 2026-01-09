/**
 * Migration utilities for adding user tracking to existing production-related entities
 * 
 * This migration assigns userId and createdBy to existing records that don't have them.
 * For each entity, it assigns the company owner or first user from the company.
 */

import { collection, query, where, getDocs, writeBatch, doc, getDoc } from 'firebase/firestore';
import { db } from '@services/core/firebase';
import { logError } from '@utils/core/logger';
import { getUserById } from '@services/utilities/userService';
import { getCurrentEmployeeRef } from '@utils/business/employeeUtils';
import type { Production, ProductionCategory, ProductionFlow, ProductionFlowStep, ProductionCharge } from '../../../types/models';
import type { EmployeeRef } from '../../../types/models';

/**
 * Get the default user for a company (owner or first user)
 */
const getDefaultUserForCompany = async (companyId: string): Promise<{ userId: string; employeeRef: EmployeeRef | null }> => {
  try {
    // Try to get company owner
    const companyRef = doc(db, 'companies', companyId);
    const companySnap = await getDoc(companyRef);
    
    if (companySnap.exists()) {
      const companyData = companySnap.data();
      // For legacy companies, companyId might be the owner's Firebase Auth UID
      if (companyData.userId) {
        try {
          const userData = await getUserById(companyData.userId);
          const employeeRef = getCurrentEmployeeRef(null, { uid: companyData.userId } as any, true, userData);
          return { userId: companyData.userId, employeeRef };
        } catch (error) {
          logError('Error fetching company owner user data', error);
        }
      }
      
      // Fallback: try to find first user in company
      const usersRef = collection(db, 'users');
      const usersQuery = query(usersRef, where('companies', 'array-contains', companyId));
      const usersSnap = await getDocs(usersQuery);
      
      if (!usersSnap.empty) {
        const firstUser = usersSnap.docs[0].data();
        const userId = firstUser.id || usersSnap.docs[0].id;
        try {
          const userData = await getUserById(userId);
          const employeeRef = getCurrentEmployeeRef(null, { uid: userId } as any, false, userData);
          return { userId, employeeRef };
        } catch (error) {
          logError('Error fetching first user data', error);
        }
      }
    }
    
    // Final fallback: use companyId as userId (for legacy companies)
    return { userId: companyId, employeeRef: null };
  } catch (error) {
    logError('Error getting default user for company', error);
    return { userId: companyId, employeeRef: null };
  }
};

/**
 * Migrate productions to add userId and createdBy
 */
export const migrateProductionsUserTracking = async (companyId: string): Promise<{ migrated: number; errors: number }> => {
  try {
    const productionsRef = collection(db, 'productions');
    const q = query(productionsRef, where('companyId', '==', companyId));
    const snapshot = await getDocs(q);
    
    const { userId, employeeRef } = await getDefaultUserForCompany(companyId);
    const batch = writeBatch(db);
    let migrated = 0;
    let errors = 0;
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as Production;
      
      // Skip if already has userId
      if (data.userId) {
        continue;
      }
      
      try {
        const updateData: any = {
          userId: userId
        };
        
        // Add createdBy if we have employeeRef
        if (employeeRef && !data.createdBy) {
          updateData.createdBy = employeeRef;
        }
        
        batch.update(docSnap.ref, updateData);
        migrated++;
      } catch (error) {
        logError(`Error migrating production ${docSnap.id}`, error);
        errors++;
      }
    }
    
    if (migrated > 0) {
      await batch.commit();
    }
    
    return { migrated, errors };
  } catch (error) {
    logError('Error migrating productions user tracking', error);
    throw error;
  }
};

/**
 * Migrate production categories to add userId
 */
export const migrateProductionCategoriesUserTracking = async (companyId: string): Promise<{ migrated: number; errors: number }> => {
  try {
    const categoriesRef = collection(db, 'productionCategories');
    const q = query(categoriesRef, where('companyId', '==', companyId));
    const snapshot = await getDocs(q);
    
    const { userId } = await getDefaultUserForCompany(companyId);
    const batch = writeBatch(db);
    let migrated = 0;
    let errors = 0;
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as ProductionCategory;
      
      // Skip if already has userId
      if (data.userId) {
        continue;
      }
      
      try {
        batch.update(docSnap.ref, { userId });
        migrated++;
      } catch (error) {
        logError(`Error migrating category ${docSnap.id}`, error);
        errors++;
      }
    }
    
    if (migrated > 0) {
      await batch.commit();
    }
    
    return { migrated, errors };
  } catch (error) {
    logError('Error migrating production categories user tracking', error);
    throw error;
  }
};

/**
 * Migrate production flows to add userId
 */
export const migrateProductionFlowsUserTracking = async (companyId: string): Promise<{ migrated: number; errors: number }> => {
  try {
    const flowsRef = collection(db, 'productionFlows');
    const q = query(flowsRef, where('companyId', '==', companyId));
    const snapshot = await getDocs(q);
    
    const { userId } = await getDefaultUserForCompany(companyId);
    const batch = writeBatch(db);
    let migrated = 0;
    let errors = 0;
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as ProductionFlow;
      
      // Skip if already has userId
      if (data.userId) {
        continue;
      }
      
      try {
        batch.update(docSnap.ref, { userId });
        migrated++;
      } catch (error) {
        logError(`Error migrating flow ${docSnap.id}`, error);
        errors++;
      }
    }
    
    if (migrated > 0) {
      await batch.commit();
    }
    
    return { migrated, errors };
  } catch (error) {
    logError('Error migrating production flows user tracking', error);
    throw error;
  }
};

/**
 * Migrate production flow steps to add userId
 */
export const migrateProductionFlowStepsUserTracking = async (companyId: string): Promise<{ migrated: number; errors: number }> => {
  try {
    const stepsRef = collection(db, 'productionFlowSteps');
    const q = query(stepsRef, where('companyId', '==', companyId));
    const snapshot = await getDocs(q);
    
    const { userId } = await getDefaultUserForCompany(companyId);
    const batch = writeBatch(db);
    let migrated = 0;
    let errors = 0;
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as ProductionFlowStep;
      
      // Skip if already has userId
      if (data.userId) {
        continue;
      }
      
      try {
        batch.update(docSnap.ref, { userId });
        migrated++;
      } catch (error) {
        logError(`Error migrating step ${docSnap.id}`, error);
        errors++;
      }
    }
    
    if (migrated > 0) {
      await batch.commit();
    }
    
    return { migrated, errors };
  } catch (error) {
    logError('Error migrating production flow steps user tracking', error);
    throw error;
  }
};

/**
 * Migrate production charges to add userId
 */
export const migrateProductionChargesUserTracking = async (companyId: string): Promise<{ migrated: number; errors: number }> => {
  try {
    const chargesRef = collection(db, 'productionCharges');
    const q = query(chargesRef, where('companyId', '==', companyId));
    const snapshot = await getDocs(q);
    
    const { userId, employeeRef } = await getDefaultUserForCompany(companyId);
    const batch = writeBatch(db);
    let migrated = 0;
    let errors = 0;
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as ProductionCharge;
      
      // Skip if already has userId
      if (data.userId) {
        continue;
      }
      
      try {
        const updateData: any = {
          userId: userId
        };
        
        // Add createdBy if we have employeeRef and it doesn't exist
        if (employeeRef && !data.createdBy) {
          updateData.createdBy = employeeRef;
        }
        
        batch.update(docSnap.ref, updateData);
        migrated++;
      } catch (error) {
        logError(`Error migrating charge ${docSnap.id}`, error);
        errors++;
      }
    }
    
    if (migrated > 0) {
      await batch.commit();
    }
    
    return { migrated, errors };
  } catch (error) {
    logError('Error migrating production charges user tracking', error);
    throw error;
  }
};

/**
 * Run all migrations for a company
 */
export const migrateAllProductionUserTracking = async (companyId: string): Promise<{
  productions: { migrated: number; errors: number };
  categories: { migrated: number; errors: number };
  flows: { migrated: number; errors: number };
  steps: { migrated: number; errors: number };
  charges: { migrated: number; errors: number };
}> => {
  const results = await Promise.all([
    migrateProductionsUserTracking(companyId),
    migrateProductionCategoriesUserTracking(companyId),
    migrateProductionFlowsUserTracking(companyId),
    migrateProductionFlowStepsUserTracking(companyId),
    migrateProductionChargesUserTracking(companyId)
  ]);
  
  return {
    productions: results[0],
    categories: results[1],
    flows: results[2],
    steps: results[3],
    charges: results[4]
  };
};

