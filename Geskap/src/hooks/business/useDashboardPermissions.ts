import { useMemo } from 'react';
import { useRolePermissions } from './useRolePermissions';
import { useAuth } from '@contexts/AuthContext';
import { RESOURCES } from '@constants/resources';

/**
 * Dashboard section visibility settings
 * These are stored in the permission template under dashboardSections
 */
export interface DashboardSectionPermissions {
  showStats: boolean;
  showProfit: boolean;
  showExpenses: boolean;
  showCharts: boolean;
  showTopSales: boolean;
  showBestClients: boolean;
  showBestProducts: boolean;
  showLatestOrders: boolean;
  showObjectives: boolean;
}

/**
 * Default dashboard permissions (all visible for owners)
 */
const DEFAULT_OWNER_PERMISSIONS: DashboardSectionPermissions = {
  showStats: true,
  showProfit: true,
  showExpenses: true,
  showCharts: true,
  showTopSales: true,
  showBestClients: true,
  showBestProducts: true,
  showLatestOrders: true,
  showObjectives: true,
};

/**
 * Default dashboard permissions for employees without specific settings
 * (restricted by default - owner must explicitly grant access)
 */
const DEFAULT_EMPLOYEE_PERMISSIONS: DashboardSectionPermissions = {
  showStats: true,
  showProfit: false, // Sensitive financial data
  showExpenses: false, // Sensitive financial data
  showCharts: true,
  showTopSales: true,
  showBestClients: false, // May contain sensitive customer data
  showBestProducts: true,
  showLatestOrders: true,
  showObjectives: false, // Business objectives may be confidential
};

/**
 * Hook to get dashboard section visibility permissions
 *
 * Usage:
 * const { canViewStats, canViewProfit, ... } = useDashboardPermissions();
 *
 * if (!canViewProfit) {
 *   // Don't show profit section
 * }
 */
export function useDashboardPermissions() {
  const { isOwner, effectiveRole, company } = useAuth();
  const { template, canAccess, canEdit, canDelete } = useRolePermissions(company?.id);

  const permissions = useMemo(() => {
    // Owner always has full access
    const isActualOwner = isOwner || effectiveRole === 'owner';
    if (isActualOwner) {
      return DEFAULT_OWNER_PERMISSIONS;
    }

    // Check if template has dashboard section settings
    const templateDashboardSections = (template as any)?.dashboardSections;
    if (templateDashboardSections) {
      return {
        showStats: templateDashboardSections.showStats ?? true,
        showProfit: templateDashboardSections.showProfit ?? false,
        showExpenses: templateDashboardSections.showExpenses ?? false,
        showCharts: templateDashboardSections.showCharts ?? true,
        showTopSales: templateDashboardSections.showTopSales ?? true,
        showBestClients: templateDashboardSections.showBestClients ?? false,
        showBestProducts: templateDashboardSections.showBestProducts ?? true,
        showLatestOrders: templateDashboardSections.showLatestOrders ?? true,
        showObjectives: templateDashboardSections.showObjectives ?? false,
      };
    }

    // Fallback to resource-based permissions
    // If user can access finance, they can see profit/expenses
    const canAccessFinance = canAccess(RESOURCES.FINANCE);
    const canAccessCustomers = canAccess(RESOURCES.CUSTOMERS);
    const canAccessReports = canAccess(RESOURCES.REPORTS);

    return {
      showStats: true,
      showProfit: canAccessFinance,
      showExpenses: canAccessFinance,
      showCharts: true,
      showTopSales: true,
      showBestClients: canAccessCustomers,
      showBestProducts: true,
      showLatestOrders: true,
      showObjectives: canAccessReports,
    };
  }, [isOwner, effectiveRole, template, canAccess]);

  return {
    // Section visibility
    canViewStats: permissions.showStats,
    canViewProfit: permissions.showProfit,
    canViewExpenses: permissions.showExpenses,
    canViewCharts: permissions.showCharts,
    canViewTopSales: permissions.showTopSales,
    canViewBestClients: permissions.showBestClients,
    canViewBestProducts: permissions.showBestProducts,
    canViewLatestOrders: permissions.showLatestOrders,
    canViewObjectives: permissions.showObjectives,

    // Raw permissions object
    permissions,

    // Action permissions (from base hook)
    canEdit,
    canDelete,
    canAccess,

    // Is owner check
    isOwner: isOwner || effectiveRole === 'owner',
  };
}

export default useDashboardPermissions;
