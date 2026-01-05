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
  
  // Management sections
  FINANCE: 'finance',
  REPORTS: 'reports',
  HR: 'hr',
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
  [RESOURCES.FINANCE]: 'Finance',
  [RESOURCES.REPORTS]: 'Rapports',
  [RESOURCES.HR]: 'RH',
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
  RESOURCES.FINANCE,
  RESOURCES.REPORTS,
  RESOURCES.HR,
  RESOURCES.SETTINGS,
];

// Resources that require special access (legacy support - will be removed)
// These are now just regular resources in canView array
export const SPECIAL_RESOURCES = {
  FINANCE: RESOURCES.FINANCE,
  HR: RESOURCES.HR,
  SETTINGS: RESOURCES.SETTINGS,
} as const;

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

