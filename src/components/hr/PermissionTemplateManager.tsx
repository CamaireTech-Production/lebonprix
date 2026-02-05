import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { Card, Button, SkeletonLoader } from '@components/common';
import Modal, { ModalFooter } from '@components/common/Modal';
import { Plus, Edit, Trash2, Users } from 'lucide-react';
import {
  getCompanyTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate
} from '@services/firestore/employees/permissionTemplateService';
import { getDefaultPermissionTemplates } from '../../types/permissions';
import { PermissionTemplate } from '../../types/permissions';
import PermissionTemplateForm from './PermissionTemplateForm';
import { clearAllPermissionCaches } from '../../hooks/business/usePermissionCache';
import { useModules } from '@hooks/business/useModules';

interface PermissionTemplateManagerProps {
  onTemplateChange?: () => void;
}

const PermissionTemplateManager = ({ onTemplateChange }: PermissionTemplateManagerProps) => {
  const { company, user } = useAuth();
  const { isStarter } = useModules(); // Check if Starter plan
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PermissionTemplate | null>(null);
  const [showDefaults, setShowDefaults] = useState(false);
  const [usingDefaultTemplateName, setUsingDefaultTemplateName] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleCreateTemplate = async (templateData: Omit<PermissionTemplate, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    if (!company?.id || !user?.uid) return;

    try {
      await createTemplate(company.id, user.uid, templateData);
      await loadTemplates();
      setShowForm(false);
      setEditingTemplate(null);
      onTemplateChange?.();
    } catch (error) {
      console.error('Error creating template:', error);
    }
  };

  const handleUpdateTemplate = async (templateData: Omit<PermissionTemplate, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    if (!company?.id || !editingTemplate) return;

    try {
      await updateTemplate(company.id, editingTemplate.id, templateData);

      // Clear all permission caches to force refresh for all users using this template
      clearAllPermissionCaches();

      // Broadcast event to notify active users to refresh their permissions
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('permission-template-updated', {
          detail: { companyId: company.id, templateId: editingTemplate.id }
        }));
      }

      await loadTemplates();
      setShowForm(false);
      setEditingTemplate(null);
      onTemplateChange?.();
    } catch (error) {
      console.error('Error updating template:', error);
    }
  };

  const handleEditTemplate = (template: PermissionTemplate) => {
    setEditingTemplate(template);
    setShowForm(true);
  };

  const handleDeleteClick = (template: PermissionTemplate) => {
    setTemplateToDelete({ id: template.id, name: template.name });
    setDeleteModalOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setTemplateToDelete(null);
  };

  const handleDeleteTemplate = async () => {
    if (!company?.id || !templateToDelete) return;

    setIsDeleting(true);
    try {
      await deleteTemplate(company.id, templateToDelete.id);

      // Clear all permission caches when template is deleted
      clearAllPermissionCaches();

      // Broadcast event to notify active users
      if (typeof window !== 'undefined' && company.id && templateToDelete.id) {
        window.dispatchEvent(new CustomEvent('permission-template-updated', {
          detail: { companyId: company.id, templateId: templateToDelete.id }
        }));
      }

      await loadTemplates();
      onTemplateChange?.();
      setDeleteModalOpen(false);
      setTemplateToDelete(null);
    } catch (error) {
      console.error('Error deleting template:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUseDefaultTemplate = async (defaultTemplate: ReturnType<typeof getDefaultPermissionTemplates>[0]) => {
    if (!company?.id || !user?.uid) return;

    try {
      setUsingDefaultTemplateName(defaultTemplate.name);
      await createTemplate(company.id, user.uid, {
        name: defaultTemplate.name,
        description: defaultTemplate.description,
        permissions: defaultTemplate.permissions
      });
      await loadTemplates();
      onTemplateChange?.();
    } catch (error) {
      console.error('Error using default template:', error);
    } finally {
      setUsingDefaultTemplateName(null);
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
      <div className="space-y-4 py-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <SkeletonLoader width="w-10" height="h-10" rounded />
                <div>
                  <SkeletonLoader width="w-32" height="h-4" className="mb-1" />
                  <SkeletonLoader width="w-24" height="h-3" />
                </div>
              </div>
              <div className="flex gap-2">
                <SkeletonLoader width="w-8" height="h-8" rounded />
                <SkeletonLoader width="w-8" height="h-8" rounded />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (showForm) {
    return (
      <PermissionTemplateForm
        template={editingTemplate}
        onSave={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
        onCancel={() => {
          setShowForm(false);
          setEditingTemplate(null);
        }}
      />
    );
  }

  // Get default templates and filter for Starter plan
  // Enterprise-only templates: Production Supervisor, Warehouse Clerk, HR Manager
  const allDefaultTemplates = getDefaultPermissionTemplates();
  const enterpriseOnlyTemplates = ['Production Supervisor', 'Warehouse Clerk', 'HR Manager'];
  const defaultTemplates = useMemo(() => {
    if (isStarter) {
      return allDefaultTemplates.filter(t => !enterpriseOnlyTemplates.includes(t.name));
    }
    return allDefaultTemplates;
  }, [isStarter, allDefaultTemplates]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Permission Templates</h2>
          <p className="text-gray-600 mt-1">Create reusable permission sets for your team</p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          icon={<Plus size={16} />}
        >
          Create Template
        </Button>
      </div>

      {/* Default Templates Section */}
      <Card>
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Default Templates</h3>
            <Button
              variant="outline"
              onClick={() => setShowDefaults(!showDefaults)}
            >
              {showDefaults ? 'Hide' : 'Show'} Defaults
            </Button>
          </div>

          {showDefaults && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {defaultTemplates.map((template, index) => (
                <div key={index} className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-medium text-gray-900">{template.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                  <div className="mt-3">
                    <Button
                      size="sm"
                      isLoading={usingDefaultTemplateName === template.name}
                      loadingText="Adding..."
                      onClick={() => handleUseDefaultTemplate(template)}
                    >
                      Use This Template
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Company Templates */}
      <Card>
        <div className="p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Your Templates ({templates.length})</h3>

          {templates.length === 0 ? (
            <div className="text-center py-8">
              <Users size={48} className="mx-auto text-gray-400 mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No templates yet</h4>
              <p className="text-gray-600 mb-4">Create your first permission template to get started</p>
              <Button onClick={() => setShowForm(true)} icon={<Plus size={16} />}>
                Create Template
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <div key={template.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">{template.name}</h4>
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditTemplate(template)}
                        icon={<Edit size={14} />}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteClick(template)}
                        icon={<Trash2 size={14} />}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  {template.description && (
                    <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  )}

                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{getPermissionCount(template)} permissions</span>
                    <span>Created {new Date(template.createdAt.seconds * 1000).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={handleDeleteCancel}
        title="Delete Permission Template"
        footer={
          <ModalFooter
            onCancel={handleDeleteCancel}
            onConfirm={handleDeleteTemplate}
            confirmText="Delete"
            cancelText="Cancel"
            isLoading={isDeleting}
            isDanger
          />
        }
      >
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Are you sure you want to delete the template <strong>"{templateToDelete?.name}"</strong>?
          </p>
          <p className="text-sm text-red-600">
            This action cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default PermissionTemplateManager;
