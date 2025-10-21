import { doc, setDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { CompanyEmployee, UserRole } from '../types/models';
import { createFirebaseUser } from './userAuth';
import { buildLoginLink, makeDefaultEmployeePassword, generateEmployeeId } from '../utils/security';

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
    
    // 4. Générer le loginLink
    const loginLink = buildLoginLink(employeeData.firstname, employeeData.lastname);
    
    // 5. Créer l'objet employé complet
    const newEmployee: CompanyEmployee = {
      ...employeeData,
      id: employeeId,
      firebaseUid,
      loginLink,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    // 6. Sauvegarder dans Firestore (sous-collection)
    const employeeRef = doc(db, 'companies', companyId, 'employees', employeeId);
    await setDoc(employeeRef, newEmployee);
    
    // 7. Mettre à jour la liste des employés dans le document company
    const companyRef = doc(db, 'companies', companyId);
    await updateDoc(companyRef, {
      [`employees.${employeeId}`]: newEmployee
    });
    
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
  // Supprimer de la sous-collection
  const employeeRef = doc(db, 'companies', companyId, 'employees', employeeId);
  await deleteDoc(employeeRef);
  
  // Supprimer du document company
  const companyRef = doc(db, 'companies', companyId);
  await updateDoc(companyRef, {
    [`employees.${employeeId}`]: null
  });
};
