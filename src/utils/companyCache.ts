import type { Company } from '../types/models';

const CACHE_KEY = 'cachedCompany';
const CACHE_EXPIRY_KEY = 'cachedCompanyExpiry';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 heures en millisecondes

/**
 * Sauvegarde les informations de la compagnie dans le cache
 * @param company - Données de la compagnie à sauvegarder
 */
export const saveCompanyToCache = (company: Company): void => {
  try {
    const cacheData = {
      company,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    localStorage.setItem(CACHE_EXPIRY_KEY, Date.now().toString());
    console.log('💾 Company saved to cache:', company.name);
  } catch (error) {
    console.error('❌ Error saving company to cache:', error);
  }
};

/**
 * Récupère les informations de la compagnie depuis le cache
 * @returns Les données de la compagnie ou null si pas de cache valide
 */
export const getCompanyFromCache = (): Company | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);
    
    if (!cached || !expiry) {
      return null;
    }
    
    // Vérifier si le cache a expiré
    const now = Date.now();
    const cacheTime = parseInt(expiry);
    if (now - cacheTime > CACHE_DURATION) {
      console.log('⏰ Company cache expired, clearing...');
      clearCompanyCache();
      return null;
    }
    
    const cacheData = JSON.parse(cached);
    console.log('🔄 Company restored from cache:', cacheData.company.name);
    return cacheData.company;
  } catch (error) {
    console.error('❌ Error parsing company cache:', error);
    clearCompanyCache();
    return null;
  }
};

/**
 * Nettoie le cache de la compagnie
 */
export const clearCompanyCache = (): void => {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_EXPIRY_KEY);
    console.log('🗑️ Company cache cleared');
  } catch (error) {
    console.error('❌ Error clearing company cache:', error);
  }
};

/**
 * Vérifie si le cache de la compagnie est valide
 * @returns true si le cache existe et n'a pas expiré
 */
export const isCompanyCacheValid = (): boolean => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);
    
    if (!cached || !expiry) {
      return false;
    }
    
    const now = Date.now();
    const cacheTime = parseInt(expiry);
    return (now - cacheTime) <= CACHE_DURATION;
  } catch (error) {
    console.error('❌ Error checking cache validity:', error);
    return false;
  }
};

