import { ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface RoleBasedAccessProps {
  children: ReactNode;
  allowedRoles: string[];
  companyId?: string;
  fallback?: ReactNode;
}

/**
 * Composant pour contrôler l'accès basé sur les rôles
 */
export default function RoleBasedAccess({ 
  children, 
  allowedRoles, 
  companyId,
  fallback = null 
}: RoleBasedAccessProps) {
  const { currentUser } = useAuth();

  // Si pas d'utilisateur connecté
  if (!currentUser) {
    return <>{fallback}</>;
  }

  // Si pas de company spécifiée, vérifier dans les companies de l'utilisateur
  if (!companyId) {
    // Vérifier si l'utilisateur a au moins une company avec un rôle autorisé
    const hasAuthorizedRole = currentUser.companies?.some(company => 
      allowedRoles.includes(company.role)
    );

    if (!hasAuthorizedRole) {
      return <>{fallback}</>;
    }
  } else {
    // Vérifier le rôle dans la company spécifiée
    const companyRole = currentUser.companies?.find(c => c.companyId === companyId)?.role;
    
    if (!companyRole || !allowedRoles.includes(companyRole)) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}

/**
 * Hook pour vérifier les permissions d'un utilisateur
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

  return {
    hasRole,
    canView,
    canEdit,
    canDelete,
    canManageEmployees,
    getCurrentRole: () => getCurrentRole(companyId),
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

/**
 * Composant pour afficher un message d'accès refusé
 */
export function AccessDenied({ message = "Vous n'avez pas les permissions nécessaires pour accéder à cette section." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Accès refusé</h3>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}
