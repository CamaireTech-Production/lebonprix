import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError } from '@utils/core/logger';
import type { CustomerSource } from '../../../types/models';

/**
 * Crée une nouvelle source clientelle
 */
export const createCustomerSource = async (
  data: Omit<CustomerSource, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'companyId'>,
  companyId: string,
  userId: string
): Promise<CustomerSource> => {
  try {
    const sourcesRef = collection(db, 'customerSources');
    const now = serverTimestamp();
    
    // Filter out undefined values (Firestore doesn't support undefined)
    const sourceData: any = {
      name: data.name,
      companyId,
      userId,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: now,
      updatedAt: now
    };
    
    // Only add optional fields if they have values
    if (data.description !== undefined && data.description !== null && data.description !== '') {
      sourceData.description = data.description;
    }
    if (data.color !== undefined && data.color !== null && data.color !== '') {
      sourceData.color = data.color;
    }
    
    const docRef = await addDoc(sourcesRef, sourceData);
    
    return {
      id: docRef.id,
      ...data,
      companyId,
      userId,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
      updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
    };
  } catch (error: any) {
    logError('Error creating customer source', error);
    throw error;
  }
};

/**
 * Met à jour une source clientelle
 */
export const updateCustomerSource = async (
  sourceId: string,
  data: Partial<Omit<CustomerSource, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'companyId'>>,
  companyId: string
): Promise<void> => {
  try {
    const sourceRef = doc(db, 'customerSources', sourceId);
    
    // Vérifier que la source appartient à l'entreprise
    const sourceDoc = await getDoc(sourceRef);
    if (!sourceDoc.exists()) {
      throw new Error('Source not found');
    }
    
    const sourceData = sourceDoc.data();
    if (sourceData.companyId !== companyId) {
      throw new Error('Unauthorized: Source does not belong to this company');
    }
    
    // Filter out undefined values (Firestore doesn't support undefined)
    const updateData: any = {
      updatedAt: serverTimestamp()
    };
    
    // Only include fields that are defined
    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.description !== undefined) {
      updateData.description = data.description || null; // Convert empty string to null
    }
    if (data.color !== undefined) {
      updateData.color = data.color || null; // Convert empty string to null
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }
    
    await updateDoc(sourceRef, updateData);
  } catch (error: any) {
    console.error('Error updating customer source:', error);
    throw error;
  }
};

/**
 * Supprime une source clientelle (soft delete en désactivant)
 */
export const deleteCustomerSource = async (
  sourceId: string,
  companyId: string
): Promise<void> => {
  try {
    // Soft delete: désactiver la source au lieu de la supprimer
    await updateCustomerSource(sourceId, { isActive: false }, companyId);
  } catch (error: any) {
    logError('Error deleting customer source', error);
    throw error;
  }
};

/**
 * Récupère toutes les sources clientelles d'une entreprise
 */
export const getCustomerSources = async (companyId: string): Promise<CustomerSource[]> => {
  try {
    const q = query(
      collection(db, 'customerSources'),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as CustomerSource[];
  } catch (error: any) {
    logError('Error getting customer sources', error);
    throw error;
  }
};

/**
 * Récupère une source clientelle par ID
 */
export const getCustomerSourceById = async (
  sourceId: string,
  companyId: string
): Promise<CustomerSource | null> => {
  try {
    const sourceRef = doc(db, 'customerSources', sourceId);
    const sourceDoc = await getDoc(sourceRef);
    
    if (!sourceDoc.exists()) {
      return null;
    }
    
    const sourceData = sourceDoc.data();
    if (sourceData.companyId !== companyId) {
      throw new Error('Unauthorized: Source does not belong to this company');
    }
    
    return {
      id: sourceDoc.id,
      ...sourceData
    } as CustomerSource;
  } catch (error: any) {
    console.error('Error getting customer source by ID:', error);
    throw error;
  }
};

/**
 * Écoute les changements des sources clientelles en temps réel
 */
export const subscribeToCustomerSources = (
  companyId: string,
  callback: (sources: CustomerSource[]) => void,
  limitCount?: number
): (() => void) => {
  if (!companyId) {
    callback([]);
    return () => {}; // Return empty cleanup function
  }

  try {
    const defaultLimit = 50; // OPTIMIZATION: Default limit to reduce Firebase reads
    const q = query(
      collection(db, 'customerSources'),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc'),
      limit(limitCount || defaultLimit)
    );
    
    let isActive = true;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!isActive) return; // Prevent callback after cleanup
        try {
          const sources = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as CustomerSource[];
          callback(sources);
        } catch (error) {
          logError('Error processing customer sources snapshot', error);
          if (isActive) callback([]);
        }
      },
      (error) => {
        if (!isActive) return; // Prevent callback after cleanup
        logError('Error in customer sources subscription', error);
        callback([]);
      }
    );

    // Return cleanup function that marks as inactive
    return () => {
      isActive = false;
      try {
        unsubscribe();
      } catch (error) {
        // Ignore cleanup errors
      }
    };
  } catch (error) {
    logError('Error setting up customer sources subscription', error);
    callback([]);
    return () => {}; // Return empty cleanup function
  }
};

