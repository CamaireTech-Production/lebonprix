import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { restockProduct, subscribeToSuppliers } from '../../services/firestore';
import type { Product, Supplier } from '../../types/models';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import { formatCostPrice } from '../../utils/inventoryManagement';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

interface RestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  batchTotals?: { remaining: number; total: number };
  onSuccess?: () => void;
}

const RestockModal: React.FC<RestockModalProps> = ({
  isOpen,
  onClose,
  product,
  batchTotals,
  onSuccess
}) => {
  const { t } = useTranslation();
  const { user, company } = useAuth();
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    quantity: '',
    costPrice: '',
    supplierId: '',
    isOwnPurchase: false,
    paymentType: 'paid' as 'paid' | 'credit', // Always require payment type
    notes: ''
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const derivedRemaining = batchTotals?.remaining ?? product?.stock ?? 0;
  const derivedTotal = batchTotals?.total;

  // Load suppliers
  useEffect(() => {
    if (isOpen && company) {
      const unsubscribe = subscribeToSuppliers(company.id, setSuppliers);
      return unsubscribe;
    }
  }, [isOpen, company]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        quantity: '',
        costPrice: '',
        supplierId: '',
        isOwnPurchase: false,
        paymentType: 'paid',
        notes: ''
      });
    }
  }, [isOpen]);

  const handleInputChange = (field: string, value: string | boolean) => {
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
    const quantity = parseFloat(formData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      errors.push('Please enter a valid quantity (greater than 0)');
    }
    
    // Validate cost price
    const costPrice = parseFloat(formData.costPrice);
    if (isNaN(costPrice) || costPrice < 0) {
      errors.push('Please enter a valid cost price (greater than or equal to 0)');
    }
    
    // Validate supplier selection for non-own purchases
    if (!formData.isOwnPurchase && !formData.supplierId) {
      errors.push('Please select a supplier for non-own purchases');
    }
    
    // Validate own purchase vs supplier selection
    if (formData.isOwnPurchase && formData.supplierId) {
      errors.push('Own purchase cannot have a supplier selected');
    }
    
    // Validate payment type for credit purchases
    if (formData.paymentType === 'credit' && formData.isOwnPurchase) {
      errors.push('Own purchases cannot be on credit');
    }
    
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!product || !company) return;

    // Validate form
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    const quantity = parseFloat(formData.quantity);
    const costPrice = parseFloat(formData.costPrice);
    const isCredit = formData.paymentType === 'credit';

    setLoading(true);

    try {
      await restockProduct(
        product.id,
        quantity,
        costPrice,
        company.id,
        formData.supplierId || undefined,
        formData.isOwnPurchase,
        isCredit,
        formData.notes || undefined
      );

      showSuccessToast('Product restocked successfully!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error restocking product:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showErrorToast(`Failed to restock product: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalCost = () => {
    const quantity = parseFloat(formData.quantity) || 0;
    const costPrice = parseFloat(formData.costPrice) || 0;
    return quantity * costPrice;
  };

  const getSupplierOptions = () => {
    return [
      { value: '', label: 'Select supplier (required for non-own purchases)' },
      ...suppliers.map(supplier => ({
        value: supplier.id,
        label: supplier.name
      }))
    ];
  };

  const getPaymentTypeOptions = () => {
    return [
      { value: 'paid', label: 'Paid' },
      { value: 'credit', label: 'Credit' }
    ];
  };

  if (!product) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Restock ${product.name}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product Information */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Product Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Name:</span>
              <p className="text-gray-900">{product.name}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Reference:</span>
              <p className="text-gray-900">{product.reference}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Current Stock:</span>
              <p className="text-gray-900">
                {derivedTotal !== undefined
                  ? `${derivedRemaining} / ${derivedTotal}`
                  : derivedRemaining}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Selling Price:</span>
              <p className="text-gray-900">{formatCostPrice(product.sellingPrice)}</p>
            </div>
          </div>
        </div>

        {/* Restock Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Restock Details</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantity"
              type="number"
              value={formData.quantity}
            onChange={(e) => handleInputChange('quantity', e.target.value)}
              placeholder="Enter quantity"
              required
              min="0.01"
              step="0.01"
            />
            
            <Input
              label="Cost Price per Unit"
              type="number"
              value={formData.costPrice}
            onChange={(e) => handleInputChange('costPrice', e.target.value)}
              placeholder="Enter cost price"
              required
              min="0"
              step="0.01"
            />
          </div>

          {/* Total Cost Display */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-sm font-medium text-blue-800">Total Cost</div>
            <div className="text-lg font-semibold text-blue-900">
              {formatCostPrice(calculateTotalCost())}
            </div>
          </div>
        </div>

        {/* Purchase Type and Supplier Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Purchase Information</h3>
          
          {/* Purchase Type Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isOwnPurchase"
                checked={formData.isOwnPurchase}
                onChange={(e) => handleInputChange('isOwnPurchase', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isOwnPurchase" className="ml-2 block text-sm text-gray-900">
                Own Purchase
              </label>
            </div>
          </div>

          {/* Supplier Selection */}
          <Select
            label="Supplier"
            value={formData.supplierId}
            onChange={(e) => handleInputChange('supplierId', e.target.value)}
            options={getSupplierOptions()}
            disabled={formData.isOwnPurchase}
          />

          {/* Payment Type Selection */}
          <Select
            label="Payment Type"
            value={formData.paymentType}
            onChange={(e) => handleInputChange('paymentType', e.target.value)}
            options={getPaymentTypeOptions()}
            disabled={formData.isOwnPurchase}
          />

          {/* Information Messages */}
          {formData.isOwnPurchase && (
            <div className="text-sm text-gray-600 bg-yellow-50 p-2 rounded">
              Own purchase selected - no supplier debt will be created
            </div>
          )}

          {formData.paymentType === 'credit' && !formData.isOwnPurchase && formData.supplierId && (
            <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
              Credit purchase selected - supplier debt will be created
            </div>
          )}

          {formData.paymentType === 'paid' && !formData.isOwnPurchase && formData.supplierId && (
            <div className="text-sm text-gray-600 bg-green-50 p-2 rounded">
              Paid purchase selected - no supplier debt will be created
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
          >
            {loading ? 'Restocking...' : 'Restock Product'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default RestockModal; 