import { doc, setDoc, updateDoc, deleteDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { CompanyEmployee, UserRole } from '../types/models';
import { createFirebaseUser } from './userAuth';
import { buildLoginLink, makeDefaultEmployeePassword, generateEmployeeId } from '../utils/security';
import { createUser, addCompanyToUser, removeCompanyFromUser } from './userService';

export interface EmployeeData {
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  role: UserRole;
  birthday?: string;
}

/**
 * Sauvegarde un employé avec création automatique d'utilisateur Firebase Auth
 * @param companyId - ID de la compagnie
 * @param employeeData - Données de l'employé
 * @returns L'employé créé
 */
export const saveEmployee = async (
  companyId: string,
  employeeData: EmployeeData
): Promise<CompanyEmployee> => {
  try {
    // 1. Générer un ID unique pour l'employé
    const employeeId = generateEmployeeId();
    
    // 2. Créer le mot de passe par défaut
    const defaultPassword = makeDefaultEmployeePassword(employeeData.firstname, employeeData.lastname);
    
    // 3. Créer l'utilisateur Firebase Auth (utilise createFirebaseUser)
    const firebaseUid = await createFirebaseUser({
      email: employeeData.email,
      password: defaultPassword,
      displayName: `${employeeData.firstname} ${employeeData.lastname}`
    });
    
    // 4. Créer l'utilisateur dans le système unifié
    await createUser(firebaseUid, {
      firstname: employeeData.firstname,
      lastname: employeeData.lastname,
      email: employeeData.email,
      phone: employeeData.phone,
      photoURL: undefined
    }, companyId, employeeData.role);
    
    // 5. Générer le loginLink
    const loginLink = buildLoginLink(employeeData.firstname, employeeData.lastname);
    
    // 6. Créer l'objet employé complet
    const newEmployee: CompanyEmployee = {
      ...employeeData,
      id: employeeId,
      firebaseUid,
      loginLink,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    // 7. Sauvegarder dans Firestore (sous-collection) - Compatibilité
    const employeeRef = doc(db, 'companies', companyId, 'employees', employeeId);
    await setDoc(employeeRef, newEmployee);
    
    // 8. Mettre à jour la liste des employés dans le document company - Compatibilité
    const companyRef = doc(db, 'companies', companyId);
    await updateDoc(companyRef, {
      [`employees.${employeeId}`]: newEmployee
    });
    
    // 9. ❌ SUPPRIMÉ - Architecture simplifiée ne gère plus employeeRefs
    // Les références sont uniquement dans users[].companies[]
    
    return newEmployee;
  } catch (error: any) {
    console.error('Erreur lors de la sauvegarde de l\'employé:', error);
    throw error;
  }
};

/**
 * Met à jour un employé existant
 * @param companyId - ID de la compagnie
 * @param employeeId - ID de l'employé
 * @param updates - Données à mettre à jour
 */
export const updateEmployee = async (
  companyId: string,
  employeeId: string,
  updates: Partial<CompanyEmployee>
): Promise<void> => {
  const employeeRef = doc(db, 'companies', companyId, 'employees', employeeId);
  await updateDoc(employeeRef, {
    ...updates,
    updatedAt: Timestamp.now()
  });
  
  // Mettre à jour aussi dans le document company
  const companyRef = doc(db, 'companies', companyId);
  await updateDoc(companyRef, {
    [`employees.${employeeId}.updatedAt`]: Timestamp.now(),
    ...Object.keys(updates).reduce((acc, key) => {
      acc[`employees.${employeeId}.${key}`] = updates[key as keyof CompanyEmployee];
      return acc;
    }, {} as Record<string, any>)
  });
};

/**
 * Supprime un employé
 * @param companyId - ID de la compagnie
 * @param employeeId - ID de l'employé
 */
export const removeEmployee = async (
  companyId: string,
  employeeId: string
): Promise<void> => {
  try {
    // 1. Récupérer les données de l'employé pour obtenir le firebaseUid
    const employeeRef = doc(db, 'companies', companyId, 'employees', employeeId);
    const employeeDoc = await getDoc(employeeRef);
    
    if (!employeeDoc.exists()) {
      throw new Error('Employé non trouvé');
    }
    
    const employeeData = employeeDoc.data();
    const firebaseUid = employeeData.firebaseUid;
    
    if (firebaseUid) {
      // 2. Supprimer la référence de l'entreprise dans users/{uid}
      await removeCompanyFromUser(firebaseUid, companyId);
      
      // 3. ❌ SUPPRIMÉ - Architecture simplifiée ne gère plus employeeRefs
      // Les références sont uniquement dans users[].companies[]
    }
    
    // 4. Supprimer de la sous-collection (compatibilité)
    await deleteDoc(employeeRef);
    
    // 5. Supprimer du document company (compatibilité)
    const companyDocRef = doc(db, 'companies', companyId);
    await updateDoc(companyDocRef, {
      [`employees.${employeeId}`]: null
    });
    
  } catch (error: any) {
    console.error('Erreur lors de la suppression de l\'employé:', error);
    throw error;
  }
};
