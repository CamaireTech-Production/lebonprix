import React, { useState } from 'react';
import { Modal, Button, Input, Select, Textarea, LoadingSpinner } from '../ui';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import type { PermissionTemplate } from '../../types/geskap';

interface EmployeeInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (
    email: string,
    permissionTemplateId: string,
    additionalInfo?: {
      firstname?: string;
      lastname?: string;
      phone?: string;
    }
  ) => Promise<void>;
  templates: PermissionTemplate[];
  restaurantId: string;
}

export const EmployeeInviteModal: React.FC<EmployeeInviteModalProps> = ({
  isOpen,
  onClose,
  onInvite,
  templates,
  restaurantId
}) => {
  const { language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    permissionTemplateId: '',
    firstname: '',
    lastname: '',
    phone: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.email || !formData.permissionTemplateId) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onInvite(
        formData.email,
        formData.permissionTemplateId,
        {
          firstname: formData.firstname || undefined,
          lastname: formData.lastname || undefined,
          phone: formData.phone || undefined
        }
      );
      setFormData({
        email: '',
        permissionTemplateId: '',
        firstname: '',
        lastname: '',
        phone: ''
      });
    } catch (err) {
      // Error handling is done in parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('invite_employee', language)}
    >
      <div className="space-y-4">
        <Input
          label={t('email', language)}
          name="email"
          type="email"
          value={formData.email}
          onChange={handleInputChange}
          placeholder={t('email_placeholder', language)}
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('permission_template', language)} <span className="text-red-500">*</span>
          </label>
          <Select
            name="permissionTemplateId"
            value={formData.permissionTemplateId}
            onChange={handleInputChange}
            className="w-full"
            required
          >
            <option value="">{t('select_template', language)}</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('first_name', language)}
            name="firstname"
            value={formData.firstname}
            onChange={handleInputChange}
            placeholder={t('first_name_placeholder', language)}
          />
          <Input
            label={t('last_name', language)}
            name="lastname"
            value={formData.lastname}
            onChange={handleInputChange}
            placeholder={t('last_name_placeholder', language)}
          />
        </div>

        <Input
          label={t('phone', language)}
          name="phone"
          value={formData.phone}
          onChange={handleInputChange}
          placeholder={t('phone_placeholder', language)}
        />

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
            disabled={isSubmitting || !formData.email || !formData.permissionTemplateId}
            loading={isSubmitting}
          >
            {t('send_invitation', language)}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
