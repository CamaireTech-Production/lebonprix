import { useMemo, useCallback } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { SystemRole, RolePermissions } from '../../types/permissions';
import { usePermissionCache } from './usePermissionCache';
import { RESOURCES } from '@constants/resources';

export function useRolePermissions(companyId?: string) {
  const { effectiveRole, isOwner, company, user, userCompanies } = useAuth();

  // Use the caching hook for loading permissions
  const { template, loading: templateLoading, refreshCache } = usePermissionCache(
    user?.uid,
    company?.id || companyId,
    userCompanies,
    isOwner || effectiveRole === 'owner'
  );

  // Stabilize refreshCache to prevent unnecessary re-renders
  // Wrap it in useCallback to ensure stable reference
  const stableRefreshCache = useCallback(async () => {
    await refreshCache();
  }, [refreshCache]);

  return useMemo(() => {
    // Un utilisateur est owner si isOwner est true OU si effectiveRole est 'owner'
    const isActualOwner = isOwner || effectiveRole === 'owner';

    // Si owner, retourner permissions complètes (pas besoin de template)
    if (isActualOwner) {
      const ownerPermissions: RolePermissions = {
        canView: [RESOURCES.ALL],
        canCreate: [RESOURCES.ALL],
        canEdit: [RESOURCES.ALL],
        canDelete: [RESOURCES.ALL],
        canManageEmployees: [RESOURCES.ALL],
      };

      const canAccess = (resource: string): boolean => {
        return ownerPermissions.canView.includes(RESOURCES.ALL) || ownerPermissions.canView.includes(resource);
      };

      const canCreate = (resource: string): boolean => {
        return ownerPermissions.canCreate.includes(RESOURCES.ALL) || ownerPermissions.canCreate.includes(resource);
      };

      const canEdit = (resource: string): boolean => {
        return ownerPermissions.canEdit.includes(RESOURCES.ALL) || ownerPermissions.canEdit.includes(resource);
      };

      const canDelete = (resource: string): boolean => {
        return ownerPermissions.canDelete.includes(RESOURCES.ALL) || ownerPermissions.canDelete.includes(resource);
      };

      const canManageEmployees = (targetRole?: SystemRole): boolean => {
        if (targetRole) {
          return (
            ownerPermissions.canManageEmployees.includes(RESOURCES.ALL) ||
            ownerPermissions.canManageEmployees.includes(targetRole)
          );
        }
        return ownerPermissions.canManageEmployees.length > 0;
      };

      // Calculate boolean flags from canView for backward compatibility
      const canAccessFinance = canAccess(RESOURCES.FINANCE);
      const canAccessHR = canAccess(RESOURCES.HR);
      const canAccessSettings = canAccess(RESOURCES.SETTINGS);

      return {
        systemRole: 'owner' as SystemRole,
        permissions: ownerPermissions,
        template: null,
        templateLoading: false,
        canAccess,
        canCreate,
        canEdit,
        canDelete,
        canManageEmployees,
        canAccessSettings,
        canAccessFinance,
        canAccessHR,
        isOwner: true,
        refreshPermissions: stableRefreshCache,
      };
    }

    // Si pas owner et template pas chargé, retourner permissions vides
    if (!template) {
      const emptyPermissions: RolePermissions = {
        canView: [],
        canCreate: [],
        canEdit: [],
        canDelete: [],
        canManageEmployees: [],
      };

      const canAccess = (resource: string): boolean => {
        return emptyPermissions.canView.includes(RESOURCES.ALL) || emptyPermissions.canView.includes(resource);
      };

      const canCreate = (resource: string): boolean => {
        return emptyPermissions.canCreate.includes(RESOURCES.ALL) || emptyPermissions.canCreate.includes(resource);
      };

      const canEdit = (resource: string): boolean => {
        return emptyPermissions.canEdit.includes(RESOURCES.ALL) || emptyPermissions.canEdit.includes(resource);
      };

      const canDelete = (resource: string): boolean => {
        return emptyPermissions.canDelete.includes(RESOURCES.ALL) || emptyPermissions.canDelete.includes(resource);
      };

      const canManageEmployees = (targetRole?: SystemRole): boolean => {
        if (targetRole) {
          return (
            emptyPermissions.canManageEmployees.includes(RESOURCES.ALL) ||
            emptyPermissions.canManageEmployees.includes(targetRole)
          );
        }
        return emptyPermissions.canManageEmployees.length > 0;
      };

      // Calculate boolean flags from canView for backward compatibility
      const canAccessFinance = canAccess(RESOURCES.FINANCE);
      const canAccessHR = canAccess(RESOURCES.HR);
      const canAccessSettings = canAccess(RESOURCES.SETTINGS);

      return {
        systemRole: 'staff' as SystemRole, // Default systemRole, mais permissions vides
        permissions: emptyPermissions,
        template: null,
        templateLoading,
        canAccess,
        canCreate,
        canEdit,
        canDelete,
        canManageEmployees,
        canAccessSettings,
        canAccessFinance,
        canAccessHR,
        isOwner: false,
        refreshPermissions: stableRefreshCache,
      };
    }

    // Sinon, utiliser UNIQUEMENT les permissions du template
    const effectivePermissions: RolePermissions = template.permissions;

    const canAccess = (resource: string): boolean => {
      return effectivePermissions.canView.includes(RESOURCES.ALL) || effectivePermissions.canView.includes(resource);
    };

    // Backward compatibility: if canCreate is missing, fall back to canEdit
    const canCreate = (resource: string): boolean => {
      const hasCreatePermission = effectivePermissions.canCreate && effectivePermissions.canCreate.length > 0;
      if (hasCreatePermission) {
        return effectivePermissions.canCreate.includes(RESOURCES.ALL) || effectivePermissions.canCreate.includes(resource);
      }
      // Fallback: if canCreate is not defined in template, use canEdit
      return effectivePermissions.canEdit.includes(RESOURCES.ALL) || effectivePermissions.canEdit.includes(resource);
    };

    const canEdit = (resource: string): boolean => {
      return effectivePermissions.canEdit.includes(RESOURCES.ALL) || effectivePermissions.canEdit.includes(resource);
    };

    const canDelete = (resource: string): boolean => {
      return effectivePermissions.canDelete.includes(RESOURCES.ALL) || effectivePermissions.canDelete.includes(resource);
    };

    const canManageEmployees = (targetRole?: SystemRole): boolean => {
      if (targetRole) {
        return (
          effectivePermissions.canManageEmployees.includes(RESOURCES.ALL) ||
          effectivePermissions.canManageEmployees.includes(targetRole)
        );
      }
      return effectivePermissions.canManageEmployees.length > 0;
    };

    // Calculate boolean flags from canView for backward compatibility
    const canAccessFinance = canAccess(RESOURCES.FINANCE);
    const canAccessHR = canAccess(RESOURCES.HR);
    const canAccessSettings = canAccess(RESOURCES.SETTINGS);

    return {
      systemRole: 'staff' as SystemRole, // systemRole n'est plus utilisé pour les permissions, mais gardé pour compatibilité
      permissions: effectivePermissions,
      template,
      templateLoading,
      canAccess,
      canCreate,
      canEdit,
      canDelete,
      canManageEmployees,
      canAccessSettings,
      canAccessFinance,
      canAccessHR,
      isOwner: false,
      refreshPermissions: stableRefreshCache,
    };
  }, [effectiveRole, isOwner, template, templateLoading, companyId, stableRefreshCache]);
}
