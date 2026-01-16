import { ReactNode } from 'react';
import { useRolePermissions } from '@hooks/business/useRolePermissions';
import { useAuth } from '@contexts/AuthContext';

type PermissionAction = 'view' | 'edit' | 'delete';

interface PermissionGuardProps {
  /** The resource to check permission for (from RESOURCES constant) */
  resource: string;
  /** The action type: 'view', 'edit', or 'delete' */
  action: PermissionAction;
  /** Content to render if user has permission */
  children: ReactNode;
  /** Optional content to render if user doesn't have permission (default: null) */
  fallback?: ReactNode;
  /** If true, shows children but disabled (for buttons) */
  showDisabled?: boolean;
}

/**
 * PermissionGuard - Central component for permission-based rendering
 *
 * Usage:
 * ```tsx
 * <PermissionGuard resource={RESOURCES.PRODUCTS} action="edit">
 *   <Button onClick={handleEdit}>Edit</Button>
 * </PermissionGuard>
 *
 * // With fallback
 * <PermissionGuard
 *   resource={RESOURCES.PRODUCTS}
 *   action="delete"
 *   fallback={<span className="text-gray-400">No permission</span>}
 * >
 *   <Button onClick={handleDelete}>Delete</Button>
 * </PermissionGuard>
 * ```
 */
export const PermissionGuard = ({
  resource,
  action,
  children,
  fallback = null,
  showDisabled = false,
}: PermissionGuardProps) => {
  const { company } = useAuth();
  const { canAccess, canEdit, canDelete, isOwner } = useRolePermissions(company?.id);

  // Owner always has permission
  if (isOwner) {
    return <>{children}</>;
  }

  // Check permission based on action type
  // IMPORTANT: Delete actions are OWNER-ONLY - employees must use action request system
  let hasPermission = false;
  switch (action) {
    case 'view':
      hasPermission = canAccess(resource);
      break;
    case 'edit':
      hasPermission = canEdit(resource);
      break;
    case 'delete':
      // DELETE IS OWNER-ONLY - never grant delete to non-owners
      hasPermission = false;
      break;
  }

  if (hasPermission) {
    return <>{children}</>;
  }

  // If showDisabled, clone children with disabled prop
  if (showDisabled && children) {
    // Return fallback or nothing if no permission
    return <>{fallback}</>;
  }

  return <>{fallback}</>;
};

/**
 * Hook version for more complex permission logic
 *
 * IMPORTANT: Delete actions are OWNER-ONLY by design.
 * Non-owners must use the action request system to request deletion approval.
 */
export const usePermissionCheck = (resource: string) => {
  const { company } = useAuth();
  const { canAccess, canEdit, isOwner } = useRolePermissions(company?.id);

  return {
    canView: isOwner || canAccess(resource),
    canEdit: isOwner || canEdit(resource),
    // DELETE IS OWNER-ONLY - employees must request deletion through action request system
    canDelete: isOwner,
    isOwner,
  };
};

export default PermissionGuard;
