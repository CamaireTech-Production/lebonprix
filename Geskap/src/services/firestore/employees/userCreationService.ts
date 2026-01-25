import { createFirebaseUser } from '../../auth/userAuth';
import { createUser } from '../../utilities/userService';
import { addUserToCompany } from '../companies/userCompanySyncService';
import { getTemplateById } from './permissionTemplateService';
import { getCompanyById } from '../companies/companyPublic';
import { getEffectiveBaseRole } from '@utils/business/permissionUtils';
import { getUserByEmail } from './invitationService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError } from '@utils/core/logger';
import { showErrorToast } from '@utils/core/toast';

/**
 * Check if username is already taken
 * @param username - Username to check
 * @returns true if username is available, false otherwise
 */
const isUsernameAvailable = async (username: string): Promise<boolean> => {
  try {
    if (!username || !username.trim()) {
      return false;
    }

    // Normalize username (lowercase for case-insensitive search)
    const normalizedUsername = username.trim().toLowerCase();

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', normalizedUsername));
    const querySnapshot = await getDocs(q);

    return querySnapshot.empty;
  } catch (error) {
    logError('Error checking username availability', error);
    return false;
  }
};

/**
 * Check if email is already used
 * @param email - Email to check
 * @returns true if email is available, false otherwise
 */
const isEmailAvailable = async (email: string): Promise<boolean> => {
  try {
    const result = await getUserByEmail(email);
    return result.type === 'not_found';
  } catch (error) {
    logError('Error checking email availability', error);
    return false;
  }
};

export interface CreateUserDirectlyParams {
  username: string;
  email: string;
  password: string;
  companyId: string;
  companyName: string;
  permissionTemplateId: string;
  creatorId: string;
  creatorName: string;
}

export interface CreateUserDirectlyResult {
  userId: string;
  username: string;
  email: string;
  password: string;
  success: boolean;
}

/**
 * Create a user account directly (by owner)
 * This function:
 * 1. Validates username and email availability
 * 2. Creates Firebase Auth account
 * 3. Creates Firestore user document
 * 4. Adds user to company with permission template
 * 
 * @param params - User creation parameters
 * @returns Created user credentials
 */
export const createUserDirectly = async (
  params: CreateUserDirectlyParams
): Promise<CreateUserDirectlyResult> => {
  try {
    const {
      username,
      email,
      password,
      companyId,
      companyName,
      permissionTemplateId,
      creatorId,
      creatorName
    } = params;

    // Validate inputs
    if (!username || !username.trim()) {
      throw new Error('Le nom d\'utilisateur est requis');
    }

    if (!email || !email.trim()) {
      throw new Error('L\'email est requis');
    }

    if (!password || password.length < 6) {
      throw new Error('Le mot de passe doit contenir au moins 6 caractères');
    }

    if (!permissionTemplateId) {
      throw new Error('Le modèle de permissions est requis');
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new Error('Format d\'email invalide');
    }

    console.log('🔍 Vérification de la disponibilité de l\'email et du username...');

    // Check if email is already used
    const emailAvailable = await isEmailAvailable(normalizedEmail);
    if (!emailAvailable) {
      throw new Error('Cet email est déjà utilisé par un autre utilisateur');
    }

    // Check if username is already taken
    const usernameAvailable = await isUsernameAvailable(normalizedUsername);
    if (!usernameAvailable) {
      throw new Error('Ce nom d\'utilisateur est déjà pris');
    }

    console.log('✅ Email et username disponibles');

    // Get permission template to determine base role
    const template = await getTemplateById(companyId, permissionTemplateId);
    if (!template) {
      throw new Error('Modèle de permissions introuvable');
    }

    const baseRole = getEffectiveBaseRole(template);
    console.log('🎯 Rôle détecté:', baseRole);

    // Create Firebase Auth account
    console.log('🔐 Création du compte Firebase Auth...');
    const userId = await createFirebaseUser({
      email: normalizedEmail,
      password: password,
      displayName: username.trim() // Use original username (not normalized) for display
    });

    console.log('✅ Compte Firebase Auth créé:', userId);

    // Create Firestore user document
    console.log('📝 Création du document Firestore...');
    await createUser(
      userId,
      {
        username: normalizedUsername, // Store normalized for uniqueness
        email: normalizedEmail
      }
    );

    console.log('✅ Document Firestore créé');

    // Get company data (we need it for addUserToCompany)
    let companyData = {
      name: companyName,
      description: '',
      logo: ''
    };
    
    try {
      const company = await getCompanyById(companyId);
      if (company) {
        companyData = {
          name: company.name || companyName,
          description: company.description || '',
          logo: company.logo || ''
        };
      }
    } catch (error) {
      console.warn('Could not fetch company details, using provided data:', error);
      // Continue with provided companyName
    }

    // Add user to company with permission template
    console.log('👥 Ajout de l\'utilisateur à la company...');
    await addUserToCompany(
      userId,
      companyId,
      companyData,
      {
        username: normalizedUsername,
        email: normalizedEmail
      },
      baseRole,
      permissionTemplateId
    );

    console.log('✅ Utilisateur ajouté à la company avec succès');

    return {
      userId,
      username: username.trim(), // Return original username for display
      email: normalizedEmail,
      password, // Return password so owner can share it
      success: true
    };
  } catch (error: any) {
    logError('Error creating user directly', error);
    
    // If Firebase Auth user was created but Firestore creation failed,
    // we should ideally clean up the Auth user, but that requires admin SDK
    // For now, we'll just throw the error and let the owner handle it
    
    const errorMessage = error.message || 'Erreur lors de la création de l\'utilisateur';
    showErrorToast(errorMessage);
    throw error;
  }
};

