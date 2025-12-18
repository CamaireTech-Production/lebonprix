import { doc, setDoc, getDoc, getDocFromCache, updateDoc, arrayUnion, arrayRemove, Timestamp, DocumentReference } from 'firebase/firestore';
import { db } from './firebase';
import { User, UserCompanyRef } from '../types/models';
import { normalizePhoneNumber } from '../utils/phoneUtils';

const isOfflineFirestoreError = (error: any) => {
  if (!error) return false;
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return error.code === 'unavailable' || message.includes('offline');
};

const getDocWithCache = async <T = unknown>(ref: DocumentReference<T>) => {
  try {
    return await getDoc(ref);
  } catch (error: any) {
    if (isOfflineFirestoreError(error)) {
      try {
        return await getDocFromCache(ref);
      } catch (cacheError) {
        console.warn('Firestore cache miss for', ref.path, cacheError);
      }
    }
    throw error;
  }
};

export interface UserData {
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  photoURL?: string;
}

/**
 * Crée un utilisateur dans la collection /users/{uid}
 * @param userId - ID Firebase Auth de l'utilisateur
 * @param userData - Données de base de l'utilisateur
 * @param companyId - ID de l'entreprise (optionnel)
 * @param role - Rôle dans l'entreprise (optionnel)
 * @returns L'utilisateur créé
 */
export const createUser = async (
  userId: string,
  userData: UserData,
  companyId?: string,
  role?: 'owner' | 'admin' | 'manager' | 'staff'
): Promise<User> => {
  try {
    console.log('📄 Création du document utilisateur dans Firestore...');
    console.log('🆔 User ID:', userId);
    console.log('📝 User Data:', userData);
    
    const now = Timestamp.now();
    
    // Créer l'objet utilisateur en filtrant les valeurs undefined
    const newUser: User = {
      id: userId,
      firstname: userData.firstname,
      lastname: userData.lastname,
      email: userData.email,
      createdAt: now,
      updatedAt: now,
      companies: [],
      status: 'active',
      // Ajouter seulement les champs non-undefined
      // Normalize phone number before saving
      ...(userData.phone && { phone: normalizePhoneNumber(userData.phone) }),
      ...(userData.photoURL && { photoURL: userData.photoURL })
    };

    console.log('👤 Objet utilisateur créé:', newUser);

    // Si une entreprise est fournie, l'ajouter à la liste
    if (companyId && role) {
      const companyRef: UserCompanyRef = {
        companyId,
        name: '', // Sera rempli lors de la récupération de l'entreprise
        role,
        joinedAt: now
      };
      newUser.companies.push(companyRef);
      console.log('🏢 Référence entreprise ajoutée:', companyRef);
    }

    console.log('💾 Sauvegarde dans Firestore...');
    await setDoc(doc(db, 'users', userId), newUser);
    console.log('✅ Document utilisateur sauvegardé avec succès');
    
    return newUser;
  } catch (error: any) {
    console.error('❌ Erreur lors de la création de l\'utilisateur:', error);
    console.error('❌ Détails de l\'erreur:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Récupère un utilisateur par son ID
 * @param userId - ID de l'utilisateur
 * @returns L'utilisateur ou null s'il n'existe pas
 */
export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const userDoc = await getDocWithCache(doc(db, 'users', userId));
    
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() } as User;
    }
    
    return null;
  } catch (error: any) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    throw error;
  }
};

/**
 * Met à jour un utilisateur
 * @param userId - ID de l'utilisateur
 * @param updates - Données à mettre à jour
 */
export const updateUser = async (
  userId: string,
  updates: Partial<Omit<User, 'id' | 'createdAt'>>
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  } catch (error: any) {
    console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
    throw error;
  }
};

/**
 * Ajoute une référence d'entreprise à un utilisateur
 * @param userId - ID de l'utilisateur
 * @param companyRef - Référence de l'entreprise
 */
export const addCompanyToUser = async (
  userId: string,
  companyRef: UserCompanyRef
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      companies: arrayUnion(companyRef),
      updatedAt: Timestamp.now()
    });
  } catch (error: any) {
    console.error('Erreur lors de l\'ajout de l\'entreprise à l\'utilisateur:', error);
    throw error;
  }
};

/**
 * Retire une référence d'entreprise d'un utilisateur
 * @param userId - ID de l'utilisateur
 * @param companyId - ID de l'entreprise à retirer
 */
export const removeCompanyFromUser = async (
  userId: string,
  companyId: string
): Promise<void> => {
  try {
    // Récupérer l'utilisateur pour trouver la référence exacte
    const user = await getUserById(userId);
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    const companyRef = user.companies.find(c => c.companyId === companyId);
    if (!companyRef) {
      throw new Error('Référence d\'entreprise non trouvée');
    }

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      companies: arrayRemove(companyRef),
      updatedAt: Timestamp.now()
    });
  } catch (error: any) {
    console.error('Erreur lors de la suppression de l\'entreprise de l\'utilisateur:', error);
    throw error;
  }
};

/**
 * Liste les entreprises d'un utilisateur
 * @param userId - ID de l'utilisateur
 * @returns Liste des entreprises de l'utilisateur
 */
export const getUserCompanies = async (userId: string): Promise<UserCompanyRef[]> => {
  try {
    const user = await getUserById(userId);
    return user?.companies || [];
  } catch (error: any) {
    console.error('Erreur lors de la récupération des entreprises de l\'utilisateur:', error);
    throw error;
  }
};

/**
 * Met à jour le statut de connexion d'un utilisateur
 * @param userId - ID de l'utilisateur
 */
export const updateUserLastLogin = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      lastLogin: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  } catch (error: any) {
    console.error('Erreur lors de la mise à jour de la dernière connexion:', error);
    throw error;
  }
};

/**
 * Met à jour le statut d'un utilisateur
 * @param userId - ID de l'utilisateur
 * @param status - Nouveau statut
 */
export const updateUserStatus = async (
  userId: string,
  status: 'active' | 'suspended' | 'invited'
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      status,
      updatedAt: Timestamp.now()
    });
  } catch (error: any) {
    console.error('Erreur lors de la mise à jour du statut de l\'utilisateur:', error);
    throw error;
  }
};

/**
 * Vérifie si un utilisateur existe
 * @param userId - ID de l'utilisateur
 * @returns true si l'utilisateur existe
 */
export const userExists = async (userId: string): Promise<boolean> => {
  try {
    const user = await getUserById(userId);
    return user !== null;
  } catch (error: any) {
    console.error('Erreur lors de la vérification de l\'existence de l\'utilisateur:', error);
    return false;
  }
};
