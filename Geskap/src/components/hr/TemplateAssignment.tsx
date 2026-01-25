import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { Card, Button } from '@components/common';
import { Check, X, Eye, Plus } from 'lucide-react';
import { 
  getCompanyTemplates, 
  getTemplateById
} from '@services/firestore/employees/permissionTemplateService';
import { PermissionTemplate } from '../../types/permissions';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@services/core/firebase';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import PermissionTemplateForm from './PermissionTemplateForm';
import { createTemplate } from '@services/firestore/employees/permissionTemplateService';

interface TemplateAssignmentProps {
  userId: string;
  currentTemplateId?: string;
  onTemplateAssigned?: () => void;
  onClose: () => void;
}

const TemplateAssignment = ({ 
  userId, 
  currentTemplateId, 
  onTemplateAssigned, 
  onClose 
}: TemplateAssignmentProps) => {
  const { company, user } = useAuth();
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(currentTemplateId || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<PermissionTemplate | null>(null);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);

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
    
    // Template is required
    if (!selectedTemplateId) {
      showErrorToast('Please select a permission template. Template is required.');
      return;
    }
    
    try {
      setSaving(true);
      
      // Update the permission template
      if (selectedTemplateId !== currentTemplateId) {
        const userRef = doc(db, 'users', userId);
        
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
        updatedCompanies[companyIndex] = {
          ...updatedCompanies[companyIndex],
          permissionTemplateId: selectedTemplateId
        };
        
        await updateDoc(userRef, {
          companies: updatedCompanies
        });
        
        console.log('✅ [TemplateAssignment] Template mis à jour avec succès');
      }
      
      showSuccessToast('Permission template assigned successfully');
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
    if (!permissions) return 0;
    
    let count = 0;
    count += permissions.canView?.length || 0;
    count += permissions.canCreate?.length || 0;
    count += permissions.canEdit?.length || 0;
    count += permissions.canDelete?.length || 0;
    return count;
  };

  const handleCreateTemplate = async (templateData: Omit<PermissionTemplate, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    if (!company?.id || !user?.uid) return;
    
    try {
      const newTemplate = await createTemplate(company.id, user.uid, templateData);
      await loadTemplates(); // Reload templates list
      setSelectedTemplateId(newTemplate.id); // Auto-select the new template
      setPreviewTemplate(newTemplate); // Show preview
      setShowCreateTemplate(false);
      showSuccessToast('Template created and selected');
    } catch (error) {
      console.error('Error creating template:', error);
      showErrorToast('Error creating template');
    }
  };

  // Auto-preview when template is selected
  useEffect(() => {
    if (selectedTemplateId && selectedTemplateId !== currentTemplateId && company?.id) {
      handlePreview(selectedTemplateId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId, company?.id]);

  if (showCreateTemplate) {
    return (
      <PermissionTemplateForm
        template={null}
        onSave={handleCreateTemplate}
        onCancel={() => setShowCreateTemplate(false)}
      />
    );
  }

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
          {/* Template Selection - Required */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Permission Template <span className="text-red-500">*</span>
            </label>
            <p className="text-sm text-gray-500 mb-3">
              Select a permission template. Template is required - employee must have permissions assigned.
            </p>
            
            {templates.length === 0 ? (
              <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                <p className="text-sm text-yellow-800 mb-3">
                  No templates available. Create a template first.
                </p>
                <Button
                  onClick={() => setShowCreateTemplate(true)}
                  icon={<Plus size={16} />}
                >
                  Create Custom Template
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {templates.map((template) => (
                    <label key={template.id} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreview(template.id);
                        }}
                        icon={<Eye size={14} />}
                      >
                        Preview
                      </Button>
                    </label>
                  ))}
                </div>
                
                <div className="border-t pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateTemplate(true)}
                    icon={<Plus size={16} />}
                    className="w-full"
                  >
                    Create Custom Template
                  </Button>
                </div>
              </>
            )}
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
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Create Access</h4>
                  <div className="text-sm text-gray-600">
                    {previewTemplate.permissions.canCreate && previewTemplate.permissions.canCreate.length > 0 
                      ? previewTemplate.permissions.canCreate.join(', ')
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
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Delete Access</h4>
                  <div className="text-sm text-gray-600">
                    {previewTemplate.permissions.canDelete && previewTemplate.permissions.canDelete.length > 0 
                      ? previewTemplate.permissions.canDelete.join(', ')
                      : 'None'
                    }
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
              disabled={saving || !selectedTemplateId}
              icon={<Check size={16} />}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default TemplateAssignment;
