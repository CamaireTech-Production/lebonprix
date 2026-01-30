import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@contexts/AuthContext';
import { getMatiereBatchesForAdjustment } from '@services/firestore/stock/stockAdjustments';
import { adjustBatchUnified } from '@services/firestore/stock/stockAdjustments';
import { useShops, useWarehouses } from '@hooks/data/useFirestore';
import type { Matiere, StockBatch, BatchAdjustment } from '../../types/models';
import { Modal, Button, Input, PriceInput, Select } from '@components/common';
import { formatCostPrice } from '@utils/inventory/inventoryManagement';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';

interface UnifiedBatchAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  matiere: Matiere | null;
  selectedBatch?: StockBatch | null;
  batchTotals?: { remaining: number; total: number };
  onSuccess?: () => void;
}

type AdjustmentType = 'quantity_correction' | 'remaining_adjustment' | 'damage' | 'cost_correction' | 'combined';
type AdjustmentReason = 'error_correction' | 'inventory_audit' | 'damage' | 'theft' | 'expiry' | 'return_to_supplier' | 'other';

const UnifiedBatchAdjustmentModal: React.FC<UnifiedBatchAdjustmentModalProps> = ({
  isOpen,
  onClose,
  matiere,
  selectedBatch: selectedBatchProp,
  batchTotals,
  onSuccess
}) => {
  const { t } = useTranslation();
  const { company, user } = useAuth();
  const { shops } = useShops();
  const { warehouses } = useWarehouses();
  
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('remaining_adjustment');
  const [adjustmentReason, setAdjustmentReason] = useState<AdjustmentReason>('error_correction');
  
  // Helper to get location display name
  const getLocationDisplay = useMemo(() => {
    return (batch: StockBatch | null): string => {
      if (!batch) return '—';
      if (batch.locationType === 'shop' && batch.shopId) {
        const shop = shops?.find(s => s.id === batch.shopId);
        return shop ? `Boutique: ${shop.name}` : `Boutique (ID: ${batch.shopId.slice(-8)})`;
      } else if (batch.locationType === 'warehouse' && batch.warehouseId) {
        const warehouse = warehouses?.find(w => w.id === batch.warehouseId);
        return warehouse ? `Entrepôt: ${warehouse.name}` : `Entrepôt (ID: ${batch.warehouseId.slice(-8)})`;
      } else if (batch.locationType === 'production' && batch.productionId) {
        return `Production (ID: ${batch.productionId.slice(-8)})`;
      } else if (batch.locationType === 'global') {
        return 'Stock global';
      }
      return 'Emplacement non spécifié';
    };
  }, [shops, warehouses]);
  
  const [formData, setFormData] = useState({
    batchId: '',
    newTotalQuantity: '', // For quantity_correction
    remainingQuantityDelta: '', // For remaining_adjustment
    damageQuantity: '', // For damage
    newCostPrice: '', // For cost_correction
    notes: ''
  });

  // Helper function to safely get string value
  const getStringValue = (value: string | number | undefined): string => {
    if (value === undefined || value === null) return '';
    return typeof value === 'string' ? value : String(value);
  };

  // Load available batches when modal opens
  useEffect(() => {
    if (isOpen && matiere && company) {
      loadBatches();
    }
  }, [isOpen, matiere, company]);

  // Preselect batch when provided
  useEffect(() => {
    if (!isOpen || !selectedBatchProp) return;
    if (batches.length > 0) {
      const match = batches.find(b => b.id === selectedBatchProp.id);
      if (match) {
        setSelectedBatch(match);
        setFormData(prev => ({
          ...prev,
          batchId: match.id,
          newCostPrice: (match.costPrice || 0).toString()
        }));
      }
    }
  }, [isOpen, selectedBatchProp, batches]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        batchId: '',
        newTotalQuantity: '',
        remainingQuantityDelta: '',
        damageQuantity: '',
        newCostPrice: '',
        notes: ''
      });
      setAdjustmentType('remaining_adjustment');
      setAdjustmentReason('error_correction');
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

  const handleInputChange = (field: string, value: string | number) => {
    // Ensure value is always a string
    const stringValue = typeof value === 'string' ? value : (value !== undefined && value !== null ? String(value) : '');
    
    const updatedFormData = {
      ...formData,
      [field]: stringValue
    };
    
    setFormData(updatedFormData);

    // Update selected batch when batch selection changes
    if (field === 'batchId') {
      const batch = batches.find(b => b.id === stringValue);
      setSelectedBatch(batch || null);
      
      if (batch) {
        const updatedWithCost = {
          ...updatedFormData,
          newCostPrice: (batch.costPrice || 0).toString()
        };
        setFormData(updatedWithCost);
        // Validate with updated data
        setTimeout(() => {
          validateFormWithData(updatedWithCost);
        }, 100);
        return;
      }
    }

    // Validate on input change with updated data
    setTimeout(() => {
      validateFormWithData(updatedFormData);
    }, 100);
  };

  const validateFormWithData = (dataToValidate = formData): boolean => {
    const errors: string[] = [];
    
    if (!dataToValidate.batchId) {
      errors.push('Please select a batch');
    }

    if (!selectedBatch) {
      setValidationErrors(errors);
      return false;
    }

    // Validate based on adjustment type
    switch (adjustmentType) {
      case 'quantity_correction':
        const newTotalQtyStr = getStringValue(dataToValidate.newTotalQuantity);
        if (!newTotalQtyStr || newTotalQtyStr.trim() === '') {
          errors.push('New total quantity is required');
        } else {
          const newTotal = parseFloat(newTotalQtyStr);
          if (isNaN(newTotal) || newTotal < 0) {
            errors.push('New total quantity must be a valid number >= 0');
          } else {
            const usedQuantity = selectedBatch.quantity - selectedBatch.remainingQuantity;
            const minAllowed = usedQuantity;
            if (newTotal < minAllowed) {
              errors.push(`New total quantity cannot be less than ${minAllowed} (already used)`);
            }
          }
        }
        break;

      case 'remaining_adjustment':
        const remainingDeltaStr = getStringValue(dataToValidate.remainingQuantityDelta);
        if (!remainingDeltaStr || remainingDeltaStr.trim() === '') {
          errors.push('Quantity adjustment is required');
        } else {
          const delta = parseFloat(remainingDeltaStr);
          if (isNaN(delta)) {
            errors.push('Quantity adjustment must be a valid number');
          } else {
            const newRemaining = selectedBatch.remainingQuantity + delta;
            if (newRemaining < 0) {
              errors.push(`Remaining quantity cannot be negative (current: ${selectedBatch.remainingQuantity})`);
            }
          }
        }
        break;

      case 'damage':
        const damageQtyStr = getStringValue(dataToValidate.damageQuantity);
        if (!damageQtyStr || damageQtyStr.trim() === '') {
          errors.push('Damage quantity is required');
        } else {
          const damageQty = parseFloat(damageQtyStr);
          if (isNaN(damageQty) || damageQty <= 0) {
            errors.push('Damage quantity must be a positive number');
          } else if (damageQty > selectedBatch.remainingQuantity) {
            errors.push(`Damage quantity cannot exceed remaining quantity (${selectedBatch.remainingQuantity})`);
          }
        }
        break;

      case 'cost_correction':
        const newCostPriceStr = getStringValue(dataToValidate.newCostPrice);
        if (!newCostPriceStr || newCostPriceStr.trim() === '') {
          errors.push('New cost price is required');
        } else {
          const newPrice = parseFloat(newCostPriceStr);
          if (isNaN(newPrice) || newPrice < 0) {
            errors.push('New cost price must be a valid number >= 0');
          }
        }
        break;

      case 'combined':
        const hasAnyChange = 
          getStringValue(dataToValidate.newTotalQuantity).trim() !== '' ||
          getStringValue(dataToValidate.remainingQuantityDelta).trim() !== '' ||
          getStringValue(dataToValidate.damageQuantity).trim() !== '' ||
          getStringValue(dataToValidate.newCostPrice).trim() !== '';
        
        if (!hasAnyChange) {
          errors.push('At least one adjustment field must be filled');
        }
        
        const newTotalQtyCombinedStr = getStringValue(dataToValidate.newTotalQuantity);
        if (newTotalQtyCombinedStr.trim() !== '') {
          const newTotal = parseFloat(newTotalQtyCombinedStr);
          if (isNaN(newTotal) || newTotal < 0) {
            errors.push('New total quantity must be a valid number >= 0');
          }
        }
        
        const remainingDeltaCombinedStr = getStringValue(dataToValidate.remainingQuantityDelta);
        if (remainingDeltaCombinedStr.trim() !== '') {
          const delta = parseFloat(remainingDeltaCombinedStr);
          if (isNaN(delta)) {
            errors.push('Quantity adjustment must be a valid number');
          }
        }
        
        const damageQtyCombinedStr = getStringValue(dataToValidate.damageQuantity);
        if (damageQtyCombinedStr.trim() !== '') {
          const damageQty = parseFloat(damageQtyCombinedStr);
          if (isNaN(damageQty) || damageQty <= 0) {
            errors.push('Damage quantity must be a positive number');
          }
        }
        
        const newCostPriceCombinedStr = getStringValue(dataToValidate.newCostPrice);
        if (newCostPriceCombinedStr.trim() !== '') {
          const newPrice = parseFloat(newCostPriceCombinedStr);
          if (isNaN(newPrice) || newPrice < 0) {
            errors.push('New cost price must be a valid number >= 0');
          }
        }
        break;
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const validateForm = (): boolean => {
    return validateFormWithData();
  };

  const calculateImpact = () => {
    if (!selectedBatch) return null;

    let newRemaining = selectedBatch.remainingQuantity;
    let newTotal = selectedBatch.quantity;
    let newCost = selectedBatch.costPrice || 0;
    let stockChange = 0;

    switch (adjustmentType) {
      case 'quantity_correction':
        if (getStringValue(formData.newTotalQuantity).trim() !== '') {
          newTotal = parseFloat(getStringValue(formData.newTotalQuantity)) || selectedBatch.quantity;
          const usedQty = selectedBatch.quantity - selectedBatch.remainingQuantity;
          newRemaining = Math.max(0, newTotal - usedQty);
          stockChange = newRemaining - selectedBatch.remainingQuantity;
        }
        break;

      case 'remaining_adjustment':
        if (getStringValue(formData.remainingQuantityDelta).trim() !== '') {
          const delta = parseFloat(getStringValue(formData.remainingQuantityDelta)) || 0;
          newRemaining = selectedBatch.remainingQuantity + delta;
          if (newRemaining > newTotal) {
            newTotal = newRemaining;
          }
          stockChange = delta;
        }
        break;

      case 'damage':
        if (getStringValue(formData.damageQuantity).trim() !== '') {
          const damageQty = parseFloat(getStringValue(formData.damageQuantity)) || 0;
          newRemaining = selectedBatch.remainingQuantity - damageQty;
          stockChange = -damageQty;
        }
        break;

      case 'cost_correction':
        if (getStringValue(formData.newCostPrice).trim() !== '') {
          newCost = parseFloat(getStringValue(formData.newCostPrice)) || (selectedBatch.costPrice || 0);
        }
        break;

      case 'combined':
        if (getStringValue(formData.newTotalQuantity).trim() !== '') {
          newTotal = parseFloat(getStringValue(formData.newTotalQuantity)) || selectedBatch.quantity;
          const usedQty = selectedBatch.quantity - selectedBatch.remainingQuantity;
          newRemaining = Math.max(0, newTotal - usedQty);
        }
        if (getStringValue(formData.remainingQuantityDelta).trim() !== '') {
          const delta = parseFloat(getStringValue(formData.remainingQuantityDelta)) || 0;
          newRemaining = newRemaining + delta;
          if (newRemaining > newTotal) {
            newTotal = newRemaining;
          }
        }
        if (getStringValue(formData.damageQuantity).trim() !== '') {
          const damageQty = parseFloat(getStringValue(formData.damageQuantity)) || 0;
          newRemaining = newRemaining - damageQty;
        }
        if (getStringValue(formData.newCostPrice).trim() !== '') {
          newCost = parseFloat(getStringValue(formData.newCostPrice)) || (selectedBatch.costPrice || 0);
        }
        stockChange = newRemaining - selectedBatch.remainingQuantity;
        break;
    }

    return {
      newRemaining,
      newTotal,
      newCost,
      stockChange,
      currentRemaining: selectedBatch.remainingQuantity,
      currentTotal: selectedBatch.quantity,
      currentCost: selectedBatch.costPrice || 0
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!matiere || !company?.id) return;

    if (!validateForm()) {
      showErrorToast('Please fix the validation errors before submitting');
      return;
    }

    if (!selectedBatch) {
      showErrorToast('Please select a batch');
      return;
    }

    setLoading(true);
    try {
      const adjustment: BatchAdjustment = {
        batchId: selectedBatch.id,
        adjustmentType,
        adjustmentReason,
        notes: formData.notes.trim() || undefined
      };

      // Add fields based on adjustment type
      if (adjustmentType === 'quantity_correction' && getStringValue(formData.newTotalQuantity).trim() !== '') {
        adjustment.newTotalQuantity = parseFloat(getStringValue(formData.newTotalQuantity));
      }
      
      if (adjustmentType === 'remaining_adjustment' && getStringValue(formData.remainingQuantityDelta).trim() !== '') {
        adjustment.remainingQuantityDelta = parseFloat(getStringValue(formData.remainingQuantityDelta));
      }
      
      if (adjustmentType === 'damage' && getStringValue(formData.damageQuantity).trim() !== '') {
        adjustment.damageQuantity = parseFloat(getStringValue(formData.damageQuantity));
      }
      
      if (adjustmentType === 'cost_correction' && getStringValue(formData.newCostPrice).trim() !== '') {
        adjustment.newCostPrice = parseFloat(getStringValue(formData.newCostPrice));
      }
      
      if (adjustmentType === 'combined') {
        if (getStringValue(formData.newTotalQuantity).trim() !== '') {
          adjustment.newTotalQuantity = parseFloat(getStringValue(formData.newTotalQuantity));
        }
        if (getStringValue(formData.remainingQuantityDelta).trim() !== '') {
          adjustment.remainingQuantityDelta = parseFloat(getStringValue(formData.remainingQuantityDelta));
        }
        if (getStringValue(formData.damageQuantity).trim() !== '') {
          adjustment.damageQuantity = parseFloat(getStringValue(formData.damageQuantity));
        }
        if (getStringValue(formData.newCostPrice).trim() !== '') {
          adjustment.newCostPrice = parseFloat(getStringValue(formData.newCostPrice));
        }
      }

      await adjustBatchUnified(matiere.id, 'matiere', adjustment, company.id);
      
      showSuccessToast('Ajustement de lot enregistré avec succès!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error adjusting batch:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to adjust batch';
      showErrorToast(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const impact = calculateImpact();
  const batchOptions = batches.map(batch => {
    const locationInfo = getLocationDisplay(batch);
    return {
      value: batch.id,
      label: `Lot ${batch.id.slice(-8)} - ${batch.remainingQuantity}/${batch.quantity} @ ${formatCostPrice(batch.costPrice || 0)} (${locationInfo})`
    };
  });

  const adjustmentTypeOptions = [
    { value: 'quantity_correction', label: 'Corriger quantité totale' },
    { value: 'remaining_adjustment', label: 'Ajuster stock restant' },
    { value: 'damage', label: 'Enregistrer dommage' },
    { value: 'cost_correction', label: 'Corriger prix de revient' },
    { value: 'combined', label: 'Ajustement combiné' }
  ];

  const adjustmentReasonOptions = [
    { value: 'error_correction', label: 'Correction d\'erreur' },
    { value: 'inventory_audit', label: 'Inventaire/Audit' },
    { value: 'damage', label: 'Dommage' },
    { value: 'theft', label: 'Vol' },
    { value: 'expiry', label: 'Péremption' },
    { value: 'return_to_supplier', label: 'Retour fournisseur' },
    { value: 'other', label: 'Autre' }
  ];

  if (!matiere) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Ajustement de lot - ${matiere.name}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Batch Selection */}
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sélectionner le lot
          </label>
          <Select
            value={formData.batchId}
            onChange={(e) => handleInputChange('batchId', e.target.value)}
            options={[
              { value: '', label: 'Sélectionner un lot' },
              ...batchOptions
            ]}
            disabled={loadingBatches}
            fullWidth={true}
            className="px-3 py-2 border-2 border-gray-300"
          />
          {loadingBatches && (
            <p className="text-sm text-gray-500 mt-1">Chargement des lots...</p>
          )}
        </div>

        {selectedBatch && (
          <>
            {/* Current Batch Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Informations du lot actuel</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Quantité totale:</span>
                  <p className="font-medium">{selectedBatch.quantity} {matiere.unit || 'unité'}</p>
                </div>
                <div>
                  <span className="text-gray-600">Stock restant:</span>
                  <p className="font-medium">{selectedBatch.remainingQuantity} {matiere.unit || 'unité'}</p>
                </div>
                <div>
                  <span className="text-gray-600">Prix de revient:</span>
                  <p className="font-medium">{formatCostPrice(selectedBatch.costPrice || 0)}</p>
                </div>
                <div>
                  <span className="text-gray-600">Emplacement:</span>
                  <p className="font-medium">{getLocationDisplay(selectedBatch)}</p>
                </div>
              </div>
            </div>

            {/* Adjustment Type */}
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type d'ajustement
              </label>
              <Select
                value={adjustmentType}
                onChange={(e) => {
                  setAdjustmentType(e.target.value as AdjustmentType);
                  setFormData(prev => ({
                    ...prev,
                    newTotalQuantity: '',
                    remainingQuantityDelta: '',
                    damageQuantity: '',
                    newCostPrice: ''
                  }));
                }}
                options={adjustmentTypeOptions}
                fullWidth={true}
                className="px-3 py-2 border-2 border-gray-300"
              />
            </div>

            {/* Adjustment Reason */}
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Raison de l'ajustement
              </label>
              <Select
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value as AdjustmentReason)}
                options={adjustmentReasonOptions}
                fullWidth={true}
                className="px-3 py-2 border-2 border-gray-300"
              />
            </div>

            {/* Dynamic Fields Based on Adjustment Type */}
            {(adjustmentType === 'quantity_correction' || adjustmentType === 'combined') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nouvelle quantité totale ({matiere.unit || 'unité'})
                </label>
                <Input
                  type="number"
                  value={formData.newTotalQuantity}
                  onChange={(e) => handleInputChange('newTotalQuantity', e.target.value)}
                  placeholder="Ex: 6"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Quantité minimale: {selectedBatch.quantity - selectedBatch.remainingQuantity} (déjà utilisée)
                </p>
              </div>
            )}

            {(adjustmentType === 'remaining_adjustment' || adjustmentType === 'combined') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ajustement du stock restant (delta) ({matiere.unit || 'unité'})
                </label>
                <Input
                  type="number"
                  value={formData.remainingQuantityDelta}
                  onChange={(e) => handleInputChange('remainingQuantityDelta', e.target.value)}
                  placeholder="Ex: -2 ou +3"
                  step="0.01"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Utilisez un nombre positif pour ajouter, négatif pour retirer
                </p>
              </div>
            )}

            {(adjustmentType === 'damage' || adjustmentType === 'combined') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantité endommagée ({matiere.unit || 'unité'})
                </label>
                <Input
                  type="number"
                  value={formData.damageQuantity}
                  onChange={(e) => handleInputChange('damageQuantity', e.target.value)}
                  placeholder="Ex: 2"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum: {selectedBatch.remainingQuantity} (stock restant actuel)
                </p>
              </div>
            )}

            {(adjustmentType === 'cost_correction' || adjustmentType === 'combined') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nouveau prix de revient
                </label>
                <PriceInput
                  name="newCostPrice"
                  value={formData.newCostPrice}
                  onChange={(e) => handleInputChange('newCostPrice', e.target.value)}
                  placeholder="Ex: 5000"
                />
              </div>
            )}

            {/* Impact Preview */}
            {impact && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="text-sm font-medium text-blue-900 mb-3">Aperçu de l'impact</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">Avant:</span>
                    <p className="font-medium">{impact.currentRemaining}/{impact.currentTotal} {matiere.unit || 'unité'} @ {formatCostPrice(impact.currentCost)}</p>
                  </div>
                  <div>
                    <span className="text-blue-700">Après:</span>
                    <p className="font-medium">{impact.newRemaining}/{impact.newTotal} {matiere.unit || 'unité'} @ {formatCostPrice(impact.newCost)}</p>
                  </div>
                </div>
                {impact.stockChange !== 0 && (
                  <div className="mt-2 pt-2 border-t border-blue-200">
                    <span className="text-blue-700">Changement de stock:</span>
                    <p className={`font-medium ${impact.stockChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {impact.stockChange > 0 ? '+' : ''}{impact.stockChange} {matiere.unit || 'unité'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (optionnel)
              </label>
              <Input
                type="text"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Ajouter des notes sur cet ajustement..."
              />
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-red-800 mb-2">Erreurs de validation:</h3>
                <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={loading}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={loading || validationErrors.length > 0}
              >
                {loading ? 'Enregistrement...' : 'Enregistrer l\'ajustement'}
              </Button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
};

export default UnifiedBatchAdjustmentModal;

