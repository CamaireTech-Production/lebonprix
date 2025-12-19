import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { SystemRole, PermissionTemplate, RolePermissions } from '../../types/permissions';
import { getTemplateById } from '@services/firestore/employees/permissionTemplateService';
import { getUserById } from '@services/utilities/userService';
import { RESOURCES } from '@constants/resources';
import { logError } from '@utils/core/logger';

export function useRolePermissions(companyId?: string) {
  const { effectiveRole, isOwner, company, user, userCompanies } = useAuth();
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
        // Utiliser userCompanies depuis le contexte au lieu de user.companies
        let userCompanyRef = userCompanies?.find(c => c.companyId === company.id);
        
        // If userCompanies is empty or doesn't contain current company, load directly from Firestore
        if (!userCompanyRef || !userCompanies || userCompanies.length === 0) {
          const userData = await getUserById(user.uid);
          if (userData?.companies) {
            userCompanyRef = userData.companies.find(c => c.companyId === company.id);
          }
        }
        
        const templateId = userCompanyRef?.permissionTemplateId;
        
        if (templateId) {
          try {
            const templateData = await getTemplateById(company.id, templateId);
            if (templateData) {
              setTemplate(templateData);
            } else {
              setTemplate(null);
            }
          } catch (error) {
            logError('Error loading permission template', error);
            setTemplate(null);
          }
        } else {
          setTemplate(null);
        }
      } catch (error) {
        logError('Error loading template', error);
        setTemplate(null);
      } finally {
        setTemplateLoading(false);
      }
    };

    loadTemplate();
  }, [company?.id, user?.uid, userCompanies, isOwner]);

  return useMemo(() => {
    // Un utilisateur est owner si isOwner est true OU si effectiveRole est 'owner'
    const isActualOwner = isOwner || effectiveRole === 'owner';
    
    // Si owner, retourner permissions complètes (pas besoin de template)
    if (isActualOwner) {
      const ownerPermissions: RolePermissions = {
        canView: [RESOURCES.ALL],
        canEdit: [RESOURCES.ALL],
        canDelete: [RESOURCES.ALL],
        canManageEmployees: [RESOURCES.ALL],
      };
      
      const canAccess = (resource: string): boolean => {
        return ownerPermissions.canView.includes(RESOURCES.ALL) || ownerPermissions.canView.includes(resource);
      };

      const canEdit = (resource: string): boolean => {
        return ownerPermissions.canEdit.includes(RESOURCES.ALL) || ownerPermissions.canEdit.includes(resource);
      };

      const canDelete = (resource: string): boolean => {
        return ownerPermissions.canDelete.includes(RESOURCES.ALL) || ownerPermissions.canDelete.includes(resource);
      };

      const canManageEmployees = (targetRole?: SystemRole): boolean => {
        if (targetRole) {
          return ownerPermissions.canManageEmployees.includes(RESOURCES.ALL) || 
                 ownerPermissions.canManageEmployees.includes(targetRole);
        }
        return ownerPermissions.canManageEmployees.length > 0;
      };

      // Calculate boolean flags from canView for backward compatibility
      const canAccessFinance = canAccess(RESOURCES.FINANCE);
      const canAccessHR = canAccess(RESOURCES.HR);
      const canAccessSettings = canAccess(RESOURCES.SETTINGS);

      return {
        systemRole: 'owner' as SystemRole,
        permissions: ownerPermissions,
        template: null,
        templateLoading: false,
        canAccess,
        canEdit,
        canDelete,
        canManageEmployees,
        canAccessSettings,
        canAccessFinance,
        canAccessHR,
      };
    }
    
    // Si pas owner et template pas chargé, retourner permissions vides
    if (!template) {
      const emptyPermissions: RolePermissions = {
        canView: [],
        canEdit: [],
        canDelete: [],
        canManageEmployees: [],
      };
      
      const canAccess = (resource: string): boolean => {
        return emptyPermissions.canView.includes(RESOURCES.ALL) || emptyPermissions.canView.includes(resource);
      };

      const canEdit = (resource: string): boolean => {
        return emptyPermissions.canEdit.includes(RESOURCES.ALL) || emptyPermissions.canEdit.includes(resource);
      };

      const canDelete = (resource: string): boolean => {
        return emptyPermissions.canDelete.includes(RESOURCES.ALL) || emptyPermissions.canDelete.includes(resource);
      };

      const canManageEmployees = (targetRole?: SystemRole): boolean => {
        if (targetRole) {
          return emptyPermissions.canManageEmployees.includes(RESOURCES.ALL) || 
                 emptyPermissions.canManageEmployees.includes(targetRole);
        }
        return emptyPermissions.canManageEmployees.length > 0;
      };

      // Calculate boolean flags from canView for backward compatibility
      const canAccessFinance = canAccess(RESOURCES.FINANCE);
      const canAccessHR = canAccess(RESOURCES.HR);
      const canAccessSettings = canAccess(RESOURCES.SETTINGS);

      console.log('🔐 [useRolePermissions] Permissions vides (pas de template):', {
        hasTemplate: false,
        templateLoading,
        canView: emptyPermissions.canView,
        canAccessFinance,
        canAccessHR,
        canAccessSettings
      });

      return {
        systemRole: 'staff' as SystemRole, // Default systemRole, mais permissions vides
        permissions: emptyPermissions,
        template: null,
        templateLoading,
        canAccess,
        canEdit,
        canDelete,
        canManageEmployees,
        canAccessSettings,
        canAccessFinance,
        canAccessHR,
      };
    }
    
    // Sinon, utiliser UNIQUEMENT les permissions du template
    const effectivePermissions: RolePermissions = template.permissions;

    const canAccess = (resource: string): boolean => {
      return effectivePermissions.canView.includes(RESOURCES.ALL) || effectivePermissions.canView.includes(resource);
    };

    const canEdit = (resource: string): boolean => {
      return effectivePermissions.canEdit.includes(RESOURCES.ALL) || effectivePermissions.canEdit.includes(resource);
    };

    const canDelete = (resource: string): boolean => {
      return effectivePermissions.canDelete.includes(RESOURCES.ALL) || effectivePermissions.canDelete.includes(resource);
    };

    const canManageEmployees = (targetRole?: SystemRole): boolean => {
      if (targetRole) {
        return effectivePermissions.canManageEmployees.includes(RESOURCES.ALL) || 
               effectivePermissions.canManageEmployees.includes(targetRole);
      }
      return effectivePermissions.canManageEmployees.length > 0;
    };

    // Calculate boolean flags from canView for backward compatibility
    const canAccessFinance = canAccess(RESOURCES.FINANCE);
    const canAccessHR = canAccess(RESOURCES.HR);
    const canAccessSettings = canAccess(RESOURCES.SETTINGS);


    return {
      systemRole: 'staff' as SystemRole, // systemRole n'est plus utilisé pour les permissions, mais gardé pour compatibilité
      permissions: effectivePermissions,
      template,
      templateLoading,
      canAccess,
      canEdit,
      canDelete,
      canManageEmployees,
      canAccessSettings,
      canAccessFinance,
      canAccessHR,
    };
  }, [effectiveRole, isOwner, template, templateLoading, companyId]);
}


