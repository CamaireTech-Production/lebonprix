/**
 * Location Access Utilities
 * Handles permissions for shops and warehouses
 */

import type { Shop, Warehouse, User } from '../../types/models';

export type LocationPermission = 'read' | 'write' | 'manage';

export interface Location {
  id: string;
  companyId: string;
  isDefault: boolean;
  isActive: boolean;
  assignedUsers?: string[];
  readOnlyUsers?: string[];
}

/**
 * Check if a user can access a location with a specific permission level
 * 
 * @param user - The user to check
 * @param location - The location (shop or warehouse) to check
 * @param permission - The permission level required ('read', 'write', or 'manage')
 * @returns true if user has access, false otherwise
 */
export function canAccessLocation(
  user: User | { id: string; isOwner?: boolean; role?: string; companyId?: string },
  location: Location,
  permission: LocationPermission = 'read'
): boolean {
  // 1. Location désactivée → Seuls owner/admin peuvent voir
  if (!location.isActive) {
    return user.isOwner === true || user.role === 'admin' || user.role === 'owner';
  }

  // 2. Owner/Admin ont tous les droits
  if (user.isOwner === true || user.role === 'admin' || user.role === 'owner') {
    return true;
  }

  // 3. Vérifier permissions selon le type
  if (permission === 'manage') {
    // Seuls owner/admin peuvent gérer
    return false;
  }

  // 4. Si location par défaut ET pas d'assignation → accessible à tous les employés
  if (
    location.isDefault &&
    (!location.assignedUsers || location.assignedUsers.length === 0) &&
    (!location.readOnlyUsers || location.readOnlyUsers.length === 0)
  ) {
    // Vérifier que l'utilisateur appartient à la même entreprise
    if (user.companyId && user.companyId === location.companyId) {
      return permission === 'read' || permission === 'write';
    }
    return false;
  }

  // 5. Vérifier assignation
  if (location.assignedUsers?.includes(user.id)) {
    return permission === 'read' || permission === 'write';
  }

  if (location.readOnlyUsers?.includes(user.id)) {
    return permission === 'read';
  }

  return false;
}

/**
 * Get accessible locations for a user
 * 
 * @param user - The user
 * @param locations - All locations to filter
 * @param permission - The permission level required
 * @returns Filtered list of accessible locations
 */
export function getAccessibleLocations<T extends Location>(
  user: User | { id: string; isOwner?: boolean; role?: string; companyId?: string },
  locations: T[],
  permission: LocationPermission = 'read'
): T[] {
  return locations.filter(loc => canAccessLocation(user, loc, permission));
}

/**
 * Check if user can create operations (sales, transfers) from/to a location
 */
export function canCreateOperationFromLocation(
  user: User | { id: string; isOwner?: boolean; role?: string; companyId?: string },
  location: Location
): boolean {
  if (!location.isActive) {
    return false;
  }
  return canAccessLocation(user, location, 'write');
}

/**
 * Check if user can create transfer between two locations
 */
export function canCreateTransfer(
  user: User | { id: string; isOwner?: boolean; role?: string; companyId?: string },
  fromLocation: Location,
  toLocation: Location
): boolean {
  if (!fromLocation.isActive || !toLocation.isActive) {
    return false;
  }

  const canWriteFrom = canAccessLocation(user, fromLocation, 'write');
  const canWriteTo = canAccessLocation(user, toLocation, 'write');

  return canWriteFrom && canWriteTo;
}

