import { createUserWithEmailAndPassword, updateProfile, User as FirebaseUser } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { auth, app } from '../core/firebase';
import { createUser } from '../utilities/userService';

export interface UserSignUpData {
  firstname: string;
  lastname: string;
  phone?: string;
}

/**
 * Inscription d'un utilisateur sans entreprise
 * 
 * Flow simplifié et standard:
 * 1. Créer le compte Firebase Auth (auto-authentifie l'utilisateur)
 * 2. Mettre à jour le profil Firebase Auth
 * 3. Créer le document Firestore (l'utilisateur est déjà authentifié)
 * 
 * @param email - Email de l'utilisateur
 * @param password - Mot de passe
 * @param userData - Données personnelles de l'utilisateur
 * @returns L'utilisateur Firebase créé
 */
export const signUpUser = async (
  email: string,
  password: string,
  userData: UserSignUpData
): Promise<FirebaseUser> => {
  try {
    // 1. Créer le compte Firebase Auth (auto-authentifie l'utilisateur)
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const userId = user.uid;
    
    // 2. Mettre à jour le profil Firebase Auth
    await updateProfile(user, {
      displayName: `${userData.firstname} ${userData.lastname}`
    });
    
    // 3. Créer le document Firestore (l'utilisateur est déjà authentifié)
    // Créer une instance Firestore fraîche (sans cache) pour garantir que l'auth state est à jour
    // C'est la même approche que main branch qui utilise getFirestore(app) directement
    const freshDb = getFirestore(app);
    await createUser(
      userId,
      {
        firstname: userData.firstname,
        lastname: userData.lastname,
        email: email,
        phone: userData.phone,
        photoURL: undefined
      },
      undefined, // companyId
      undefined, // role
      freshDb
    );
    
    return user;
    
  } catch (error: any) {
    console.error('❌ Erreur lors de l\'inscription de l\'utilisateur:', error);
    throw error;
  }
};

/**
 * Vérifier si un utilisateur a des entreprises
 * 
 * @param userId - ID de l'utilisateur
 * @returns true si l'utilisateur a au moins une entreprise
 */
export const userHasCompanies = async (userId: string): Promise<boolean> => {
  try {
    const user = await getUserById(userId);
    return !!(user?.companies && user.companies.length > 0);
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des entreprises:', error);
    return false;
  }
};

/**
 * Obtenir le nombre d'entreprises d'un utilisateur
 * 
 * @param userId - ID de l'utilisateur
 * @returns Nombre d'entreprises
 */
export const getUserCompaniesCount = async (userId: string): Promise<number> => {
  try {
    const user = await getUserById(userId);
    return user?.companies?.length || 0;
  } catch (error) {
    console.error('❌ Erreur lors du comptage des entreprises:', error);
    return 0;
  }
};

/**
 * Vérifier si l'utilisateur est propriétaire d'une entreprise
 * 
 * @param userId - ID de l'utilisateur
 * @param companyId - ID de l'entreprise
 * @returns true si l'utilisateur est propriétaire
 */
export const isUserOwnerOfCompany = async (userId: string, companyId: string): Promise<boolean> => {
  try {
    const user = await getUserById(userId);
    if (!user?.companies) return false;
    
    return user.companies.some(company => 
      company.companyId === companyId && company.role === 'owner'
    );
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de propriété:', error);
    return false;
  }
};

/**
 * Obtenir le rôle de l'utilisateur dans une entreprise
 * 
 * @param userId - ID de l'utilisateur
 * @param companyId - ID de l'entreprise
 * @returns Le rôle de l'utilisateur ou null
 */
export const getUserRoleInCompany = async (
  userId: string, 
  companyId: string
): Promise<'owner' | 'admin' | 'manager' | 'staff' | null> => {
  try {
    const user = await getUserById(userId);
    if (!user?.companies) return null;
    
    const company = user.companies.find(c => c.companyId === companyId);
    return company?.role || null;
  } catch (error) {
    console.error('❌ Erreur lors de la récupération du rôle:', error);
    return null;
  }
};

// Import nécessaire pour les fonctions helper
import { getUserById } from '../utilities/userService';
