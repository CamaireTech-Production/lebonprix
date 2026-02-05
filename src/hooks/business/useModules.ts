/**
 * useModules Hook
 * Provides module checking utilities based on company plan and active modules
 */

import { useAuth } from '@/contexts/AuthContext';
import type { ModuleName } from '@/types/models';
import { PLAN_MODULES } from '@/constants/modules';

export interface UseModulesReturn {
    /** Check if a specific module is available */
    hasModule: (moduleName: ModuleName) => boolean;
    /** Check if company is on starter plan */
    isStarter: boolean;
    /** Check if company is on enterprise plan */
    isEnterprise: boolean;
    /** Get the current plan type */
    planType: 'starter' | 'enterprise';
    /** Get all active modules for current company */
    activeModules: ModuleName[];
    /** Get the default shop ID */
    defaultShopId: string | undefined;
    /** Get the default warehouse ID (enterprise only) */
    defaultWarehouseId: string | undefined;
}

/**
 * Hook for checking module availability based on company plan
 * 
 * @example
 * const { hasModule, isStarter } = useModules();
 * 
 * // Check if production module is available
 * if (hasModule('PRODUCTION')) {
 *   // Show production features
 * }
 * 
 * // Check plan type
 * if (isStarter) {
 *   // Use default shop only
 * }
 */
export const useModules = (): UseModulesReturn => {
    const { company } = useAuth();

    // Default to enterprise for backward compatibility (existing companies)
    const planType = company?.planType || 'enterprise';
    const isStarter = planType === 'starter';
    const isEnterprise = planType === 'enterprise';

    // Get active modules: use company.modules if set, otherwise use plan defaults
    const activeModules: ModuleName[] = company?.modules || PLAN_MODULES[planType] || [];

    /**
     * Check if a module is available for the current company
     * - Enterprise plans have all modules by default
     * - Starter plans have no advanced modules
     * - Admin can override by setting company.modules
     */
    const hasModule = (moduleName: ModuleName): boolean => {
        // If company has custom modules set, use those
        if (company?.modules && company.modules.length > 0) {
            return company.modules.includes(moduleName);
        }

        // Otherwise, check plan-based modules
        if (isEnterprise) {
            return true; // Enterprise has all modules
        }

        // Starter has no advanced modules
        return false;
    };

    return {
        hasModule,
        isStarter,
        isEnterprise,
        planType,
        activeModules,
        defaultShopId: company?.defaultShopId,
        defaultWarehouseId: company?.defaultWarehouseId
    };
};

export default useModules;
