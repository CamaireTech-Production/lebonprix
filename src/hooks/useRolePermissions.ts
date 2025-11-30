import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { SystemRole, PermissionTemplate, RolePermissions } from '../types/permissions';
import { getTemplateById } from '../services/permissionTemplateService';
import { getUserById } from '../services/userService';
import { RESOURCES } from '../constants/resources';

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
          console.log('⚠️ [useRolePermissions] userCompanies not populated, loading from Firestore...');
          const userData = await getUserById(user.uid);
          if (userData?.companies) {
            userCompanyRef = userData.companies.find(c => c.companyId === company.id);
            console.log('✅ [useRolePermissions] Loaded from Firestore:', {
              companiesCount: userData.companies.length,
              foundCompany: !!userCompanyRef,
              templateId: userCompanyRef?.permissionTemplateId
            });
          }
        }
        
        const templateId = userCompanyRef?.permissionTemplateId;
        
        console.log('🔍 [useRolePermissions] Chargement du template:', { 
          userId: user.uid, 
          companyId: company.id, 
          templateId,
          hasCompanies: !!userCompanies,
          companiesCount: userCompanies?.length || 0,
          userCompanyRef: userCompanyRef ? {
            companyId: userCompanyRef.companyId,
            role: userCompanyRef.role,
            templateId: userCompanyRef.permissionTemplateId
          } : null
        });
        
        if (templateId) {
          try {
            console.log('🔄 [useRolePermissions] Tentative de chargement du template depuis Firestore...', {
              templateId,
              companyId: company.id,
              path: `companies/${company.id}/permissionTemplates/${templateId}`
            });
            const templateData = await getTemplateById(company.id, templateId);
            if (templateData) {
              console.log('✅ [useRolePermissions] Template chargé:', { 
                templateId, 
                templateName: templateData.name,
                canView: templateData.permissions.canView,
                canEdit: templateData.permissions.canEdit,
                canDelete: templateData.permissions.canDelete,
                canManageEmployees: templateData.permissions.canManageEmployees
              });
              setTemplate(templateData);
            } else {
              console.error('❌ [useRolePermissions] Template non trouvé dans Firestore (getTemplateById retourne null):', {
                templateId,
                companyId: company.id,
                path: `companies/${company.id}/permissionTemplates/${templateId}`,
                message: 'Le document n\'existe pas ou n\'a pas pu être lu'
              });
              setTemplate(null);
            }
          } catch (error) {
            console.error('❌ [useRolePermissions] Erreur lors du chargement du template depuis Firestore:', {
              error,
              templateId,
              companyId: company.id,
              path: `companies/${company.id}/permissionTemplates/${templateId}`,
              errorMessage: error instanceof Error ? error.message : String(error),
              errorStack: error instanceof Error ? error.stack : undefined
            });
            setTemplate(null);
          }
        } else {
          console.log('⚠️ [useRolePermissions] Aucun template assigné pour cet employé (templateId est undefined)');
          setTemplate(null);
        }
      } catch (error) {
        console.error('❌ [useRolePermissions] Erreur lors du chargement du template:', error);
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
      
      console.log('🔐 [useRolePermissions] Owner permissions (full access)');
      
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

    console.log('🔐 [useRolePermissions] Permissions effectives (depuis template):', {
      hasTemplate: true,
      templateName: template.name,
      usingTemplate: true,
      canView: effectivePermissions.canView,
      canAccessFinance,
      canAccessHR,
      canAccessSettings
    });

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


