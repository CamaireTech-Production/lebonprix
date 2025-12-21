import React, { useState, useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { getMatiereBatchesForAdjustment, adjustMatiereStockManually } from '@services/firestore/stock/stockAdjustments';
import { validateBatchAdjustment } from '@services/firestore/stock/stockService';
import type { Matiere, StockBatch } from '../../types/models';
import { Modal, Button, Input, Select } from '@components/common';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';

interface ManualAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  matiere: Matiere | null;
  selectedBatch?: StockBatch | null;
  batchTotals?: { remaining: number; total: number };
  onSuccess?: () => void;
}

const MatiereManualAdjustmentModal: React.FC<ManualAdjustmentModalProps> = ({
  isOpen,
  onClose,
  matiere,
  selectedBatch: selectedBatchProp,
  batchTotals,
  onSuccess
}) => {
  const { company } = useAuth();
  
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const derivedRemaining = batchTotals?.remaining ?? 0;
  const derivedTotal = batchTotals?.total;
  
  const [formData, setFormData] = useState({
    batchId: '',
    quantityChange: '',
    notes: ''
  });

  // Load available batches when modal opens
  useEffect(() => {
    if (isOpen && matiere && company) {
      loadBatches();
    }
  }, [isOpen, matiere, company]);

  // Preselect batch when provided
  useEffect(() => {
    if (!isOpen || !selectedBatchProp) return;
    // If batches already loaded, set immediately
    if (batches.length > 0) {
      const match = batches.find(b => b.id === selectedBatchProp.id);
      if (match) {
        setSelectedBatch(match);
        setFormData(prev => ({
          ...prev,
          batchId: match.id
        }));
      }
    }
  }, [isOpen, selectedBatchProp, batches]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        batchId: '',
        quantityChange: '',
        notes: ''
      });
      setSelectedBatch(selectedBatchProp ?? null);
      setValidationErrors([]);
    }
  }, [isOpen, selectedBatchProp]);

  const loadBatches = async () => {
    if (!matiere) return;
    
    setLoadingBatches(true);
    try {
      const availableBatches = await getMatiereBatchesForAdjustment(matiere.id);
      setBatches(availableBatches);
    } catch (error) {
      console.error('Error loading batches:', error);
      showErrorToast('Error loading available batches');
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

    // Quantity change is required
    if (!formData.quantityChange) {
      errors.push('Enter a quantity change');
    }

    if (formData.quantityChange) {
      const quantityChange = parseFloat(formData.quantityChange);
      if (isNaN(quantityChange)) {
        errors.push('Quantity change must be a valid number');
      }
    }

    // Validate with selected batch (no cost price validation for matieres)
    if (selectedBatch) {
      const quantityChange = parseFloat(formData.quantityChange || '0') || 0;
      
      const validation = validateBatchAdjustment(selectedBatch, quantityChange, undefined);
      errors.push(...validation.errors);
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!matiere || !user?.uid || !selectedBatch) return;

    if (!validateForm()) {
      showErrorToast('Please fix the validation errors before submitting');
      return;
    }

    const quantityChange = parseFloat(formData.quantityChange || '0') || 0;

    setLoading(true);

    try {
      await adjustMatiereStockManually(
        matiere.id,
        selectedBatch.id,
        quantityChange,
        company?.id || '',
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
        label: `Batch ${batch.id.slice(-8)} - ${batch.remainingQuantity} ${matiere?.unit || ''}`
      }))
    ];
  };

  const calculateNewRemainingQuantity = () => {
    if (!selectedBatch) return 0;
    const quantityChange = parseFloat(formData.quantityChange || '0') || 0;
    return selectedBatch.remainingQuantity + quantityChange;
  };

  const calculateNewStock = () => {
    const quantityChange = parseFloat(formData.quantityChange || '0') || 0;
    const baseStock = typeof derivedRemaining === 'number' ? derivedRemaining : 0;
    return baseStock + quantityChange;
  };

  if (!matiere) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manual Stock Adjustment - ${matiere.name}`}
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
                No active batches found for this matiere. Please create a batch first.
              </p>
            </div>
          ) : (
            <Select
              label="Select Batch"
              value={formData.batchId}
              onChange={(e) => handleInputChange('batchId', e.target.value)}
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
                <p className="text-blue-900">{selectedBatch.remainingQuantity} {matiere.unit}</p>
              </div>
              <div>
                <span className="font-medium text-blue-700">Status:</span>
                <p className="text-blue-900 capitalize">{selectedBatch.status}</p>
              </div>
            </div>
          </div>
        )}

        {/* Adjustment Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Adjustment Details</h3>
          
          <Input
            label={`Quantity Change (${matiere.unit})`}
            type="number"
            value={formData.quantityChange}
            onChange={(e) => handleInputChange('quantityChange', e.target.value)}
            placeholder="+10 or -5"
            required
            step="0.01"
          />

          {/* Preview Changes */}
          {selectedBatch && formData.quantityChange && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-green-800 mb-2">Preview Changes</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-green-700">New Batch Quantity:</span>
                  <p className="text-green-900">{calculateNewRemainingQuantity()} {matiere.unit}</p>
                </div>
                <div>
                  <span className="font-medium text-green-700">New Matiere Stock:</span>
                  <p className="text-green-900">{calculateNewStock()} {matiere.unit}</p>
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
        <div className="flex justify-between pt-4">
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
            {loading ? 'Processing...' : 'Adjust Stock'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default MatiereManualAdjustmentModal;

