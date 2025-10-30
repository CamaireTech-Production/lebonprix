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
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { EmployeeRef, User, UserRole, UserCompanyRef } from '../types/models';
import { addUserToCompany } from './userCompanySyncService';

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
    console.log(`🔍 Recherche d'utilisateurs par email: ${email}`);
    
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

    console.log(`✅ ${users.length} utilisateurs trouvés`);
    return users;
  } catch (error: any) {
    console.error('❌ Erreur lors de la recherche d\'utilisateurs:', error);
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
    console.log(`👥 Ajout de l'employé ${userId} à l'entreprise ${companyId} avec le rôle ${role}`);

    // 1. Vérifier que le user existe
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error(`Utilisateur ${userId} non trouvé`);
    }

    const userData = userSnap.data() as User;
    console.log(`✅ Utilisateur trouvé: ${userData.firstname} ${userData.lastname}`);

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
        firstname: userData.firstname,
        lastname: userData.lastname,
        email: userData.email
      },
      role
    );

    console.log(`🎉 Employé ajouté avec succès à l'entreprise ${companyInfo.name}`);

  } catch (error: any) {
    console.error('❌ Erreur lors de l\'ajout de l\'employé:', error);
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
    console.log(`🗑️ Suppression de l'employé ${userId} de l'entreprise ${companyId}`);

    // 1. Supprimer la référence employé de la sous-collection
    const employeeRef = doc(db, 'companies', companyId, 'employeeRefs', userId);
    await deleteDoc(employeeRef);
    console.log(`✅ Référence employé supprimée de employeeRefs`);

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
      console.log(`✅ Référence d'entreprise retirée de l'utilisateur`);
    }

    console.log(`🎉 Employé retiré avec succès de l'entreprise`);

  } catch (error: any) {
    console.error('❌ Erreur lors de la suppression de l\'employé:', error);
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
    console.log(`🔄 Mise à jour du rôle de l'employé ${userId} vers ${newRole}`);

    // 1. Mettre à jour le rôle dans la sous-collection employeeRefs
    const employeeRef = doc(db, 'companies', companyId, 'employeeRefs', userId);
    await updateDoc(employeeRef, {
      role: newRole
    });
    console.log(`✅ Rôle mis à jour dans employeeRefs`);

    // 2. Mettre à jour le rôle dans la liste des entreprises de l'utilisateur
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data() as User;
      const updatedCompanies = (userData.companies || []).map(company => 
        company.companyId === companyId 
          ? { ...company, role: newRole }
          : company
      );
      
      await updateDoc(userRef, {
        companies: updatedCompanies
      });
      console.log(`✅ Rôle mis à jour dans la référence utilisateur`);
    }

    console.log(`🎉 Rôle de l'employé mis à jour avec succès`);

  } catch (error: any) {
    console.error('❌ Erreur lors de la mise à jour du rôle:', error);
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
    console.log(`📋 Récupération des employés de l'entreprise ${companyId}`);

    const employeeRefs = collection(db, 'companies', companyId, 'employeeRefs');
    const q = query(employeeRefs, orderBy('addedAt', 'desc'));
    const snapshot = await getDocs(q);

    const employees: EmployeeRef[] = [];
    snapshot.forEach((doc) => {
      employees.push(doc.data() as EmployeeRef);
    });

    console.log(`✅ ${employees.length} employés récupérés`);
    return employees;

  } catch (error: any) {
    console.error('❌ Erreur lors de la récupération des employés:', error);
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
  console.log(`👂 Abonnement aux employés de l'entreprise ${companyId}`);

  const employeeRefs = collection(db, 'companies', companyId, 'employeeRefs');
  const q = query(employeeRefs, orderBy('addedAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const employees: EmployeeRef[] = [];
    snapshot.forEach((doc) => {
      employees.push(doc.data() as EmployeeRef);
    });
    callback(employees);
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
    console.error('❌ Erreur lors de la vérification de l\'employé:', error);
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
    console.error('❌ Erreur lors de la récupération du rôle:', error);
    return null;
  }
};
