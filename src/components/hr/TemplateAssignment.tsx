import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { Card, Button } from '@components/common';
import { Check, X, Eye } from 'lucide-react';
import { 
  getCompanyTemplates, 
  getTemplateById
} from '@services/firestore/employees/permissionTemplateService';
import { PermissionTemplate } from '../../types/permissions';
import { doc, updateDoc, getDoc, FieldValue } from 'firebase/firestore';
import { db } from '@services/firebase';
import { updateEmployeeRole } from '@services/firestore/employees/employeeRefService';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';

interface TemplateAssignmentProps {
  userId: string;
  currentRole?: 'staff' | 'manager' | 'admin' | 'owner';
  currentTemplateId?: string;
  onTemplateAssigned?: () => void;
  onClose: () => void;
}

const TemplateAssignment = ({ 
  userId, 
  currentRole,
  currentTemplateId, 
  onTemplateAssigned, 
  onClose 
}: TemplateAssignmentProps) => {
  const { company, user } = useAuth();
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>(currentRole || 'staff');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(currentTemplateId || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<PermissionTemplate | null>(null);

  const loadTemplates = useCallback(async () => {
    if (!company?.id) return;
    
    try {
      setLoading(true);
      const companyTemplates = await getCompanyTemplates(company.id);
      setTemplates(companyTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handlePreview = async (templateId: string) => {
    if (!company?.id || !templateId) return;
    
    try {
      const template = await getTemplateById(company.id, templateId);
      setPreviewTemplate(template);
    } catch (error) {
      console.error('Error loading template preview:', error);
    }
  };

  const handleAssignTemplate = async () => {
    if (!company?.id || !user?.uid) return;
    
    try {
      setSaving(true);
      
      // 1. Mettre à jour le rôle si nécessaire
      if (currentRole && selectedRole !== currentRole && selectedRole !== 'owner') {
        console.log('🔄 [TemplateAssignment] Mise à jour du rôle:', { 
          userId, 
          companyId: company.id, 
          oldRole: currentRole, 
          newRole: selectedRole 
        });
        
        await updateEmployeeRole(company.id, userId, selectedRole as 'staff' | 'manager' | 'admin');
        console.log('✅ [TemplateAssignment] Rôle mis à jour avec succès');
      }
      
      // 2. Mettre à jour le template de permissions si nécessaire
      if (selectedTemplateId !== currentTemplateId) {
        const userRef = doc(db, 'users', userId);
        const updateData: Record<string, string | FieldValue> = {};
        
        // Trouver l'index de la company dans le tableau companies
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          throw new Error('Utilisateur non trouvé');
        }
        
        const userData = userDoc.data();
        let companies = userData?.companies;
        
        // S'assurer que companies est un tableau
        if (!Array.isArray(companies)) {
          console.error('❌ [TemplateAssignment] companies n\'est pas un tableau:', companies);
          companies = [];
        }
        
        const companyIndex = companies.findIndex((c: any) => c.companyId === company.id);
        
        if (companyIndex === -1) {
          console.error('❌ [TemplateAssignment] Company non trouvée dans user.companies[]:', {
            companyId: company.id,
            companies: companies.map((c: any) => ({ companyId: c.companyId, role: c.role }))
          });
          throw new Error('Company non trouvée dans user.companies[]');
        }
        
        // Créer un nouveau tableau avec le template mis à jour
        const updatedCompanies = [...companies];
        if (selectedTemplateId) {
          updatedCompanies[companyIndex] = {
            ...updatedCompanies[companyIndex],
            permissionTemplateId: selectedTemplateId
          };
        } else {
          // Supprimer le template si on sélectionne "Base Role Only"
          const { permissionTemplateId, ...rest } = updatedCompanies[companyIndex];
          updatedCompanies[companyIndex] = rest;
        }
        
        await updateDoc(userRef, {
          companies: updatedCompanies
        });
        
        console.log('✅ [TemplateAssignment] Template mis à jour avec succès');
      }
      
      showSuccessToast('Rôle et permissions mis à jour avec succès');
      onTemplateAssigned?.();
      onClose();
    } catch (error: any) {
      console.error('❌ [TemplateAssignment] Erreur lors de la mise à jour:', error);
      showErrorToast(error.message || 'Erreur lors de la mise à jour du rôle et des permissions');
    } finally {
      setSaving(false);
    }
  };

  const getPermissionCount = (template: PermissionTemplate) => {
    const { permissions } = template;
    let count = 0;
    count += permissions.canView.length;
    count += permissions.canEdit.length;
    count += permissions.canDelete.length;
    // Note: canAccessSettings, canAccessFinance, canAccessHR removed - now part of canView array
    return count;
  };

  if (loading) {
    return (
      <Card>
        <div className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading templates...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Assign Permission Template</h2>
          <Button
            variant="outline"
            onClick={onClose}
            icon={<X size={16} />}
          >
            Close
          </Button>
        </div>

        <div className="space-y-6">
          {/* Role Selection */}
          {currentRole !== 'owner' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Rôle de base
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                disabled={saving}
              >
                <option value="staff">Staff (Vendeur)</option>
                <option value="manager">Manager (Gestionnaire)</option>
                <option value="admin">Admin (Magasinier)</option>
              </select>
              <p className="mt-1 text-sm text-gray-500">
                Le rôle de base détermine les permissions par défaut de l'utilisateur.
              </p>
            </div>
          )}
          
          {/* Template Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Template de permissions (optionnel)
            </label>
            <div className="space-y-2">
              <label className="flex items-center p-3 border rounded-lg hover:bg-gray-50">
                <input
                  type="radio"
                  name="template"
                  value=""
                  checked={selectedTemplateId === ''}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium text-gray-900">Base Role Only</div>
                  <div className="text-sm text-gray-600">Use only the user's base role permissions</div>
                </div>
              </label>
              
              {templates.map((template) => (
                <label key={template.id} className="flex items-center p-3 border rounded-lg hover:bg-gray-50">
                  <input
                    type="radio"
                    name="template"
                    value={template.id}
                    checked={selectedTemplateId === template.id}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{template.name}</div>
                    <div className="text-sm text-gray-600">{template.description}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {getPermissionCount(template)} permissions
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePreview(template.id)}
                    icon={<Eye size={14} />}
                  >
                    Preview
                  </Button>
                </label>
              ))}
            </div>
          </div>

          {/* Template Preview */}
          {previewTemplate && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-medium text-gray-900 mb-3">Template Preview: {previewTemplate.name}</h3>
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">View Access</h4>
                  <div className="text-sm text-gray-600">
                    {previewTemplate.permissions.canView.length > 0 
                      ? previewTemplate.permissions.canView.join(', ')
                      : 'None'
                    }
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Edit Access</h4>
                  <div className="text-sm text-gray-600">
                    {previewTemplate.permissions.canEdit.length > 0 
                      ? previewTemplate.permissions.canEdit.join(', ')
                      : 'None'
                    }
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Special Sections</h4>
                  <div className="text-sm text-gray-600">
                    {[
                      previewTemplate.permissions.canView.includes('settings') && 'Settings',
                      previewTemplate.permissions.canView.includes('finance') && 'Finance',
                      previewTemplate.permissions.canView.includes('hr') && 'HR'
                    ].filter(Boolean).join(', ') || 'None'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignTemplate}
              disabled={saving}
              icon={<Check size={16} />}
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default TemplateAssignment;
