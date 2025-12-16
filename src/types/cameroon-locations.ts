/**
 * Types pour les données géographiques du Cameroun
 * Source: CM.json
 * 
 * Structure JSON:
 * {
 *   "metadata": { ... },
 *   "locations": [ ... ]
 * }
 */

/**
 * Structure complète du fichier JSON
 */
export interface CameroonLocationsData {
  metadata: LocationsMetadata;
  locations: CameroonLocation[];
}

/**
 * Métadonnées du fichier
 */
export interface LocationsMetadata {
  source: string;
  country: string;
  country_code: string;
  total_locations: number;
  generated_at: string;
}

/**
 * Structure d'un lieu géographique
 */
export interface CameroonLocation {
  id: string;
  names: LocationNames;
  coordinates: LocationCoordinates;
  feature: LocationFeature;
  country: LocationCountry;
  administrative?: AdministrativeCodes;
  elevation?: {
    meters: number;
  };
  population?: number;
  timezone?: string;
  metadata?: {
    modification_date?: string;
  };
}

/**
 * Noms d'un lieu
 */
export interface LocationNames {
  primary: string;
  alternate?: string | null;
  alternatives: string[];
  all: string[];
}

/**
 * Coordonnées géographiques
 */
export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Caractéristique géographique
 */
export interface LocationFeature {
  type: 'P' | 'H' | 'T' | 'S' | 'L' | null;
  code: string | null;
  type_label: string | null;
  code_label: string | null;
}

/**
 * Informations sur le pays
 */
export interface LocationCountry {
  code: string | null;
}

/**
 * Codes administratifs par niveau
 */
export interface AdministrativeCodes {
  level_1?: string;
  level_2?: string;
  level_3?: string;
  level_4?: string;
}

/**
 * Résultat de recherche
 */
export interface LocationSearchResult {
  location: CameroonLocation;
  matchType: 'exact' | 'partial' | 'alternative';
  matchField: 'primary' | 'alternate' | 'alternatives';
}

/**
 * Codes de caractéristiques géographiques
 */
export const FeatureCodes = {
  PPL: 'Populated Place', // Lieu habité
  PPLA: 'Seat of a first-order administrative division',
  PPLA2: 'Seat of a second-order administrative division',
  PPLA3: 'Seat of a third-order administrative division',
  PPLA4: 'Seat of a fourth-order administrative division',
  PPLC: 'Capital of a political entity',
  STM: 'Stream', // Cours d'eau
  STMI: 'Intermittent Stream', // Cours d'eau intermittent
  HLL: 'Hill', // Colline
  MT: 'Mountain', // Montagne
  LK: 'Lake', // Lac
  RESV: 'Reservoir', // Réservoir
  ISL: 'Island', // Île
} as const;

/**
 * Types de caractéristiques
 */
export const FeatureTypes = {
  P: 'Populated place', // Lieu habité
  H: 'Hydrographic', // Hydrographie
  T: 'Topographic', // Topographie
  S: 'Spot', // Point
  L: 'Area', // Zone
} as const;

/**
 * Utilitaires pour travailler avec les données géographiques
 */
export class CameroonLocationUtils {
  /**
   * Obtient les coordonnées d'un lieu
   */
  static getCoordinates(location: CameroonLocation): { lat: number; lng: number } | null {
    if (!location.coordinates) {
      return null;
    }
    return {
      lat: location.coordinates.latitude,
      lng: location.coordinates.longitude,
    };
  }

  /**
   * Vérifie si un lieu est une ville/village (lieu habité)
   */
  static isPopulatedPlace(location: CameroonLocation): boolean {
    return location.feature?.code === 'PPL';
  }

  /**
   * Obtient tous les noms d'un lieu
   */
  static getAllNames(location: CameroonLocation): string[] {
    return location.names.all || [];
  }

  /**
   * Obtient le nom principal d'un lieu
   */
  static getPrimaryName(location: CameroonLocation): string {
    return location.names.primary;
  }

  /**
   * Recherche un lieu par nom (insensible à la casse)
   */
  static searchByName(
    locations: CameroonLocation[],
    query: string
  ): LocationSearchResult[] {
    const lowerQuery = query.toLowerCase().trim();
    const results: LocationSearchResult[] = [];
    
    for (const location of locations) {
      const allNames = this.getAllNames(location);
      
      for (const name of allNames) {
        const lowerName = name.toLowerCase();
        
        // Correspondance exacte
        if (lowerName === lowerQuery) {
          let matchField: 'primary' | 'alternate' | 'alternatives' = 'primary';
          if (name === location.names.primary) {
            matchField = 'primary';
          } else if (name === location.names.alternate) {
            matchField = 'alternate';
          } else {
            matchField = 'alternatives';
          }
          
          results.push({
            location,
            matchType: 'exact',
            matchField,
          });
          break; // Ne pas ajouter plusieurs fois le même lieu
        }
        
        // Correspondance partielle
        if (lowerName.includes(lowerQuery) || lowerQuery.includes(lowerName)) {
          let matchField: 'primary' | 'alternate' | 'alternatives' = 'primary';
          if (name === location.names.primary) {
            matchField = 'primary';
          } else if (name === location.names.alternate) {
            matchField = 'alternate';
          } else {
            matchField = 'alternatives';
          }
          
          results.push({
            location,
            matchType: 'partial',
            matchField,
          });
          break;
        }
      }
    }
    
    // Trier par type de correspondance (exact d'abord)
    return results.sort((a, b) => {
      if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
      if (a.matchType !== 'exact' && b.matchType === 'exact') return 1;
      return 0;
    });
  }

  /**
   * Filtre les lieux par code de caractéristique
   */
  static filterByFeatureCode(
    locations: CameroonLocation[],
    featureCode: string
  ): CameroonLocation[] {
    return locations.filter(loc => loc.feature?.code === featureCode);
  }

  /**
   * Filtre les lieux par type de caractéristique
   */
  static filterByFeatureType(
    locations: CameroonLocation[],
    featureType: 'P' | 'H' | 'T' | 'S' | 'L'
  ): CameroonLocation[] {
    return locations.filter(loc => loc.feature?.type === featureType);
  }

  /**
   * Filtre uniquement les villes et villages
   */
  static getCities(locations: CameroonLocation[]): CameroonLocation[] {
    return this.filterByFeatureCode(locations, 'PPL');
  }

  /**
   * Filtre uniquement les cours d'eau
   */
  static getWaterways(locations: CameroonLocation[]): CameroonLocation[] {
    return locations.filter(
      loc => loc.feature?.code === 'STM' || loc.feature?.code === 'STMI'
    );
  }

  /**
   * Filtre uniquement les montagnes et collines
   */
  static getMountains(locations: CameroonLocation[]): CameroonLocation[] {
    return locations.filter(
      loc => loc.feature?.code === 'MT' || loc.feature?.code === 'HLL'
    );
  }

  /**
   * Calcule la distance entre deux points (formule de Haversine)
   * Retourne la distance en kilomètres
   */
  static calculateDistance(
    loc1: CameroonLocation,
    loc2: CameroonLocation
  ): number | null {
    const coords1 = this.getCoordinates(loc1);
    const coords2 = this.getCoordinates(loc2);
    
    if (!coords1 || !coords2) {
      return null;
    }
    
    const R = 6371; // Rayon de la Terre en km
    const dLat = this.toRadians(coords2.lat - coords1.lat);
    const dLon = this.toRadians(coords2.lng - coords1.lng);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(coords1.lat)) *
        Math.cos(this.toRadians(coords2.lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Trouve les lieux les plus proches d'un point donné
   */
  static findNearestLocations(
    locations: CameroonLocation[],
    targetLocation: CameroonLocation,
    maxResults: number = 10
  ): Array<{ location: CameroonLocation; distance: number }> {
    const results = locations
      .map(loc => ({
        location: loc,
        distance: this.calculateDistance(targetLocation, loc),
      }))
      .filter(item => item.distance !== null)
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))
      .slice(0, maxResults);
    
    return results as Array<{ location: CameroonLocation; distance: number }>;
  }

  /**
   * Recherche par coordonnées (avec tolérance)
   */
  static searchByCoordinates(
    locations: CameroonLocation[],
    latitude: number,
    longitude: number,
    tolerance: number = 0.01 // ~1km
  ): CameroonLocation[] {
    return locations.filter(loc => {
      if (!loc.coordinates) return false;
      const latDiff = Math.abs(loc.coordinates.latitude - latitude);
      const lngDiff = Math.abs(loc.coordinates.longitude - longitude);
      return latDiff <= tolerance && lngDiff <= tolerance;
    });
  }

  /**
   * Obtient l'élévation d'un lieu
   */
  static getElevation(location: CameroonLocation): number | null {
    return location.elevation?.meters ?? null;
  }

  /**
   * Obtient la population d'un lieu
   */
  static getPopulation(location: CameroonLocation): number | null {
    return location.population ?? null;
  }

  /**
   * Obtient le code administratif d'un niveau spécifique
   */
  static getAdministrativeCode(
    location: CameroonLocation,
    level: 1 | 2 | 3 | 4
  ): string | null {
    return location.administrative?.[`level_${level}`] ?? null;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
