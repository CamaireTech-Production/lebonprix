import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Phone, Hash, Link } from 'lucide-react';
import type { PaymentMethod, PaymentMethodType } from '../../types/order';
import Button from '../common/Button';
import Input from '../common/Input';

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (paymentMethod: PaymentMethod) => void;
  onUpdate: (id: string, paymentMethod: Partial<PaymentMethod>) => void;
  onDelete: (id: string) => void;
  paymentMethods: PaymentMethod[];
}

const PaymentMethodModal: React.FC<PaymentMethodModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  onDelete,
  paymentMethods
}) => {
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'phone' as PaymentMethodType,
    value: '',
    isActive: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingMethod) {
      setFormData({
        name: editingMethod.name,
        type: editingMethod.type,
        value: editingMethod.value,
        isActive: editingMethod.isActive
      });
    } else {
      setFormData({
        name: '',
        type: 'phone',
        value: '',
        isActive: true
      });
    }
    setErrors({});
  }, [editingMethod, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Payment method name is required';
    }

    if (!formData.value.trim()) {
      newErrors.value = 'Payment method value is required';
    }

    // Type-specific validation
    if (formData.type === 'phone' && !/^\+?[\d\s\-\(\)]+$/.test(formData.value)) {
      newErrors.value = 'Please enter a valid phone number';
    }

    if (formData.type === 'ussd' && !/^\*[\d\*#]+#$/.test(formData.value)) {
      newErrors.value = 'USSD code should start with * and end with # (e.g., *126#)';
    }

    if (formData.type === 'link' && !/^https?:\/\/.+/.test(formData.value)) {
      newErrors.value = 'Please enter a valid URL starting with http:// or https://';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const paymentMethod: PaymentMethod = {
      id: editingMethod?.id || `pm_${Date.now()}`,
      name: formData.name.trim(),
      type: formData.type,
      value: formData.value.trim(),
      isActive: formData.isActive,
      createdAt: editingMethod?.createdAt || new Date()
    };

    if (editingMethod) {
      onUpdate(editingMethod.id, paymentMethod);
    } else {
      onSave(paymentMethod);
    }

    setEditingMethod(null);
    onClose();
  };

  const handleEdit = (method: PaymentMethod) => {
    setEditingMethod(method);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this payment method?')) {
      onDelete(id);
    }
  };

  const handleCancel = () => {
    setEditingMethod(null);
    onClose();
  };

  const getTypeIcon = (type: PaymentMethodType) => {
    switch (type) {
      case 'phone':
        return <Phone className="h-4 w-4" />;
      case 'ussd':
        return <Hash className="h-4 w-4" />;
      case 'link':
        return <Link className="h-4 w-4" />;
      default:
        return <Phone className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: PaymentMethodType) => {
    switch (type) {
      case 'phone':
        return 'Phone Number';
      case 'ussd':
        return 'USSD Code';
      case 'link':
        return 'Payment Link';
      default:
        return 'Phone Number';
    }
  };

  const getPlaceholder = (type: PaymentMethodType) => {
    switch (type) {
      case 'phone':
        return '+237 6XX XXX XXX';
      case 'ussd':
        return '*126#';
      case 'link':
        return 'https://payment.example.com';
      default:
        return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {editingMethod ? 'Edit Payment Method' : 'Add Payment Method'}
          </h3>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Payment Method Name */}
            <div>
              <Input
                label="Payment Method Name"
                name="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                error={errors.name}
                placeholder="e.g., MTN Mobile Money, Orange Money"
                required
              />
            </div>

            {/* Payment Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Type
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['phone', 'ussd', 'link'] as PaymentMethodType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type }))}
                    className={`flex items-center justify-center space-x-2 p-3 border rounded-lg transition-colors ${
                      formData.type === type
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {getTypeIcon(type)}
                    <span className="text-sm font-medium">{getTypeLabel(type)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Value */}
            <div>
              <Input
                label={getTypeLabel(formData.type)}
                name="value"
                value={formData.value}
                onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                error={errors.value}
                placeholder={getPlaceholder(formData.type)}
                required
              />
            </div>

            {/* Active Status */}
            <div className="flex items-center space-x-3">
              <input
                id="isActive"
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                Active (show in WhatsApp messages)
              </label>
            </div>
          </form>

          {/* Existing Payment Methods */}
          {paymentMethods.length > 0 && (
            <div className="mt-8">
              <h4 className="text-sm font-medium text-gray-900 mb-4">Existing Payment Methods</h4>
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      {getTypeIcon(method.type)}
                      <div>
                        <p className="font-medium text-gray-900">{method.name}</p>
                        <p className="text-sm text-gray-500">
                          {method.type === 'phone' && '📞'}
                          {method.type === 'ussd' && '🔢'}
                          {method.type === 'link' && '🔗'}
                          {' '}{method.value}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        method.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {method.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={() => handleEdit(method)}
                        className="text-gray-500 hover:text-emerald-600"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(method.id)}
                        className="text-gray-500 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
          >
            {editingMethod ? 'Update Payment Method' : 'Add Payment Method'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodModal;
