import { useState, useEffect } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import { X, Check } from 'lucide-react';
import { PermissionTemplate, RolePermissions } from '../../types/permissions';

interface PermissionTemplateFormProps {
  template?: PermissionTemplate | null;
  onSave: (templateData: Omit<PermissionTemplate, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'createdBy'>) => void;
  onCancel: () => void;
}

const PermissionTemplateForm = ({ template, onSave, onCancel }: PermissionTemplateFormProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<RolePermissions>({
    canView: [],
    canEdit: [],
    canDelete: [],
    canManageEmployees: [],
    canAccessSettings: false,
    canAccessFinance: false,
    canAccessHR: false
  });

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setPermissions(template.permissions);
    }
  }, [template]);

  const allResources = [
    'dashboard', 'sales', 'products', 'customers', 'orders', 
    'expenses', 'finance', 'reports', 'categories', 'suppliers'
  ];

  const handlePermissionChange = (type: keyof RolePermissions, resource: string, checked: boolean) => {
    if (type === 'canAccessSettings' || type === 'canAccessFinance' || type === 'canAccessHR') {
      setPermissions(prev => ({
        ...prev,
        [type]: checked
      }));
      return;
    }

    setPermissions(prev => ({
      ...prev,
      [type]: checked 
        ? [...prev[type], resource]
        : prev[type].filter(r => r !== resource)
    }));
  };

  const handleSelectAll = (type: keyof RolePermissions, checked: boolean) => {
    if (type === 'canAccessSettings' || type === 'canAccessFinance' || type === 'canAccessHR') {
      setPermissions(prev => ({
        ...prev,
        [type]: checked
      }));
      return;
    }

    setPermissions(prev => ({
      ...prev,
      [type]: checked ? allResources : []
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('Please enter a template name');
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      permissions
    });
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
                    {resource.charAt(0).toUpperCase() + resource.slice(1)}
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
                    {resource.charAt(0).toUpperCase() + resource.slice(1)}
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
                    {resource.charAt(0).toUpperCase() + resource.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            {/* Special Access */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Special Access</h4>
              <div className="space-y-2">
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={permissions.canAccessSettings}
                    onChange={(e) => handlePermissionChange('canAccessSettings', '', e.target.checked)}
                    className="mr-2"
                  />
                  Settings Management
                </label>
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={permissions.canAccessFinance}
                    onChange={(e) => handlePermissionChange('canAccessFinance', '', e.target.checked)}
                    className="mr-2"
                  />
                  Finance Management
                </label>
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={permissions.canAccessHR}
                    onChange={(e) => handlePermissionChange('canAccessHR', '', e.target.checked)}
                    className="mr-2"
                  />
                  HR Management
                </label>
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
