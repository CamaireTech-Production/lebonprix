import { useState, useEffect } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import { X, Check } from 'lucide-react';
import { PermissionTemplate, RolePermissions } from '../../types/permissions';
import { ALL_RESOURCES, getResourceLabel } from '../../constants/resources';

interface PermissionTemplateFormProps {
  template?: PermissionTemplate | null;
  onSave: (templateData: Omit<PermissionTemplate, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<void> | void;
  onCancel: () => void;
}

const PermissionTemplateForm = ({ template, onSave, onCancel }: PermissionTemplateFormProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseRole, setBaseRole] = useState<'staff' | 'manager' | 'admin' | ''>('');
  const [permissions, setPermissions] = useState<RolePermissions>({
    canView: [],
    canEdit: [],
    canDelete: [],
    canManageEmployees: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setBaseRole(template.baseRole || '');
      // Remove legacy boolean fields if they exist (for backward compatibility)
      const { canAccessSettings, canAccessFinance, canAccessHR, ...cleanPermissions } = template.permissions as any;
      setPermissions(cleanPermissions);
    }
  }, [template]);

  // Use RESOURCES constants for all resources
  const allResources = ALL_RESOURCES;

  const handlePermissionChange = (type: keyof RolePermissions, resource: string, checked: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [type]: checked 
        ? [...(prev[type] as string[]), resource]
        : (prev[type] as string[]).filter(r => r !== resource)
    }));
  };

  const handleSelectAll = (type: keyof RolePermissions, checked: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [type]: checked ? allResources : []
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('Please enter a template name');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        ...(baseRole && { baseRole: baseRole as 'staff' | 'manager' | 'admin' }),
        permissions
      });
    } catch (error) {
      console.error('Error in form submission:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = !!template;

  return (
    <Card>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? 'Edit Template' : 'Create Permission Template'}
          </h2>
          <Button
            variant="outline"
            onClick={onCancel}
            icon={<X size={16} />}
          >
            Cancel
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., Finance Manager"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Describe what this template is for..."
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Base Role (Optional)
              </label>
              <select
                value={baseRole}
                onChange={(e) => setBaseRole(e.target.value as 'staff' | 'manager' | 'admin' | '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Auto-detect from permissions</option>
                <option value="staff">Staff (Vendeur)</option>
                <option value="manager">Manager (Gestionnaire)</option>
                <option value="admin">Admin (Magasinier)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to automatically detect based on selected permissions. This is only a label for display purposes - actual access is controlled by the checkboxes below.
              </p>
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Permissions</h3>
            
            {/* View Access */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700">View Access</h4>
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={permissions.canView.length === allResources.length}
                    onChange={(e) => handleSelectAll('canView', e.target.checked)}
                    className="mr-2"
                  />
                  Select All
                </label>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {allResources.map((resource) => (
                  <label key={resource} className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={permissions.canView.includes(resource)}
                      onChange={(e) => handlePermissionChange('canView', resource, e.target.checked)}
                      className="mr-2"
                    />
                    {getResourceLabel(resource)}
                  </label>
                ))}
              </div>
            </div>

            {/* Edit Access */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700">Edit Access</h4>
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={permissions.canEdit.length === allResources.length}
                    onChange={(e) => handleSelectAll('canEdit', e.target.checked)}
                    className="mr-2"
                  />
                  Select All
                </label>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {allResources.map((resource) => (
                  <label key={resource} className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={permissions.canEdit.includes(resource)}
                      onChange={(e) => handlePermissionChange('canEdit', resource, e.target.checked)}
                      className="mr-2"
                    />
                    {getResourceLabel(resource)}
                  </label>
                ))}
              </div>
            </div>

            {/* Delete Access */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700">Delete Access</h4>
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={permissions.canDelete.length === allResources.length}
                    onChange={(e) => handleSelectAll('canDelete', e.target.checked)}
                    className="mr-2"
                  />
                  Select All
                </label>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {allResources.map((resource) => (
                  <label key={resource} className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={permissions.canDelete.includes(resource)}
                      onChange={(e) => handlePermissionChange('canDelete', resource, e.target.checked)}
                      className="mr-2"
                    />
                    {getResourceLabel(resource)}
                  </label>
                ))}
              </div>
            </div>

          </div>

          {/* Submit */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              icon={<Check size={16} />}
              isLoading={isSubmitting}
              loadingText={isEditing ? 'Updating...' : 'Creating...'}
            >
              {isEditing ? 'Update Template' : 'Create Template'}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
};

export default PermissionTemplateForm;
