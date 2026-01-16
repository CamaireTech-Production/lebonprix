import { useState, useEffect, useCallback, useRef } from 'react';
import { PermissionTemplate } from '../../types/permissions';
import { getTemplateById } from '@services/firestore/employees/permissionTemplateService';
import { getUserById } from '@services/utilities/userService';
import { logError } from '@utils/core/logger';

// Cache configuration
const CACHE_KEY_PREFIX = 'permission_cache_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

interface CachedPermission {
  template: PermissionTemplate | null;
  templateId: string | null;
  timestamp: number;
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
    const data: CachedPermission = {
      template,
      templateId,
      timestamp: Date.now(),
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

  const loadTemplate = useCallback(async (forceRefresh = false) => {
    if (!userId || !companyId) {
      setTemplate(null);
      setLoading(false);
      return;
    }

    // Owners don't need templates
    if (isOwner) {
      setTemplate(null);
      setLoading(false);
      return;
    }

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = getFromCache(userId, companyId);
      if (cached) {
        setTemplate(cached.template);
        lastTemplateIdRef.current = cached.templateId;
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      // Find template ID from userCompanies or fetch from Firestore
      let templateId: string | undefined;

      const userCompanyRef = userCompanies?.find((c) => c.companyId === companyId);
      if (userCompanyRef?.permissionTemplateId) {
        templateId = userCompanyRef.permissionTemplateId;
      } else {
        // Fallback: load directly from Firestore
        const userData = await getUserById(userId);
        if (userData?.companies) {
          const companyRef = userData.companies.find((c) => c.companyId === companyId);
          templateId = companyRef?.permissionTemplateId;
        }
      }

      // Skip loading if template ID hasn't changed (unless forcing refresh)
      if (!forceRefresh && templateId === lastTemplateIdRef.current && template) {
        setLoading(false);
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

      if (isMounted.current) {
        setTemplate(loadedTemplate);
        setLoading(false);
      }
    } catch (err) {
      logError('Error in permission cache', err);
      if (isMounted.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setLoading(false);
      }
    }
  }, [userId, companyId, userCompanies, isOwner, template]);

  // Load template on mount and when dependencies change
  useEffect(() => {
    isMounted.current = true;
    loadTemplate();

    return () => {
      isMounted.current = false;
    };
  }, [loadTemplate]);

  const refreshCache = useCallback(async () => {
    if (userId && companyId) {
      clearFromCache(userId, companyId);
      await loadTemplate(true);
    }
  }, [userId, companyId, loadTemplate]);

  const clearCache = useCallback(() => {
    if (userId && companyId) {
      clearFromCache(userId, companyId);
      setTemplate(null);
      lastTemplateIdRef.current = null;
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
