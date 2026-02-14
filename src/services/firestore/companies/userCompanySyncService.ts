import { db } from '../../core/firebase';
import { doc, setDoc, updateDoc, getDoc, arrayUnion, arrayRemove, serverTimestamp, increment, deleteField, writeBatch } from 'firebase/firestore';
import { UserCompanyRef } from '../../../types/models';
import { logError } from '@utils/core/logger';

/**
 * Service de synchronisation bidirectionnelle entre employeeRefs et users.companies[]
 * Garantit que les rôles et les données sont toujours cohérents
 */

/**
 * Ajoute un utilisateur comme employé d'une company
 * Crée l'employeeRef ET met à jour users.companies[]
 */
export async function addUserToCompany(
  userId: string,
  companyId: string,
  companyData: {
    name: string;
    description?: string;
    logo?: string;
  },
  userData: {
    username: string;
    email: string;
  },
  role: 'owner' | 'admin' | 'manager' | 'staff',
  permissionTemplateId?: string
): Promise<void> {
  try {

    // 1. Créer l'employeeRef dans companies/{companyId}/employeeRefs/{userId}
    const employeeRefData = {
      id: userId, // ID de l'utilisateur (Firebase UID)
      username: userData.username,
      email: userData.email, // Email de l'utilisateur
      role: role,
      deleted: false,
      addedAt: serverTimestamp()
    };

    await setDoc(
      doc(db, 'companies', companyId, 'employeeRefs', userId),
      employeeRefData
    );


    // 2. Mettre à jour company.employees{} et employeeCount
    const companyRef = doc(db, 'companies', companyId);
    await updateDoc(companyRef, {
      [`employees.${userId}`]: {
        username: userData.username,
        email: userData.email,
        role: role
      },
      employeeCount: increment(1),
      updatedAt: serverTimestamp()
    });



    // 3. Mettre à jour users/{userId}.companies[] avec arrayUnion
    const userCompanyRef: UserCompanyRef = {
      companyId: companyId, // ID de la company (pas l'ID utilisateur)
      name: companyData.name,
      description: companyData.description || '',
      logo: companyData.logo || '',
      role: role,
      joinedAt: new Date() as any,
      ...(permissionTemplateId && { permissionTemplateId })
    };

    await updateDoc(doc(db, 'users', userId), {
      companies: arrayUnion(userCompanyRef),
      updatedAt: serverTimestamp()
    });

  } catch (error) {
    logError('Error adding user to company', error);
    throw error;
  }
}

/**
 * Supprime un utilisateur d'une company
 * Supprime l'employeeRef ET retire de users.companies[]
 */
export async function removeUserFromCompany(
  userId: string,
  companyId: string
): Promise<void> {
  try {

    const userRef = doc(db, 'users', userId);
    const companyRef = doc(db, 'companies', companyId);
    const employeeRef = doc(db, 'companies', companyId, 'employeeRefs', userId);

    // 1) Lire l'utilisateur pour récupérer l'objet EXACT à retirer
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      throw new Error('Utilisateur non trouvé');
    }
    const userData = userSnap.data();
    const userCompanyRef = userData?.companies?.find((c: UserCompanyRef) => c.companyId === companyId);

    // 2) Batch atomique
    const batch = writeBatch(db);
    // a) HARD delete de l'employeeRef
    batch.delete(employeeRef);
    // b) Nettoyer company.employees et décrémenter
    batch.update(companyRef, {
      [`employees.${userId}`]: deleteField(),
      employeeCount: increment(-1),
      updatedAt: serverTimestamp()
    });
    // c) Retirer l'entrée côté user si présente
    if (userCompanyRef) {
      const cleanCompanyRef: any = {};
      Object.keys(userCompanyRef).forEach((key) => {
        const value = (userCompanyRef as any)[key];
        if (value !== undefined && value !== null) {
          cleanCompanyRef[key] = value;
        }
      });
      batch.update(userRef, {
        companies: arrayRemove(cleanCompanyRef),
        updatedAt: serverTimestamp()
      });
    }

    await batch.commit();

  } catch (error) {
    logError('Error removing user from company', error);
    throw error;
  }
}

/**
 * Met à jour le rôle d'un utilisateur dans une company
 * Synchronise employeeRefs ET users.companies[]
 */
export async function updateUserRole(
  userId: string,
  companyId: string,
  newRole: 'owner' | 'admin' | 'manager' | 'staff'
): Promise<void> {
  try {


    // 1. Mettre à jour l'employeeRef
    await updateDoc(doc(db, 'companies', companyId, 'employeeRefs', userId), {
      role: newRole,
      updatedAt: serverTimestamp()
    });


    // 2. Mettre à jour le rôle dans company.employees{}
    const companyRef = doc(db, 'companies', companyId);
    await updateDoc(companyRef, {
      [`employees.${userId}.role`]: newRole,
      updatedAt: serverTimestamp()
    });



    // 3. Mettre à jour users.companies[]
    // Récupérer le document, modifier le tableau, et le remplacer complètement
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('Utilisateur non trouvé');
    }

    const userData = userDoc.data();
    const companies = userData?.companies || [];

    // Trouver l'index de la company à modifier
    const companyIndex = companies.findIndex((c: UserCompanyRef) => c.companyId === companyId);

    if (companyIndex === -1) {
      throw new Error('Company non trouvée dans user.companies[]');
    }

    // Créer un nouveau tableau avec le rôle mis à jour
    const updatedCompanies = [...companies];
    updatedCompanies[companyIndex] = {
      ...updatedCompanies[companyIndex],
      role: newRole,
      description: updatedCompanies[companyIndex].description || '',
      logo: updatedCompanies[companyIndex].logo || ''
    };

    // Remplacer complètement le tableau companies

    await updateDoc(userRef, {
      companies: updatedCompanies,
      updatedAt: serverTimestamp()
    });


  } catch (error) {
    logError('Error updating user role', error);
    throw error;
  }
}

/**
 * Synchronise les données d'un employeeRef vers users.companies[]
 * Utile après modification manuelle d'un employeeRef
 */
export async function syncEmployeeRefToUser(
  userId: string,
  companyId: string
): Promise<void> {
  try {


    // 1. Récupérer l'employeeRef
    const employeeRefDoc = await getDoc(doc(db, 'companies', companyId, 'employeeRefs', userId));

    if (!employeeRefDoc.exists()) {
      throw new Error('EmployeeRef non trouvé');
    }

    const employeeRefData = employeeRefDoc.data();

    // 2. Récupérer les infos de la company
    const companyDoc = await getDoc(doc(db, 'companies', companyId));

    if (!companyDoc.exists()) {
      throw new Error('Company non trouvée');
    }

    const companyData = companyDoc.data();

    // 3. Récupérer l'utilisateur
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!userDoc.exists()) {
      throw new Error('Utilisateur non trouvé');
    }

    const userData = userDoc.data();
    const oldCompanyRef = userData?.companies?.find((c: UserCompanyRef) => c.companyId === companyId);

    // 4. Créer la nouvelle référence synchronisée
    const newCompanyRef: UserCompanyRef = {
      companyId: companyId,
      name: companyData.name,
      description: companyData.description || '',
      logo: companyData.logo || '',
      role: employeeRefData.role,
      joinedAt: employeeRefData.addedAt || new Date() as any
    };

    // 5. Remplacer dans users.companies[]
    if (oldCompanyRef) {
      await updateDoc(doc(db, 'users', userId), {
        companies: arrayRemove(oldCompanyRef)
      });
    }

    await updateDoc(doc(db, 'users', userId), {
      companies: arrayUnion(newCompanyRef),
      updatedAt: serverTimestamp()
    });

  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation:', error);
    throw error;
  }
}

/**
 * Vérifie la cohérence entre employeeRefs et users.companies[]
 * Retourne les incohérences trouvées
 */
export async function checkConsistency(
  userId: string,
  companyId: string
): Promise<{
  isConsistent: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  try {
    // 1. Vérifier l'employeeRef
    const employeeRefDoc = await getDoc(doc(db, 'companies', companyId, 'employeeRefs', userId));
    const hasEmployeeRef = employeeRefDoc.exists();

    // 2. Vérifier users.companies[]
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data();
    const userCompanyRef = userData?.companies?.find((c: UserCompanyRef) => c.companyId === companyId);
    const hasUserCompanyRef = !!userCompanyRef;

    // 3. Vérifier la cohérence
    if (hasEmployeeRef && !hasUserCompanyRef) {
      issues.push('EmployeeRef existe mais absent de user.companies[]');
    }

    if (!hasEmployeeRef && hasUserCompanyRef) {
      issues.push('Présent dans user.companies[] mais employeeRef n\'existe pas');
    }

    if (hasEmployeeRef && hasUserCompanyRef) {
      const employeeRefData = employeeRefDoc.data();
      if (employeeRefData.role !== userCompanyRef.role) {
        issues.push(`Rôle différent: employeeRef=${employeeRefData.role}, user=${userCompanyRef.role}`);
      }
    }

    return {
      isConsistent: issues.length === 0,
      issues
    };
  } catch (error) {
    logError('Error checking consistency', error);
    return {
      isConsistent: false,
      issues: ['Erreur lors de la vérification']
    };
  }
}

export default {
  addUserToCompany,
  removeUserFromCompany,
  updateUserRole,
  syncEmployeeRefToUser,
  checkConsistency
};
