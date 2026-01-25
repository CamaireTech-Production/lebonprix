import React, { useState, useEffect } from 'react';
import { Modal, ModalFooter, Input } from '@components/common';
import { useCustomUnits } from '@hooks/business/useCustomUnits';
import { showErrorToast } from '@utils/core/toast';

interface CreateCustomUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialValue?: string; // Pre-filled value from search input
  onSuccess?: (unitValue: string) => void;
}

const CreateCustomUnitModal: React.FC<CreateCustomUnitModalProps> = ({
  isOpen,
  onClose,
  initialValue = '',
  onSuccess
}) => {
  const { addCustomUnit } = useCustomUnits();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    value: '',
    label: ''
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Auto-generate value from label if initialValue is provided
      const normalizedValue = initialValue
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');

      setFormData({
        value: normalizedValue || '',
        label: initialValue || ''
      });
    } else {
      setFormData({
        value: '',
        label: ''
      });
    }
  }, [isOpen, initialValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === 'label') {
      // Auto-generate value from label
      const normalizedValue = value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');

      setFormData((prev) => ({
        ...prev,
        label: value,
        value: normalizedValue
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.label.trim()) {
      showErrorToast('Le libellé est requis');
      return;
    }

    if (!formData.value.trim()) {
      showErrorToast('Le code technique est requis');
      return;
    }

    setIsSubmitting(true);

    try {
      const newUnit = await addCustomUnit(formData.value.trim(), formData.label.trim());

      if (newUnit) {
        onSuccess?.(newUnit.value);
        onClose();
      }
    } catch (error) {
      // Error is already handled in addCustomUnit
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Créer une unité personnalisée"
      size="md"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleSubmit}
          confirmText="Créer"
          isLoading={isSubmitting}
        />
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Créez une unité personnalisée qui sera disponible uniquement pour votre entreprise.
          </p>
        </div>

        <Input
          label="Libellé *"
          name="label"
          value={formData.label}
          onChange={handleInputChange}
          placeholder="Ex: Boîte spéciale"
          required
        />

        <Input
          label="Code technique *"
          name="value"
          value={formData.value}
          onChange={handleInputChange}
          placeholder="Ex: custom_box"
          required
        />

        <div className="bg-gray-50 rounded-md p-3">
          <p className="text-xs text-gray-600">
            <strong>Prévisualisation:</strong> {formData.label || 'Libellé'} ({formData.value || 'code'})
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> Le code technique sera automatiquement normalisé (minuscules, espaces remplacés par des underscores).
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default CreateCustomUnitModal;

