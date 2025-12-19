/**
 * Service pour charger et rechercher dans les données géographiques du Cameroun
 */

import type { CameroonLocation, CameroonLocationsData, LocationSearchResult } from '../../types/cameroon-locations';
import LocalStorageService from './localStorageService';

// Mapping des codes de régions du Cameroun
const REGION_NAMES: Record<string, string> = {
  '00': 'Non spécifié',
  '01': 'Adamaoua',
  '02': 'Centre',
  '03': 'Est',
  '04': 'Extrême-Nord',
  '05': 'Littoral',
  '06': 'Nord',
  '07': 'Nord-Ouest',
  '08': 'Ouest',
  '09': 'Sud',
  '10': 'Sud-Ouest',
  '11': 'Est', // Code alternatif
  '12': 'Nord', // Code alternatif
  '13': 'Nord-Ouest', // Code alternatif
  '14': 'Centre', // Code alternatif
};

// Codes de caractéristiques pour les lieux habités (quartiers, villes, villages)
const POPULATED_PLACE_CODES = ['PPL', 'PPLX', 'PPLQ', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLC'];

// Clés pour le cache localStorage
const CACHE_KEY = 'cameroon_locations_filtered';
const INDEX_CACHE_KEY = 'cameroon_locations_index';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 jours

interface LocationIndex {
  [firstLetter: string]: CameroonLocation[];
}

class LocationService {
  private static cachedLocations: CameroonLocation[] | null = null;
  private static index: LocationIndex | null = null;
  private static loadingPromise: Promise<CameroonLocation[]> | null = null;

  /**
   * Charge les données géographiques depuis le fichier JSON
   * Utilise le cache localStorage si disponible
   */
  static async loadLocations(): Promise<CameroonLocation[]> {
    // Si déjà en cache en mémoire, retourner immédiatement
    if (this.cachedLocations) {
      return this.cachedLocations;
    }

    // Si un chargement est déjà en cours, attendre sa fin
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    // Créer la promesse de chargement
    this.loadingPromise = this._loadLocationsInternal();
    
    try {
      const locations = await this.loadingPromise;
      return locations;
    } finally {
      this.loadingPromise = null;
    }
  }

  /**
   * Chargement interne avec cache
   */
  private static async _loadLocationsInternal(): Promise<CameroonLocation[]> {
    // 1. Vérifier le cache localStorage
    const cached = LocalStorageService.get<CameroonLocation[]>(CACHE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      console.log(`✅ Locations chargées depuis le cache (${cached.length} lieux)`);
      this.cachedLocations = cached;
      return cached;
    }

    // 2. Charger depuis le fichier JSON
    try {
      console.log('📡 Chargement des données géographiques depuis CM.json...');
      const importedData = await import('../../data/cameroon-locations.json');
      const data: CameroonLocationsData = ((importedData as unknown as { default: CameroonLocationsData }).default || importedData) as unknown as CameroonLocationsData;
      
      // 3. Filtrer uniquement les lieux habités
      const filteredLocations = data.locations.filter((location: CameroonLocation) => {
        const featureCode = location.feature?.code;
        return featureCode && POPULATED_PLACE_CODES.includes(featureCode);
      });

      console.log(`✅ ${filteredLocations.length} lieux habités filtrés sur ${data.locations.length} total`);

      // 4. Mettre en cache
      this.cachedLocations = filteredLocations;
      
      // 5. Sauvegarder dans localStorage (avec gestion de la taille)
      try {
        LocalStorageService.set(CACHE_KEY, filteredLocations, CACHE_TTL);
        console.log('✅ Données mises en cache dans localStorage');
      } catch (error) {
        console.warn('⚠️ Impossible de mettre en cache dans localStorage (trop volumineux)', error);
      }

      return filteredLocations;
    } catch (error) {
      console.error('❌ Erreur lors du chargement des données géographiques:', error);
      throw error;
    }
  }

  /**
   * Crée un index par première lettre pour recherche rapide
   */
  private static buildIndex(locations: CameroonLocation[]): LocationIndex {
    // Vérifier le cache de l'index
    const cachedIndex = LocalStorageService.get<LocationIndex>(INDEX_CACHE_KEY);
    if (cachedIndex) {
      this.index = cachedIndex;
      return cachedIndex;
    }

    const index: LocationIndex = {};

    for (const location of locations) {
      const primaryName = location.names.primary;
      if (!primaryName) continue;

      const firstLetter = primaryName.charAt(0).toUpperCase();
      
      if (!index[firstLetter]) {
        index[firstLetter] = [];
      }
      
      index[firstLetter].push(location);
    }

    // Trier chaque groupe alphabétiquement
    for (const letter in index) {
      index[letter].sort((a, b) => 
        a.names.primary.localeCompare(b.names.primary, 'fr', { sensitivity: 'base' })
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

    const locations = this.cachedLocations;
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

      const allNames = location.names.all || [];
      let bestMatch: { type: 'exact' | 'partial' | 'alternative'; field: 'primary' | 'alternate' | 'alternatives' } | null = null;

      for (const name of allNames) {
        const lowerName = name.toLowerCase();

        // Correspondance exacte
        if (lowerName === lowerQuery) {
          let field: 'primary' | 'alternate' | 'alternatives' = 'primary';
          if (name === location.names.primary) {
            field = 'primary';
          } else if (name === location.names.alternate) {
            field = 'alternate';
          } else {
            field = 'alternatives';
          }

          bestMatch = { type: 'exact', field };
          break;
        }

        // Correspondance partielle (commence par)
        if (lowerName.startsWith(lowerQuery)) {
          if (!bestMatch || bestMatch.type !== 'exact') {
            let field: 'primary' | 'alternate' | 'alternatives' = 'primary';
            if (name === location.names.primary) {
              field = 'primary';
            } else if (name === location.names.alternate) {
              field = 'alternate';
            } else {
              field = 'alternatives';
            }

            bestMatch = { type: 'partial', field };
          }
        }

        // Correspondance partielle (contient)
        if (!bestMatch && lowerName.includes(lowerQuery)) {
          let field: 'primary' | 'alternate' | 'alternatives' = 'primary';
          if (name === location.names.primary) {
            field = 'primary';
          } else if (name === location.names.alternate) {
            field = 'alternate';
          } else {
            field = 'alternatives';
          }

          bestMatch = { type: 'alternative', field };
        }
      }

      if (bestMatch) {
        results.push({
          location,
          matchType: bestMatch.type,
          matchField: bestMatch.field,
        });
        seenIds.add(location.id);
      }
    }

    // Si pas assez de résultats dans le groupe de la première lettre, chercher dans tous
    if (results.length < limit) {
      for (const location of locations) {
        if (seenIds.has(location.id)) continue;
        if (results.length >= limit * 2) break; // Limiter la recherche exhaustive

        const allNames = location.names.all || [];
        for (const name of allNames) {
          const lowerName = name.toLowerCase();
          
          if (lowerName.includes(lowerQuery)) {
            let field: 'primary' | 'alternate' | 'alternatives' = 'primary';
            if (name === location.names.primary) {
              field = 'primary';
            } else if (name === location.names.alternate) {
              field = 'alternate';
            } else {
              field = 'alternatives';
            }

            results.push({
              location,
              matchType: 'alternative',
              matchField: field,
            });
            seenIds.add(location.id);
            break;
          }
        }
      }
    }

    // Trier les résultats : exact d'abord, puis partiel, puis alternative
    // Puis tri alphabétique par nom principal
    results.sort((a, b) => {
      // Priorité par type de correspondance
      const priority: Record<string, number> = { exact: 0, partial: 1, alternative: 2 };
      const priorityDiff = (priority[a.matchType] || 0) - (priority[b.matchType] || 0);
      if (priorityDiff !== 0) return priorityDiff;

      // Puis tri alphabétique
      return a.location.names.primary.localeCompare(
        b.location.names.primary,
        'fr',
        { sensitivity: 'base' }
      );
    });

    // Limiter les résultats
    return results.slice(0, limit);
  }

  /**
   * Obtient un lieu par sa valeur (nom principal)
   */
  static getLocationByValue(value: string): CameroonLocation | null {
    if (!value || !this.cachedLocations) {
      return null;
    }

    const location = this.cachedLocations.find(
      loc => loc.names.primary === value || loc.names.all?.includes(value)
    );

    return location || null;
  }

  /**
   * Obtient le nom de la région à partir du code
   */
  static getRegionName(regionCode: string | undefined): string {
    if (!regionCode) return '';
    return REGION_NAMES[regionCode] || `Région ${regionCode}`;
  }

  /**
   * Obtient le nom du département à partir du code
   * Note: level_2 n'existe pas dans les données actuelles, mais on prépare pour le futur
   */
  static getDepartmentName(location: CameroonLocation): string {
    const deptCode = location.administrative?.level_2;
    if (!deptCode) return '';
    // Pour l'instant, on retourne le code si disponible
    // À améliorer quand les données seront disponibles
    return `Département ${deptCode}`;
  }

  /**
   * Réinitialise le cache (utile pour les tests ou le rechargement)
   */
  static clearCache(): void {
    this.cachedLocations = null;
    this.index = null;
    this.loadingPromise = null;
    LocalStorageService.remove(CACHE_KEY);
    LocalStorageService.remove(INDEX_CACHE_KEY);
  }
}

export default LocationService;

