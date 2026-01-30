import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useCustomers } from '@hooks/data/useFirestore';
import { normalizePhoneForComparison } from '@utils/core/phoneUtils';
import type { Customer } from '../../types/models';

interface UseCustomerAutocompleteOptions {
  /**
   * Minimum number of characters before showing suggestions
   * @default 1
   */
  minChars?: number;
  /**
   * Maximum number of suggestions to show
   * @default 10
   */
  maxSuggestions?: number;
  /**
   * Whether to search by name
   * @default true
   */
  searchByName?: boolean;
  /**
   * Whether to search by phone
   * @default true
   */
  searchByPhone?: boolean;
  /**
   * Whether to search by quarter/location
   * @default false
   */
  searchByLocation?: boolean;
}

interface CustomerSuggestion extends Customer {
  matchType: 'name' | 'phone' | 'location' | 'multiple';
  matchScore: number;
}

export const useCustomerAutocomplete = (options: UseCustomerAutocompleteOptions = {}) => {
  const {
    minChars = 1,
    maxSuggestions = 10,
    searchByName = true,
    searchByPhone = true,
    searchByLocation = false
  } = options;

  const { customers } = useCustomers();
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter and score customers based on search term
  const suggestions = useMemo(() => {
    if (!searchTerm.trim() || searchTerm.length < minChars) {
      return [];
    }

    const normalizedSearch = normalizePhoneForComparison(searchTerm);
    const searchLower = searchTerm.trim().toLowerCase();
    const hasDigits = /\d/.test(searchTerm);

    const scored: CustomerSuggestion[] = [];

    customers.forEach(customer => {
      let matchScore = 0;
      let matchType: 'name' | 'phone' | 'location' | 'multiple' = 'name';
      let matches = false;

      // Search by name
      if (searchByName && customer.name) {
        const customerName = customer.name.toLowerCase();
        if (customerName.includes(searchLower)) {
          matches = true;
          // Exact match gets higher score
          if (customerName === searchLower) {
            matchScore += 100;
          } else if (customerName.startsWith(searchLower)) {
            matchScore += 50;
          } else {
            matchScore += 10;
          }
          matchType = 'name';
        }
      }

      // Search by phone (only if search term contains digits)
      if (searchByPhone && customer.phone && hasDigits) {
        const normalizedPhone = normalizePhoneForComparison(customer.phone);
        if (normalizedPhone.includes(normalizedSearch) || normalizedSearch.includes(normalizedPhone)) {
          matches = true;
          // Exact match gets higher score
          if (normalizedPhone === normalizedSearch) {
            matchScore += 100;
          } else if (normalizedPhone.startsWith(normalizedSearch)) {
            matchScore += 50;
          } else {
            matchScore += 10;
          }
          // If already matched by name, it's a multiple match
          if (matchType === 'name') {
            matchType = 'multiple';
            matchScore += 20; // Bonus for multiple matches
          } else {
            matchType = 'phone';
          }
        }
      }

      // Search by location/quarter
      if (searchByLocation && customer.quarter) {
        const customerLocation = customer.quarter.toLowerCase();
        if (customerLocation.includes(searchLower)) {
          matches = true;
          if (matchType !== 'multiple') {
            matchType = 'location';
          }
          matchScore += 5; // Lower priority than name/phone
        }
      }

      if (matches) {
        scored.push({
          ...customer,
          matchType,
          matchScore
        });
      }
    });

    // Sort by score (highest first), then by name
    return scored
      .sort((a, b) => {
        if (b.matchScore !== a.matchScore) {
          return b.matchScore - a.matchScore;
        }
        return (a.name || '').localeCompare(b.name || '');
      })
      .slice(0, maxSuggestions);
  }, [customers, searchTerm, minChars, maxSuggestions, searchByName, searchByPhone, searchByLocation]);

  // Handle search input change
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setIsOpen(value.trim().length >= minChars && suggestions.length > 0);
  }, [minChars, suggestions.length]);

  // Handle customer selection
  const handleSelectCustomer = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    setSearchTerm(customer.name || customer.phone || '');
    setIsOpen(false);
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedCustomer(null);
    setSearchTerm('');
    setIsOpen(false);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return {
    searchTerm,
    suggestions,
    isOpen,
    selectedCustomer,
    containerRef,
    handleSearchChange,
    handleSelectCustomer,
    clearSelection,
    setIsOpen
  };
};

