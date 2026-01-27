import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Button from '../common/Button';
import { X, Check, LayoutDashboard } from 'lucide-react';
import { PermissionTemplate, RolePermissions } from '../../types/permissions';
import { ALL_RESOURCES, getResourceLabel, CREATABLE_RESOURCES, EDITABLE_RESOURCES, DELETABLE_RESOURCES } from '../../constants/resources';
import type { DashboardSectionPermissions } from '@hooks/business/useDashboardPermissions';

interface PermissionTemplateFormProps {
  template?: PermissionTemplate | null;
  onSave: (templateData: Omit<PermissionTemplate, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<void> | void;
  onCancel: () => void;
}

// Default dashboard sections for new templates
const DEFAULT_DASHBOARD_SECTIONS: DashboardSectionPermissions = {
  showStats: true,
  showProfit: false,
  showExpenses: false,
  showCharts: true,
  showTopSales: true,
  showBestClients: false,
  showBestProducts: true,
  showLatestOrders: true,
  showObjectives: false,
};

const PermissionTemplateForm = ({ template, onSave, onCancel }: PermissionTemplateFormProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseRole, setBaseRole] = useState<'staff' | 'manager' | 'admin' | ''>('');
  const [permissions, setPermissions] = useState<RolePermissions>({
    canView: [],
    canCreate: [],
    canEdit: [],
    canDelete: [],
    canManageEmployees: [],
  });
  const [dashboardSections, setDashboardSections] = useState<DashboardSectionPermissions>(DEFAULT_DASHBOARD_SECTIONS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setBaseRole(template.baseRole || '');
      // Remove legacy boolean fields if they exist (for backward compatibility)
      const { canAccessSettings, canAccessFinance, canAccessHR, ...cleanPermissions } = template.permissions as any;
      // Backward compatibility: if canCreate is missing, initialize it as empty array
      if (!cleanPermissions.canCreate) {
        cleanPermissions.canCreate = [];
      }
      setPermissions(cleanPermissions);
      // Load dashboard sections if they exist
      const templateWithDashboard = template as any;
      if (templateWithDashboard.dashboardSections) {
        setDashboardSections({
          ...DEFAULT_DASHBOARD_SECTIONS,
          ...templateWithDashboard.dashboardSections,
        });
      }
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

  const handleDashboardSectionChange = (key: keyof DashboardSectionPermissions, checked: boolean) => {
    setDashboardSections(prev => ({
      ...prev,
      [key]: checked
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
        permissions,
        dashboardSections,
      } as any);
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
                <option value="admin">Admin (Boutiquier)</option>
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

            {/* Create Access - Only show resources that support creation */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700">Create Access</h4>
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={CREATABLE_RESOURCES.every(r => permissions.canCreate.includes(r))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPermissions(prev => ({
                          ...prev,
                          canCreate: CREATABLE_RESOURCES
                        }));
                      } else {
                        setPermissions(prev => ({
                          ...prev,
                          canCreate: []
                        }));
                      }
                    }}
                    className="mr-2"
                  />
                  Select All
                </label>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                Only resources with creation flows are shown here
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {CREATABLE_RESOURCES.map((resource) => (
                  <label key={resource} className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={permissions.canCreate.includes(resource)}
                      onChange={(e) => handlePermissionChange('canCreate', resource, e.target.checked)}
                      className="mr-2"
                    />
                    {getResourceLabel(resource)}
                  </label>
                ))}
              </div>
            </div>

            {/* Edit Access - Only show resources that support editing */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700">Edit Access</h4>
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={EDITABLE_RESOURCES.every(r => permissions.canEdit.includes(r))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPermissions(prev => ({
                          ...prev,
                          canEdit: EDITABLE_RESOURCES
                        }));
                      } else {
                        setPermissions(prev => ({
                          ...prev,
                          canEdit: []
                        }));
                      }
                    }}
                    className="mr-2"
                  />
                  Select All
                </label>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                Only resources with edit capabilities are shown here
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {EDITABLE_RESOURCES.map((resource) => (
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

            {/* Delete Access - Only show resources that support deletion */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700">Delete Access</h4>
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={DELETABLE_RESOURCES.every(r => permissions.canDelete.includes(r))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPermissions(prev => ({
                          ...prev,
                          canDelete: DELETABLE_RESOURCES
                        }));
                      } else {
                        setPermissions(prev => ({
                          ...prev,
                          canDelete: []
                        }));
                      }
                    }}
                    className="mr-2"
                  />
                  Select All
                </label>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                Note: Delete is owner-only in practice, but you can configure which resources support it
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {DELETABLE_RESOURCES.map((resource) => (
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

          {/* Dashboard Sections */}
          <div className="space-y-4 border-t pt-6">
            <div className="flex items-center space-x-2">
              <LayoutDashboard className="h-5 w-5 text-emerald-600" />
              <h3 className="text-lg font-medium text-gray-900">
                {t('permissions.dashboardSections.title', 'Dashboard Visibility')}
              </h3>
            </div>
            <p className="text-sm text-gray-500">
              {t('permissions.dashboardSections.description', 'Control which sections employees can see on the dashboard')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <label className="flex items-center text-sm bg-gray-50 p-3 rounded-lg">
                <input
                  type="checkbox"
                  checked={dashboardSections.showStats}
                  onChange={(e) => handleDashboardSectionChange('showStats', e.target.checked)}
                  className="mr-3 h-4 w-4 text-emerald-600 rounded"
                />
                <div>
                  <span className="font-medium">{t('permissions.dashboardSections.stats', 'Statistics Cards')}</span>
                  <p className="text-xs text-gray-500">{t('permissions.dashboardSections.statsDesc', 'Sales count, products sold, etc.')}</p>
                </div>
              </label>

              <label className="flex items-center text-sm bg-gray-50 p-3 rounded-lg">
                <input
                  type="checkbox"
                  checked={dashboardSections.showProfit}
                  onChange={(e) => handleDashboardSectionChange('showProfit', e.target.checked)}
                  className="mr-3 h-4 w-4 text-emerald-600 rounded"
                />
                <div>
                  <span className="font-medium">{t('permissions.dashboardSections.profit', 'Profit & Margins')}</span>
                  <p className="text-xs text-gray-500">{t('permissions.dashboardSections.profitDesc', 'Financial profit data')}</p>
                </div>
              </label>

              <label className="flex items-center text-sm bg-gray-50 p-3 rounded-lg">
                <input
                  type="checkbox"
                  checked={dashboardSections.showExpenses}
                  onChange={(e) => handleDashboardSectionChange('showExpenses', e.target.checked)}
                  className="mr-3 h-4 w-4 text-emerald-600 rounded"
                />
                <div>
                  <span className="font-medium">{t('permissions.dashboardSections.expenses', 'Expenses')}</span>
                  <p className="text-xs text-gray-500">{t('permissions.dashboardSections.expensesDesc', 'Expense totals and charts')}</p>
                </div>
              </label>

              <label className="flex items-center text-sm bg-gray-50 p-3 rounded-lg">
                <input
                  type="checkbox"
                  checked={dashboardSections.showCharts}
                  onChange={(e) => handleDashboardSectionChange('showCharts', e.target.checked)}
                  className="mr-3 h-4 w-4 text-emerald-600 rounded"
                />
                <div>
                  <span className="font-medium">{t('permissions.dashboardSections.charts', 'Charts')}</span>
                  <p className="text-xs text-gray-500">{t('permissions.dashboardSections.chartsDesc', 'Donut charts and analytics')}</p>
                </div>
              </label>

              <label className="flex items-center text-sm bg-gray-50 p-3 rounded-lg">
                <input
                  type="checkbox"
                  checked={dashboardSections.showTopSales}
                  onChange={(e) => handleDashboardSectionChange('showTopSales', e.target.checked)}
                  className="mr-3 h-4 w-4 text-emerald-600 rounded"
                />
                <div>
                  <span className="font-medium">{t('permissions.dashboardSections.topSales', 'Top Sales')}</span>
                  <p className="text-xs text-gray-500">{t('permissions.dashboardSections.topSalesDesc', 'Highest value sales list')}</p>
                </div>
              </label>

              <label className="flex items-center text-sm bg-gray-50 p-3 rounded-lg">
                <input
                  type="checkbox"
                  checked={dashboardSections.showBestClients}
                  onChange={(e) => handleDashboardSectionChange('showBestClients', e.target.checked)}
                  className="mr-3 h-4 w-4 text-emerald-600 rounded"
                />
                <div>
                  <span className="font-medium">{t('permissions.dashboardSections.bestClients', 'Best Clients')}</span>
                  <p className="text-xs text-gray-500">{t('permissions.dashboardSections.bestClientsDesc', 'Top customers by spending')}</p>
                </div>
              </label>

              <label className="flex items-center text-sm bg-gray-50 p-3 rounded-lg">
                <input
                  type="checkbox"
                  checked={dashboardSections.showBestProducts}
                  onChange={(e) => handleDashboardSectionChange('showBestProducts', e.target.checked)}
                  className="mr-3 h-4 w-4 text-emerald-600 rounded"
                />
                <div>
                  <span className="font-medium">{t('permissions.dashboardSections.bestProducts', 'Best Products')}</span>
                  <p className="text-xs text-gray-500">{t('permissions.dashboardSections.bestProductsDesc', 'Top selling products')}</p>
                </div>
              </label>

              <label className="flex items-center text-sm bg-gray-50 p-3 rounded-lg">
                <input
                  type="checkbox"
                  checked={dashboardSections.showLatestOrders}
                  onChange={(e) => handleDashboardSectionChange('showLatestOrders', e.target.checked)}
                  className="mr-3 h-4 w-4 text-emerald-600 rounded"
                />
                <div>
                  <span className="font-medium">{t('permissions.dashboardSections.latestOrders', 'Latest Orders')}</span>
                  <p className="text-xs text-gray-500">{t('permissions.dashboardSections.latestOrdersDesc', 'Recent orders table')}</p>
                </div>
              </label>

              <label className="flex items-center text-sm bg-gray-50 p-3 rounded-lg">
                <input
                  type="checkbox"
                  checked={dashboardSections.showObjectives}
                  onChange={(e) => handleDashboardSectionChange('showObjectives', e.target.checked)}
                  className="mr-3 h-4 w-4 text-emerald-600 rounded"
                />
                <div>
                  <span className="font-medium">{t('permissions.dashboardSections.objectives', 'Objectives')}</span>
                  <p className="text-xs text-gray-500">{t('permissions.dashboardSections.objectivesDesc', 'Business goals and targets')}</p>
                </div>
              </label>
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
