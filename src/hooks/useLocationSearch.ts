/**
 * Hook pour rechercher des lieux géographiques avec debouncing
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import LocationService from '../services/locationService';
import type { CameroonLocation, LocationSearchResult } from '../types/cameroon-locations';

export interface LocationOption {
  value: string;
  label: string;
  region?: string;
  department?: string;
  location?: CameroonLocation;
}

interface UseLocationSearchReturn {
  locations: LocationOption[];
  loading: boolean;
  searchLocations: (query: string) => void;
  getLocationByValue: (value: string) => LocationOption | null;
  isInitialized: boolean;
}

const DEBOUNCE_DELAY = 300; // ms
const MAX_RESULTS = 15;

/**
 * Hook pour rechercher des lieux géographiques
 * Implémente le debouncing et gère le chargement des données
 */
export function useLocationSearch(): UseLocationSearchReturn {
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentQueryRef = useRef<string>('');

  // Charger les données au montage du hook
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        setLoading(true);
        await LocationService.loadLocations();
        if (mounted) {
          setIsInitialized(true);
          setLoading(false);
        }
      } catch (error) {
        console.error('Erreur lors de l\'initialisation des données géographiques:', error);
        if (mounted) {
          setIsInitialized(false);
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Recherche des lieux avec debouncing
   */
  const searchLocations = useCallback((query: string) => {
    currentQueryRef.current = query;

    // Annuler le timer précédent
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Si la requête est vide, vider les résultats
    if (!query || query.trim().length === 0) {
      setLocations([]);
      return;
    }

    // Débouncer la recherche
    debounceTimerRef.current = setTimeout(() => {
      // Vérifier que la requête n'a pas changé pendant le debounce
      if (currentQueryRef.current !== query) {
        return;
      }

      try {
        const results = LocationService.searchLocations(query, MAX_RESULTS);
        
        // Convertir les résultats en options pour react-select
        const options: LocationOption[] = results.map((result) => {
          const location = result.location;
          const regionCode = location.administrative?.level_1;
          const regionName = LocationService.getRegionName(regionCode);
          const departmentName = LocationService.getDepartmentName(location);

          return {
            value: location.names.primary,
            label: location.names.primary,
            region: regionName,
            department: departmentName || undefined,
            location,
          };
        });

        setLocations(options);
      } catch (error) {
        console.error('Erreur lors de la recherche de lieux:', error);
        setLocations([]);
      }
    }, DEBOUNCE_DELAY);
  }, []);

  /**
   * Obtient un lieu par sa valeur (nom principal)
   */
  const getLocationByValue = useCallback((value: string): LocationOption | null => {
    if (!value) return null;

    const location = LocationService.getLocationByValue(value);
    if (!location) return null;

    const regionCode = location.administrative?.level_1;
    const regionName = LocationService.getRegionName(regionCode);
    const departmentName = LocationService.getDepartmentName(location);

    return {
      value: location.names.primary,
      label: location.names.primary,
      region: regionName,
      department: departmentName || undefined,
      location,
    };
  }, []);

  return {
    locations,
    loading,
    searchLocations,
    getLocationByValue,
    isInitialized,
  };
}

