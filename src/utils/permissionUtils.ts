import type { RolePermissions } from '../types/permissions';

/**
 * Detects the appropriate base role from permission settings
 * Used when baseRole is not explicitly set in a template
 * NOTE: baseRole is ONLY for database compatibility - access control is 100% based on permissions checkboxes
 */
import { RESOURCES } from '../constants/resources';

export function detectBaseRoleFromPermissions(permissions: RolePermissions): 'staff' | 'manager' | 'admin' {
  // Admin: Has access to settings or HR management
  const hasSettingsAccess = permissions.canView.includes(RESOURCES.SETTINGS) || permissions.canView.includes(RESOURCES.ALL);
  const hasHRAccess = permissions.canView.includes(RESOURCES.HR) || permissions.canView.includes(RESOURCES.ALL);
  
  if (hasSettingsAccess || hasHRAccess) {
    console.log('🔍 [detectBaseRole] Detected admin (has settings or HR access)');
    return 'admin';
  }
  
  // Manager: Has access to finance or can edit many resources
  const hasFinanceAccess = permissions.canView.includes(RESOURCES.FINANCE) || permissions.canView.includes(RESOURCES.ALL);
  if (hasFinanceAccess || permissions.canEdit.length >= 5) {
    console.log('🔍 [detectBaseRole] Detected manager (has finance or 5+ edit permissions)');
    return 'manager';
  }
  
  // Staff: Default fallback
  console.log('🔍 [detectBaseRole] Detected staff (default)');
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
    console.warn('⚠️ [getEffectiveBaseRole] Template is null/undefined, defaulting to staff');
    return 'staff';
  }
  
  // Handle missing permissions
  if (!template.permissions) {
    console.warn('⚠️ [getEffectiveBaseRole] Template has no permissions, defaulting to staff');
    return 'staff';
  }
  
  // If baseRole is explicitly defined, use it
  if (template.baseRole) {
    console.log(`✅ [getEffectiveBaseRole] Using explicit baseRole: ${template.baseRole}`);
    return template.baseRole;
  }
  
  // Otherwise, detect it automatically from permissions
  console.log('🔄 [getEffectiveBaseRole] No baseRole set, detecting from permissions...');
  const detected = detectBaseRoleFromPermissions(template.permissions);
  console.log(`✅ [getEffectiveBaseRole] Auto-detected baseRole: ${detected}`);
  return detected;
}

