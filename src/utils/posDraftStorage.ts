/**
 * POS Draft Storage Service
 * Gère le stockage des brouillons POS dans localStorage
 * Les drafts sont stockés localement et ne sont pas synchronisés avec Firebase
 */

import type { CartItem } from '../hooks/usePOS';
import type { POSPaymentData } from '../components/pos/POSPaymentModal';

export interface POSDraft {
  id: string; // UUID généré
  cart: CartItem[]; // Produits dans le panier
  customer: {
    name: string;
    phone: string;
    quarter?: string;
    address?: string;
    town?: string;
    sourceId?: string;
  } | null;
  paymentData: Partial<POSPaymentData>; // Données de paiement partielles
  deliveryFee: number;
  subtotal: number;
  total: number;
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
  createdBy: {
    id: string;
    name: string;
  } | null;
}

const STORAGE_KEY_PREFIX = 'pos_drafts_';
const MAX_DRAFTS_PER_USER = 20;

/**
 * Génère la clé de stockage pour les drafts d'un utilisateur/company
 */
const getStorageKey = (userId: string, companyId: string): string => {
  return `${STORAGE_KEY_PREFIX}${userId}_${companyId}`;
};

/**
 * Génère un ID unique pour un draft
 */
const generateDraftId = (): string => {
  return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Sauvegarde un draft dans localStorage
 */
export const saveDraft = (
  userId: string,
  companyId: string,
  draft: Omit<POSDraft, 'id' | 'createdAt' | 'updatedAt'>
): POSDraft => {
  try {
    const storageKey = getStorageKey(userId, companyId);
    const existingDrafts = getDrafts(userId, companyId);
    
    // Créer le draft complet
    const now = Date.now();
    const newDraft: POSDraft = {
      ...draft,
      id: generateDraftId(),
      createdAt: now,
      updatedAt: now,
    };

    // Ajouter le nouveau draft
    const updatedDrafts = [newDraft, ...existingDrafts];

    // Limiter à MAX_DRAFTS_PER_USER (supprimer les plus anciens)
    const limitedDrafts = updatedDrafts.slice(0, MAX_DRAFTS_PER_USER);

    // Sauvegarder dans localStorage
    localStorage.setItem(storageKey, JSON.stringify(limitedDrafts));

    return newDraft;
  } catch (error) {
    console.error('Error saving draft to localStorage:', error);
    throw error;
  }
};

/**
 * Met à jour un draft existant
 */
export const updateDraft = (
  userId: string,
  companyId: string,
  draftId: string,
  updates: Partial<Omit<POSDraft, 'id' | 'createdAt' | 'createdBy'>>
): POSDraft | null => {
  try {
    const storageKey = getStorageKey(userId, companyId);
    const drafts = getDrafts(userId, companyId);
    
    const draftIndex = drafts.findIndex(d => d.id === draftId);
    if (draftIndex === -1) {
      return null;
    }

    // Mettre à jour le draft
    const updatedDraft: POSDraft = {
      ...drafts[draftIndex],
      ...updates,
      updatedAt: Date.now(),
    };

    drafts[draftIndex] = updatedDraft;

    // Sauvegarder
    localStorage.setItem(storageKey, JSON.stringify(drafts));

    return updatedDraft;
  } catch (error) {
    console.error('Error updating draft in localStorage:', error);
    throw error;
  }
};

/**
 * Récupère tous les drafts d'un utilisateur/company
 */
export const getDrafts = (userId: string, companyId: string): POSDraft[] => {
  try {
    const storageKey = getStorageKey(userId, companyId);
    const stored = localStorage.getItem(storageKey);
    
    if (!stored) {
      return [];
    }

    const drafts: POSDraft[] = JSON.parse(stored);
    
    // Trier par updatedAt (plus récent en premier)
    return drafts.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.error('Error getting drafts from localStorage:', error);
    return [];
  }
};

/**
 * Récupère un draft par ID
 */
export const getDraft = (
  userId: string,
  companyId: string,
  draftId: string
): POSDraft | null => {
  try {
    const drafts = getDrafts(userId, companyId);
    return drafts.find(d => d.id === draftId) || null;
  } catch (error) {
    console.error('Error getting draft from localStorage:', error);
    return null;
  }
};

/**
 * Supprime un draft
 */
export const deleteDraft = (
  userId: string,
  companyId: string,
  draftId: string
): boolean => {
  try {
    const storageKey = getStorageKey(userId, companyId);
    const drafts = getDrafts(userId, companyId);
    
    const filteredDrafts = drafts.filter(d => d.id !== draftId);
    
    if (filteredDrafts.length === drafts.length) {
      // Draft non trouvé
      return false;
    }

    // Sauvegarder les drafts restants
    localStorage.setItem(storageKey, JSON.stringify(filteredDrafts));
    
    return true;
  } catch (error) {
    console.error('Error deleting draft from localStorage:', error);
    return false;
  }
};

/**
 * Supprime tous les drafts d'un utilisateur/company
 */
export const clearAllDrafts = (userId: string, companyId: string): void => {
  try {
    const storageKey = getStorageKey(userId, companyId);
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.error('Error clearing drafts from localStorage:', error);
  }
};

/**
 * Vérifie si un draft existe
 */
export const hasDraft = (
  userId: string,
  companyId: string,
  draftId: string
): boolean => {
  const draft = getDraft(userId, companyId, draftId);
  return draft !== null;
};


