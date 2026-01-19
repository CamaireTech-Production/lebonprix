import { useState, useEffect, useCallback } from 'react';
import { subscribeToHRActors } from '@services/firestore/hr/hrActorService';
import { logError } from '@utils/core/logger';
import type { HRActor } from '../../types/models';

interface UseHRActorsResult {
  actors: HRActor[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to subscribe to HR Actors for a company in real-time
 *
 * @param companyId - The company ID to fetch HR actors for
 * @returns Object containing actors array, loading state, error, and refetch function
 */
export function useHRActors(companyId: string | undefined): UseHRActorsResult {
  const [actors, setActors] = useState<HRActor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!companyId) {
      setActors([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToHRActors(companyId, (hrActors) => {
      setActors(hrActors);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [companyId, refreshKey]);

  return {
    actors,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to get filtered HR Actors
 *
 * @param companyId - The company ID
 * @param options - Filter options
 * @returns Filtered actors with loading state
 */
export function useFilteredHRActors(
  companyId: string | undefined,
  options: {
    status?: 'active' | 'inactive' | 'archived';
    actorType?: string;
    searchQuery?: string;
  } = {}
): UseHRActorsResult {
  const { actors, loading, error, refetch } = useHRActors(companyId);
  const { status, actorType, searchQuery } = options;

  const filteredActors = actors.filter(actor => {
    // Status filter
    if (status && actor.status !== status) {
      return false;
    }

    // Actor type filter
    if (actorType && actorType !== 'all' && actor.actorType !== actorType) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const fullName = `${actor.firstName} ${actor.lastName}`.toLowerCase();
      const phone = actor.phone?.toLowerCase() || '';
      const email = actor.email?.toLowerCase() || '';
      if (!fullName.includes(query) && !phone.includes(query) && !email.includes(query)) {
        return false;
      }
    }

    return true;
  });

  return {
    actors: filteredActors,
    loading,
    error,
    refetch,
  };
}

export default useHRActors;
