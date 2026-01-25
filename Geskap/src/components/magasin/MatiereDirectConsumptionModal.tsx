import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@contexts/AuthContext';
import { consumeMatiereStockDirectly } from '@services/firestore/stock/stockAdjustments';
import { getMatiereStockBatches } from '@services/firestore/stock/stockService';
import type { Matiere, StockBatch } from '../../types/models';
import { Modal, Button, Input, Select } from '@components/common';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';

interface DirectConsumptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  matiere: Matiere | null;
  batchTotals?: { remaining: number; total: number };
  onSuccess?: () => void;
}

type InventoryMethod = 'FIFO' | 'LIFO' | 'CMUP';

const MatiereDirectConsumptionModal: React.FC<DirectConsumptionModalProps> = ({
  isOpen,
  onClose,
  matiere,
  batchTotals,
  onSuccess
}) => {
  const { t } = useTranslation();
  const { company, user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [availableBatches, setAvailableBatches] = useState<StockBatch[]>([]);
  const [formData, setFormData] = useState({
    quantity: '',
    method: 'FIFO' as InventoryMethod,
    reason: '',
    notes: ''
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const availableStock = batchTotals?.remaining ?? 0;

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
        quantity: '',
        method: 'FIFO',
        reason: '',
        notes: ''
      });
      setValidationErrors([]);
    }
  }, [isOpen]);

  const loadBatches = async () => {
    if (!matiere) return;
    setLoadingBatches(true);
    try {
      const batches = await getMatiereStockBatches(matiere.id);
      const activeBatches = batches.filter(b => b.status === 'active' && b.remainingQuantity > 0);
      setAvailableBatches(activeBatches);
    } catch (error) {
      console.error('Error loading batches:', error);
      showErrorToast(t('navigation.warehouseMenu.stocksPage.directConsumption.errors.loadBatches'));
    } finally {
      setLoadingBatches(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];
    
    if (!formData.quantity || formData.quantity.trim() === '') {
      errors.push(t('navigation.warehouseMenu.stocksPage.directConsumption.errors.quantityRequired'));
    } else {
      const quantity = parseFloat(formData.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        errors.push(t('navigation.warehouseMenu.stocksPage.directConsumption.errors.quantityInvalid'));
      } else if (quantity > availableStock) {
        errors.push(t('navigation.warehouseMenu.stocksPage.directConsumption.errors.insufficientStock', { 
          available: availableStock,
          unit: matiere?.unit || 'unité'
        }));
      }
    }

    if (!formData.method) {
      errors.push(t('navigation.warehouseMenu.stocksPage.directConsumption.errors.methodRequired'));
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!matiere || !company || !user) {
      showErrorToast(t('navigation.warehouseMenu.stocksPage.directConsumption.errors.missingData'));
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const quantity = parseFloat(formData.quantity);
      
      await consumeMatiereStockDirectly(
        matiere.id,
        quantity,
        company.id,
        formData.method,
        user.uid,
        formData.reason || undefined,
        formData.notes || undefined
      );

      showSuccessToast(
        t('navigation.warehouseMenu.stocksPage.directConsumption.success', {
          quantity,
          unit: matiere.unit || 'unité',
          name: matiere.name
        })
      );

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Error consuming matiere stock:', error);
      showErrorToast(
        error.message || t('navigation.warehouseMenu.stocksPage.directConsumption.errors.consumeFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  if (!matiere) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('navigation.warehouseMenu.stocksPage.directConsumption.title')}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Matiere Info */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">
                {t('navigation.warehouseMenu.stocksPage.directConsumption.matiere')}
              </span>
              <p className="text-gray-900 mt-1">{matiere.name}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">
                {t('navigation.warehouseMenu.stocksPage.directConsumption.availableStock')}
              </span>
              <p className="text-gray-900 mt-1">
                {availableStock.toLocaleString()} {matiere.unit || 'unité'}
              </p>
            </div>
          </div>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-red-800 mb-2">
                  {t('navigation.warehouseMenu.stocksPage.directConsumption.errors.title')}
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('navigation.warehouseMenu.stocksPage.directConsumption.quantity')} *
          </label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            max={availableStock}
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            placeholder={t('navigation.warehouseMenu.stocksPage.directConsumption.quantityPlaceholder')}
            required
            disabled={loading}
          />
          <p className="mt-1 text-xs text-gray-500">
            {t('navigation.warehouseMenu.stocksPage.directConsumption.quantityHelp', {
              max: availableStock,
              unit: matiere.unit || 'unité'
            })}
          </p>
        </div>

        {/* Inventory Method */}
        <div>
          <Select
            label={t('navigation.warehouseMenu.stocksPage.directConsumption.method')}
            value={formData.method}
            onChange={(e) => setFormData({ ...formData, method: e.target.value as InventoryMethod })}
            required
            disabled={loading}
            options={[
              {
                value: 'FIFO',
                label: t('navigation.warehouseMenu.stocksPage.directConsumption.methods.fifo')
              },
              {
                value: 'LIFO',
                label: t('navigation.warehouseMenu.stocksPage.directConsumption.methods.lifo')
              },
              {
                value: 'CMUP',
                label: t('navigation.warehouseMenu.stocksPage.directConsumption.methods.cmup')
              }
            ]}
            helpText={
              formData.method === 'FIFO' 
                ? t('navigation.warehouseMenu.stocksPage.directConsumption.methods.fifoDescription')
                : formData.method === 'LIFO'
                ? t('navigation.warehouseMenu.stocksPage.directConsumption.methods.lifoDescription')
                : t('navigation.warehouseMenu.stocksPage.directConsumption.methods.cmupDescription')
            }
          />
        </div>

        {/* Reason (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('navigation.warehouseMenu.stocksPage.directConsumption.reason')}
          </label>
          <Input
            type="text"
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            placeholder={t('navigation.warehouseMenu.stocksPage.directConsumption.reasonPlaceholder')}
            disabled={loading}
          />
        </div>

        {/* Notes (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('navigation.warehouseMenu.stocksPage.directConsumption.notes')}
          </label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder={t('navigation.warehouseMenu.stocksPage.directConsumption.notesPlaceholder')}
            disabled={loading}
          />
        </div>

        {/* Available Batches Preview */}
        {loadingBatches ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">
              {t('navigation.warehouseMenu.stocksPage.directConsumption.loadingBatches')}
            </span>
          </div>
        ) : availableBatches.length > 0 ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              {t('navigation.warehouseMenu.stocksPage.directConsumption.batchesPreview')}
            </h4>
            <div className="space-y-1 text-xs text-blue-800">
              <p>
                {t('navigation.warehouseMenu.stocksPage.directConsumption.batchesCount', {
                  count: availableBatches.length
                })}
              </p>
              <p>
                {t('navigation.warehouseMenu.stocksPage.directConsumption.methodInfo', {
                  method: formData.method
                })}
              </p>
            </div>
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={loading || availableStock === 0}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('navigation.warehouseMenu.stocksPage.directConsumption.processing')}
              </>
            ) : (
              t('navigation.warehouseMenu.stocksPage.directConsumption.confirm')
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default MatiereDirectConsumptionModal;

