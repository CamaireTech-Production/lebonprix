import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@contexts/AuthContext';
import { 
  getProductBatchesForAdjustment,
  validateBatchAdjustment 
} from '@services/firestore/stock/stockService';
import { adjustStockManually, adjustMultipleBatchesManually } from '@services/firestore/stock/stockAdjustments';
import type { Product, StockBatch } from '../../types/models';
import { Modal, Button, Input, PriceInput, Select } from '@components/common';
import { formatCostPrice } from '@utils/inventory/inventoryManagement';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';

// Type for temporary batch edits
interface TempBatchEdit {
  batchId: string;
  batch: StockBatch;
  quantityChange?: number; // undefined means no quantity change
  newCostPrice?: number; // undefined means no price change
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
  const derivedRemaining = batchTotals?.remaining ?? 0;
  const derivedTotal = batchTotals?.total;
  
  const [formData, setFormData] = useState({
    batchId: '',
    newStock: '',
    newCostPrice: '',
    notes: ''
  });

  // Adjustment mode: 'correction' or 'addition'
  const [adjustmentMode, setAdjustmentMode] = useState<'correction' | 'addition'>('correction');

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
        newStock: '',
        newCostPrice: '',
        notes: ''
      });
      setAdjustmentMode('correction');
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

    // Auto-determine adjustment mode when new stock is entered
    if (field === 'newStock' && selectedBatch && value.trim() !== '') {
      const inputStock = parseInt(value, 10);
      if (!isNaN(inputStock) && inputStock >= 0) {
        // If entered value is greater than current remaining, it's likely an addition
        // If entered value is less than or equal to current remaining, it's likely a correction
        if (inputStock > selectedBatch.remainingQuantity) {
          setAdjustmentMode('addition');
        } else {
          setAdjustmentMode('correction');
        }
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

    // At least one of new stock or new cost price must be provided
    const hasNewStock = formData.newStock.trim() !== '';
    const hasNewCostPrice = formData.newCostPrice.trim() !== '';
    
    if (!hasNewStock && !hasNewCostPrice) {
      errors.push('Enter a new stock quantity and/or a new cost price');
    }

    // Validate new stock only if provided
    if (hasNewStock) {
      // Check if input contains decimal point
      if (formData.newStock.includes('.')) {
        errors.push('New stock must be a whole number (no decimals)');
      } else {
        const newStock = parseInt(formData.newStock, 10);
        if (isNaN(newStock) || newStock < 0) {
          errors.push('New stock must be a valid whole number greater than or equal to 0');
        }
      }
    }

    // Validate new cost price only if provided
    if (hasNewCostPrice) {
      const newCostPrice = parseFloat(formData.newCostPrice);
      if (isNaN(newCostPrice) || newCostPrice < 0) {
        errors.push('New cost price must be a valid positive number');
      }
    }

    // Validate with selected batch - only validate fields that are being changed
    if (selectedBatch) {
      const newCostPrice = hasNewCostPrice ? parseFloat(formData.newCostPrice) : selectedBatch.costPrice;
      
      // Only validate quantity change if it's being modified
      if (hasNewStock && !formData.newStock.includes('.')) {
        const inputStock = parseInt(formData.newStock, 10);
        if (!isNaN(inputStock) && inputStock >= 0) {
          let quantityChange: number;
          if (adjustmentMode === 'correction') {
            // Correction mode: input is the new remaining quantity
            quantityChange = inputStock - selectedBatch.remainingQuantity;
          } else {
            // Addition mode: input is the quantity to add
            quantityChange = inputStock;
          }
          const validation = validateBatchAdjustment(selectedBatch, quantityChange, newCostPrice);
          errors.push(...validation.errors);
        }
      }
      // If only price is being changed, we don't need to validate quantity constraints
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

    // Treat empty string as undefined (no change), only parse if value is provided
    let quantityChange: number | undefined = undefined;
    if (formData.newStock.trim() !== '') {
      if (formData.newStock.includes('.')) {
        showErrorToast('New stock must be a whole number (no decimals)');
        return;
      }
      const inputStock = parseInt(formData.newStock, 10);
      if (!isNaN(inputStock) && inputStock >= 0) {
        if (adjustmentMode === 'correction') {
          // Correction mode: input is the new remaining quantity
          quantityChange = inputStock - selectedBatch.remainingQuantity;
        } else {
          // Addition mode: input is the quantity to add
          quantityChange = inputStock;
        }
      }
    }
    
    const newCostPrice = formData.newCostPrice.trim() !== '' 
      ? parseFloat(formData.newCostPrice) 
      : undefined;

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
      newStock: '',
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
      if (!company) return;
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

    // Calculate quantity change from new stock value
    let quantityChange: number | undefined = undefined;
    if (formData.newStock.trim() !== '') {
      // Check if input contains decimal point
      if (formData.newStock.includes('.')) {
        showErrorToast('New stock must be a whole number (no decimals)');
        return;
      }
      
      const inputStock = parseInt(formData.newStock, 10);
      if (isNaN(inputStock) || inputStock < 0) {
        showErrorToast('Invalid stock value. Must be a whole number greater than or equal to 0.');
        return;
      }
      
      if (adjustmentMode === 'correction') {
        // Correction mode: input is the new remaining quantity
        quantityChange = inputStock - selectedBatch.remainingQuantity;
      } else {
        // Addition mode: input is the quantity to add
        quantityChange = inputStock;
      }
    }
    
    const newCostPrice = formData.newCostPrice.trim() !== '' 
      ? parseFloat(formData.newCostPrice) 
      : undefined;

    setLoading(true);

    try {
      await adjustStockManually(
        product.id,
        selectedBatch.id,
        quantityChange,
        newCostPrice,
        company?.id || '',
        formData.notes || undefined,
        adjustmentMode
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
        label: `Batch ${batch.id.slice(-8)} - ${batch.remainingQuantity} @ ${formatCostPrice(batch.costPrice)}`
      }))
    ];
  };

  const calculateNewProductStock = () => {
    if (!selectedBatch || !formData.newStock) return derivedRemaining;
    const newStock = parseInt(formData.newStock, 10);
    if (isNaN(newStock)) return derivedRemaining;
    
    // Calculate the difference in batch stock
    const batchDifference = newStock - selectedBatch.remainingQuantity;
    const baseStock = typeof derivedRemaining === 'number' ? derivedRemaining : 0;
    return baseStock + batchDifference;
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
                  : `${derivedRemaining}`}
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
                            <span className="font-medium text-gray-600">New Stock Quantity:</span>
                            <span className="ml-2 text-gray-900">
                              {edit.quantityChange !== undefined
                                ? (edit.batch.remainingQuantity + edit.quantityChange).toLocaleString()
                                : `${edit.batch.remainingQuantity.toLocaleString()} (unchanged)`
                              }
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">New Cost Price:</span>
                            <span className="ml-2 text-gray-900">
                              {edit.newCostPrice 
                                ? formatCostPrice(edit.newCostPrice)
                                : `${formatCostPrice(edit.batch.costPrice)} (unchanged)`
                              }
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

        {/* Adjustment Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Adjustment Details</h3>
          
          {/* Adjustment Mode Selection - Only show when new stock is entered */}
          {selectedBatch && formData.newStock.trim() !== '' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adjustment Type
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="adjustmentMode"
                    value="correction"
                    checked={adjustmentMode === 'correction'}
                    onChange={(e) => setAdjustmentMode(e.target.value as 'correction' | 'addition')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">
                    <strong>Correct existing stock</strong>
                    <br />
                    <span className="text-xs text-gray-500">
                      Set actual stock count ({selectedBatch.remainingQuantity}/{selectedBatch.quantity} → {formData.newStock.trim() !== '' ? parseInt(formData.newStock, 10) : selectedBatch.remainingQuantity}/{selectedBatch.quantity})
                    </span>
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="adjustmentMode"
                    value="addition"
                    checked={adjustmentMode === 'addition'}
                    onChange={(e) => setAdjustmentMode(e.target.value as 'correction' | 'addition')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">
                    <strong>Add to batch</strong>
                    <br />
                    <span className="text-xs text-gray-500">
                      Add new units ({selectedBatch.remainingQuantity}/{selectedBatch.quantity} → {formData.newStock.trim() !== '' ? selectedBatch.remainingQuantity + parseInt(formData.newStock, 10) : selectedBatch.remainingQuantity}/{selectedBatch.quantity + (formData.newStock.trim() !== '' ? parseInt(formData.newStock, 10) : 0)})
                    </span>
                  </span>
                </label>
              </div>
            </div>
          )}
          
          {selectedBatch && (
            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <p className="text-sm text-gray-600">
                Current batch stock: <span className="font-medium text-gray-900">{selectedBatch.remainingQuantity}</span>
              </p>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="New Stock Quantity (Optional)"
              type="number"
              value={formData.newStock}
              onChange={(e) => handleInputChange('newStock', e.target.value)}
              placeholder={selectedBatch ? `Enter quantity (current: ${selectedBatch.remainingQuantity})` : "Enter quantity"}
              helpText="Enter quantity to adjust stock"
              min="0"
              step="1"
            />
            
            <PriceInput
              label="New Cost Price (Optional)"
              name="newCostPrice"
              value={formData.newCostPrice}
              onChange={(e) => handleInputChange('newCostPrice', e.target.value)}
              placeholder="Leave empty to keep current price"
              helpText="Leave empty if you only want to change the quantity"
              allowDecimals={true}
            />
          </div>

          {/* Preview Changes */}
          {selectedBatch && (formData.newStock.trim() !== '' || formData.newCostPrice.trim() !== '') && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-green-800 mb-2">Preview Changes</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {formData.newStock.trim() !== '' && !formData.newStock.includes('.') && !isNaN(parseInt(formData.newStock, 10)) && parseInt(formData.newStock, 10) >= 0 && (
                  <>
                    <div>
                      <span className="font-medium text-green-700">New Batch Quantity:</span>
                      <p className="text-green-900">{parseInt(formData.newStock, 10).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="font-medium text-green-700">New Product Stock:</span>
                      <p className="text-green-900">{calculateNewProductStock().toLocaleString()}</p>
                    </div>
                  </>
                )}
                <div className={formData.newStock.trim() === '' ? 'col-span-2' : ''}>
                  <span className="font-medium text-green-700">New Cost Price:</span>
                  <p className="text-green-900">
                    {formData.newCostPrice.trim() !== '' 
                      ? formatCostPrice(parseFloat(formData.newCostPrice))
                      : formatCostPrice(selectedBatch.costPrice) + ' (unchanged)'
                    }
                  </p>
                </div>
                {formData.newStock.trim() === '' && (
                  <div className="col-span-2">
                    <span className="font-medium text-green-700">Batch Quantity:</span>
                    <p className="text-green-900">{selectedBatch.remainingQuantity} (unchanged)</p>
                  </div>
                )}
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