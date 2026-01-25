/**
 * Service pour charger et rechercher dans les données géographiques du Cameroun
 * Simplified structure - only id and name
 */

import type { SimplifiedLocation, CameroonLocationsData, LocationSearchResult } from '../../types/cameroon-locations';
import LocalStorageService from './localStorageService';

// Clés pour le cache localStorage
const CACHE_KEY = 'cameroon_locations_filtered';
const CUSTOM_LOCATIONS_KEY = 'cameroon_locations_custom';
const INDEX_CACHE_KEY = 'cameroon_locations_index';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 jours

interface LocationIndex {
  [firstLetter: string]: SimplifiedLocation[];
}

class LocationService {
  private static cachedLocations: SimplifiedLocation[] | null = null;
  private static customLocations: SimplifiedLocation[] = [];
  private static index: LocationIndex | null = null;
  private static loadingPromise: Promise<SimplifiedLocation[]> | null = null;

  /**
   * Charge les données géographiques depuis le fichier TypeScript
   * Utilise le cache localStorage si disponible
   * Merges with custom locations from localStorage
   */
  static async loadLocations(): Promise<SimplifiedLocation[]> {
    // Si déjà en cache en mémoire, retourner immédiatement
    if (this.cachedLocations) {
      return this.getAllLocations();
    }

    // Si un chargement est déjà en cours, attendre sa fin
    if (this.loadingPromise) {
      return this.loadingPromise.then(() => this.getAllLocations());
    }

    // Créer la promesse de chargement
    this.loadingPromise = this._loadLocationsInternal();
    
    try {
      await this.loadingPromise;
      return this.getAllLocations();
    } finally {
      this.loadingPromise = null;
    }
  }

  /**
   * Get all locations (cached + custom)
   */
  private static getAllLocations(): SimplifiedLocation[] {
    const base = this.cachedLocations || [];
    const custom = this.customLocations || [];
    // Merge and deduplicate by name (case-insensitive)
    const all = [...base];
    const existingNames = new Set(base.map(loc => loc.name.toLowerCase()));
    
    for (const customLoc of custom) {
      if (!existingNames.has(customLoc.name.toLowerCase())) {
        all.push(customLoc);
        existingNames.add(customLoc.name.toLowerCase());
      }
    }
    
    return all;
  }

  /**
   * Chargement interne avec cache
   */
  private static async _loadLocationsInternal(): Promise<void> {
    // 1. Load custom locations from localStorage
    const cachedCustom = LocalStorageService.get<SimplifiedLocation[]>(CUSTOM_LOCATIONS_KEY);
    if (cachedCustom && Array.isArray(cachedCustom)) {
      this.customLocations = cachedCustom;
      console.log(`✅ ${cachedCustom.length} custom locations chargées`);
    }

    // 2. Vérifier le cache localStorage pour les locations principales
    const cached = LocalStorageService.get<SimplifiedLocation[]>(CACHE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      console.log(`✅ Locations chargées depuis le cache (${cached.length} lieux)`);
      this.cachedLocations = cached;
      return;
    }

    // 3. Charger depuis le fichier TypeScript
    try {
      console.log('📡 Chargement des données géographiques depuis cameroon-locations.ts...');
      const importedData = await import('../../data/cameroon-locations');
      const data = (importedData as any).cameroonLocationsData || (importedData as any).default;
      
      if (!data || !data.locations) {
        throw new Error('Invalid data structure');
      }

      console.log(`✅ ${data.locations.length} lieux chargés`);

      // 4. Mettre en cache
      this.cachedLocations = data.locations;
      
      // 5. Sauvegarder dans localStorage (avec gestion de la taille)
      try {
        LocalStorageService.set(CACHE_KEY, data.locations, CACHE_TTL);
        console.log('✅ Données mises en cache dans localStorage');
      } catch (error) {
        console.warn('⚠️ Impossible de mettre en cache dans localStorage (trop volumineux)', error);
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des données géographiques:', error);
      throw error;
    }
  }

  /**
   * Crée un index par première lettre pour recherche rapide
   */
  private static buildIndex(locations: SimplifiedLocation[]): LocationIndex {
    // Vérifier le cache de l'index
    const cachedIndex = LocalStorageService.get<LocationIndex>(INDEX_CACHE_KEY);
    if (cachedIndex) {
      this.index = cachedIndex;
      return cachedIndex;
    }

    const index: LocationIndex = {};

    for (const location of locations) {
      const name = location.name;
      if (!name) continue;

      const firstLetter = name.charAt(0).toUpperCase();
      
      if (!index[firstLetter]) {
        index[firstLetter] = [];
      }
      
      index[firstLetter].push(location);
    }

    // Trier chaque groupe alphabétiquement
    for (const letter in index) {
      index[letter].sort((a, b) => 
        a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
      );
    }

    this.index = index;
    
    // Mettre en cache l'index
    try {
      LocalStorageService.set(INDEX_CACHE_KEY, index, CACHE_TTL);
    } catch (error) {
      console.warn('⚠️ Impossible de mettre en cache l\'index', error);
    }

    return index;
  }

  /**
   * Recherche des lieux par nom
   * Retourne les résultats triés alphabétiquement
   */
  static searchLocations(query: string, limit: number = 15): LocationSearchResult[] {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const locations = this.getAllLocations();
    if (!locations || locations.length === 0) {
      return [];
    }

    const lowerQuery = query.toLowerCase().trim();
    const results: LocationSearchResult[] = [];
    const seenIds = new Set<string>();

    // Utiliser l'index si disponible pour optimiser
    const index = this.index || this.buildIndex(locations);
    const firstLetter = query.charAt(0).toUpperCase();
    
    // Rechercher dans le groupe de la première lettre d'abord
    const candidates = index[firstLetter] || locations;

    for (const location of candidates) {
      if (seenIds.has(location.id)) continue;

      const lowerName = location.name.toLowerCase();
      let matchType: 'exact' | 'partial' | null = null;

      // Correspondance exacte
      if (lowerName === lowerQuery) {
        matchType = 'exact';
      }
      // Correspondance partielle (commence par)
      else if (lowerName.startsWith(lowerQuery)) {
        matchType = 'partial';
      }
      // Correspondance partielle (contient)
      else if (lowerName.includes(lowerQuery)) {
        matchType = 'partial';
      }

      if (matchType) {
        results.push({
          location,
          matchType,
        });
        seenIds.add(location.id);
      }
    }

    // Si pas assez de résultats dans le groupe de la première lettre, chercher dans tous
    if (results.length < limit) {
      for (const location of locations) {
        if (seenIds.has(location.id)) continue;
        if (results.length >= limit * 2) break; // Limiter la recherche exhaustive

        const lowerName = location.name.toLowerCase();
        if (lowerName.includes(lowerQuery)) {
          const matchType: 'exact' | 'partial' = lowerName === lowerQuery ? 'exact' : 'partial';
          results.push({
            location,
            matchType,
          });
          seenIds.add(location.id);
        }
      }
    }

    // Trier les résultats : exact d'abord, puis partiel
    // Puis tri alphabétique par nom
    results.sort((a, b) => {
      // Priorité par type de correspondance
      if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
      if (a.matchType !== 'exact' && b.matchType === 'exact') return 1;

      // Puis tri alphabétique
      return a.location.name.localeCompare(
        b.location.name,
        'fr',
        { sensitivity: 'base' }
      );
    });

    // Limiter les résultats
    return results.slice(0, limit);
  }

  /**
   * Obtient un lieu par sa valeur (nom)
   */
  static getLocationByValue(value: string): SimplifiedLocation | null {
    if (!value) {
      return null;
    }

    const locations = this.getAllLocations();
    const location = locations.find(
      loc => loc.name === value || loc.name.toLowerCase() === value.toLowerCase()
    );

    return location || null;
  }

  /**
   * Add a custom location (user-created quarter)
   */
  static addCustomLocation(name: string): SimplifiedLocation {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Location name cannot be empty');
    }

    // Check if it already exists (case-insensitive)
    const existing = this.getAllLocations().find(
      loc => loc.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existing) {
      return existing;
    }

    // Create new custom location
    const newLocation: SimplifiedLocation = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: trimmedName,
    };

    // Add to custom locations
    this.customLocations.push(newLocation);

    // Save to localStorage
    try {
      LocalStorageService.set(CUSTOM_LOCATIONS_KEY, this.customLocations, CACHE_TTL);
      console.log(`✅ Custom location added: ${trimmedName}`);
    } catch (error) {
      console.warn('⚠️ Impossible de sauvegarder la location personnalisée', error);
    }

    // Rebuild index
    this.index = null;
    this.buildIndex(this.getAllLocations());

    return newLocation;
  }

  /**
   * Get all custom locations
   */
  static getCustomLocations(): SimplifiedLocation[] {
    return [...this.customLocations];
  }

  /**
   * Réinitialise le cache (utile pour les tests ou le rechargement)
   */
  static clearCache(): void {
    this.cachedLocations = null;
    this.customLocations = [];
    this.index = null;
    this.loadingPromise = null;
    LocalStorageService.remove(CACHE_KEY);
    LocalStorageService.remove(CUSTOM_LOCATIONS_KEY);
    LocalStorageService.remove(INDEX_CACHE_KEY);
  }
}

export default LocationService;

