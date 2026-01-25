import { 
  User, 
  RestaurantUser, 
  AdminUser, 
  RestaurantPermission, 
  AdminPermission, 
  PermissionCheck,
  UserRole
} from './types';

export class PermissionService {
  checkPermission(user: User, permission: RestaurantPermission | AdminPermission): PermissionCheck {
    if (!user.isActive) {
      return {
        hasPermission: false,
        reason: 'User account is inactive'
      };
    }

    // Check role-based permissions
    if (user.role === 'restaurant') {
      return this.checkRestaurantPermission(user as RestaurantUser, permission);
    } else if (user.role === 'admin' || user.role === 'super_admin') {
      return this.checkAdminPermission(user as AdminUser, permission);
    }

    return {
      hasPermission: false,
      reason: 'Invalid user role'
    };
  }

  checkRole(user: User, role: UserRole): boolean {
    return user.role === role;
  }

  getUserPermissions(user: User): (RestaurantPermission | AdminPermission)[] {
    if (!user.isActive) {
      return [];
    }

    if (user.role === 'restaurant') {
      return (user as RestaurantUser).permissions || [];
    } else if (user.role === 'admin' || user.role === 'super_admin') {
      return (user as AdminUser).permissions || [];
    }

    return [];
  }

  canAccessRoute(user: User, route: string): boolean {
    if (!user.isActive) {
      return false;
    }

    // Define route permissions
    const routePermissions: Record<string, (RestaurantPermission | AdminPermission)[]> = {
      // Restaurant routes
      '/dashboard': ['manage_menu'],
      '/menu': ['manage_menu'],
      '/orders': ['manage_orders'],
      '/tables': ['manage_tables'],
      '/media': ['manage_media'],
      '/analytics': ['view_analytics'],
      '/settings': ['manage_settings'],
      '/staff': ['manage_staff'],
      
      // Admin routes
      '/admin/dashboard': ['manage_restaurants'],
      '/admin/restaurants': ['manage_restaurants'],
      '/admin/analytics': ['view_system_analytics'],
      '/admin/orders': ['view_all_orders'],
      '/admin/settings': ['manage_system_settings'],
      '/admin/templates': ['manage_templates'],
      '/admin/billing': ['manage_billing'],
      '/admin/admins': ['manage_admins']
    };

    const requiredPermissions = routePermissions[route];
    if (!requiredPermissions) {
      return true; // No specific permissions required
    }

    // Check if user has any of the required permissions
    const userPermissions = this.getUserPermissions(user);
    return requiredPermissions.some(permission => 
      userPermissions.includes(permission)
    );
  }

  private checkRestaurantPermission(user: RestaurantUser, permission: RestaurantPermission | AdminPermission): PermissionCheck {
    // Restaurant users can only have restaurant permissions
    if (this.isAdminPermission(permission)) {
      return {
        hasPermission: false,
        reason: 'Restaurant users cannot access admin permissions'
      };
    }

    const hasPermission = user.permissions.includes(permission as RestaurantPermission);
    
    return {
      hasPermission,
      reason: hasPermission ? undefined : `Missing permission: ${permission}`
    };
  }

  private checkAdminPermission(user: AdminUser, permission: RestaurantPermission | AdminPermission): PermissionCheck {
    // Admin users can have both admin and restaurant permissions
    const hasPermission = user.permissions.includes(permission);
    
    return {
      hasPermission,
      reason: hasPermission ? undefined : `Missing permission: ${permission}`
    };
  }

  private isAdminPermission(permission: RestaurantPermission | AdminPermission): permission is AdminPermission {
    const adminPermissions: AdminPermission[] = [
      'manage_restaurants',
      'manage_admins',
      'view_system_analytics',
      'manage_system_settings',
      'manage_templates',
      'view_all_orders',
      'manage_billing'
    ];
    
    return adminPermissions.includes(permission as AdminPermission);
  }
}

// Permission decorators for components
export function requirePermission(permission: RestaurantPermission | AdminPermission) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      const user = this.user; // Assuming user is available in the component
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const permissionService = new PermissionService();
      const check = permissionService.checkPermission(user, permission);
      
      if (!check.hasPermission) {
        throw new Error(`Permission denied: ${check.reason}`);
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

export function requireRole(role: UserRole) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      const user = this.user; // Assuming user is available in the component
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      if (user.role !== role) {
        throw new Error(`Role required: ${role}, but user has role: ${user.role}`);
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

// Route protection utilities
export function createRouteGuard(requiredPermissions: (RestaurantPermission | AdminPermission)[]) {
  return function (user: User): boolean {
    const permissionService = new PermissionService();
    
    return requiredPermissions.every(permission => {
      const check = permissionService.checkPermission(user, permission);
      return check.hasPermission;
    });
  };
}

export function createRoleGuard(requiredRole: UserRole) {
  return function (user: User): boolean {
    return user.role === requiredRole;
  };
}

// Permission constants for easy reference
export const RESTAURANT_PERMISSIONS = {
  MANAGE_MENU: 'manage_menu' as RestaurantPermission,
  MANAGE_ORDERS: 'manage_orders' as RestaurantPermission,
  MANAGE_TABLES: 'manage_tables' as RestaurantPermission,
  MANAGE_MEDIA: 'manage_media' as RestaurantPermission,
  VIEW_ANALYTICS: 'view_analytics' as RestaurantPermission,
  MANAGE_SETTINGS: 'manage_settings' as RestaurantPermission,
  MANAGE_STAFF: 'manage_staff' as RestaurantPermission
};

export const ADMIN_PERMISSIONS = {
  MANAGE_RESTAURANTS: 'manage_restaurants' as AdminPermission,
  MANAGE_ADMINS: 'manage_admins' as AdminPermission,
  VIEW_SYSTEM_ANALYTICS: 'view_system_analytics' as AdminPermission,
  MANAGE_SYSTEM_SETTINGS: 'manage_system_settings' as AdminPermission,
  MANAGE_TEMPLATES: 'manage_templates' as AdminPermission,
  VIEW_ALL_ORDERS: 'view_all_orders' as AdminPermission,
  MANAGE_BILLING: 'manage_billing' as AdminPermission
};

// Export singleton instance
export const permissionService = new PermissionService();

