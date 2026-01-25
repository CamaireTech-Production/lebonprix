// usePermissions hook for Restoflow
import { useState, useEffect, useCallback } from 'react';
import type { PermissionTemplate, UserRole, ResourceValue } from '../../types/geskap';
import {
  subscribeToPermissionTemplates,
  createPermissionTemplate,
  updatePermissionTemplate,
  deletePermissionTemplate,
  getPermissionTemplate,
  checkPermission
} from '../../services/firestore/employees/permissionTemplateService';
import { getUserRole } from '../../services/firestore/employees/employeeRefService';

interface UsePermissionsOptions {
  restaurantId: string;
  userId: string;
}

interface UsePermissionsReturn {
  templates: PermissionTemplate[];
  userRole: UserRole | null;
  loading: boolean;
  error: string | null;
  canView: (resource: ResourceValue) => Promise<boolean>;
  canCreate: (resource: ResourceValue) => Promise<boolean>;
  canEdit: (resource: ResourceValue) => Promise<boolean>;
  canDelete: (resource: ResourceValue) => Promise<boolean>;
  createTemplate: (data: {
    name: string;
    description?: string;
    baseRole: UserRole;
    permissions: {
      canView: ResourceValue[];
      canCreate: ResourceValue[];
      canEdit: ResourceValue[];
      canDelete: ResourceValue[];
    };
  }) => Promise<PermissionTemplate>;
  updateTemplate: (
    templateId: string,
    updates: Partial<Omit<PermissionTemplate, 'id' | 'restaurantId' | 'createdAt' | 'createdBy'>>
  ) => Promise<void>;
  deleteTemplate: (templateId: string) => Promise<void>;
  getTemplate: (templateId: string) => Promise<PermissionTemplate | null>;
}

export const usePermissions = ({
  restaurantId,
  userId
}: UsePermissionsOptions): UsePermissionsReturn => {
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to permission templates
  useEffect(() => {
    if (!restaurantId) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToPermissionTemplates(restaurantId, (data) => {
      setTemplates(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [restaurantId]);

  // Get user role
  useEffect(() => {
    if (!restaurantId || !userId) {
      setUserRole(null);
      return;
    }

    getUserRole(restaurantId, userId)
      .then(setUserRole)
      .catch((err) => {
        console.error('Error getting user role:', err);
        setUserRole(null);
      });
  }, [restaurantId, userId]);

  const handleCheckPermission = useCallback(
    async (resource: ResourceValue, action: 'view' | 'create' | 'edit' | 'delete') => {
      try {
        return await checkPermission(restaurantId, userId, resource, action);
      } catch (err: any) {
        console.error('Error checking permission:', err);
        return false;
      }
    },
    [restaurantId, userId]
  );

  const canView = useCallback(
    (resource: ResourceValue) => handleCheckPermission(resource, 'view'),
    [handleCheckPermission]
  );

  const canCreate = useCallback(
    (resource: ResourceValue) => handleCheckPermission(resource, 'create'),
    [handleCheckPermission]
  );

  const canEdit = useCallback(
    (resource: ResourceValue) => handleCheckPermission(resource, 'edit'),
    [handleCheckPermission]
  );

  const canDelete = useCallback(
    (resource: ResourceValue) => handleCheckPermission(resource, 'delete'),
    [handleCheckPermission]
  );

  const handleCreateTemplate = useCallback(
    async (data: {
      name: string;
      description?: string;
      baseRole: UserRole;
      permissions: {
        canView: ResourceValue[];
        canCreate: ResourceValue[];
        canEdit: ResourceValue[];
        canDelete: ResourceValue[];
      };
    }) => {
      try {
        return await createPermissionTemplate(restaurantId, userId, data);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId, userId]
  );

  const handleUpdateTemplate = useCallback(
    async (
      templateId: string,
      updates: Partial<Omit<PermissionTemplate, 'id' | 'restaurantId' | 'createdAt' | 'createdBy'>>
    ) => {
      try {
        await updatePermissionTemplate(restaurantId, templateId, updates);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleDeleteTemplate = useCallback(
    async (templateId: string) => {
      try {
        await deletePermissionTemplate(restaurantId, templateId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleGetTemplate = useCallback(
    async (templateId: string) => {
      try {
        return await getPermissionTemplate(restaurantId, templateId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  return {
    templates,
    userRole,
    loading,
    error,
    canView,
    canCreate,
    canEdit,
    canDelete,
    createTemplate: handleCreateTemplate,
    updateTemplate: handleUpdateTemplate,
    deleteTemplate: handleDeleteTemplate,
    getTemplate: handleGetTemplate
  };
};
