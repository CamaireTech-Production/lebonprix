import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { Company } from '../types/models';
import { createFirebaseUser } from './userAuth';
import CompanyManager from './storage/CompanyManager';

export interface CompanyData {
  name: string;
  description?: string;
  phone: string;
  location?: string;
  logo?: string;
  email: string;
}

/**
 * Sauvegarde une compagnie avec création automatique d'utilisateur Firebase Auth
 * Préserve la logique existante de création de compagnie
 * @param email - Email de l'utilisateur
 * @param password - Mot de passe de l'utilisateur
 * @param companyData - Données de la compagnie
 * @returns La compagnie créée
 */
export const saveCompany = async (
  email: string,
  password: string,
  companyData: CompanyData
): Promise<Company> => {
  try {
    // 1. Créer l'utilisateur Firebase Auth (utilise createFirebaseUser)
    const firebaseUid = await createFirebaseUser({
      email,
      password,
      displayName: companyData.name
    });

    // 2. Créer le document compagnie (logique existante préservée)
    const companyDoc = {
      ...companyData,
      userId: firebaseUid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    // 3. Sauvegarder en base de données
    await setDoc(doc(db, 'companies', firebaseUid), companyDoc);

    // 4. Créer l'objet compagnie complet
    const company: Company = { 
      id: firebaseUid, 
      ...companyDoc 
    };

    // 5. Sauvegarder dans le cache local (logique existante préservée)
    CompanyManager.save(firebaseUid, company);

    return company;
  } catch (error: any) {
    console.error('Erreur lors de la sauvegarde de la compagnie:', error);
    throw error;
  }
};
