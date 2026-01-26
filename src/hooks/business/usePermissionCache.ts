import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PermissionTemplate } from '../../types/permissions';
import { getTemplateById, subscribeToTemplate } from '@services/firestore/employees/permissionTemplateService';
import { getUserById } from '@services/utilities/userService';
import { logError } from '@utils/core/logger';
import type { Unsubscribe } from 'firebase/firestore';

// Cache configuration
const CACHE_KEY_PREFIX = 'permission_cache_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

interface CachedPermission {
  template: PermissionTemplate | null;
  templateId: string | null;
  timestamp: number;
  templateUpdatedAt?: number; // Track template's updatedAt to detect changes
}

interface PermissionCacheResult {
  template: PermissionTemplate | null;
  loading: boolean;
  error: Error | null;
  refreshCache: () => Promise<void>;
  clearCache: () => void;
}

/**
 * Gets the cache key for a specific user and company
 */
const getCacheKey = (userId: string, companyId: string): string => {
  return `${CACHE_KEY_PREFIX}${userId}_${companyId}`;
};

/**
 * Gets cached permission data from localStorage
 */
const getFromCache = (userId: string, companyId: string): CachedPermission | null => {
  try {
    const key = getCacheKey(userId, companyId);
    const cached = localStorage.getItem(key);

    if (!cached) return null;

    const data: CachedPermission = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid
    if (now - data.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }

    return data;
  } catch (error) {
    logError('Error reading permission cache', error);
    return null;
  }
};

/**
 * Saves permission data to localStorage cache
 */
const saveToCache = (
  userId: string,
  companyId: string,
  template: PermissionTemplate | null,
  templateId: string | null
): void => {
  try {
    const key = getCacheKey(userId, companyId);
    const templateUpdatedAt = template?.updatedAt 
      ? (typeof template.updatedAt === 'object' && 'seconds' in template.updatedAt 
          ? template.updatedAt.seconds * 1000 
          : new Date(template.updatedAt).getTime())
      : undefined;
    
    const data: CachedPermission = {
      template,
      templateId,
      timestamp: Date.now(),
      templateUpdatedAt,
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    logError('Error saving permission cache', error);
  }
};

/**
 * Clears permission cache for a specific user and company
 */
const clearFromCache = (userId: string, companyId: string): void => {
  try {
    const key = getCacheKey(userId, companyId);
    localStorage.removeItem(key);
  } catch (error) {
    logError('Error clearing permission cache', error);
  }
};

/**
 * Clears all permission caches from localStorage
 */
export const clearAllPermissionCaches = (): void => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    logError('Error clearing all permission caches', error);
  }
};

/**
 * Hook for caching permission templates to avoid repeated Firestore calls.
 * Uses localStorage with TTL to persist permissions across navigation.
 */
export function usePermissionCache(
  userId: string | undefined,
  companyId: string | undefined,
  userCompanies?: Array<{ companyId: string; permissionTemplateId?: string }>,
  isOwner?: boolean
): PermissionCacheResult {
  const [template, setTemplate] = useState<PermissionTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);

  // Track last loaded template ID to prevent redundant loads
  const lastTemplateIdRef = useRef<string | null>(null);
  
  // Track current template in ref to avoid dependency issues
  const templateRef = useRef<PermissionTemplate | null>(null);
  
  // Track if we're currently loading to prevent concurrent loads
  const isLoadingRef = useRef(false);
  
  // Track real-time subscription
  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  
  // Memoize userCompanies to get stable reference for template ID extraction
  // Extract only the template ID we need to avoid array reference changes
  // Use a stable string key for comparison to prevent unnecessary recalculations
  const userCompaniesKey = useMemo(() => {
    if (!userCompanies || !companyId) return '';
    return userCompanies
      .map(c => `${c.companyId}:${c.permissionTemplateId || ''}`)
      .join('|');
  }, [userCompanies, companyId]);
  
  const templateIdFromUserCompanies = useMemo(() => {
    if (!userCompanies || !companyId) return undefined;
    const userCompanyRef = userCompanies.find((c) => c.companyId === companyId);
    return userCompanyRef?.permissionTemplateId;
  }, [userCompaniesKey, userCompanies, companyId]);

  // Update template ref when template state changes
  useEffect(() => {
    templateRef.current = template;
  }, [template]);

  const loadTemplate = useCallback(async (forceRefresh = false) => {
    // Prevent concurrent loads
    if (isLoadingRef.current && !forceRefresh) {
      return;
    }

    if (!userId || !companyId) {
      if (isMounted.current) {
        setTemplate(null);
        setLoading(false);
      }
      return;
    }

    // Owners don't need templates
    if (isOwner) {
      if (isMounted.current) {
        setTemplate(null);
        setLoading(false);
      }
      return;
    }

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = getFromCache(userId, companyId);
      if (cached) {
        // Only update if template actually changed
        if (cached.templateId !== lastTemplateIdRef.current || cached.template !== templateRef.current) {
          lastTemplateIdRef.current = cached.templateId;
          templateRef.current = cached.template;
          if (isMounted.current) {
            setTemplate(cached.template);
            setLoading(false);
          }
        }
        
        // Set up real-time listener even for cached templates (if template ID exists)
        // This ensures we detect deletions in real-time even when using cached data
        if (cached.templateId) {
          // Clean up any existing subscription
          if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
          }
          
          // Set up real-time listener
          unsubscribeRef.current = subscribeToTemplate(companyId, cached.templateId, (updatedTemplate) => {
            // Template was deleted or updated
            if (isMounted.current) {
              // Update cache
              saveToCache(userId, companyId, updatedTemplate, cached.templateId);
              lastTemplateIdRef.current = cached.templateId;
              templateRef.current = updatedTemplate;
              
              // Update state immediately
              setTemplate(updatedTemplate);
              // If template was deleted (null), we're done loading
              if (!updatedTemplate) {
                setLoading(false);
              }
            }
          });
        }
        
        return;
      }
    }

    // Set loading guard
    isLoadingRef.current = true;

    try {
      if (isMounted.current) {
        setLoading(true);
        setError(null);
      }

      // Find template ID from memoized value or fetch from Firestore
      let templateId: string | undefined = templateIdFromUserCompanies;

      if (!templateId) {
        // Fallback: load directly from Firestore
        const userData = await getUserById(userId);
        if (userData?.companies) {
          const companyRef = userData.companies.find((c) => c.companyId === companyId);
          templateId = companyRef?.permissionTemplateId;
        }
      }

      // Skip loading if template ID hasn't changed (unless forcing refresh)
      // But still set up real-time listener
      if (!forceRefresh && templateId === lastTemplateIdRef.current && templateRef.current) {
        isLoadingRef.current = false;
        if (isMounted.current) {
          setLoading(false);
        }
        
        // Set up real-time listener even if template ID hasn't changed
        if (templateId) {
          // Clean up any existing subscription
          if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
          }
          
          // Set up real-time listener
          unsubscribeRef.current = subscribeToTemplate(companyId, templateId, (updatedTemplate) => {
            if (isMounted.current) {
              saveToCache(userId, companyId, updatedTemplate, templateId);
              lastTemplateIdRef.current = templateId;
              templateRef.current = updatedTemplate;
              setTemplate(updatedTemplate);
              if (!updatedTemplate) {
                setLoading(false);
              }
            }
          });
        }
        
        return;
      }

      let loadedTemplate: PermissionTemplate | null = null;

      if (templateId) {
        try {
          loadedTemplate = await getTemplateById(companyId, templateId);
        } catch (err) {
          logError('Error loading permission template', err);
        }
      }

      // Save to cache
      saveToCache(userId, companyId, loadedTemplate, templateId || null);
      lastTemplateIdRef.current = templateId || null;
      templateRef.current = loadedTemplate;

      if (isMounted.current) {
        setTemplate(loadedTemplate);
        setLoading(false);
      }
      
      // Set up real-time listener if we have a template ID (even if template is null - to detect when it's created)
      // This will detect when the template is deleted or created in real-time
      if (templateId) {
        // Clean up any existing subscription
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
        
        // Set up real-time listener
        unsubscribeRef.current = subscribeToTemplate(companyId, templateId, (updatedTemplate) => {
          // Template was deleted or updated
          if (isMounted.current) {
            // Update cache
            saveToCache(userId, companyId, updatedTemplate, templateId);
            lastTemplateIdRef.current = templateId;
            templateRef.current = updatedTemplate;
            
            // Update state immediately
            setTemplate(updatedTemplate);
            // If template was deleted (null), we're done loading
            if (!updatedTemplate) {
              setLoading(false);
            }
          }
        });
      }
    } catch (err) {
      logError('Error in permission cache', err);
      if (isMounted.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setLoading(false);
      }
    } finally {
      isLoadingRef.current = false;
    }
  }, [userId, companyId, templateIdFromUserCompanies, isOwner]);

  // Load template on mount and when key dependencies change
  useEffect(() => {
    isMounted.current = true;
    loadTemplate();

    return () => {
      isMounted.current = false;
      // Clean up real-time subscription
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [loadTemplate]);

  // Listen for template update events and refresh cache
  useEffect(() => {
    if (!userId || !companyId || isOwner) return;

    const handleTemplateUpdate = (event: CustomEvent) => {
      const { companyId: updatedCompanyId, templateId } = event.detail;
      
      // Only refresh if this is for our company
      if (updatedCompanyId === companyId) {
        // Check if this user is using the updated template
        const currentTemplateId = templateIdFromUserCompanies;
        if (!templateId || currentTemplateId === templateId) {
          // Clear cache and refresh
          clearFromCache(userId, companyId);
          lastTemplateIdRef.current = null;
          loadTemplate(true);
        }
      }
    };

    window.addEventListener('permission-template-updated', handleTemplateUpdate as EventListener);

    return () => {
      window.removeEventListener('permission-template-updated', handleTemplateUpdate as EventListener);
    };
  }, [userId, companyId, templateIdFromUserCompanies, isOwner, loadTemplate]);

  const refreshCache = useCallback(async () => {
    if (userId && companyId && !isLoadingRef.current) {
      clearFromCache(userId, companyId);
      lastTemplateIdRef.current = null;
      await loadTemplate(true);
    }
  }, [userId, companyId, loadTemplate]);

  const clearCache = useCallback(() => {
    if (userId && companyId) {
      clearFromCache(userId, companyId);
      lastTemplateIdRef.current = null;
      templateRef.current = null;
      
      // Clean up real-time subscription
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      
      if (isMounted.current) {
        setTemplate(null);
      }
    }
  }, [userId, companyId]);

  return {
    template,
    loading,
    error,
    refreshCache,
    clearCache,
  };
}

export default usePermissionCache;
