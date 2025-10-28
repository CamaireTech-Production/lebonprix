// Centralized role and permission definitions

export type SystemRole = 'owner' | 'admin' | 'manager' | 'staff';
export type UIRole = 'owner' | 'magasinier' | 'gestionnaire' | 'vendeur';

export interface RolePermissions {
  canView: string[];
  canEdit: string[];
  canDelete: string[];
  canManageEmployees: string[];
  canAccessSettings: boolean;
  canAccessFinance: boolean;
  canAccessHR: boolean;
}

export const ROLE_HIERARCHY: SystemRole[] = ['owner', 'admin', 'manager', 'staff'];

export const ROLE_MAPPING: Record<SystemRole, UIRole> = {
  owner: 'owner',
  admin: 'magasinier',
  manager: 'gestionnaire',
  staff: 'vendeur'
};

export const ROLE_PERMISSIONS: Record<SystemRole, RolePermissions> = {
  owner: {
    canView: ['all'],
    canEdit: ['all'],
    canDelete: ['all'],
    canManageEmployees: ['all'],
    canAccessSettings: true,
    canAccessFinance: true,
    canAccessHR: true
  },
  admin: {
    canView: ['all'],
    canEdit: ['all'],
    canDelete: ['all-except-company'],
    canManageEmployees: ['staff', 'manager', 'admin'],
    canAccessSettings: true,
    canAccessFinance: true,
    canAccessHR: true
  },
  manager: {
    canView: ['dashboard', 'sales', 'customers', 'products', 'expenses', 'orders', 'reports'],
    canEdit: ['sales', 'customers', 'products', 'expenses', 'orders'],
    canDelete: ['sales', 'customers', 'products', 'expenses'],
    canManageEmployees: ['staff'],
    canAccessSettings: false,
    canAccessFinance: false,
    canAccessHR: false
  },
  staff: {
    canView: ['dashboard', 'sales', 'customers', 'orders'],
    canEdit: ['sales', 'customers', 'orders'],
    canDelete: ['sales', 'customers'],
    canManageEmployees: [],
    canAccessSettings: false,
    canAccessFinance: false,
    canAccessHR: false
  }
};

export function mapUIRoleToSystemRole(uiRole: UIRole): SystemRole {
  switch (uiRole) {
    case 'owner': return 'owner';
    case 'magasinier': return 'admin';
    case 'gestionnaire': return 'manager';
    case 'vendeur': return 'staff';
    default: return 'staff';
  }
}


