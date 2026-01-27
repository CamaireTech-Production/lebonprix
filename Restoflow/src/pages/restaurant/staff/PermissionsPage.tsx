import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, Shield, Check, X } from 'lucide-react';
import { Card, Button, Badge, Table, Input, Modal, LoadingSpinner, Textarea } from '../../../components/ui';
import { usePermissions } from '../../../hooks/business/usePermissions';
import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { t } from '../../../utils/i18n';
import type { PermissionTemplate, ResourceValue, UserRole } from '../../../types/geskap';
import { RESTAURANT_RESOURCES } from '../../../types/geskap';
import toast from 'react-hot-toast';

const PermissionsPage = () => {
  const { currentUser, restaurant } = useAuth();
  const { language } = useLanguage();
  const restaurantId = restaurant?.id || currentUser?.uid || '';
  const userId = currentUser?.uid || '';

  const {
    templates,
    loading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate
  } = usePermissions({ restaurantId, userId });

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form states
  const [currentTemplate, setCurrentTemplate] = useState<PermissionTemplate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    baseRole: 'staff' as UserRole,
    permissions: {
      canView: [] as ResourceValue[],
      canCreate: [] as ResourceValue[],
      canEdit: [] as ResourceValue[],
      canDelete: [] as ResourceValue[]
    }
  });

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');

  const resources = Object.values(RESTAURANT_RESOURCES);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    if (!searchQuery) return templates;

    const query = searchQuery.toLowerCase();
    return templates.filter(template => {
      return (
        template.name?.toLowerCase().includes(query) ||
        template.description?.toLowerCase().includes(query) ||
        template.baseRole?.toLowerCase().includes(query)
      );
    });
  }, [templates, searchQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const togglePermission = (resource: ResourceValue, action: 'canView' | 'canCreate' | 'canEdit' | 'canDelete') => {
    setFormData(prev => {
      const current = prev.permissions[action];
      const updated = current.includes(resource)
        ? current.filter(r => r !== resource)
        : [...current, resource];
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [action]: updated
        }
      };
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      baseRole: 'staff',
      permissions: {
        canView: [],
        canCreate: [],
        canEdit: [],
        canDelete: []
      }
    });
    setCurrentTemplate(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (template: PermissionTemplate) => {
    setCurrentTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      baseRole: template.baseRole,
      permissions: template.permissions
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (template: PermissionTemplate) => {
    setCurrentTemplate(template);
    setIsDeleteModalOpen(true);
  };

  const handleCreateTemplate = async () => {
    if (!formData.name) {
      toast.error(t('template_name_required', language));
      return;
    }

    setIsSubmitting(true);
    try {
      await createTemplate({
        name: formData.name,
        description: formData.description || undefined,
        baseRole: formData.baseRole,
        permissions: formData.permissions
      });
      setIsAddModalOpen(false);
      resetForm();
      toast.success(t('template_created_successfully', language));
    } catch (err: any) {
      toast.error(err.message || t('error_creating_template', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!currentTemplate?.id || !formData.name) {
      return;
    }

    setIsSubmitting(true);
    try {
      await updateTemplate(currentTemplate.id, {
        name: formData.name,
        description: formData.description || undefined,
        baseRole: formData.baseRole,
        permissions: formData.permissions
      });
      setIsEditModalOpen(false);
      resetForm();
      toast.success(t('template_updated_successfully', language));
    } catch (err: any) {
      toast.error(err.message || t('error_updating_template', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!currentTemplate?.id) return;

    setIsSubmitting(true);
    try {
      await deleteTemplate(currentTemplate.id);
      setIsDeleteModalOpen(false);
      setCurrentTemplate(null);
      toast.success(t('template_deleted_successfully', language));
    } catch (err: any) {
      toast.error(err.message || t('error_deleting_template', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const tableColumns = [
    { header: t('template_name', language), accessor: 'name' as const },
    { header: t('base_role', language), accessor: 'role' as const },
    { header: t('permissions_count', language), accessor: 'permissions' as const },
    { header: t('actions', language), accessor: 'actions' as const }
  ];

  const tableData = filteredTemplates.map(template => {
    const totalPermissions =
      template.permissions.canView.length +
      template.permissions.canCreate.length +
      template.permissions.canEdit.length +
      template.permissions.canDelete.length;

    return {
      id: template.id,
      name: template.name,
      role: (
        <Badge className="bg-blue-100 text-blue-800">
          {t(`role_${template.baseRole}`, language)}
        </Badge>
      ),
      permissions: `${totalPermissions} ${t('permissions', language)}`,
      actions: (
        <div className="flex space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(template);
            }}
            className="text-blue-600 hover:text-blue-900 p-1"
            title={t('edit', language)}
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openDeleteModal(template);
            }}
            className="text-red-600 hover:text-red-900 p-1"
            title={t('delete', language)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    };
  });

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('permission_templates', language)}</h1>
          <p className="text-gray-600">{t('manage_permission_templates_desc', language)}</p>
        </div>

          <div className="mt-4 md:mt-0">
            <Button icon={<Plus size={16} />} onClick={openAddModal}>
              {t('create_template', language)}
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder={t('search_templates', language)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Templates Table */}
        <Card>
          <Table
            data={tableData}
            columns={tableColumns}
            keyExtractor={(item) => item.id}
            emptyMessage={t('no_templates_found', language)}
          />
        </Card>

        {/* Add/Edit Template Modal */}
        <Modal
          isOpen={isAddModalOpen || isEditModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setIsEditModalOpen(false);
            resetForm();
          }}
          title={isAddModalOpen ? t('create_template', language) : t('edit_template', language)}
          className="max-w-4xl"
        >
          <div className="space-y-4">
            <Input
              label={t('template_name', language)}
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder={t('template_name_placeholder', language)}
              required
            />

            <Textarea
              label={t('description', language)}
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder={t('template_description_placeholder', language)}
              rows={2}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('base_role', language)}
              </label>
              <select
                name="baseRole"
                value={formData.baseRole}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="owner">{t('role_owner', language)}</option>
                <option value="admin">{t('role_admin', language)}</option>
                <option value="manager">{t('role_manager', language)}</option>
                <option value="staff">{t('role_staff', language)}</option>
              </select>
            </div>

            {/* Permission Matrix */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {t('permissions', language)}
              </label>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700">
                        {t('resource', language)}
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700">
                        {t('view', language)}
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700">
                        {t('create', language)}
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700">
                        {t('edit', language)}
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700">
                        {t('delete', language)}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {resources.map((resource) => (
                      <tr key={resource}>
                        <td className="border border-gray-300 px-3 py-2 text-sm">
                          {t(`resource_${resource}`, language)}
                        </td>
                        {(['canView', 'canCreate', 'canEdit', 'canDelete'] as const).map((action) => (
                          <td key={action} className="border border-gray-300 px-3 py-2 text-center">
                            <button
                              onClick={() => togglePermission(resource, action)}
                              className={`w-6 h-6 rounded flex items-center justify-center ${
                                formData.permissions[action].includes(resource)
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-200 text-gray-400'
                              }`}
                            >
                              {formData.permissions[action].includes(resource) ? (
                                <Check size={16} />
                              ) : (
                                <X size={16} />
                              )}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                  resetForm();
                }}
              >
                {t('cancel', language)}
              </Button>
              <Button
                onClick={isAddModalOpen ? handleCreateTemplate : handleUpdateTemplate}
                disabled={isSubmitting || !formData.name}
                loading={isSubmitting}
              >
                {isAddModalOpen ? t('create_template', language) : t('save_changes', language)}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Delete Template Modal */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setCurrentTemplate(null);
          }}
          title={t('delete_template', language)}
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              {t('delete_template_confirm', language)} <strong>{currentTemplate?.name}</strong>?
              {t('action_cannot_be_undone', language)}
            </p>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setCurrentTemplate(null);
                }}
              >
                {t('cancel', language)}
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteTemplate}
                disabled={isSubmitting}
                loading={isSubmitting}
              >
                {t('delete', language)}
              </Button>
            </div>
          </div>
        </Modal>
    </>
  );
};

export default PermissionsPage;
