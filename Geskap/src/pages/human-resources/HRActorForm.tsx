import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@contexts/AuthContext';
import { Card, Button, Input } from '@components/common';
import { Save, X, User, Briefcase, MapPin, Phone, AlertCircle } from 'lucide-react';
import { createHRActor, updateHRActor } from '@services/firestore/hr/hrActorService';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import { Timestamp } from 'firebase/firestore';
import {
  ALL_HR_ACTOR_TYPES,
  HR_ACTOR_TYPE_LABELS,
  ALL_CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  ALL_SALARY_FREQUENCIES,
  SALARY_FREQUENCY_LABELS,
  HR_ACTOR_STATUS_LABELS,
} from '@constants/hrActorTypes';
import type { HRActor, HRActorType, ContractType, SalaryFrequency, HRActorStatus } from '../../types/models';

interface HRActorFormProps {
  actor?: HRActor | null;
  onClose: () => void;
  onSuccess: () => void;
}

const HRActorForm = ({ actor, onClose, onSuccess }: HRActorFormProps) => {
  const { t } = useTranslation();
  const { company, user } = useAuth();
  const isEditing = !!actor;

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    actorType: 'caissier' as HRActorType,
    customActorType: '',
    department: '',
    position: '',
    hireDate: new Date().toISOString().split('T')[0],
    endDate: '',
    salary: '',
    salaryFrequency: 'monthly' as SalaryFrequency,
    contractType: 'CDI' as ContractType,
    address: '',
    city: '',
    country: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelationship: '',
    status: 'active' as HRActorStatus,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load actor data if editing
  useEffect(() => {
    if (actor) {
      setFormData({
        firstName: actor.firstName || '',
        lastName: actor.lastName || '',
        phone: actor.phone || '',
        email: actor.email || '',
        actorType: actor.actorType || 'caissier',
        customActorType: actor.customActorType || '',
        department: actor.department || '',
        position: actor.position || '',
        hireDate: actor.hireDate
          ? new Date(actor.hireDate.seconds * 1000).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        endDate: actor.endDate
          ? new Date(actor.endDate.seconds * 1000).toISOString().split('T')[0]
          : '',
        salary: actor.salary?.toString() || '',
        salaryFrequency: actor.salaryFrequency || 'monthly',
        contractType: actor.contractType || 'CDI',
        address: actor.address || '',
        city: actor.city || '',
        country: actor.country || '',
        emergencyName: actor.emergencyContact?.name || '',
        emergencyPhone: actor.emergencyContact?.phone || '',
        emergencyRelationship: actor.emergencyContact?.relationship || '',
        status: actor.status || 'active',
      });
    }
  }, [actor]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when field is modified
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = t('humanResources.form.errors.firstNameRequired', 'First name is required');
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = t('humanResources.form.errors.lastNameRequired', 'Last name is required');
    }
    if (!formData.phone.trim()) {
      newErrors.phone = t('humanResources.form.errors.phoneRequired', 'Phone number is required');
    }
    if (formData.actorType === 'custom' && !formData.customActorType.trim()) {
      newErrors.customActorType = t('humanResources.form.errors.customTypeRequired', 'Custom type is required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!company?.id || !user?.uid) {
      showErrorToast(t('common.error', 'Error'));
      return;
    }

    setIsSubmitting(true);

    try {
      const hireDateTimestamp = {
        seconds: Math.floor(new Date(formData.hireDate).getTime() / 1000),
        nanoseconds: 0,
      } as unknown as import('../../types/models').Timestamp;

      const endDateTimestamp = formData.endDate
        ? ({
            seconds: Math.floor(new Date(formData.endDate).getTime() / 1000),
            nanoseconds: 0,
          } as unknown as import('../../types/models').Timestamp)
        : undefined;

      const actorData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        actorType: formData.actorType,
        customActorType: formData.actorType === 'custom' ? formData.customActorType.trim() : undefined,
        department: formData.department.trim() || undefined,
        position: formData.position.trim() || undefined,
        hireDate: hireDateTimestamp,
        endDate: endDateTimestamp,
        salary: formData.salary ? parseFloat(formData.salary) : undefined,
        salaryFrequency: formData.salary ? formData.salaryFrequency : undefined,
        contractType: formData.contractType,
        address: formData.address.trim() || undefined,
        city: formData.city.trim() || undefined,
        country: formData.country.trim() || undefined,
        emergencyContact:
          formData.emergencyName || formData.emergencyPhone
            ? {
                name: formData.emergencyName.trim(),
                phone: formData.emergencyPhone.trim(),
                relationship: formData.emergencyRelationship.trim(),
              }
            : undefined,
        status: formData.status,
      };

      if (isEditing && actor) {
        await updateHRActor(actor.id, actorData);
        showSuccessToast(t('humanResources.messages.actorUpdated', 'HR Actor updated successfully'));
      } else {
        await createHRActor(company.id, user.uid, actorData as any);
        showSuccessToast(t('humanResources.messages.actorCreated', 'HR Actor created successfully'));
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving HR Actor:', error);
      showErrorToast(
        isEditing
          ? t('humanResources.messages.updateError', 'Error updating HR Actor')
          : t('humanResources.messages.createError', 'Error creating HR Actor')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing
              ? t('humanResources.editActor', 'Edit HR Actor')
              : t('humanResources.addActor', 'Add HR Actor')}
          </h2>
          <Button variant="outline" type="button" onClick={onClose} icon={<X className="h-4 w-4" />}>
            {t('common.cancel', 'Cancel')}
          </Button>
        </div>

        {/* Basic Info Section */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <User className="h-5 w-5 mr-2 text-emerald-600" />
            {t('humanResources.form.basicInfo', 'Basic Information')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('humanResources.form.firstName', 'First Name')} *
              </label>
              <Input
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                placeholder="Jean"
                className={errors.firstName ? 'border-red-500' : ''}
              />
              {errors.firstName && (
                <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('humanResources.form.lastName', 'Last Name')} *
              </label>
              <Input
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                placeholder="Dupont"
                className={errors.lastName ? 'border-red-500' : ''}
              />
              {errors.lastName && (
                <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('humanResources.form.phone', 'Phone')} *
              </label>
              <Input
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="+237 6XX XXX XXX"
                className={errors.phone ? 'border-red-500' : ''}
              />
              {errors.phone && (
                <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('humanResources.form.email', 'Email')}
              </label>
              <Input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="jean.dupont@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('humanResources.form.actorType', 'Actor Type')} *
              </label>
              <select
                name="actorType"
                value={formData.actorType}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {ALL_HR_ACTOR_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {HR_ACTOR_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            {formData.actorType === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('humanResources.form.customActorType', 'Custom Type')} *
                </label>
                <Input
                  name="customActorType"
                  value={formData.customActorType}
                  onChange={handleInputChange}
                  placeholder="e.g., Agent de sécurité"
                  className={errors.customActorType ? 'border-red-500' : ''}
                />
                {errors.customActorType && (
                  <p className="text-red-500 text-xs mt-1">{errors.customActorType}</p>
                )}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('humanResources.form.department', 'Department')}
              </label>
              <Input
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                placeholder="e.g., Sécurité, Ventes"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('humanResources.form.position', 'Position')}
              </label>
              <Input
                name="position"
                value={formData.position}
                onChange={handleInputChange}
                placeholder="e.g., Chef d'équipe"
              />
            </div>
          </div>
        </div>

        {/* Employment Info Section */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Briefcase className="h-5 w-5 mr-2 text-emerald-600" />
            {t('humanResources.form.employmentInfo', 'Employment Information')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('humanResources.form.hireDate', 'Hire Date')} *
              </label>
              <Input
                name="hireDate"
                type="date"
                value={formData.hireDate}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('humanResources.form.endDate', 'End Date')}
              </label>
              <Input
                name="endDate"
                type="date"
                value={formData.endDate}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('humanResources.form.contractType', 'Contract Type')}
              </label>
              <select
                name="contractType"
                value={formData.contractType}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {ALL_CONTRACT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {CONTRACT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('humanResources.form.salary', 'Salary')} (FCFA)
              </label>
              <Input
                name="salary"
                type="number"
                value={formData.salary}
                onChange={handleInputChange}
                placeholder="e.g., 150000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('humanResources.form.salaryFrequency', 'Payment Frequency')}
              </label>
              <select
                name="salaryFrequency"
                value={formData.salaryFrequency}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {ALL_SALARY_FREQUENCIES.map((freq) => (
                  <option key={freq} value={freq}>
                    {SALARY_FREQUENCY_LABELS[freq]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('humanResources.form.status', 'Status')}
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="active">{HR_ACTOR_STATUS_LABELS.active}</option>
                <option value="inactive">{HR_ACTOR_STATUS_LABELS.inactive}</option>
                <option value="archived">{HR_ACTOR_STATUS_LABELS.archived}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Address Section */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <MapPin className="h-5 w-5 mr-2 text-emerald-600" />
            {t('humanResources.form.addressInfo', 'Address')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('humanResources.form.address', 'Address')}
              </label>
              <Input
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="e.g., 123 Rue Principale"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('humanResources.form.city', 'City')}
              </label>
              <Input
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                placeholder="e.g., Douala"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('humanResources.form.country', 'Country')}
              </label>
              <Input
                name="country"
                value={formData.country}
                onChange={handleInputChange}
                placeholder="e.g., Cameroun"
              />
            </div>
          </div>
        </div>

        {/* Emergency Contact Section */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Phone className="h-5 w-5 mr-2 text-emerald-600" />
            {t('humanResources.form.emergencyContact', 'Emergency Contact')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('humanResources.form.emergencyName', 'Contact Name')}
              </label>
              <Input
                name="emergencyName"
                value={formData.emergencyName}
                onChange={handleInputChange}
                placeholder="e.g., Marie Dupont"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('humanResources.form.emergencyPhone', 'Contact Phone')}
              </label>
              <Input
                name="emergencyPhone"
                type="tel"
                value={formData.emergencyPhone}
                onChange={handleInputChange}
                placeholder="+237 6XX XXX XXX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('humanResources.form.emergencyRelationship', 'Relationship')}
              </label>
              <Input
                name="emergencyRelationship"
                value={formData.emergencyRelationship}
                onChange={handleInputChange}
                placeholder="e.g., Épouse, Frère"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" type="button" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting} icon={<Save className="h-4 w-4" />}>
            {isSubmitting
              ? t('common.saving', 'Saving...')
              : isEditing
              ? t('common.update', 'Update')
              : t('common.save', 'Save')}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default HRActorForm;
