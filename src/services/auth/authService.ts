import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../core/firebase';
import { createUser } from '../utilities/userService';
import { FirebaseUser } from 'firebase/auth';

export interface UserSignUpData {
  firstname: string;
  lastname: string;
  phone?: string;
}

/**
 * Inscription d'un utilisateur sans entreprise
 * 
 * Ce service gère l'inscription d'un utilisateur qui pourra ensuite
 * créer des entreprises via le dashboard Netflix
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
    console.log('👤 Création d\'un nouvel utilisateur...');
    console.log('📝 Données utilisateur:', { email, userData });
    
    // 1. Créer le compte Firebase Auth
    console.log('🔥 Création du compte Firebase Auth...');
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log('✅ Compte Firebase Auth créé:', user.uid);
    
    // 2. Mettre à jour le profil Firebase Auth
    console.log('👤 Mise à jour du profil Firebase Auth...');
    await updateProfile(user, {
      displayName: `${userData.firstname} ${userData.lastname}`
    });
    console.log('✅ Profil Firebase Auth mis à jour');
    
    // 3. Créer le document utilisateur dans Firestore
    console.log('📄 Création du document Firestore...');
    await createUser(user.uid, {
      firstname: userData.firstname,
      lastname: userData.lastname,
      email: email,
      phone: userData.phone,
      photoURL: undefined
    });
    console.log('✅ Document Firestore créé');
    
    console.log(`✅ Utilisateur créé avec succès: ${userData.firstname} ${userData.lastname}`);
    console.log('📋 L\'utilisateur peut maintenant créer des entreprises via le dashboard');
    
    return user;
    
  } catch (error: any) {
    console.error('❌ Erreur lors de l\'inscription de l\'utilisateur:', error);
    
    // Gérer les erreurs spécifiques
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('Cette adresse email est déjà utilisée');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Le mot de passe doit contenir au moins 6 caractères');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Adresse email invalide');
    }
    
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
    return user?.companies && user.companies.length > 0;
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
