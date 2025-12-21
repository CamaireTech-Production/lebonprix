import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../core/firebase';

export interface CreateFirebaseUserParams {
  email: string;
  password: string;
  displayName: string;
}

/**
 * Crée un utilisateur Firebase Auth avec les informations fournies
 * @param userData - Données de l'utilisateur (email, password, displayName)
 * @returns L'UID de l'utilisateur créé
 */
export const createFirebaseUser = async (userData: CreateFirebaseUserParams): Promise<string> => {
  try {
    // Créer l'utilisateur Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
    const user = userCredential.user;
    
    // Mettre à jour le profil avec le nom d'affichage
    await updateProfile(user, {
      displayName: userData.displayName
    });
    
    return user.uid;
  } catch (error: any) {
    console.error('Erreur lors de la création de l\'utilisateur Firebase Auth:', error);
    throw new Error(`Impossible de créer l'utilisateur: ${error.message}`);
  }
};
