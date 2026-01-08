import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@contexts/AuthContext';
import { restockMatiere } from '@services/firestore/stock/stockAdjustments';
import { getMatiereStockBatches } from '@services/firestore/stock/stockService';
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
  const { t } = useTranslation();
  const { company } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [loadingCostPrice, setLoadingCostPrice] = useState(false);
  const [formData, setFormData] = useState({
    quantity: '',
    costPrice: '',
    notes: ''
  });
  const [defaultCostPrice, setDefaultCostPrice] = useState<number>(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const derivedRemaining = batchTotals?.remaining ?? 0;
  const derivedTotal = batchTotals?.total;

  // Load latest cost price and reset form when modal opens
  useEffect(() => {
    if (isOpen && matiere) {
      const loadLatestCostPrice = async () => {
        setLoadingCostPrice(true);
        try {
          // Get stock batches ordered by creation date (newest first)
          const batches = await getMatiereStockBatches(matiere.id);
          
          // Get cost price from the most recent batch, or fallback to matiere's costPrice
          let latestCostPrice = '';
          let defaultPrice = 0;
          if (batches.length > 0 && batches[0].costPrice > 0) {
            latestCostPrice = batches[0].costPrice.toString();
            defaultPrice = batches[0].costPrice;
          } else if (matiere.costPrice > 0) {
            latestCostPrice = matiere.costPrice.toString();
            defaultPrice = matiere.costPrice;
          }

          setDefaultCostPrice(defaultPrice);
          setFormData({
            quantity: '',
            costPrice: latestCostPrice,
            notes: ''
          });
        } catch (error) {
          console.error('Error loading latest cost price:', error);
          // Fallback to matiere's costPrice if batch fetch fails
          const fallbackPrice = matiere.costPrice > 0 ? matiere.costPrice : 0;
          setDefaultCostPrice(fallbackPrice);
          setFormData({
            quantity: '',
            costPrice: fallbackPrice > 0 ? fallbackPrice.toString() : '',
            notes: ''
          });
        } finally {
          setLoadingCostPrice(false);
        }
      };

      loadLatestCostPrice();
    }
  }, [isOpen, matiere]);

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
      errors.push(t('navigation.warehouseMenu.restockModal.validation.invalidQuantity'));
    }
    
    // Validate cost price if provided
    if (formData.costPrice && formData.costPrice.trim() !== '') {
      const costPrice = parseFloat(formData.costPrice);
      if (isNaN(costPrice) || costPrice < 0) {
        errors.push(t('navigation.warehouseMenu.restockModal.validation.invalidCostPrice'));
      }
    }
    
    return errors;
  };

  const calculateTotalCost = (): number => {
    const quantity = parseInt(formData.quantity, 10);
    // Use form cost price if provided, otherwise use default cost price from latest batch
    let costPrice = 0;
    if (formData.costPrice && formData.costPrice.trim() !== '') {
      costPrice = parseFloat(formData.costPrice);
    } else {
      // Use default cost price (from latest batch or matiere's costPrice)
      costPrice = defaultCostPrice;
    }
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
    
    // If cost price is not provided, get the latest batch cost price (same logic as when loading the form)
    let costPrice: number | undefined;
    if (formData.costPrice && formData.costPrice.trim() !== '') {
      costPrice = parseFloat(formData.costPrice);
    } else {
      // Fetch latest batch cost price as fallback
      setLoadingCostPrice(true);
      try {
        const batches = await getMatiereStockBatches(matiere.id);
        if (batches.length > 0 && batches[0].costPrice > 0) {
          costPrice = batches[0].costPrice;
        } else if (matiere.costPrice > 0) {
          costPrice = matiere.costPrice;
        }
      } catch (error) {
        console.error('Error fetching latest cost price:', error);
        // If fetch fails, costPrice remains undefined and restockMatiere will handle it
      } finally {
        setLoadingCostPrice(false);
      }
    }

    setLoading(true);

    try {
      await restockMatiere(
        matiere.id,
        quantity,
        company.id,
        formData.notes || undefined,
        costPrice
      );

      showSuccessToast(t('navigation.warehouseMenu.restockModal.messages.success'));
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error restocking matiere:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showErrorToast(t('navigation.warehouseMenu.restockModal.messages.error', { error: errorMessage }));
    } finally {
      setLoading(false);
    }
  };

  if (!matiere) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('navigation.warehouseMenu.restockModal.title', { name: matiere.name })}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Matiere Information */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('navigation.warehouseMenu.restockModal.matiereInfo.title')}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">{t('navigation.warehouseMenu.restockModal.matiereInfo.name')}</span>
              <p className="text-gray-900">{matiere.name}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">{t('navigation.warehouseMenu.restockModal.matiereInfo.unit')}</span>
              <p className="text-gray-900">{matiere.unit || '—'}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">{t('navigation.warehouseMenu.restockModal.matiereInfo.currentStock')}</span>
              <p className="text-gray-900">
                {derivedTotal !== undefined
                  ? `${derivedRemaining} / ${derivedTotal} ${matiere.unit || 'unité'}`
                  : `${derivedRemaining} ${matiere.unit || 'unité'}`}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700">{t('navigation.warehouseMenu.restockModal.matiereInfo.category')}</span>
              <p className="text-gray-900">{matiere.refCategorie || '—'}</p>
            </div>
          </div>
        </div>

        {/* Restock Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">{t('navigation.warehouseMenu.restockModal.restockDetails.title')}</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('navigation.warehouseMenu.restockModal.restockDetails.quantity', { unit: matiere.unit || 'unité' })}
              type="number"
              value={formData.quantity}
              onChange={(e) => handleInputChange('quantity', e.target.value)}
              placeholder={t('navigation.warehouseMenu.restockModal.restockDetails.quantityPlaceholder')}
              required
              min="1"
              step="1"
            />
            
            <div>
              <div className="relative">
                <PriceInput
                  label={t('navigation.warehouseMenu.restockModal.restockDetails.costPrice')}
                  name="costPrice"
                  value={formData.costPrice}
                  onChange={(e) => handleInputChange('costPrice', e.target.value)}
                  placeholder={loadingCostPrice ? t('navigation.warehouseMenu.restockModal.restockDetails.loadingCostPrice') : t('navigation.warehouseMenu.restockModal.restockDetails.costPricePlaceholder')}
                  allowDecimals={true}
                  disabled={loadingCostPrice}
                />
                {loadingCostPrice && (
                  <div className="absolute right-3 top-8 flex items-center pointer-events-none">
                    <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                  </div>
                )}
              </div>
              {loadingCostPrice && (
                <p className="mt-1 text-xs text-gray-500 flex items-center">
                  <Loader2 className="h-3 w-3 text-gray-400 animate-spin mr-1" />
                  {t('navigation.warehouseMenu.restockModal.restockDetails.fetchingCostPrice')}
                </p>
              )}
            </div>
          </div>

          {/* Total Cost Display - show if quantity is provided and we have a cost price (from form or default) */}
          {(() => {
            const quantity = parseInt(formData.quantity, 10);
            if (!quantity || quantity <= 0) return null;
            
            const totalCost = calculateTotalCost();
            if (totalCost <= 0) return null;
            
            const effectiveCostPrice = formData.costPrice && formData.costPrice.trim() !== '' 
              ? parseFloat(formData.costPrice) 
              : defaultCostPrice;
            const isUsingDefault = !formData.costPrice || formData.costPrice.trim() === '';
            
            return (
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-sm font-medium text-blue-800">{t('navigation.warehouseMenu.restockModal.totalCost.title')}</div>
                <div className="text-lg font-semibold text-blue-900">
                  {formatCostPrice(totalCost)}
                </div>
                <div className="text-xs text-blue-700 mt-1">
                  {effectiveCostPrice > 0 
                    ? t('navigation.warehouseMenu.restockModal.totalCost.expenseWillBeCreated', { 
                        usingDefault: isUsingDefault ? t('navigation.warehouseMenu.restockModal.totalCost.usingDefault') : '' 
                      })
                    : t('navigation.warehouseMenu.restockModal.totalCost.noExpenseCreated')}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <h4 className="text-md font-medium text-red-800 mb-2">{t('navigation.warehouseMenu.restockModal.validation.title')}</h4>
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
            {t('navigation.warehouseMenu.restockModal.notes.label')}
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder={t('navigation.warehouseMenu.restockModal.notes.placeholder')}
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
            {t('navigation.warehouseMenu.restockModal.actions.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={loading}
            isLoading={loading}
            loadingText={t('navigation.warehouseMenu.restockModal.actions.restocking')}
          >
            {t('navigation.warehouseMenu.restockModal.actions.restock')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default MatiereRestockModal;
