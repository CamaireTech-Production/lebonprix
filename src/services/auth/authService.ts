import {
  createUserWithEmailAndPassword,
  updateProfile,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  linkWithCredential,
  EmailAuthProvider,
  fetchSignInMethodsForEmail
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { auth, app } from '../core/firebase';
import { createUser, getUserById } from '../utilities/userService';
import { validateUsername, generateUsernameFromEmail, normalizeUsername } from '@utils/validation/usernameValidation';

export interface UserSignUpData {
  username: string; // Required unique username
}

/**
 * Inscription d'un utilisateur sans entreprise
 * 
 * Flow simplifié et standard:
 * 1. Valider le nom d'utilisateur (format et disponibilité)
 * 2. Créer le compte Firebase Auth (auto-authentifie l'utilisateur)
 * 3. Mettre à jour le profil Firebase Auth avec le username
 * 4. Créer le document Firestore (l'utilisateur est déjà authentifié)
 * 
 * @param email - Email de l'utilisateur
 * @param password - Mot de passe
 * @param userData - Données personnelles de l'utilisateur (username uniquement)
 * @returns L'utilisateur Firebase créé
 */
export const signUpUser = async (
  email: string,
  password: string,
  userData: UserSignUpData
): Promise<FirebaseUser> => {
  try {
    // 1. Valider le format du nom d'utilisateur
    const usernameValidation = validateUsername(userData.username);
    if (!usernameValidation.valid) {
      throw new Error(usernameValidation.error || 'Nom d\'utilisateur invalide');
    }

    // Note: Username availability check removed - username is not used for authentication

    // 2. Créer le compte Firebase Auth (auto-authentifie l'utilisateur)
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const userId = user.uid;

    // 3. Mettre à jour le profil Firebase Auth avec le username
    await updateProfile(user, {
      displayName: userData.username
    });

    // 4. Créer le document Firestore (l'utilisateur est déjà authentifié)
    // Créer une instance Firestore fraîche (sans cache) pour garantir que l'auth state est à jour
    // C'est la même approche que main branch qui utilise getFirestore(app) directement
    const freshDb = getFirestore(app);

    await createUser(
      userId,
      {
        username: userData.username,
        email: email,
        photoURL: undefined
      },
      undefined, // companyId
      undefined, // role
      freshDb
    );

    return user;

  } catch (error: any) {
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
    return null;
  }
};

/**
 * Connexion avec Google
 * 
 * Flow:
 * 1. Authentifier l'utilisateur avec Google (popup)
 * 2. Vérifier si l'utilisateur existe dans Firestore
 * 3. Si nouveau utilisateur:
 *    - Extraire displayName comme username (ou générer depuis email si absent)
 *    - Vérifier disponibilité du username
 *    - Créer le document Firestore
 * 4. Si utilisateur existant: procéder normalement
 * 
 * @returns L'utilisateur Firebase authentifié
 */
export const signInWithGoogle = async (): Promise<FirebaseUser> => {
  try {
    const provider = new GoogleAuthProvider();

    // Utiliser signInWithPopup pour une meilleure expérience utilisateur
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const userId = user.uid;

    // Vérifier si l'utilisateur existe déjà dans Firestore
    const existingUser = await getUserById(userId);

    if (!existingUser) {
      // Nouvel utilisateur - créer le document Firestore
      // 1. Extraire ou générer le username
      // Option B: Use displayName as username directly (as per user requirement)
      // Fallback to Option A: Generate from email if no displayName
      let username = user.displayName || '';

      // Si pas de displayName, générer depuis l'email (fallback)
      if (!username || username.trim().length === 0) {
        username = generateUsernameFromEmail(user.email || '');
      }

      // Nettoyer le username: remplacer les espaces et caractères invalides
      // Garder le displayName tel quel mais nettoyer les caractères non autorisés
      username = username.trim().replace(/[^a-zA-Z0-9_\s-]/g, ''); // Garder espaces temporairement
      username = username.replace(/\s+/g, '_'); // Remplacer espaces par underscores

      // S'assurer que le username respecte les règles de validation
      // Si trop court après nettoyage, ajouter un suffixe
      if (username.length < 3) {
        username = username + Date.now().toString().slice(-6);
      }

      // Limiter à 30 caractères
      if (username.length > 30) {
        username = username.substring(0, 30);
      }

      // S'assurer que le username ne commence/termine pas par underscore ou tiret
      username = username.replace(/^[_-]+|[_-]+$/g, '');
      if (username.length < 3) {
        username = 'user' + Date.now().toString().slice(-6);
      }

      // Note: Username availability check removed - username is not used for authentication
      // We just validate the format and use it directly
      let finalUsername = username;

      // Valider le username final
      const usernameValidation = validateUsername(finalUsername);
      if (!usernameValidation.valid) {
        // Si invalide, générer un username sûr depuis l'email
        finalUsername = generateUsernameFromEmail(user.email || '');
      }

      // 2. Créer le document Firestore
      const freshDb = getFirestore(app);
      await createUser(
        userId,
        {
          username: finalUsername,
          email: user.email || '',
          photoURL: user.photoURL || undefined
        },
        undefined, // companyId
        undefined, // role
        freshDb
      );
    }

    return user;

  } catch (error: any) {

    // Gérer les erreurs spécifiques de Google Auth
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('La fenêtre de connexion a été fermée. Veuillez réessayer.');
    } else if (error.code === 'auth/popup-blocked') {
      throw new Error('La fenêtre de connexion a été bloquée. Veuillez autoriser les popups pour ce site.');
    } else if (error.code === 'auth/account-exists-with-different-credential') {
      // Get the email from the error for a more helpful message
      const email = error.customData?.email || '';
      throw new Error(
        `Un compte existe déjà avec l'email ${email} utilisant une autre méthode de connexion. ` +
        'Veuillez vous connecter avec votre mot de passe, puis liez votre compte Google dans les paramètres.'
      );
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Erreur réseau. Vérifiez votre connexion internet et réessayez.');
    }

    throw error;
  }
};

/**
 * Link an email/password credential to an existing Google account
 * This allows Google users to also sign in with email/password
 *
 * @param password - The new password to set
 * @returns Promise<void>
 */
export const linkEmailPasswordToAccount = async (password: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Aucun utilisateur connecté');
  }

  if (!user.email) {
    throw new Error('L\'utilisateur n\'a pas d\'email associé');
  }

  // Check if user already has password provider
  const hasPasswordProvider = user.providerData.some(
    (provider) => provider?.providerId === 'password'
  );

  if (hasPasswordProvider) {
    throw new Error('Un mot de passe est déjà associé à ce compte');
  }

  try {
    // Create email/password credential
    const credential = EmailAuthProvider.credential(user.email, password);

    // Link the credential to the current user
    await linkWithCredential(user, credential);
  } catch (error: any) {
    if (error.code === 'auth/provider-already-linked') {
      throw new Error('Ce compte a déjà un mot de passe associé');
    } else if (error.code === 'auth/invalid-credential') {
      throw new Error('Les identifiants fournis sont invalides');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Le mot de passe doit contenir au moins 6 caractères');
    } else if (error.code === 'auth/requires-recent-login') {
      throw new Error('Pour des raisons de sécurité, veuillez vous reconnecter avant d\'ajouter un mot de passe');
    }
    throw error;
  }
};

/**
 * Check what sign-in methods are available for an email
 *
 * @param email - The email to check
 * @returns Array of provider IDs (e.g., ['google.com', 'password'])
 */
export const getSignInMethodsForEmail = async (email: string): Promise<string[]> => {
  try {
    return await fetchSignInMethodsForEmail(auth, email);
  } catch (error) {
    return [];
  }
};

/**
 * Check if the current user has a specific provider linked
 *
 * @param providerId - The provider ID to check (e.g., 'password', 'google.com')
 * @returns boolean
 */
export const hasProviderLinked = (providerId: string): boolean => {
  const user = auth.currentUser;
  if (!user) return false;

  return user.providerData.some(
    (provider) => provider?.providerId === providerId
  );
};
