/**
 * Logout Cleanup Utility
 * Clears all user-specific localStorage data while preserving:
 * - PWA update data (app metadata)
 * - Checkout data (may contain personal info but should persist)
 */

/**
 * Clear all user-specific localStorage data on logout
 * Preserves PWA update data and checkout data
 */
export const clearUserDataOnLogout = (userId?: string): void => {
  try {
    const keysToRemove: string[] = [];
    
    // Get all localStorage keys
    const allKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        allKeys.push(key);
      }
    }
    
    // Keys to preserve (should NOT be removed)
    const preservePrefixes = [
      'pwa_', // PWA update data
      'checkout_data_' // Checkout data
    ];
    
    // Function to check if a key should be preserved
    const shouldPreserve = (key: string): boolean => {
      return preservePrefixes.some(prefix => key.startsWith(prefix));
    };
    
    // Collect keys to remove
    allKeys.forEach(key => {
      // Skip preserved keys
      if (shouldPreserve(key)) {
        return;
      }
      
      // Remove user-specific session keys
      if (key.startsWith('lebonprix_user_session_')) {
        keysToRemove.push(key);
        return;
      }
      
      // Remove company cache keys
      if (key === 'cachedCompany' || key === 'cachedCompanyExpiry') {
        keysToRemove.push(key);
        return;
      }
      
      // Remove company data (company_${userId})
      if (key.startsWith('company_')) {
        // If userId provided, only remove that user's company data
        if (userId && key === `company_${userId}`) {
          keysToRemove.push(key);
        } else if (!userId) {
          // If no userId, remove all company data
          keysToRemove.push(key);
        }
        return;
      }
      
      // Remove finance-related user data
      if (key.startsWith('finance_types_setup_')) {
        if (userId && key === `finance_types_setup_${userId}`) {
          keysToRemove.push(key);
        } else if (!userId) {
          keysToRemove.push(key);
        }
        return;
      }
      
      if (key.startsWith('finance_entry_types_')) {
        if (userId && key === `finance_entry_types_${userId}`) {
          keysToRemove.push(key);
        } else if (!userId) {
          keysToRemove.push(key);
        }
        return;
      }
      
      if (key.startsWith('financial_categories_')) {
        if (userId && key === `financial_categories_${userId}`) {
          keysToRemove.push(key);
        } else if (!userId) {
          keysToRemove.push(key);
        }
        return;
      }
      
      // Remove company-specific data caches
      // These are typically prefixed with: products_, sales_, expenses_, categories_, etc.
      // We clear ALL of these on logout for privacy, even though we don't know which belong to the user
      const companyDataPrefixes = [
        'products_',
        'sales_',
        'expenses_',
        'categories_',
        'stockChanges_',
        'suppliers_',
        'dashboard_',
        'search_products_',
        'sales_analytics_'
      ];
      
      companyDataPrefixes.forEach(prefix => {
        if (key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      });
    });
    
    // Remove all collected keys
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`❌ Failed to remove localStorage key: ${key}`, error);
      }
    });
    
  } catch (error) {
    console.error('❌ Error during logout cleanup:', error);
  }
};

/**
 * Get list of all localStorage keys that would be cleared on logout
 * Useful for debugging
 */
export const getKeysToClearOnLogout = (userId?: string): string[] => {
  const keysToRemove: string[] = [];
  
  const preservePrefixes = ['pwa_', 'checkout_data_'];
  
  const shouldPreserve = (key: string): boolean => {
    return preservePrefixes.some(prefix => key.startsWith(prefix));
  };
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || shouldPreserve(key)) continue;
    
    // Check all patterns
    if (
      key.startsWith('lebonprix_user_session_') ||
      key === 'cachedCompany' ||
      key === 'cachedCompanyExpiry' ||
      key.startsWith('company_') ||
      key.startsWith('finance_types_setup_') ||
      key.startsWith('finance_entry_types_') ||
      key.startsWith('financial_categories_') ||
      key.startsWith('products_') ||
      key.startsWith('sales_') ||
      key.startsWith('expenses_') ||
      key.startsWith('categories_') ||
      key.startsWith('stockChanges_') ||
      key.startsWith('suppliers_') ||
      key.startsWith('dashboard_') ||
      key.startsWith('search_products_') ||
      key.startsWith('sales_analytics_')
    ) {
      // If userId provided, only include that user's keys
      if (userId) {
        if (
          key === `company_${userId}` ||
          key === `finance_types_setup_${userId}` ||
          key === `finance_entry_types_${userId}` ||
          key === `financial_categories_${userId}` ||
          key.startsWith('lebonprix_user_session_')
        ) {
          keysToRemove.push(key);
        } else if (
          !key.includes(userId) && 
          !key.startsWith('lebonprix_user_session_')
        ) {
          // Company-specific data (products_, sales_, etc.) - include all
          keysToRemove.push(key);
        }
      } else {
        keysToRemove.push(key);
      }
    }
  }
  
  return keysToRemove;
};

