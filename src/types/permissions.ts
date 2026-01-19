// Centralized role and permission definitions
import { RESOURCES } from '../constants/resources';

export type SystemRole = 'owner' | 'admin' | 'manager' | 'staff';
export type UIRole = 'owner' | 'magasinier' | 'gestionnaire' | 'vendeur';

export interface RolePermissions {
  canView: string[]; // Resources user can view (e.g., ['dashboard', 'finance', 'reports'])
  canCreate: string[]; // Resources user can create/add (e.g., ['products', 'sales', 'customers'])
  canEdit: string[]; // Resources user can edit
  canDelete: string[]; // Resources user can delete
  canManageEmployees: string[]; // Roles user can manage (e.g., ['staff', 'manager'])
  // Note: canAccessFinance, canAccessHR, canAccessSettings removed - use canView array instead
  // Example: canView: ['finance'] instead of canAccessFinance: true
}

// Company-specific reusable permission templates
export interface PermissionTemplate {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  baseRole?: 'staff' | 'manager' | 'admin'; // Optional: label for compatibility, auto-detected if not provided
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
    canView: [RESOURCES.ALL],
    canCreate: [RESOURCES.ALL],
    canEdit: [RESOURCES.ALL],
    canDelete: [RESOURCES.ALL],
    canManageEmployees: [RESOURCES.ALL],
  },
  admin: {
    canView: [RESOURCES.ALL],
    canCreate: [RESOURCES.ALL],
    canEdit: [RESOURCES.ALL],
    canDelete: ['all-except-company'],
    canManageEmployees: ['staff', 'manager', 'admin'],
  },
  manager: {
    canView: [RESOURCES.DASHBOARD, RESOURCES.SALES, RESOURCES.CUSTOMERS, RESOURCES.PRODUCTS, RESOURCES.CATEGORIES, RESOURCES.SUPPLIERS, RESOURCES.EXPENSES, RESOURCES.ORDERS, RESOURCES.REPORTS],
    canCreate: [RESOURCES.SALES, RESOURCES.CUSTOMERS, RESOURCES.PRODUCTS, RESOURCES.CATEGORIES, RESOURCES.SUPPLIERS, RESOURCES.EXPENSES, RESOURCES.ORDERS],
    canEdit: [RESOURCES.SALES, RESOURCES.CUSTOMERS, RESOURCES.PRODUCTS, RESOURCES.CATEGORIES, RESOURCES.SUPPLIERS, RESOURCES.EXPENSES, RESOURCES.ORDERS],
    canDelete: [RESOURCES.SALES, RESOURCES.CUSTOMERS, RESOURCES.PRODUCTS, RESOURCES.EXPENSES],
    canManageEmployees: ['staff'],
  },
  staff: {
    canView: [RESOURCES.DASHBOARD, RESOURCES.SALES, RESOURCES.CUSTOMERS, RESOURCES.ORDERS],
    canCreate: [RESOURCES.SALES, RESOURCES.CUSTOMERS, RESOURCES.ORDERS],
    canEdit: [RESOURCES.SALES, RESOURCES.CUSTOMERS, RESOURCES.ORDERS],
    canDelete: [RESOURCES.SALES, RESOURCES.CUSTOMERS],
    canManageEmployees: [],
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
export function getDefaultPermissionTemplates(): Array<Pick<PermissionTemplate, 'name' | 'description' | 'baseRole' | 'permissions'>> {
  return [
    {
      name: 'Finance Manager',
      description: 'Access to finance and reports with editing capabilities',
      // baseRole will be auto-detected as 'manager'
      permissions: {
        canView: [RESOURCES.DASHBOARD, RESOURCES.SALES, RESOURCES.FINANCE, RESOURCES.REPORTS, RESOURCES.ORDERS],
        canCreate: [RESOURCES.FINANCE, RESOURCES.REPORTS],
        canEdit: [RESOURCES.FINANCE, RESOURCES.REPORTS],
        canDelete: [RESOURCES.FINANCE],
        canManageEmployees: [],
      }
    },
    {
      name: 'Sales Manager',
      description: 'Manage sales, products and customers, view reports',
      // baseRole will be auto-detected as 'manager'
      permissions: {
        canView: [RESOURCES.DASHBOARD, RESOURCES.SALES, RESOURCES.PRODUCTS, RESOURCES.CUSTOMERS, RESOURCES.REPORTS, RESOURCES.ORDERS],
        canCreate: [RESOURCES.SALES, RESOURCES.PRODUCTS, RESOURCES.CUSTOMERS, RESOURCES.ORDERS],
        canEdit: [RESOURCES.SALES, RESOURCES.PRODUCTS, RESOURCES.CUSTOMERS, RESOURCES.ORDERS],
        canDelete: [RESOURCES.SALES, RESOURCES.PRODUCTS, RESOURCES.CUSTOMERS],
        canManageEmployees: [],
      }
    },
    {
      name: 'Inventory Clerk',
      description: 'Manage products and inventory only',
      // baseRole will be auto-detected as 'staff'
      permissions: {
        canView: [RESOURCES.PRODUCTS, RESOURCES.PRODUCTS_CATEGORIES, RESOURCES.PRODUCTS_STOCKS, RESOURCES.CATEGORIES],
        canCreate: [RESOURCES.PRODUCTS, RESOURCES.PRODUCTS_CATEGORIES, RESOURCES.PRODUCTS_STOCKS],
        canEdit: [RESOURCES.PRODUCTS, RESOURCES.PRODUCTS_CATEGORIES, RESOURCES.PRODUCTS_STOCKS],
        canDelete: [RESOURCES.PRODUCTS, RESOURCES.PRODUCTS_CATEGORIES],
        canManageEmployees: [],
      }
    },
    {
      name: 'Cashier',
      description: 'Sales and customers operations',
      // baseRole will be auto-detected as 'staff'
      permissions: {
        canView: [RESOURCES.DASHBOARD, RESOURCES.SALES, RESOURCES.CUSTOMERS, RESOURCES.ORDERS, RESOURCES.PRODUCTS],
        canCreate: [RESOURCES.SALES, RESOURCES.CUSTOMERS, RESOURCES.ORDERS],
        canEdit: [RESOURCES.SALES, RESOURCES.CUSTOMERS, RESOURCES.ORDERS],
        canDelete: [RESOURCES.SALES],
        canManageEmployees: [],
      }
    },
    {
      name: 'Store Manager',
      description: 'Full store operations without settings and HR',
      // baseRole will be auto-detected as 'manager'
      permissions: {
        canView: [RESOURCES.ALL],
        canCreate: [RESOURCES.SALES, RESOURCES.PRODUCTS, RESOURCES.CUSTOMERS, RESOURCES.ORDERS, RESOURCES.EXPENSES, RESOURCES.PRODUCTS_STOCKS, RESOURCES.PRODUCTS_CATEGORIES],
        canEdit: [RESOURCES.SALES, RESOURCES.PRODUCTS, RESOURCES.CUSTOMERS, RESOURCES.ORDERS, RESOURCES.EXPENSES, RESOURCES.PRODUCTS_STOCKS, RESOURCES.PRODUCTS_CATEGORIES],
        canDelete: [RESOURCES.SALES, RESOURCES.PRODUCTS, RESOURCES.CUSTOMERS, RESOURCES.EXPENSES, RESOURCES.PRODUCTS_CATEGORIES],
        canManageEmployees: [],
      }
    },
    {
      name: 'Production Supervisor',
      description: 'Manage productions, flows, steps, and materials',
      // baseRole will be auto-detected as 'manager'
      permissions: {
        canView: [RESOURCES.PRODUCTIONS, RESOURCES.PRODUCTIONS_FLOWS, RESOURCES.PRODUCTIONS_STEPS, RESOURCES.PRODUCTIONS_CATEGORIES, RESOURCES.PRODUCTIONS_CHARGES, RESOURCES.MAGASIN, RESOURCES.MAGASIN_STOCKS, RESOURCES.PRODUCTS],
        canCreate: [RESOURCES.PRODUCTIONS, RESOURCES.PRODUCTIONS_FLOWS, RESOURCES.PRODUCTIONS_STEPS, RESOURCES.PRODUCTIONS_CATEGORIES, RESOURCES.PRODUCTIONS_CHARGES],
        canEdit: [RESOURCES.PRODUCTIONS, RESOURCES.PRODUCTIONS_FLOWS, RESOURCES.PRODUCTIONS_STEPS, RESOURCES.PRODUCTIONS_CATEGORIES, RESOURCES.PRODUCTIONS_CHARGES],
        canDelete: [RESOURCES.PRODUCTIONS, RESOURCES.PRODUCTIONS_FLOWS, RESOURCES.PRODUCTIONS_STEPS],
        canManageEmployees: [],
      }
    },
    {
      name: 'Warehouse Clerk',
      description: 'Manage raw materials (matières) and warehouse stocks only',
      // baseRole will be auto-detected as 'staff'
      permissions: {
        canView: [RESOURCES.MAGASIN, RESOURCES.MAGASIN_CATEGORIES, RESOURCES.MAGASIN_STOCKS],
        canCreate: [RESOURCES.MAGASIN, RESOURCES.MAGASIN_CATEGORIES, RESOURCES.MAGASIN_STOCKS],
        canEdit: [RESOURCES.MAGASIN, RESOURCES.MAGASIN_CATEGORIES, RESOURCES.MAGASIN_STOCKS],
        canDelete: [],
        canManageEmployees: [],
      }
    },
    {
      name: 'HR Manager',
      description: 'Manage human resources actors and employee data',
      // baseRole will be auto-detected as 'manager'
      permissions: {
        canView: [RESOURCES.HUMAN_RESOURCES, RESOURCES.DASHBOARD, RESOURCES.REPORTS],
        canCreate: [RESOURCES.HUMAN_RESOURCES],
        canEdit: [RESOURCES.HUMAN_RESOURCES],
        canDelete: [],
        canManageEmployees: [],
      }
    },
    {
      name: 'Admin Assistant',
      description: 'Manage permissions, invitations, and HR data',
      // baseRole will be auto-detected as 'admin'
      permissions: {
        canView: [RESOURCES.PERMISSIONS, RESOURCES.HUMAN_RESOURCES, RESOURCES.DASHBOARD],
        canCreate: [RESOURCES.PERMISSIONS, RESOURCES.HUMAN_RESOURCES],
        canEdit: [RESOURCES.PERMISSIONS, RESOURCES.HUMAN_RESOURCES],
        canDelete: [],
        canManageEmployees: [],
      }
    },
    {
      name: 'Finance Officer',
      description: 'View operations and manage expenses only',
      // baseRole will be auto-detected as 'manager'
      permissions: {
        canView: [RESOURCES.FINANCE, RESOURCES.REPORTS, RESOURCES.SALES, RESOURCES.EXPENSES, RESOURCES.EXPENSE_CATEGORIES, RESOURCES.PRODUCTS, RESOURCES.DASHBOARD],
        canCreate: [RESOURCES.EXPENSES, RESOURCES.EXPENSE_CATEGORIES],
        canEdit: [RESOURCES.EXPENSES, RESOURCES.EXPENSE_CATEGORIES],
        canDelete: [],
        canManageEmployees: [],
      }
    },
    {
      name: 'Stock Auditor',
      description: 'View stocks and inventory without modifications',
      // baseRole will be auto-detected as 'staff'
      permissions: {
        canView: [RESOURCES.PRODUCTS_STOCKS, RESOURCES.MAGASIN_STOCKS, RESOURCES.PRODUCTS, RESOURCES.MAGASIN, RESOURCES.REPORTS],
        canCreate: [],
        canEdit: [],
        canDelete: [],
        canManageEmployees: [],
      }
    }
  ];
}


