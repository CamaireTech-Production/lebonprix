/**
 * Customer utility functions
 * Centralized functions for customer name normalization
 */

import { normalizePhoneForComparison } from '@utils/core/phoneUtils';

/**
 * Normalizes customer name - returns "Client de passage" if name is empty
 * @param phone - Customer phone number (not used but kept for consistency)
 * @param name - Customer name (can be empty)
 * @returns Normalized customer name
 */
export const normalizeCustomerName = (_phone: string, name: string): string => {
  const trimmedName = name?.trim() || '';
  
  // If no name provided, return "Client de passage"
  if (!trimmedName) {
    return 'Client de passage';
  }
  
  return trimmedName;
};

/**
 * Checks if two customers are duplicates based on phone AND name
 * Duplicate condition: same normalized phone AND same normalized name (case-insensitive)
 * @param customer1 - First customer
 * @param customer2 - Second customer
 * @returns true if customers are duplicates
 */
export const areCustomersDuplicates = (
  customer1: { phone: string; name?: string },
  customer2: { phone: string; name?: string }
): boolean => {
  const phone1 = normalizePhoneForComparison(customer1.phone);
  const phone2 = normalizePhoneForComparison(customer2.phone);
  
  const name1 = (customer1.name || '').trim().toLowerCase();
  const name2 = (customer2.name || '').trim().toLowerCase();
  
  // Duplicate if same phone AND same name
  return phone1 === phone2 && phone1 !== '' && name1 === name2 && name1 !== '';
};

