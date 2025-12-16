/**
 * Exemple d'utilisation des données géographiques du Cameroun
 * 
 * Ce fichier montre comment utiliser le fichier CM.json dans l'application
 */

import type { CameroonLocation, CameroonLocationsData } from '@/types/cameroon-locations';
import { CameroonLocationUtils } from '@/types/cameroon-locations';

// Import du fichier JSON (nécessite la configuration TypeScript appropriée)
// import cameroonData from '../../CM.json';

/**
 * Exemple 1: Rechercher une ville par nom
 */
export function searchCityByName(
  data: CameroonLocationsData,
  cityName: string
): CameroonLocation | null {
  const results = CameroonLocationUtils.searchByName(data.locations, cityName);
  const exactMatch = results.find(r => r.matchType === 'exact');
  return exactMatch?.location ?? null;
}

/**
 * Exemple 2: Obtenir toutes les villes (lieux habités)
 */
export function getAllCities(data: CameroonLocationsData): CameroonLocation[] {
  return CameroonLocationUtils.getCities(data.locations);
}

/**
 * Exemple 3: Trouver les villes les plus proches d'un point
 */
export function findNearestCities(
  data: CameroonLocationsData,
  targetCityName: string,
  maxResults: number = 5
): Array<{ location: CameroonLocation; distance: number }> {
  const targetCity = searchCityByName(data, targetCityName);
  if (!targetCity) {
    return [];
  }
  
  const cities = getAllCities(data);
  return CameroonLocationUtils.findNearestLocations(cities, targetCity, maxResults);
}

/**
 * Exemple 4: Rechercher des villes par région (code administratif)
 */
export function getCitiesByRegion(
  data: CameroonLocationsData,
  adminCode: string
): CameroonLocation[] {
  const cities = getAllCities(data);
  return cities.filter(city => 
    CameroonLocationUtils.getAdministrativeCode(city, 1) === adminCode
  );
}

/**
 * Exemple 5: Autocomplétion pour un champ de recherche
 */
export function getAutocompleteSuggestions(
  data: CameroonLocationsData,
  query: string,
  maxResults: number = 10
): Array<{ name: string; location: CameroonLocation }> {
  if (query.length < 2) {
    return [];
  }
  
  const results = CameroonLocationUtils.searchByName(data.locations, query);
  return results
    .slice(0, maxResults)
    .map(result => ({
      name: CameroonLocationUtils.getPrimaryName(result.location),
      location: result.location,
    }));
}

/**
 * Exemple 6: Obtenir les informations complètes d'une ville
 */
export function getCityInfo(location: CameroonLocation) {
  return {
    id: location.id,
    name: CameroonLocationUtils.getPrimaryName(location),
    allNames: CameroonLocationUtils.getAllNames(location),
    coordinates: CameroonLocationUtils.getCoordinates(location),
    elevation: CameroonLocationUtils.getElevation(location),
    population: CameroonLocationUtils.getPopulation(location),
    feature: location.feature,
    timezone: location.timezone,
    region: CameroonLocationUtils.getAdministrativeCode(location, 1),
  };
}

/**
 * Exemple 7: Calculer la distance entre deux villes
 */
export function getDistanceBetweenCities(
  data: CameroonLocationsData,
  city1Name: string,
  city2Name: string
): number | null {
  const city1 = searchCityByName(data, city1Name);
  const city2 = searchCityByName(data, city2Name);
  
  if (!city1 || !city2) {
    return null;
  }
  
  return CameroonLocationUtils.calculateDistance(city1, city2);
}

/**
 * Exemple d'utilisation dans un composant React
 * 
 * ```tsx
 * import { useState, useMemo } from 'react';
 * import cameroonData from '../../CM.json';
 * import { getAutocompleteSuggestions } from '@/utils/cameroonLocationsExample';
 * 
 * function CitySearch() {
 *   const [query, setQuery] = useState('');
 *   const suggestions = useMemo(
 *     () => getAutocompleteSuggestions(cameroonData, query),
 *     [query]
 *   );
 * 
 *   return (
 *     <div>
 *       <input
 *         value={query}
 *         onChange={(e) => setQuery(e.target.value)}
 *         placeholder="Rechercher une ville..."
 *       />
 *       <ul>
 *         {suggestions.map((suggestion) => (
 *           <li key={suggestion.location.id}>
 *             {suggestion.name}
 *           </li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */



