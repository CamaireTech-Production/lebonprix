import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../common/Card';
import Button from '../common/Button';
import { Check, X, Eye } from 'lucide-react';
import { 
  getCompanyTemplates, 
  getTemplateById
} from '../../services/permissionTemplateService';
import { PermissionTemplate } from '../../types/permissions';
import { doc, updateDoc, arrayRemove, FieldValue } from 'firebase/firestore';
import { db } from '../../services/firebase';

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
    if (!company?.id || !user?.uid || !selectedTemplateId) return;
    
    try {
      setSaving(true);
      
      // Update user's company reference with template ID
      const userRef = doc(db, 'users', userId);
      const updateData: Record<string, string | FieldValue> = {};
      
      if (currentTemplateId) {
        // Remove old template reference
        updateData[`companies.${company.id}.permissionTemplateId`] = arrayRemove(currentTemplateId);
      }
      
      if (selectedTemplateId) {
        // Add new template reference
        updateData[`companies.${company.id}.permissionTemplateId`] = selectedTemplateId;
      }
      
      await updateDoc(userRef, updateData);
      
      onTemplateAssigned?.();
      onClose();
    } catch (error) {
      console.error('Error assigning template:', error);
      alert('Failed to assign template. Please try again.');
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
    if (permissions.canAccessSettings) count++;
    if (permissions.canAccessFinance) count++;
    if (permissions.canAccessHR) count++;
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
          {/* Template Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Template
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
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Special Access</h4>
                  <div className="text-sm text-gray-600">
                    {[
                      previewTemplate.permissions.canAccessSettings && 'Settings',
                      previewTemplate.permissions.canAccessFinance && 'Finance',
                      previewTemplate.permissions.canAccessHR && 'HR'
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
              {saving ? 'Assigning...' : 'Assign Template'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default TemplateAssignment;
