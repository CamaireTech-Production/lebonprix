import React, { useState, useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { getMatiereBatchesForAdjustment } from '@services/firestore/stock/stockAdjustments';
import { adjustMatiereStockForDamage } from '@services/firestore/stock/stockAdjustments';
import type { Matiere, StockBatch } from '../../types/models';
import { Modal, Button, Input, Select } from '@components/common';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';

interface DamageAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  matiere: Matiere | null;
  selectedBatch?: StockBatch | null;
  batchTotals?: { remaining: number; total: number };
  onSuccess?: () => void;
}

const MatiereDamageAdjustmentModal: React.FC<DamageAdjustmentModalProps> = ({
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
  const [formData, setFormData] = useState({
    batchId: '',
    damagedQuantity: '',
    notes: ''
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const derivedRemaining = batchTotals?.remaining ?? 0;
  const derivedTotal = batchTotals?.total;

  // Load available batches when modal opens
  useEffect(() => {
    if (isOpen && matiere && company) {
      loadBatches();
    }
  }, [isOpen, matiere, company]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        batchId: '',
        damagedQuantity: '',
        notes: ''
      });
      setSelectedBatch(selectedBatchProp ?? null);
    }
  }, [isOpen, selectedBatchProp]);

  // Preselect batch when provided
  useEffect(() => {
    if (!isOpen || !selectedBatchProp) return;
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
    
    // Clear validation errors when user starts typing
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  const validateForm = () => {
    const errors: string[] = [];
    
    if (!formData.batchId) {
      errors.push('Please select a batch');
    }

    const damagedQuantity = parseInt(formData.damagedQuantity, 10);
    if (isNaN(damagedQuantity) || damagedQuantity <= 0) {
      errors.push('Please enter a valid damaged quantity (whole number greater than 0)');
    }

    if (selectedBatch && damagedQuantity > selectedBatch.remainingQuantity) {
      errors.push(`Damaged quantity cannot exceed remaining batch quantity (${selectedBatch.remainingQuantity} ${matiere?.unit || ''})`);
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!matiere || !company || !selectedBatch) return;

    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    const damagedQuantity = parseInt(formData.damagedQuantity, 10);

    setLoading(true);

    try {
      await adjustMatiereStockForDamage(
        matiere.id,
        selectedBatch.id,
        damagedQuantity,
        company.id,
        formData.notes || undefined
      );

      showSuccessToast('Damage adjustment recorded successfully!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error recording damage adjustment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showErrorToast(`Failed to record damage adjustment: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const getBatchOptions = () => {
    return [
      { value: '', label: 'Select a batch to record damage' },
      ...batches.map(batch => ({
        value: batch.id,
        label: `Batch ${batch.id.slice(-8)} - ${batch.remainingQuantity} ${matiere?.unit || ''}`
      }))
    ];
  };

  const calculateNewRemainingQuantity = () => {
    if (!selectedBatch) return 0;
    const damagedQuantity = parseInt(formData.damagedQuantity || '0', 10) || 0;
    return selectedBatch.remainingQuantity - damagedQuantity;
  };

  const calculateNewStock = () => {
    const damagedQuantity = parseInt(formData.damagedQuantity || '0', 10) || 0;
    const currentStock = typeof derivedRemaining === 'number' ? derivedRemaining : 0;
    return currentStock - damagedQuantity;
  };


  if (!matiere) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Damage Adjustment - ${matiere.name}`}
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
              <p className="text-gray-900">{matiere.unit || '—'}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Current Stock:</span>
              <p className="text-gray-900">
                {derivedTotal !== undefined
                  ? `${derivedRemaining} / ${derivedTotal} ${matiere.unit || 'unité'}`
                  : `${derivedRemaining} ${matiere.unit || 'unité'}`}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Category:</span>
              <p className="text-gray-900">{matiere.refCategorie || '—'}</p>
            </div>
          </div>
        </div>

        {/* Important Notice */}
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-orange-800">
                Damage Adjustment Notice
              </h3>
              <div className="mt-2 text-sm text-orange-700">
                <p>
                  • This will reduce stock from the selected batch<br/>
                  • Supplier debt will NOT be affected (debt remains unchanged)<br/>
                  • This is for recording damaged/lost inventory
                </p>
              </div>
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
                <p className="text-blue-900">{selectedBatch.remainingQuantity} {matiere.unit || 'unité'}</p>
              </div>
              <div>
                <span className="font-medium text-blue-700">Status:</span>
                <p className="text-blue-900 capitalize">{selectedBatch.status}</p>
              </div>
            </div>
          </div>
        )}

        {/* Damage Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Damage Details</h3>
          
          <Input
            label={`Damaged Quantity (${matiere.unit || 'unité'})`}
            type="number"
            value={formData.damagedQuantity}
            onChange={(e) => handleInputChange('damagedQuantity', e.target.value)}
            placeholder="Enter damaged quantity"
            required
            min="1"
            step="1"
            max={selectedBatch?.remainingQuantity || undefined}
          />

          {/* Preview Changes */}
          {selectedBatch && formData.damagedQuantity && (
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-red-800 mb-2">Preview Changes</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-red-700">New Batch Quantity:</span>
                  <p className="text-red-900">{calculateNewRemainingQuantity()} {matiere.unit || 'unité'}</p>
                </div>
                <div>
                  <span className="font-medium text-red-700">New Matiere Stock:</span>
                  <p className="text-red-900">{calculateNewStock()} {matiere.unit || 'unité'}</p>
                </div>
                <div>
                  <span className="font-medium text-red-700">Supplier Debt:</span>
                  <p className="text-red-900">Unchanged</p>
                </div>
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
            Damage Notes (Optional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder="Describe the damage or reason for adjustment..."
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
            disabled={loading || !selectedBatch}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
            isLoading={loading}
            loadingText="Recording..."
          >
            Record Damage
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default MatiereDamageAdjustmentModal;

