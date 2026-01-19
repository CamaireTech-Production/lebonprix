/**
 * Resource constants for permission system
 * 
 * This file defines all available resources (sections) in the application.
 * Used for clean code and consistency across frontend and backend.
 * 
 * When adding a new section:
 * 1. Add the resource name here
 * 2. Add it to the RESOURCE_LABELS map
 * 3. Update the navigation items in Sidebar.tsx
 * 4. Update the routes in App.tsx if needed
 */

// Core resources
export const RESOURCES = {
  // Main sections
  DASHBOARD: 'dashboard',
  SALES: 'sales',
  ORDERS: 'orders',
  PRODUCTS: 'products',
  CUSTOMERS: 'customers',
  CATEGORIES: 'categories',
  SUPPLIERS: 'suppliers',
  EXPENSES: 'expenses',
  MAGASIN: 'magasin',
  PRODUCTIONS: 'productions',

  // Sub-resources (Granular permissions)
  // Products sub-resources
  PRODUCTS_CATEGORIES: 'products_categories', // Product categories
  PRODUCTS_STOCKS: 'products_stocks', // Product stock management

  // Magasin sub-resources
  MAGASIN_CATEGORIES: 'magasin_categories', // Matiere categories
  MAGASIN_STOCKS: 'magasin_stocks', // Matiere stock management

  // Production sub-resources
  PRODUCTIONS_FLOWS: 'productions_flows', // Production flows
  PRODUCTIONS_STEPS: 'productions_steps', // Production flow steps
  PRODUCTIONS_CATEGORIES: 'productions_categories', // Production categories
  PRODUCTIONS_CHARGES: 'productions_charges', // Production charges

  // Expense sub-resources
  EXPENSE_CATEGORIES: 'expense_categories', // Expense categories

  // Management sections
  FINANCE: 'finance',
  REPORTS: 'reports',
  HR: 'hr', // Legacy - kept for backward compatibility with existing templates
  PERMISSIONS: 'permissions', // Renamed from HR - manages invitations & permission templates
  HUMAN_RESOURCES: 'human_resources', // True HR - manages HR actors (gardien, caissier, etc.)
  SETTINGS: 'settings',

  // Special values
  ALL: 'all', // Grants access to all resources
} as const;

// Type for resource values
export type Resource = typeof RESOURCES[keyof typeof RESOURCES];

// Human-readable labels for resources (for UI display)
export const RESOURCE_LABELS: Record<Resource, string> = {
  [RESOURCES.DASHBOARD]: 'Dashboard',
  [RESOURCES.SALES]: 'Ventes',
  [RESOURCES.ORDERS]: 'Commandes',
  [RESOURCES.PRODUCTS]: 'Produits',
  [RESOURCES.CUSTOMERS]: 'Clients',
  [RESOURCES.CATEGORIES]: 'Catégories',
  [RESOURCES.SUPPLIERS]: 'Fournisseurs',
  [RESOURCES.EXPENSES]: 'Dépenses',
  [RESOURCES.MAGASIN]: 'Magasin',
  [RESOURCES.PRODUCTIONS]: 'Productions',
  [RESOURCES.PRODUCTS_CATEGORIES]: 'Catégories Produits',
  [RESOURCES.PRODUCTS_STOCKS]: 'Stocks Produits',
  [RESOURCES.MAGASIN_CATEGORIES]: 'Catégories Matières',
  [RESOURCES.MAGASIN_STOCKS]: 'Stocks Matières',
  [RESOURCES.PRODUCTIONS_FLOWS]: 'Flux de Production',
  [RESOURCES.PRODUCTIONS_STEPS]: 'Étapes de Production',
  [RESOURCES.PRODUCTIONS_CATEGORIES]: 'Catégories Production',
  [RESOURCES.PRODUCTIONS_CHARGES]: 'Charges Production',
  [RESOURCES.EXPENSE_CATEGORIES]: 'Catégories Dépenses',
  [RESOURCES.FINANCE]: 'Finance',
  [RESOURCES.REPORTS]: 'Rapports',
  [RESOURCES.HR]: 'RH (Legacy)', // Legacy - kept for backward compatibility
  [RESOURCES.PERMISSIONS]: 'Permissions & Invitations',
  [RESOURCES.HUMAN_RESOURCES]: 'Ressources Humaines',
  [RESOURCES.SETTINGS]: 'Paramètres',
  [RESOURCES.ALL]: 'Tout',
};

// Array of all resources (excluding 'all')
export const ALL_RESOURCES: Resource[] = [
  RESOURCES.DASHBOARD,
  RESOURCES.SALES,
  RESOURCES.ORDERS,
  RESOURCES.PRODUCTS,
  RESOURCES.CUSTOMERS,
  RESOURCES.CATEGORIES,
  RESOURCES.SUPPLIERS,
  RESOURCES.EXPENSES,
  RESOURCES.MAGASIN,
  RESOURCES.PRODUCTIONS,
  RESOURCES.PRODUCTS_CATEGORIES,
  RESOURCES.PRODUCTS_STOCKS,
  RESOURCES.MAGASIN_CATEGORIES,
  RESOURCES.MAGASIN_STOCKS,
  RESOURCES.PRODUCTIONS_FLOWS,
  RESOURCES.PRODUCTIONS_STEPS,
  RESOURCES.PRODUCTIONS_CATEGORIES,
  RESOURCES.PRODUCTIONS_CHARGES,
  RESOURCES.EXPENSE_CATEGORIES,
  RESOURCES.FINANCE,
  RESOURCES.REPORTS,
  RESOURCES.PERMISSIONS,
  RESOURCES.HUMAN_RESOURCES,
  RESOURCES.SETTINGS,
];

// Legacy resources array (for backward compatibility with existing templates)
export const LEGACY_RESOURCES: Resource[] = [
  RESOURCES.HR, // Maps to PERMISSIONS
];

// Resources that require special access (legacy support - will be removed)
// These are now just regular resources in canView array
export const SPECIAL_RESOURCES = {
  FINANCE: RESOURCES.FINANCE,
  HR: RESOURCES.HR, // Legacy - maps to PERMISSIONS
  PERMISSIONS: RESOURCES.PERMISSIONS,
  HUMAN_RESOURCES: RESOURCES.HUMAN_RESOURCES,
  SETTINGS: RESOURCES.SETTINGS,
} as const;

/**
 * Map legacy resource names to new ones
 * Used for backward compatibility with existing permission templates
 */
export function mapLegacyResource(resource: string): string {
  if (resource === RESOURCES.HR) {
    return RESOURCES.PERMISSIONS;
  }
  return resource;
}

/**
 * Check if a resource is valid
 */
export function isValidResource(resource: string): resource is Resource {
  return ALL_RESOURCES.includes(resource as Resource) || resource === RESOURCES.ALL;
}

/**
 * Get resource label for display
 */
export function getResourceLabel(resource: Resource): string {
  return RESOURCE_LABELS[resource] || resource;
}

