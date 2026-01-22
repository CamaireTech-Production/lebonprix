import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalFooter, Input, Select, Textarea } from '@components/common';
import { useAuth } from '@contexts/AuthContext';
import { useProducts } from '@hooks/data/useFirestore';
import { getAvailableStockBatches } from '@services/firestore/stock/stockService';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import type { Product, Shop } from '../../types/models';
import { Package, AlertCircle } from 'lucide-react';

interface ReplenishmentRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onCreateRequest: (requestData: {
    shopId: string;
    productId: string;
    quantity: number;
    notes?: string;
  }) => Promise<void>;
  shop: Shop | null;
  initialProductId?: string;
}

const ReplenishmentRequestModal: React.FC<ReplenishmentRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onCreateRequest,
  shop,
  initialProductId
}) => {
  const { t } = useTranslation();
  const { company } = useAuth();
  const { products } = useProducts();

  const [formData, setFormData] = useState({
    productId: initialProductId || '',
    quantity: '',
    notes: ''
  });

  const [availableStock, setAvailableStock] = useState<number>(0);
  const [loadingStock, setLoadingStock] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Filter active products
  const activeProducts = useMemo(() => {
    return (products || []).filter(p => p.isAvailable !== false && p.isDeleted !== true);
  }, [products]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        productId: initialProductId || '',
        quantity: '',
        notes: ''
      });
      setAvailableStock(0);
      setValidationErrors([]);
    }
  }, [isOpen, initialProductId]);

  // Load available stock in shop when product changes
  useEffect(() => {
    if (!isOpen || !formData.productId || !company?.id || !shop?.id) {
      setAvailableStock(0);
      return;
    }

    const loadAvailableStock = async () => {
      setLoadingStock(true);
      try {
        const batches = await getAvailableStockBatches(
          formData.productId,
          company.id,
          'product',
          shop.id,
          undefined,
          'shop'
        );
        const totalStock = batches.reduce((sum, batch) => sum + (batch.remainingQuantity || 0), 0);
        setAvailableStock(totalStock);
      } catch (error) {
        console.error('Error loading available stock:', error);
        setAvailableStock(0);
      } finally {
        setLoadingStock(false);
      }
    };

    loadAvailableStock();
  }, [isOpen, formData.productId, company?.id, shop?.id]);

  const handleSubmit = async () => {
    if (!shop) {
      showErrorToast(t('replenishmentRequests.messages.shopRequired', 'Shop is required'));
      return;
    }

    const errors: string[] = [];

    if (!formData.productId) {
      errors.push(t('replenishmentRequests.messages.productRequired', 'Product is required'));
    }

    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      errors.push(t('replenishmentRequests.messages.quantityRequired', 'Quantity must be greater than 0'));
    }

    // Validate shop is active
    if (shop.isActive === false) {
      errors.push(t('replenishmentRequests.messages.shopInactive', 'Cannot create replenishment request from an inactive shop'));
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setValidationErrors([]);

    try {
      await onCreateRequest({
        shopId: shop.id,
        productId: formData.productId,
        quantity: parseFloat(formData.quantity),
        notes: formData.notes.trim() || undefined
      });

      showSuccessToast(t('replenishmentRequests.messages.createSuccess', 'Replenishment request created successfully'));
      onSuccess?.();
      onClose();
    } catch (error: any) {
      const errorMessage = error.message || t('replenishmentRequests.messages.createError', 'Error creating replenishment request');
      showErrorToast(errorMessage);
      setValidationErrors([errorMessage]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProduct = activeProducts.find(p => p.id === formData.productId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('replenishmentRequests.modal.createTitle', 'Request Stock Replenishment')}
      size="md"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleSubmit}
          cancelText={t('common.cancel')}
          confirmText={t('replenishmentRequests.modal.create', 'Create Request')}
          isLoading={isSubmitting}
          disabled={!formData.productId || !formData.quantity || parseFloat(formData.quantity) <= 0 || shop?.isActive === false}
        />
      }
    >
      <div className="space-y-4">
        {shop && shop.isActive === false && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800">
                {t('replenishmentRequests.messages.shopInactive', 'Cannot create replenishment request from an inactive shop')}
              </p>
            </div>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('replenishmentRequests.modal.shop', 'Shop')}
          </label>
          <Input
            value={shop?.name || ''}
            disabled
            className="bg-gray-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('replenishmentRequests.modal.product', 'Product')} <span className="text-red-500">*</span>
          </label>
          <Select
            value={formData.productId}
            onChange={(e) => setFormData(prev => ({ ...prev, productId: e.target.value }))}
            className="w-full"
            required
          >
            <option value="">{t('replenishmentRequests.modal.selectProduct', 'Select a product')}</option>
            {activeProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </Select>
        </div>

        {selectedProduct && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {t('replenishmentRequests.modal.currentStock', 'Current Stock in Shop')}
              </span>
            </div>
            {loadingStock ? (
              <p className="text-sm text-blue-700">{t('common.loading', 'Loading...')}</p>
            ) : (
              <p className="text-sm text-blue-800 font-semibold">
                {availableStock} {t('replenishmentRequests.modal.units', 'units')}
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('replenishmentRequests.modal.quantity', 'Quantity Requested')} <span className="text-red-500">*</span>
          </label>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={formData.quantity}
            onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
            placeholder={t('replenishmentRequests.modal.quantityPlaceholder', 'Enter quantity')}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('replenishmentRequests.modal.notes', 'Notes')} ({t('common.optional', 'Optional')})
          </label>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder={t('replenishmentRequests.modal.notesPlaceholder', 'Add any additional notes about this request')}
            rows={3}
          />
        </div>
      </div>
    </Modal>
  );
};

export default ReplenishmentRequestModal;

