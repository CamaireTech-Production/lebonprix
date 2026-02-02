import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { searchProductsInFirebase, localProductSearch } from '@services/search/searchService';
import type { Product } from '../../types/models';

interface UseProductSearchOptions {
  localProducts: Product[];
  hasMoreProducts: boolean;
  debounceMs?: number;
}

interface UseProductSearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: Product[];
  isSearching: boolean;
  searchMode: 'local' | 'remote' | 'hybrid';
  displayResults: Product[];
  clearSearch: () => void;
}

export const useProductSearch = ({
  localProducts,
  hasMoreProducts,
  debounceMs = 300
}: UseProductSearchOptions): UseProductSearchReturn => {
  const { company } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<'local' | 'remote' | 'hybrid'>('local');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchQuery, debounceMs]);

  // Local search function
  const performLocalSearch = useCallback((query: string, products: Product[]) => {
    return localProductSearch(query, products);
  }, []);

  // Remote search function
  const performRemoteSearch = useCallback(async (query: string) => {
    if (!company?.id || !query.trim()) return;

    setIsSearching(true);
    setSearchMode('remote');

    try {
      const results = await searchProductsInFirebase(company.id, query);
      setSearchResults(results);
    } catch (error) {
      console.error('Remote search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [company?.id]);

  // Determine when to trigger remote search
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults([]);
      setSearchMode('local');
      return;
    }

    // Always trigger remote search for queries longer than 2 characters
    // This ensures we get ALL matching products from Firebase, not just loaded ones
    const shouldUseRemoteSearch = debouncedQuery.trim().length > 2;

    if (shouldUseRemoteSearch) {
      setSearchMode('hybrid');
      performRemoteSearch(debouncedQuery);
    } else {
      setSearchMode('local');
      setSearchResults([]);
    }
  }, [debouncedQuery, localProducts, hasMoreProducts, performLocalSearch, performRemoteSearch]);

  // Calculate display results
  const displayResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return localProducts;
    }

    if (searchMode === 'remote' && searchResults.length > 0) {
      return searchResults;
    }

    if (searchMode === 'hybrid') {
      // Combine local results with remote results (if available)
      const localResults = performLocalSearch(searchQuery, localProducts);
      
      if (isSearching) {
        return localResults; // Show local results while remote search is in progress
      }
      return searchResults.length > 0 ? searchResults : localResults;
    }

    // Default to local search
    return performLocalSearch(searchQuery, localProducts);
  }, [searchQuery, localProducts, searchResults, searchMode, isSearching, performLocalSearch]);

  // Clear search function
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchMode('local');
    setIsSearching(false);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    searchMode,
    displayResults,
    clearSearch
  };
};
