import type { RolePermissions } from '../../types/permissions';
/**
 * Detects the appropriate base role from permission settings
 * Used when baseRole is not explicitly set in a template
 * NOTE: baseRole is ONLY for database compatibility - access control is 100% based on permissions checkboxes
 */
import { RESOURCES } from '../../constants/resources';

export function detectBaseRoleFromPermissions(permissions: RolePermissions): 'staff' | 'manager' | 'admin' {
  // Admin: Has access to settings or HR management
  const hasSettingsAccess = permissions.canView.includes(RESOURCES.SETTINGS) || permissions.canView.includes(RESOURCES.ALL);
  const hasHRAccess = permissions.canView.includes(RESOURCES.HR) || permissions.canView.includes(RESOURCES.ALL);
  
  if (hasSettingsAccess || hasHRAccess) {
    return 'admin';
  }
  
  // Manager: Has access to finance or can edit many resources
  const hasFinanceAccess = permissions.canView.includes(RESOURCES.FINANCE) || permissions.canView.includes(RESOURCES.ALL);
  if (hasFinanceAccess || permissions.canEdit.length >= 5) {
    return 'manager';
  }
  
  // Staff: Default fallback
  return 'staff';
}

/**
 * Gets the effective base role for a template
 * Uses the explicit baseRole if provided, otherwise detects it from permissions
 * IMPORTANT: This is ONLY for database compatibility. Access control is 100% checkbox-based.
 */
export function getEffectiveBaseRole(
  template: { baseRole?: 'staff' | 'manager' | 'admin'; permissions: RolePermissions } | null | undefined
): 'staff' | 'manager' | 'admin' {
  // Handle null/undefined template
  if (!template) {
    return 'staff';
  }
  
  // Handle missing permissions
  if (!template.permissions) {
    return 'staff';
  }
  
  // If baseRole is explicitly defined, use it
  if (template.baseRole) {
    return template.baseRole;
  }
  
  // Otherwise, detect it automatically from permissions
  const detected = detectBaseRoleFromPermissions(template.permissions);
  return detected;
}

