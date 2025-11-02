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

// Company-specific reusable permission templates
export interface PermissionTemplate {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  permissions: RolePermissions;
  createdBy: string; // owner uid
  createdAt: import('./models').Timestamp; // Firestore Timestamp
  updatedAt?: import('./models').Timestamp; // Firestore Timestamp
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

// Predefined templates that companies can adopt
export function getDefaultPermissionTemplates(): Array<Pick<PermissionTemplate, 'name' | 'description' | 'permissions'>> {
  return [
    {
      name: 'Finance Manager',
      description: 'Access to finance and reports with editing capabilities',
      permissions: {
        canView: ['dashboard', 'sales', 'finance', 'reports', 'orders'],
        canEdit: ['finance', 'reports'],
        canDelete: ['finance'],
        canManageEmployees: [],
        canAccessSettings: false,
        canAccessFinance: true,
        canAccessHR: false
      }
    },
    {
      name: 'Sales Manager',
      description: 'Manage sales, products and customers, view reports',
      permissions: {
        canView: ['dashboard', 'sales', 'products', 'customers', 'reports', 'orders'],
        canEdit: ['sales', 'products', 'customers', 'orders'],
        canDelete: ['sales', 'products', 'customers'],
        canManageEmployees: [],
        canAccessSettings: false,
        canAccessFinance: false,
        canAccessHR: false
      }
    },
    {
      name: 'Inventory Clerk',
      description: 'Manage products and inventory only',
      permissions: {
        canView: ['products', 'categories'],
        canEdit: ['products', 'categories'],
        canDelete: ['products'],
        canManageEmployees: [],
        canAccessSettings: false,
        canAccessFinance: false,
        canAccessHR: false
      }
    },
    {
      name: 'Cashier',
      description: 'Sales and customers operations',
      permissions: {
        canView: ['dashboard', 'sales', 'customers', 'orders'],
        canEdit: ['sales', 'customers', 'orders'],
        canDelete: ['sales'],
        canManageEmployees: [],
        canAccessSettings: false,
        canAccessFinance: false,
        canAccessHR: false
      }
    },
    {
      name: 'Store Manager',
      description: 'Full store operations without settings and HR',
      permissions: {
        canView: ['all'],
        canEdit: ['sales', 'products', 'customers', 'orders', 'expenses'],
        canDelete: ['sales', 'products', 'customers', 'expenses'],
        canManageEmployees: [],
        canAccessSettings: false,
        canAccessFinance: true,
        canAccessHR: false
      }
    }
  ];
}


