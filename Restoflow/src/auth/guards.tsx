import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole, RestaurantPermission, AdminPermission } from './types';
import { permissionService } from './permissions';
import LoadingSpinner from '../components/ui/LoadingSpinner';

// Base guard component
interface GuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Authentication guard
export const AuthGuard: React.FC<GuardProps> = ({ children, fallback }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return fallback || <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// Role-based guard
interface RoleGuardProps extends GuardProps {
  requiredRole: UserRole;
  redirectTo?: string;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ 
  children, 
  requiredRole, 
  redirectTo = '/unauthorized',
  fallback 
}) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.role !== requiredRole) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

// Permission-based guard
interface PermissionGuardProps extends GuardProps {
  requiredPermissions: (RestaurantPermission | AdminPermission)[];
  requireAll?: boolean; // If true, user must have ALL permissions; if false, user needs ANY permission
  redirectTo?: string;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({ 
  children, 
  requiredPermissions, 
  requireAll = true,
  redirectTo = '/unauthorized',
  fallback 
}) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check permissions
  const hasRequiredPermissions = requireAll
    ? requiredPermissions.every(permission => {
        const check = permissionService.checkPermission(user, permission);
        return check.hasPermission;
      })
    : requiredPermissions.some(permission => {
        const check = permissionService.checkPermission(user, permission);
        return check.hasPermission;
      });

  if (!hasRequiredPermissions) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

// Route-based guard
interface RouteGuardProps extends GuardProps {
  route: string;
  redirectTo?: string;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({ 
  children, 
  route, 
  redirectTo = '/unauthorized',
  fallback 
}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const canAccess = permissionService.canAccessRoute(user, route);
  
  if (!canAccess) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

// Admin-specific guard
export const AdminGuard: React.FC<GuardProps> = ({ children, fallback }) => {
  return (
    <RoleGuard requiredRole="admin" fallback={fallback}>
      {children}
    </RoleGuard>
  );
};

// Super admin guard
export const SuperAdminGuard: React.FC<GuardProps> = ({ children, fallback }) => {
  return (
    <RoleGuard requiredRole="super_admin" fallback={fallback}>
      {children}
    </RoleGuard>
  );
};

// Restaurant guard
export const RestaurantGuard: React.FC<GuardProps> = ({ children, fallback }) => {
  return (
    <RoleGuard requiredRole="restaurant" fallback={fallback}>
      {children}
    </RoleGuard>
  );
};

// Specific permission guards
export const MenuManagementGuard: React.FC<GuardProps> = ({ children, fallback }) => {
  return (
    <PermissionGuard 
      requiredPermissions={['manage_menu']} 
      fallback={fallback}
    >
      {children}
    </PermissionGuard>
  );
};

export const OrderManagementGuard: React.FC<GuardProps> = ({ children, fallback }) => {
  return (
    <PermissionGuard 
      requiredPermissions={['manage_orders']} 
      fallback={fallback}
    >
      {children}
    </PermissionGuard>
  );
};

export const RestaurantManagementGuard: React.FC<GuardProps> = ({ children, fallback }) => {
  return (
    <PermissionGuard 
      requiredPermissions={['manage_restaurants']} 
      fallback={fallback}
    >
      {children}
    </PermissionGuard>
  );
};

// Higher-order component for route protection
export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>,
  guardProps?: {
    requiredRole?: UserRole;
    requiredPermissions?: (RestaurantPermission | AdminPermission)[];
    requireAll?: boolean;
    redirectTo?: string;
  }
) {
  return function GuardedComponent(props: P) {
    const { user, isLoading } = useAuth();

    if (isLoading) {
      return <LoadingSpinner />;
    }

    if (!user) {
      return <Navigate to="/login" replace />;
    }

    // Check role if specified
    if (guardProps?.requiredRole && user.role !== guardProps.requiredRole) {
      return <Navigate to={guardProps.redirectTo || '/unauthorized'} replace />;
    }

    // Check permissions if specified
    if (guardProps?.requiredPermissions) {
      const hasRequiredPermissions = guardProps.requireAll
        ? guardProps.requiredPermissions.every(permission => {
            const check = permissionService.checkPermission(user, permission);
            return check.hasPermission;
          })
        : guardProps.requiredPermissions.some(permission => {
            const check = permissionService.checkPermission(user, permission);
            return check.hasPermission;
          });

      if (!hasRequiredPermissions) {
        return <Navigate to={guardProps.redirectTo || '/unauthorized'} replace />;
      }
    }

    return <Component {...props} />;
  };
}

// Hook for permission checking
export function usePermission(permission: RestaurantPermission | AdminPermission) {
  const { user } = useAuth();
  
  if (!user) {
    return { hasPermission: false, reason: 'Not authenticated' };
  }
  
  return permissionService.checkPermission(user, permission);
}

// Hook for role checking
export function useRole(role: UserRole) {
  const { user } = useAuth();
  
  if (!user) {
    return false;
  }
  
  return user.role === role;
}

// Hook for route access checking
export function useRouteAccess(route: string) {
  const { user } = useAuth();
  
  if (!user) {
    return false;
  }
  
  return permissionService.canAccessRoute(user, route);
}

// Unauthorized page component
export const UnauthorizedPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Access Denied</h2>
          <p className="mt-2 text-sm text-gray-600">
            You don't have permission to access this page.
          </p>
          <div className="mt-6">
            <button
              onClick={() => window.history.back()}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

