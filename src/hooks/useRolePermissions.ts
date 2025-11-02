import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_PERMISSIONS, mapUIRoleToSystemRole, SystemRole, PermissionTemplate, RolePermissions } from '../types/permissions';
import { getTemplateById } from '../services/permissionTemplateService';

export function useRolePermissions(companyId?: string) {
  const { effectiveRole, isOwner, company, user } = useAuth();
  const [template, setTemplate] = useState<PermissionTemplate | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);

  // Load user's assigned template
  useEffect(() => {
    const loadTemplate = async () => {
      if (!company?.id || !user?.uid || isOwner) {
        setTemplate(null);
        return;
      }

      try {
        setTemplateLoading(true);
        
        // Check if user has a template assigned for this company
        const userCompanyRef = user.companies?.find(c => c.companyId === company.id);
        const templateId = userCompanyRef?.permissionTemplateId;
        
        if (templateId) {
          const templateData = await getTemplateById(company.id, templateId);
          setTemplate(templateData);
        } else {
          setTemplate(null);
        }
      } catch (error) {
        console.error('Error loading permission template:', error);
        setTemplate(null);
      } finally {
        setTemplateLoading(false);
      }
    };

    loadTemplate();
  }, [company?.id, user?.uid, user?.companies, isOwner]);

  return useMemo(() => {
    const systemRole: SystemRole = isOwner
      ? 'owner'
      : mapUIRoleToSystemRole((effectiveRole as any) || 'vendeur');

    // Use template permissions if available, otherwise fall back to base role
    const basePermissions = ROLE_PERMISSIONS[systemRole];
    const effectivePermissions: RolePermissions = template?.permissions || basePermissions;

    const canAccess = (resource: string): boolean => {
      return effectivePermissions.canView.includes('all') || effectivePermissions.canView.includes(resource);
    };

    const canEdit = (resource: string): boolean => {
      return effectivePermissions.canEdit.includes('all') || effectivePermissions.canEdit.includes(resource);
    };

    const canDelete = (resource: string): boolean => {
      return effectivePermissions.canDelete.includes('all') || effectivePermissions.canDelete.includes(resource);
    };

    const canManageEmployees = (targetRole?: SystemRole): boolean => {
      if (targetRole) {
        return effectivePermissions.canManageEmployees.includes('all') || 
               effectivePermissions.canManageEmployees.includes(targetRole);
      }
      return effectivePermissions.canManageEmployees.length > 0;
    };

    return {
      systemRole,
      permissions: effectivePermissions,
      template,
      templateLoading,
      canAccess,
      canEdit,
      canDelete,
      canManageEmployees,
      canAccessSettings: effectivePermissions.canAccessSettings,
      canAccessFinance: effectivePermissions.canAccessFinance,
      canAccessHR: effectivePermissions.canAccessHR,
    };
  }, [effectiveRole, isOwner, template, templateLoading, companyId]);
}


