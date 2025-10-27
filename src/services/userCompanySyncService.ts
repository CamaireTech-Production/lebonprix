import { db } from './firebase';
import { doc, setDoc, updateDoc, getDoc, arrayUnion, arrayRemove, serverTimestamp, increment, deleteField } from 'firebase/firestore';
import { UserCompanyRef } from '../types/models';

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
    firstname: string;
    lastname: string;
    email: string;
  },
  role: 'owner' | 'admin' | 'manager' | 'staff'
): Promise<void> {
  try {
    console.log('➕ Ajout utilisateur à company:', { userId, companyId, role });

    // 1. Créer l'employeeRef dans companies/{companyId}/employeeRefs/{userId}
    const employeeRefData = {
      id: userId, // ID de l'utilisateur (Firebase UID)
      firstname: userData.firstname,
      lastname: userData.lastname,
      email: userData.email, // Email de l'utilisateur
      role: role,
      addedAt: serverTimestamp()
    };

    await setDoc(
      doc(db, 'companies', companyId, 'employeeRefs', userId),
      employeeRefData
    );

    console.log('✅ EmployeeRef créé');

    // 2. Mettre à jour company.employees{} et employeeCount
    const companyRef = doc(db, 'companies', companyId);
    await updateDoc(companyRef, {
      [`employees.${userId}`]: {
        firstname: userData.firstname,
        lastname: userData.lastname,
        email: userData.email,
        role: role
      },
      employeeCount: increment(1),
      updatedAt: serverTimestamp()
    });

    console.log('✅ Company.employees{} mis à jour');

    // 3. Mettre à jour users/{userId}.companies[] avec arrayUnion
    const userCompanyRef: UserCompanyRef = {
      companyId: companyId, // ID de la company (pas l'ID utilisateur)
      name: companyData.name,
      description: companyData.description,
      logo: companyData.logo,
      role: role,
      joinedAt: new Date() as any
    };

    await updateDoc(doc(db, 'users', userId), {
      companies: arrayUnion(userCompanyRef),
      updatedAt: serverTimestamp()
    });

    console.log('✅ User.companies[] mis à jour');
  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout de l\'utilisateur à la company:', error);
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
    console.log('➖ Suppression utilisateur de company:', { userId, companyId });

    // 1. Récupérer les infos de l'utilisateur dans la company
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      throw new Error('Utilisateur non trouvé');
    }

    const userData = userDoc.data();
    const userCompanyRef = userData.companies?.find((c: UserCompanyRef) => c.companyId === companyId);

    if (!userCompanyRef) {
      console.warn('⚠️ Utilisateur non trouvé dans cette company');
      return;
    }

    // 2. Supprimer l'employeeRef (utiliser deleteDoc séparément si nécessaire)
    await setDoc(doc(db, 'companies', companyId, 'employeeRefs', userId), {
      deleted: true,
      deletedAt: serverTimestamp()
    }, { merge: true });

    console.log('✅ EmployeeRef marqué comme supprimé');

    // 3. Retirer de company.employees{} et décrémenter employeeCount
    const companyRef = doc(db, 'companies', companyId);
    await updateDoc(companyRef, {
      [`employees.${userId}`]: deleteField(),
      employeeCount: increment(-1),
      updatedAt: serverTimestamp()
    });

    console.log('✅ Company.employees{} mis à jour');

    // 4. Retirer de users.companies[]
    await updateDoc(doc(db, 'users', userId), {
      companies: arrayRemove(userCompanyRef),
      updatedAt: serverTimestamp()
    });

    console.log('✅ User.companies[] mis à jour');
  } catch (error) {
    console.error('❌ Erreur lors de la suppression de l\'utilisateur de la company:', error);
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
    console.log('🔄 Mise à jour du rôle:', { userId, companyId, newRole });

    // 1. Mettre à jour l'employeeRef
    await updateDoc(doc(db, 'companies', companyId, 'employeeRefs', userId), {
      role: newRole,
      updatedAt: serverTimestamp()
    });

    console.log('✅ EmployeeRef mis à jour');

    // 2. Mettre à jour le rôle dans company.employees{}
    const companyRef = doc(db, 'companies', companyId);
    await updateDoc(companyRef, {
      [`employees.${userId}.role`]: newRole,
      updatedAt: serverTimestamp()
    });

    console.log('✅ Company.employees{} mis à jour');

    // 3. Mettre à jour users.companies[]
    // Firestore ne permet pas de modifier directement un élément d'un array
    // Il faut retirer l'ancien et ajouter le nouveau
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      throw new Error('Utilisateur non trouvé');
    }

    const userData = userDoc.data();
    const oldCompanyRef = userData.companies?.find((c: UserCompanyRef) => c.companyId === companyId);

    if (!oldCompanyRef) {
      throw new Error('Company non trouvée dans user.companies[]');
    }

    // Créer la nouvelle référence avec le nouveau rôle
    const newCompanyRef: UserCompanyRef = {
      ...oldCompanyRef,
      role: newRole
    };

    // Retirer l'ancienne et ajouter la nouvelle
    await updateDoc(doc(db, 'users', userId), {
      companies: arrayRemove(oldCompanyRef)
    });

    await updateDoc(doc(db, 'users', userId), {
      companies: arrayUnion(newCompanyRef),
      updatedAt: serverTimestamp()
    });

    console.log('✅ User.companies[] mis à jour');
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour du rôle:', error);
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
    console.log('🔄 Synchronisation employeeRef → user:', { userId, companyId });

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
    const oldCompanyRef = userData.companies?.find((c: UserCompanyRef) => c.companyId === companyId);

    // 4. Créer la nouvelle référence synchronisée
    const newCompanyRef: UserCompanyRef = {
      companyId: companyId,
      name: companyData.name,
      description: companyData.description,
      logo: companyData.logo,
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

    console.log('✅ Synchronisation terminée');
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
    console.error('❌ Erreur lors de la vérification de cohérence:', error);
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
