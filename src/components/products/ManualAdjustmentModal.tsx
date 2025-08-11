import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { 
  adjustStockManually, 
  getProductBatchesForAdjustment,
  validateBatchAdjustment 
} from '../../services/firestore';
import type { Product, StockBatch } from '../../types/models';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import { formatCostPrice } from '../../utils/inventoryManagement';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

interface ManualAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSuccess?: () => void;
}

const ManualAdjustmentModal: React.FC<ManualAdjustmentModalProps> = ({
  isOpen,
  onClose,
  product,
  onSuccess
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    batchId: '',
    quantityChange: '',
    newCostPrice: '',
    notes: ''
  });

  // Load available batches when modal opens
  useEffect(() => {
    if (isOpen && product && user?.uid) {
      loadBatches();
    }
  }, [isOpen, product, user?.uid]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        batchId: '',
        quantityChange: '',
        newCostPrice: '',
        notes: ''
      });
      setSelectedBatch(null);
      setValidationErrors([]);
    }
  }, [isOpen]);

  const loadBatches = async () => {
    if (!product) return;
    
    setLoadingBatches(true);
    try {
      const availableBatches = await getProductBatchesForAdjustment(product.id);
      setBatches(availableBatches);
    } catch (error) {
      console.error('Error loading batches:', error);
      alert('Error loading available batches');
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Update selected batch when batch selection changes
    if (field === 'batchId') {
      const batch = batches.find(b => b.id === value);
      setSelectedBatch(batch || null);
      
      // Pre-fill current cost price
      if (batch) {
        setFormData(prev => ({
          ...prev,
          newCostPrice: batch.costPrice.toString()
        }));
      }
    }

    // Validate on input change with delay to avoid too many validations
    setTimeout(() => {
      validateForm();
    }, 300);
  };

  const validateForm = () => {
    const errors: string[] = [];
    
    if (!formData.batchId) {
      errors.push('Please select a batch');
    }

    if (!formData.quantityChange) {
      errors.push('Please enter quantity change');
    } else {
      const quantityChange = parseFloat(formData.quantityChange);
      if (isNaN(quantityChange)) {
        errors.push('Quantity change must be a valid number');
      }
    }

    if (formData.newCostPrice) {
      const newCostPrice = parseFloat(formData.newCostPrice);
      if (isNaN(newCostPrice) || newCostPrice < 0) {
        errors.push('New cost price must be a valid positive number');
      }
    }

    // Validate with selected batch
    if (selectedBatch) {
      const quantityChange = parseFloat(formData.quantityChange) || 0;
      const newCostPrice = parseFloat(formData.newCostPrice) || selectedBatch.costPrice;
      
      const validation = validateBatchAdjustment(selectedBatch, quantityChange, newCostPrice);
      errors.push(...validation.errors);
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!product || !user?.uid || !selectedBatch) return;

    if (!validateForm()) {
      showErrorToast('Please fix the validation errors before submitting');
      return;
    }

    const quantityChange = parseFloat(formData.quantityChange);
    const newCostPrice = formData.newCostPrice ? parseFloat(formData.newCostPrice) : undefined;

    setLoading(true);

    try {
      await adjustStockManually(
        product.id,
        selectedBatch.id,
        quantityChange,
        user.uid,
        newCostPrice,
        formData.notes || undefined
      );

      showSuccessToast('Stock adjusted successfully!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error adjusting stock:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showErrorToast(`Failed to adjust stock: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };



  const getBatchOptions = () => {
    return [
      { value: '', label: 'Select a batch to adjust' },
      ...batches.map(batch => ({
        value: batch.id,
        label: `Batch ${batch.id.slice(-8)} - ${batch.remainingQuantity} units @ ${formatCostPrice(batch.costPrice)}`
      }))
    ];
  };

  const calculateNewRemainingQuantity = () => {
    if (!selectedBatch) return 0;
    const quantityChange = parseFloat(formData.quantityChange) || 0;
    return selectedBatch.remainingQuantity + quantityChange;
  };

  const calculateNewStock = () => {
    if (!product) return 0;
    const quantityChange = parseFloat(formData.quantityChange) || 0;
    return product.stock + quantityChange;
  };

  if (!product) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manual Stock Adjustment - ${product.name}`}
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
              <p className="text-gray-900">{product.stock}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Selling Price:</span>
              <p className="text-gray-900">{formatCostPrice(product.sellingPrice)}</p>
            </div>
          </div>
        </div>

        {/* Batch Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Batch Selection</h3>
          
          {loadingBatches ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading available batches...</p>
            </div>
          ) : batches.length === 0 ? (
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                No active batches found for this product. Please create a batch first.
              </p>
            </div>
          ) : (
            <Select
              label="Select Batch"
              value={formData.batchId}
              onChange={(value) => handleInputChange('batchId', value)}
              options={getBatchOptions()}
              required
            />
          )}
        </div>

        {/* Selected Batch Information */}
        {selectedBatch && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-blue-900 mb-2">Selected Batch Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-blue-700">Batch ID:</span>
                <p className="text-blue-900 font-mono">{selectedBatch.id}</p>
              </div>
              <div>
                <span className="font-medium text-blue-700">Remaining Quantity:</span>
                <p className="text-blue-900">{selectedBatch.remainingQuantity}</p>
              </div>
              <div>
                <span className="font-medium text-blue-700">Current Cost Price:</span>
                <p className="text-blue-900">{formatCostPrice(selectedBatch.costPrice)}</p>
              </div>
              <div>
                <span className="font-medium text-blue-700">Status:</span>
                <p className="text-blue-900 capitalize">{selectedBatch.status}</p>
              </div>
              {selectedBatch.supplierId && (
                <div className="col-span-2">
                  <span className="font-medium text-blue-700">Supplier:</span>
                  <p className="text-blue-900">{selectedBatch.supplierId}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Adjustment Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Adjustment Details</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantity Change"
              type="number"
              value={formData.quantityChange}
              onChange={(value) => handleInputChange('quantityChange', value)}
              placeholder="+10 or -5"
              required
              step="0.01"
            />
            
            <Input
              label="New Cost Price (Optional)"
              type="number"
              value={formData.newCostPrice}
              onChange={(value) => handleInputChange('newCostPrice', value)}
              placeholder="Leave empty to keep current"
              min="0"
              step="0.01"
            />
          </div>

          {/* Preview Changes */}
          {selectedBatch && formData.quantityChange && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-green-800 mb-2">Preview Changes</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-green-700">New Batch Quantity:</span>
                  <p className="text-green-900">{calculateNewRemainingQuantity()}</p>
                </div>
                <div>
                  <span className="font-medium text-green-700">New Product Stock:</span>
                  <p className="text-green-900">{calculateNewStock()}</p>
                </div>
                <div>
                  <span className="font-medium text-green-700">New Cost Price:</span>
                  <p className="text-green-900">
                    {formData.newCostPrice 
                      ? formatCostPrice(parseFloat(formData.newCostPrice))
                      : formatCostPrice(selectedBatch.costPrice)
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="bg-red-50 p-4 rounded-lg">
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
            placeholder="Add any notes about this adjustment..."
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
            disabled={loading || validationErrors.length > 0 || !selectedBatch}
          >
            {loading ? 'Adjusting...' : 'Adjust Stock'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ManualAdjustmentModal; 