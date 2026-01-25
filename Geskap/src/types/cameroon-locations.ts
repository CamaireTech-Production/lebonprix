/**
 * Types pour les données géographiques du Cameroun
 * Simplified structure - only id and name
 */

/**
 * Simplified location structure
 */
export interface SimplifiedLocation {
  id: string;
  name: string;
}

/**
 * Structure complète du fichier de données
 */
export interface CameroonLocationsData {
  metadata: LocationsMetadata;
  locations: SimplifiedLocation[];
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
  converted_at?: string;
}

/**
 * Alias for backward compatibility
 * @deprecated Use SimplifiedLocation instead
 */
export type CameroonLocation = SimplifiedLocation;

/**
 * Résultat de recherche
 */
export interface LocationSearchResult {
  location: SimplifiedLocation;
  matchType: 'exact' | 'partial';
}


