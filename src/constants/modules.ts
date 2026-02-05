/**
 * Module Constants
 * Defines available modules and their mapping to plans
 */

import type { ModuleName } from '@/types/models';

/**
 * All available modules in the system
 */
export const ALL_MODULES: ModuleName[] = [
    'PRODUCTION',
    'MULTI_LOCATION',
    'MAGASIN',
    'STOCK_TRANSFERS',
    'HR',
    'WAREHOUSE',
    'ADVANCED_PERMISSIONS'
];

/**
 * Modules included in each plan
 */
export const PLAN_MODULES: Record<'starter' | 'enterprise', ModuleName[]> = {
    starter: [], // Starter has no advanced modules
    enterprise: ALL_MODULES // Enterprise has all modules
};

/**
 * Module display information for UI
 */
export const MODULE_INFO: Record<ModuleName, { name: string; description: string; icon: string }> = {
    PRODUCTION: {
        name: 'Production',
        description: 'Manufacturing flows, raw material consumption, and production tracking',
        icon: 'Factory'
    },
    MULTI_LOCATION: {
        name: 'Multi-Location',
        description: 'Manage multiple shops and locations',
        icon: 'Store'
    },
    MAGASIN: {
        name: 'Raw Materials',
        description: 'Raw materials warehouse and inventory',
        icon: 'Warehouse'
    },
    STOCK_TRANSFERS: {
        name: 'Stock Transfers',
        description: 'Transfer products between shops and warehouses',
        icon: 'ArrowRight'
    },
    HR: {
        name: 'Human Resources',
        description: 'Employee management, payroll, and schedules',
        icon: 'Briefcase'
    },
    WAREHOUSE: {
        name: 'Product Warehouse',
        description: 'Central product warehouse management',
        icon: 'Package'
    },
    ADVANCED_PERMISSIONS: {
        name: 'Advanced Permissions',
        description: 'Granular role-based access control',
        icon: 'Shield'
    }
};

/**
 * Get modules for a given plan type
 */
export const getModulesForPlan = (planType: 'starter' | 'enterprise'): ModuleName[] => {
    return PLAN_MODULES[planType] || [];
};

/**
 * Check if a module is available for a plan
 */
export const isModuleInPlan = (moduleName: ModuleName, planType: 'starter' | 'enterprise'): boolean => {
    return PLAN_MODULES[planType].includes(moduleName);
};
