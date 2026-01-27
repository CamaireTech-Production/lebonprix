import React, { useState } from 'react';
import { Modal, Button, Input, Select } from '../ui';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import type { UserRole, PermissionTemplate } from '../../types/geskap';
import { Eye, EyeOff, Copy, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface EmployeeCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (employeeData: {
    username: string;
    email: string;
    password: string;
    role: UserRole;
    permissionTemplateId?: string;
    phone?: string;
  }) => Promise<void>;
  templates: PermissionTemplate[];
}

export const EmployeeCreateModal: React.FC<EmployeeCreateModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  templates
}) => {
  const { language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'staff' as UserRole,
    permissionTemplateId: '',
    phone: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const generatePassword = () => {
    // Generate a simple memorable password
    const words = ['resto', 'cafe', 'food', 'chef', 'menu'];
    const numbers = Math.floor(1000 + Math.random() * 9000);
    const password = words[Math.floor(Math.random() * words.length)] + numbers;
    setFormData(prev => ({ ...prev, password }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.username.trim()) {
      toast.error(t('name_required', language));
      return;
    }

    if (!formData.email.trim()) {
      toast.error(t('email_required', language));
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      toast.error(t('password_min_length', language));
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate(formData);

      // Show success with credentials
      setCreatedCredentials({
        email: formData.email,
        password: formData.password
      });
      setShowSuccess(true);

      // Don't close modal yet - let user copy credentials
    } catch (err: any) {
      toast.error(err.message || t('error_creating_employee', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} ${t('copied', language)}`);
  };

  const handleCloseAfterSuccess = () => {
    setShowSuccess(false);
    setCreatedCredentials(null);
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'staff',
      permissionTemplateId: '',
      phone: ''
    });
    onClose();
  };

  if (showSuccess && createdCredentials) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleCloseAfterSuccess}
        title={t('employee_created_successfully', language)}
      >
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="text-green-600" size={24} />
              <h3 className="text-lg font-semibold text-green-900">
                {t('employee_account_created', language)}
              </h3>
            </div>
            <p className="text-sm text-green-800 mb-4">
              {t('employee_credentials_message', language)}
            </p>

            <div className="space-y-3">
              <div className="bg-white rounded-lg p-3 border border-green-300">
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  {t('email', language)}:
                </label>
                <div className="flex items-center justify-between">
                  <code className="text-sm font-mono text-gray-900">{createdCredentials.email}</code>
                  <button
                    onClick={() => copyToClipboard(createdCredentials.email, t('email', language))}
                    className="text-green-600 hover:text-green-700 p-1"
                    title={t('copy', language)}
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 border border-green-300">
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  {t('password', language)}:
                </label>
                <div className="flex items-center justify-between">
                  <code className="text-sm font-mono text-gray-900">{createdCredentials.password}</code>
                  <button
                    onClick={() => copyToClipboard(createdCredentials.password, t('password', language))}
                    className="text-green-600 hover:text-green-700 p-1"
                    title={t('copy', language)}
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-xs text-yellow-800">
                ⚠️ {t('save_credentials_warning', language)}
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleCloseAfterSuccess}>
              {t('close', language)}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('create_employee', language)}
    >
      <div className="space-y-4">
        <Input
          label={t('employee_name', language)}
          name="username"
          value={formData.username}
          onChange={handleInputChange}
          placeholder={t('employee_name_placeholder', language)}
          required
        />

        <Input
          label={t('email', language)}
          name="email"
          type="email"
          value={formData.email}
          onChange={handleInputChange}
          placeholder={t('email_placeholder_employee', language)}
          required
          helpText={t('email_can_be_fictive', language)}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('password', language)} *
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder={t('password_placeholder', language)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <Button
              variant="outline"
              onClick={generatePassword}
              type="button"
            >
              {t('generate', language)}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {t('password_min_6_chars', language)}
          </p>
        </div>

        <Input
          label={t('phone', language)}
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleInputChange}
          placeholder={t('phone_placeholder', language)}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('role', language)} *
          </label>
          <select
            name="role"
            value={formData.role}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            required
          >
            <option value="staff">{t('role_staff', language)}</option>
            <option value="manager">{t('role_manager', language)}</option>
            <option value="admin">{t('role_admin', language)}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('permission_template', language)}
          </label>
          <select
            name="permissionTemplateId"
            value={formData.permissionTemplateId}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">{t('select_template', language)}</option>
            {templates.map(template => (
              <option key={template.id} value={template.id}>
                {template.name} - {template.description}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {t('permission_template_help', language)}
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t('cancel', language)}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            loading={isSubmitting}
          >
            {t('create_employee', language)}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
