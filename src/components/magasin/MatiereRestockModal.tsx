import React, { useState, useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { restockMatiere } from '@services/firestore/stock/stockAdjustments';
import type { Matiere } from '../../types/models';
import { Modal, Button, Input, PriceInput } from '@components/common';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import { formatCostPrice } from '@utils/inventory/inventoryManagement';

interface RestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  matiere: Matiere | null;
  batchTotals?: { remaining: number; total: number };
  onSuccess?: () => void;
}

const MatiereRestockModal: React.FC<RestockModalProps> = ({
  isOpen,
  onClose,
  matiere,
  batchTotals,
  onSuccess
}) => {
  const { company } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    quantity: '',
    costPrice: '',
    notes: ''
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const derivedRemaining = batchTotals?.remaining ?? 0;
  const derivedTotal = batchTotals?.total;

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        quantity: '',
        costPrice: '',
        notes: ''
      });
    }
  }, [isOpen]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation errors when user starts typing
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  const validateForm = () => {
    const errors: string[] = [];
    
    // Validate quantity
    const quantity = parseInt(formData.quantity, 10);
    if (isNaN(quantity) || quantity <= 0) {
      errors.push('Please enter a valid quantity (whole number greater than 0)');
    }
    
    // Validate cost price if provided
    if (formData.costPrice && formData.costPrice.trim() !== '') {
      const costPrice = parseFloat(formData.costPrice);
      if (isNaN(costPrice) || costPrice < 0) {
        errors.push('Please enter a valid cost price (greater than or equal to 0)');
      }
    }
    
    return errors;
  };

  const calculateTotalCost = (): number => {
    const quantity = parseInt(formData.quantity, 10);
    const costPrice = parseFloat(formData.costPrice);
    if (isNaN(quantity) || isNaN(costPrice) || quantity <= 0 || costPrice < 0) {
      return 0;
    }
    return quantity * costPrice;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!matiere || !company) return;

    // Validate form
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    const quantity = parseInt(formData.quantity, 10);
    const costPrice = formData.costPrice && formData.costPrice.trim() !== '' 
      ? parseFloat(formData.costPrice) 
      : undefined;

    setLoading(true);

    try {
      await restockMatiere(
        matiere.id,
        quantity,
        company.id,
        formData.notes || undefined,
        costPrice
      );

      showSuccessToast('Matiere restocked successfully!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error restocking matiere:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showErrorToast(`Failed to restock matiere: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (!matiere) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Restock ${matiere.name}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Matiere Information */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Matiere Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Name:</span>
              <p className="text-gray-900">{matiere.name}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Unit:</span>
              <p className="text-gray-900">{matiere.unit}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Current Stock:</span>
              <p className="text-gray-900">
                {derivedTotal !== undefined
                  ? `${derivedRemaining} / ${derivedTotal} ${matiere.unit}`
                  : `${derivedRemaining} ${matiere.unit}`}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Category:</span>
              <p className="text-gray-900">{matiere.refCategorie || '—'}</p>
            </div>
          </div>
        </div>

        {/* Restock Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Restock Details</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={`Quantity (${matiere.unit})`}
              type="number"
              value={formData.quantity}
              onChange={(e) => handleInputChange('quantity', e.target.value)}
              placeholder="Enter quantity"
              required
              min="1"
              step="1"
            />
            
            <PriceInput
              label="Cost Price per Unit (Optional)"
              name="costPrice"
              value={formData.costPrice}
              onChange={(e) => handleInputChange('costPrice', e.target.value)}
              placeholder="Enter cost price"
              allowDecimals={true}
            />
          </div>

          {/* Total Cost Display - only show if cost price is provided */}
          {formData.costPrice && formData.costPrice.trim() !== '' && formData.quantity && parseInt(formData.quantity, 10) > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm font-medium text-blue-800">Total Cost</div>
              <div className="text-lg font-semibold text-blue-900">
                {formatCostPrice(calculateTotalCost())}
              </div>
              <div className="text-xs text-blue-700 mt-1">
                {formData.costPrice && parseFloat(formData.costPrice) > 0 
                  ? 'An expense entry will be created for this restock'
                  : 'No expense entry will be created'}
              </div>
            </div>
          )}
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <h4 className="text-md font-medium text-red-800 mb-2">Validation Errors</h4>
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index} className="text-sm text-red-700">{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder="Add any notes about this restock..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            rows={3}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            isLoading={loading}
            loadingText="Restocking..."
          >
            Restock Matiere
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default MatiereRestockModal;
