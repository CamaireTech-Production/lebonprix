import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_PERMISSIONS, mapUIRoleToSystemRole, SystemRole } from '../types/permissions';

export function useRolePermissions(companyId?: string) {
  const { effectiveRole, isOwner } = useAuth();

  return useMemo(() => {
    const systemRole: SystemRole = isOwner
      ? 'owner'
      : mapUIRoleToSystemRole((effectiveRole as any) || 'vendeur');

    const permissions = ROLE_PERMISSIONS[systemRole];

    const canAccess = (resource: string): boolean => {
      return permissions.canView.includes('all') || permissions.canView.includes(resource);
    };

    const canEdit = (resource: string): boolean => {
      return permissions.canEdit.includes('all') || permissions.canEdit.includes(resource);
    };

    const canDelete = (resource: string): boolean => {
      return permissions.canDelete.includes('all') || permissions.canDelete.includes(resource);
    };

    return {
      systemRole,
      permissions,
      canAccess,
      canEdit,
      canDelete
    };
  }, [effectiveRole, isOwner, companyId]);
}


