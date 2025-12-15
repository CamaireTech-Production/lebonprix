import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { 
  adjustStockManually, 
  getProductBatchesForAdjustment,
  validateBatchAdjustment 
} from '../../services/firestore';
import { adjustMultipleBatchesManually } from '../../services/stockAdjustments';
import type { Product, StockBatch } from '../../types/models';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import { formatCostPrice } from '../../utils/inventoryManagement';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

// Type for temporary batch edits
interface TempBatchEdit {
  batchId: string;
  batch: StockBatch;
  quantityChange: number;
  newCostPrice?: number;
  notes?: string;
  timestamp: Date;
}

interface ManualAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  selectedBatch?: StockBatch | null;
  batchTotals?: { remaining: number; total: number };
  onSuccess?: () => void;
}

const ManualAdjustmentModal: React.FC<ManualAdjustmentModalProps> = ({
  isOpen,
  onClose,
  product,
  selectedBatch: selectedBatchProp,
  batchTotals,
  onSuccess
}) => {
  const { t } = useTranslation();
  const { user, company } = useAuth();
  
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // New state for temporary batch edits
  const [tempEdits, setTempEdits] = useState<TempBatchEdit[]>([]);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const derivedRemaining = batchTotals?.remaining ?? product?.stock ?? 0;
  const derivedTotal = batchTotals?.total;
  
  const [formData, setFormData] = useState({
    batchId: '',
    quantityChange: '',
    newCostPrice: '',
    notes: ''
  });

  // Load available batches when modal opens
  useEffect(() => {
    if (isOpen && product && company) {
      loadBatches();
    }
  }, [isOpen, product, company]);

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
          batchId: match.id,
          newCostPrice: match.costPrice.toString()
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
        newCostPrice: '',
        notes: ''
      });
      setSelectedBatch(selectedBatchProp ?? null);
      setValidationErrors([]);
      setTempEdits([]);
      setIsEditingMode(false);
    }
  }, [isOpen, selectedBatchProp]);

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

  // Add batch edit to temporary list
  const addTempEdit = () => {
    if (!selectedBatch || !validateForm()) {
      showErrorToast('Please fix validation errors before adding');
      return;
    }

    const quantityChange = parseFloat(formData.quantityChange);
    const newCostPrice = formData.newCostPrice ? parseFloat(formData.newCostPrice) : undefined;

    // Check if this batch is already in temp edits
    const existingEditIndex = tempEdits.findIndex(edit => edit.batchId === selectedBatch.id);

    const newEdit: TempBatchEdit = {
      batchId: selectedBatch.id,
      batch: selectedBatch,
      quantityChange,
      newCostPrice,
      notes: formData.notes || undefined,
      timestamp: new Date()
    };

    if (existingEditIndex >= 0) {
      // Update existing edit
      const updatedEdits = [...tempEdits];
      updatedEdits[existingEditIndex] = newEdit;
      setTempEdits(updatedEdits);
      showSuccessToast('Batch edit updated in temporary list');
    } else {
      // Add new edit
      setTempEdits(prev => [...prev, newEdit]);
      showSuccessToast('Batch edit added to temporary list');
    }

    // Reset form for next batch
    setFormData({
      batchId: '',
      quantityChange: '',
      newCostPrice: '',
      notes: ''
    });
    setSelectedBatch(null);
    setValidationErrors([]);
    setIsEditingMode(true);
  };

  // Remove a temporary edit
  const removeTempEdit = (batchId: string) => {
    setTempEdits(prev => prev.filter(edit => edit.batchId !== batchId));
    showSuccessToast('Batch edit removed from temporary list');
  };

  // Clear all temporary edits
  const clearTempEdits = () => {
    setTempEdits([]);
    setIsEditingMode(false);
    showSuccessToast('All temporary edits cleared');
  };

  // Submit all temporary edits as a bulk operation
  const commitAllEdits = async () => {
    if (!product || !user?.uid || tempEdits.length === 0) return;

    setLoading(true);

    try {
      // Convert temp edits to adjustment format
      const adjustments = tempEdits.map(edit => ({
        batchId: edit.batchId,
        quantityChange: edit.quantityChange,
        newCostPrice: edit.newCostPrice,
        notes: edit.notes
      }));

      // Execute bulk adjustment in a single transaction
      await adjustMultipleBatchesManually(product.id, adjustments, company.id);

      showSuccessToast(`Successfully applied ${tempEdits.length} batch adjustments!`);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error committing batch adjustments:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showErrorToast(`Failed to commit adjustments: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!product || !user?.uid) return;

    // If we're in editing mode with temp edits, commit all
    if (isEditingMode && tempEdits.length > 0) {
      await commitAllEdits();
      return;
    }

    // Otherwise, handle single batch adjustment (legacy mode)
    if (!selectedBatch) return;

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
        newCostPrice,
        company.id,
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
    // Filter out batches that are already in temp edits
    const availableBatches = batches.filter(batch => 
      !tempEdits.some(edit => edit.batchId === batch.id)
    );
    
    return [
      { value: '', label: 'Select a batch to adjust' },
      ...availableBatches.map(batch => ({
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

        {/* Enhanced Workflow Status */}
        {isEditingMode && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-blue-900 mb-2">Multi-Batch Editing Mode</h3>
            <p className="text-sm text-blue-700">
              You have {tempEdits.length} batch{tempEdits.length !== 1 ? 'es' : ''} ready for adjustment. 
              You can add more batches or finalize all changes.
            </p>
          </div>
        )}

        {/* Temporary Edits History */}
        {tempEdits.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Pending Batch Adjustments</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearTempEdits}
                className="text-red-600 border-red-600 hover:bg-red-50"
              >
                Clear All
              </Button>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="space-y-3">
                {tempEdits.map((edit, index) => (
                  <div key={edit.batchId} className="bg-white p-3 rounded border">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">
                            Batch {edit.batchId.slice(-8)}
                          </h4>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeTempEdit(edit.batchId)}
                            className="text-red-600 border-red-600 hover:bg-red-50"
                          >
                            Remove
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="font-medium text-gray-600">Quantity Change:</span>
                            <span className={`ml-2 ${edit.quantityChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {edit.quantityChange > 0 ? '+' : ''}{edit.quantityChange}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">New Cost Price:</span>
                            <span className="ml-2 text-gray-900">
                              {edit.newCostPrice ? formatCostPrice(edit.newCostPrice) : formatCostPrice(edit.batch.costPrice)}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="font-medium text-gray-600">New Quantity:</span>
                            <span className="ml-2 text-gray-900">
                              {edit.batch.remainingQuantity + edit.quantityChange}
                            </span>
                          </div>
                          {edit.notes && (
                            <div className="col-span-2">
                              <span className="font-medium text-gray-600">Notes:</span>
                              <span className="ml-2 text-gray-700">{edit.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Batch Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">
            {isEditingMode ? 'Add Another Batch' : 'Batch Selection'}
          </h3>
          
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
          ) : getBatchOptions().length === 1 ? (
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">
                All available batches have been added to the adjustment list.
              </p>
            </div>
          ) : (
            <Select
              label="Select Batch"
              value={formData.batchId}
              onChange={(e) => handleInputChange('batchId', e.target.value)}
              options={getBatchOptions()}
              required={!isEditingMode}
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
            onChange={(e) => handleInputChange('quantityChange', e.target.value)}
              placeholder="+10 or -5"
              required
              step="0.01"
            />
            
            <Input
              label="New Cost Price (Optional)"
              type="number"
              value={formData.newCostPrice}
            onChange={(e) => handleInputChange('newCostPrice', e.target.value)}
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
        <div className="flex justify-between pt-4">
          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
          
          <div className="flex space-x-3">
            {/* Add to Temporary List Button */}
            {selectedBatch && !isEditingMode && (
              <Button
                type="button"
                variant="outline"
                onClick={addTempEdit}
                disabled={loading || validationErrors.length > 0}
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                Add to List
              </Button>
            )}
            
            {/* Add Another Batch Button */}
            {selectedBatch && isEditingMode && (
              <Button
                type="button"
                variant="outline"
                onClick={addTempEdit}
                disabled={loading || validationErrors.length > 0}
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                Add Another
              </Button>
            )}
            
            {/* Single Batch Adjustment or Commit All */}
            <Button
              type="submit"
              disabled={loading || 
                (isEditingMode ? tempEdits.length === 0 : (validationErrors.length > 0 || !selectedBatch))
              }
            >
              {loading 
                ? 'Processing...' 
                : isEditingMode && tempEdits.length > 0
                  ? `Commit All (${tempEdits.length})`
                  : 'Adjust Stock'
              }
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default ManualAdjustmentModal; 