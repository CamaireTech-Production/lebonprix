import { 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  collection, 
  query, 
  where, 
  orderBy, 
  updateDoc, 
  Timestamp,
  Unsubscribe,
  onSnapshot,
  arrayRemove,
  arrayUnion,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError } from '@utils/core/logger';
import { EmployeeRef, User, UserRole, UserCompanyRef } from '../../../types/models';
import { addUserToCompany, updateUserRole } from '../companies/userCompanySyncService';

/**
 * Service pour gérer les références d'employés (employeeRefs)
 * Nouvelle architecture basée sur la sous-collection companies/{companyId}/employeeRefs/{firebaseUid}
 */

/**
 * Rechercher des utilisateurs par email
 * @param email - Email à rechercher (peut être partiel)
 * @returns Liste des utilisateurs correspondants
 */
export const searchUserByEmail = async (email: string): Promise<User[]> => {
  try {
    if (!email || email.trim().length < 2) {
      return [];
    }

    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('email', '>=', email.toLowerCase()),
      where('email', '<=', email.toLowerCase() + '\uf8ff'),
      orderBy('email')
    );

    const snapshot = await getDocs(q);
    const users: User[] = [];

    snapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() } as User);
    });

    return users;
  } catch (error: any) {
    logError('Error searching users by email', error);
    throw error;
  }
};

/**
 * Ajouter un employé à une entreprise
 * @param companyId - ID de l'entreprise
 * @param userId - ID (firebaseUid) de l'utilisateur
 * @param role - Rôle de l'employé dans cette entreprise
 * @param companyInfo - Informations de l'entreprise pour la référence user
 */
export const addEmployeeToCompany = async (
  companyId: string, 
  userId: string, 
  role: UserRole,
  companyInfo: { name: string; description?: string; logo?: string }
): Promise<void> => {
  try {
    // 1. Vérifier que le user existe
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error(`Utilisateur ${userId} non trouvé`);
    }

    const userData = userSnap.data() as User;

    // 2. Vérifier que l'employé n'est pas déjà dans cette entreprise
    const employeeRef = doc(db, 'companies', companyId, 'employeeRefs', userId);
    const employeeSnap = await getDoc(employeeRef);
    
    if (employeeSnap.exists()) {
      throw new Error('Cet utilisateur est déjà employé dans cette entreprise');
    }

    // 3. Utiliser addUserToCompany qui fait tout :
    // - Crée l'employeeRef
    // - Met à jour company.employees{}
    // - Met à jour employeeCount
    // - Met à jour users.companies[]
    await addUserToCompany(
      userId,
      companyId,
      companyInfo,
      {
        username: userData.username,
        email: userData.email
      },
      role
    );

  } catch (error: any) {
    logError('Error adding employee to company', error);
    throw error;
  }
};

/**
 * Retirer un employé d'une entreprise
 * @param companyId - ID de l'entreprise
 * @param userId - ID (firebaseUid) de l'utilisateur
 */
export const removeEmployeeFromCompany = async (
  companyId: string, 
  userId: string
): Promise<void> => {
  try {
    // 1. Supprimer la référence employé de la sous-collection
    const employeeRef = doc(db, 'companies', companyId, 'employeeRefs', userId);
    await deleteDoc(employeeRef);

    // 2. Retirer la référence de la liste des entreprises de l'utilisateur
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data() as User;
      const updatedCompanies = (userData.companies || []).filter(
        company => company.companyId !== companyId
      );
      
      await updateDoc(userRef, {
        companies: updatedCompanies
      });
    }

  } catch (error: any) {
    logError('Error removing employee from company', error);
    throw error;
  }
};

/**
 * Mettre à jour le rôle d'un employé
 * @param companyId - ID de l'entreprise
 * @param userId - ID (firebaseUid) de l'utilisateur
 * @param newRole - Nouveau rôle
 */
export const updateEmployeeRole = async (
  companyId: string, 
  userId: string, 
  newRole: UserRole
): Promise<void> => {
  try {
    // Utiliser le service de synchronisation qui met à jour tout correctement :
    // - employeeRefs
    // - company.employees{}
    // - users.companies[] (avec arrayRemove/arrayUnion)
    await updateUserRole(userId, companyId, newRole);

  } catch (error: any) {
    logError('Error updating employee role', error);
    throw error;
  }
};

/**
 * Récupérer tous les employés d'une entreprise
 * @param companyId - ID de l'entreprise
 * @returns Liste des employés
 */
export const getCompanyEmployees = async (companyId: string): Promise<EmployeeRef[]> => {
  try {
    const employeeRefs = collection(db, 'companies', companyId, 'employeeRefs');
    const q = query(employeeRefs, orderBy('addedAt', 'desc'));
    const snapshot = await getDocs(q);

    const employees: EmployeeRef[] = [];
    snapshot.forEach((doc) => {
      employees.push({ id: doc.id, ...doc.data() } as EmployeeRef);
    });

    return employees;

  } catch (error: any) {
    logError('Error fetching company employees', error);
    throw error;
  }
};

/**
 * S'abonner aux changements des employés d'une entreprise
 * @param companyId - ID de l'entreprise
 * @param callback - Fonction appelée à chaque changement
 * @returns Fonction de désabonnement
 */
export const subscribeToEmployeeRefs = (
  companyId: string, 
  callback: (employees: EmployeeRef[]) => void
): Unsubscribe => {
  const employeeRefs = collection(db, 'companies', companyId, 'employeeRefs');
  const q = query(employeeRefs, orderBy('addedAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const employees: EmployeeRef[] = [];
    snapshot.forEach((doc) => {
      const employeeData = { id: doc.id, ...doc.data() } as EmployeeRef;
      employees.push(employeeData);
    });
    callback(employees);
  }, (error) => {
    logError(`Error in subscribeToEmployeeRefs listener for company ${companyId}`, error);
  });
};

/**
 * Vérifier si un utilisateur est employé dans une entreprise
 * @param companyId - ID de l'entreprise
 * @param userId - ID (firebaseUid) de l'utilisateur
 * @returns True si l'utilisateur est employé dans cette entreprise
 */
export const isUserEmployeeOfCompany = async (
  companyId: string, 
  userId: string
): Promise<boolean> => {
  try {
    const employeeRef = doc(db, 'companies', companyId, 'employeeRefs', userId);
    const employeeSnap = await getDoc(employeeRef);
    return employeeSnap.exists();
  } catch (error: any) {
    logError('Error checking if user is employee of company', error);
    return false;
  }
};

/**
 * Obtenir le rôle d'un employé dans une entreprise
 * @param companyId - ID de l'entreprise
 * @param userId - ID (firebaseUid) de l'utilisateur
 * @returns Le rôle de l'employé ou null s'il n'est pas employé
 */
export const getEmployeeRole = async (
  companyId: string, 
  userId: string
): Promise<UserRole | null> => {
  try {
    const employeeRef = doc(db, 'companies', companyId, 'employeeRefs', userId);
    const employeeSnap = await getDoc(employeeRef);
    
    if (employeeSnap.exists()) {
      const employeeData = employeeSnap.data() as EmployeeRef;
      return employeeData.role;
    }
    
    return null;
  } catch (error: any) {
    logError('Error getting employee role', error);
    return null;
  }
};
