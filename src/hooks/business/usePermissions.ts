import { useAuth } from '@contexts/AuthContext';

/**
 * Hook pour gérer les permissions d'un utilisateur
 */
export function usePermissions(companyId?: string) {
  const { currentUser } = useAuth();

  const hasRole = (roles: string[]): boolean => {
    if (!currentUser) return false;

    if (!companyId) {
      // Vérifier dans toutes les companies
      return currentUser.companies?.some(company => 
        roles.includes(company.role)
      ) || false;
    }

    // Vérifier dans la company spécifiée
    const companyRole = currentUser.companies?.find(c => c.companyId === companyId)?.role;
    return companyRole ? roles.includes(companyRole) : false;
  };

  const canView = (resource: string): boolean => {
    if (!currentUser) return false;

    const role = getCurrentRole(companyId);
    if (!role) return false;

    const permissions = getRolePermissions(role);
    return permissions.canView.includes('all') || permissions.canView.includes(resource);
  };

  const canEdit = (resource: string): boolean => {
    if (!currentUser) return false;

    const role = getCurrentRole(companyId);
    if (!role) return false;

    const permissions = getRolePermissions(role);
    return permissions.canEdit.includes('all') || permissions.canEdit.includes(resource);
  };

  const canDelete = (resource: string): boolean => {
    if (!currentUser) return false;

    const role = getCurrentRole(companyId);
    if (!role) return false;

    const permissions = getRolePermissions(role);
    return permissions.canDelete.includes('all') || permissions.canDelete.includes(resource);
  };

  const canManageEmployees = (targetRole?: string): boolean => {
    if (!currentUser) return false;

    const role = getCurrentRole(companyId);
    if (!role) return false;

    const permissions = getRolePermissions(role);
    
    if (targetRole) {
      return permissions.canManageEmployees.includes('all') || 
             permissions.canManageEmployees.includes(targetRole);
    }

    return permissions.canManageEmployees.length > 0;
  };

  const getCurrentRole = (companyId?: string): string | null => {
    if (!currentUser) return null;

    if (!companyId) {
      // Retourner le rôle le plus élevé
      const roles = currentUser.companies?.map(c => c.role) || [];
      return getHighestRole(roles);
    }

    // Retourner le rôle dans la company spécifiée
    return currentUser.companies?.find(c => c.companyId === companyId)?.role || null;
  };

  const getHighestRole = (roles: string[]): string => {
    const roleHierarchy = ['owner', 'admin', 'manager', 'staff'];
    
    for (const role of roleHierarchy) {
      if (roles.includes(role)) {
        return role;
      }
    }
    
    return 'staff';
  };

  const getRoleLabel = (role: string): string => {
    const labels = {
      owner: 'Propriétaire',
      admin: 'Administrateur',
      manager: 'Manager',
      staff: 'Employé'
    };
    return labels[role as keyof typeof labels] || role;
  };

  const getRoleBadgeColor = (role: string): string => {
    const colors = {
      owner: 'bg-purple-100 text-purple-800',
      admin: 'bg-red-100 text-red-800',
      manager: 'bg-blue-100 text-blue-800',
      staff: 'bg-green-100 text-green-800'
    };
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return {
    hasRole,
    canView,
    canEdit,
    canDelete,
    canManageEmployees,
    getCurrentRole: () => getCurrentRole(companyId),
    getRoleLabel,
    getRoleBadgeColor,
    isOwner: hasRole(['owner']),
    isAdmin: hasRole(['owner', 'admin']),
    isManager: hasRole(['owner', 'admin', 'manager']),
    isStaff: hasRole(['owner', 'admin', 'manager', 'staff'])
  };
}

/**
 * Définit les permissions par rôle
 */
function getRolePermissions(role: string) {
  const permissions = {
    owner: {
      canView: ['all'],
      canEdit: ['all'],
      canDelete: ['all'],
      canManageEmployees: ['all']
    },
    admin: {
      canView: ['all'],
      canEdit: ['all'],
      canDelete: ['all-except-company'],
      canManageEmployees: ['staff', 'manager', 'admin']
    },
    manager: {
      canView: ['dashboard', 'sales', 'customers', 'products', 'expenses'],
      canEdit: ['sales', 'customers', 'products', 'expenses'],
      canDelete: ['sales', 'customers', 'products', 'expenses'],
      canManageEmployees: ['staff']
    },
    staff: {
      canView: ['dashboard', 'sales', 'customers'],
      canEdit: ['sales', 'customers'],
      canDelete: ['sales', 'customers'],
      canManageEmployees: []
    }
  };

  return permissions[role as keyof typeof permissions] || permissions.staff;
}

export default usePermissions;
