import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalFooter, Input, Select, Textarea } from '@components/common';
import { useAuth } from '@contexts/AuthContext';
import { useProducts } from '@hooks/data/useFirestore';
import { useShops } from '@hooks/data/useFirestore';
import { useWarehouses } from '@hooks/data/useFirestore';
import { getAvailableStockBatches } from '@services/firestore/stock/stockService';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import type { StockTransfer, Product, Shop, Warehouse } from '../../types/models';

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onCreateTransfer: (transferData: {
    transferType: StockTransfer['transferType'];
    productId: string;
    quantity: number;
    fromWarehouseId?: string;
    fromShopId?: string;
    fromProductionId?: string;
    toWarehouseId?: string;
    toShopId?: string;
    inventoryMethod?: 'FIFO' | 'LIFO';
    notes?: string;
  }) => Promise<void>;
  initialProductId?: string;
  initialTransferType?: StockTransfer['transferType'];
}

const StockTransferModal: React.FC<StockTransferModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onCreateTransfer,
  initialProductId,
  initialTransferType
}) => {
  const { t } = useTranslation();
  const { user, company } = useAuth();
  const { products } = useProducts();
  const { shops } = useShops();
  const { warehouses } = useWarehouses();

  const [formData, setFormData] = useState({
    transferType: initialTransferType || ('warehouse_to_shop' as StockTransfer['transferType']),
    productId: initialProductId || '',
    quantity: '',
    fromWarehouseId: '',
    fromShopId: '',
    fromProductionId: '',
    toWarehouseId: '',
    toShopId: '',
    inventoryMethod: 'FIFO' as 'FIFO' | 'LIFO',
    notes: ''
  });

  const [availableStock, setAvailableStock] = useState<number>(0);
  const [loadingStock, setLoadingStock] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        transferType: initialTransferType || 'warehouse_to_shop',
        productId: initialProductId || '',
        quantity: '',
        fromWarehouseId: '',
        fromShopId: '',
        fromProductionId: '',
        toWarehouseId: '',
        toShopId: '',
        inventoryMethod: 'FIFO',
        notes: ''
      });
      setAvailableStock(0);
      setValidationErrors([]);
    }
  }, [isOpen, initialProductId, initialTransferType]);

  // Load available stock when product and source location change
  useEffect(() => {
    if (!isOpen || !formData.productId || !company?.id) {
      setAvailableStock(0);
      return;
    }

    const loadAvailableStock = async () => {
      setLoadingStock(true);
      try {
        let sourceShopId: string | undefined;
        let sourceWarehouseId: string | undefined;
        let sourceLocationType: 'warehouse' | 'shop' | 'production' | 'global' | undefined;

        if (formData.transferType === 'production_to_warehouse') {
          sourceLocationType = 'production';
        } else if (formData.transferType === 'warehouse_to_shop' || formData.transferType === 'warehouse_to_warehouse') {
          sourceWarehouseId = formData.fromWarehouseId || undefined;
          sourceLocationType = 'warehouse';
        } else if (formData.transferType === 'shop_to_shop') {
          sourceShopId = formData.fromShopId || undefined;
          sourceLocationType = 'shop';
        }

        if (!sourceShopId && !sourceWarehouseId && formData.transferType !== 'production_to_warehouse') {
          setAvailableStock(0);
          setLoadingStock(false);
          return;
        }

        const batches = await getAvailableStockBatches(
          formData.productId,
          company.id,
          'product',
          sourceShopId,
          sourceWarehouseId,
          sourceLocationType
        );

        const total = batches.reduce((sum, batch) => sum + (batch.remainingQuantity || 0), 0);
        setAvailableStock(total);
      } catch (error) {
        console.error('Error loading available stock:', error);
        setAvailableStock(0);
      } finally {
        setLoadingStock(false);
      }
    };

    loadAvailableStock();
  }, [isOpen, formData.productId, formData.transferType, formData.fromWarehouseId, formData.fromShopId, company?.id]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setValidationErrors([]);
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!formData.productId) {
      errors.push('Le produit est requis');
    }

    const quantity = parseFloat(formData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      errors.push('La quantité doit être supérieure à 0');
    }

    if (quantity > availableStock) {
      errors.push(`Stock insuffisant. Disponible: ${availableStock}`);
    }

    // Validate based on transfer type
    if (formData.transferType === 'production_to_warehouse') {
      if (!formData.fromProductionId) {
        errors.push('La production source est requise');
      }
      if (!formData.toWarehouseId) {
        errors.push('L\'entrepôt de destination est requis');
      }
    } else if (formData.transferType === 'warehouse_to_shop') {
      if (!formData.fromWarehouseId) {
        errors.push('L\'entrepôt source est requis');
      }
      if (!formData.toShopId) {
        errors.push('Le magasin de destination est requis');
      }
    } else if (formData.transferType === 'warehouse_to_warehouse') {
      if (!formData.fromWarehouseId) {
        errors.push('L\'entrepôt source est requis');
      }
      if (!formData.toWarehouseId) {
        errors.push('L\'entrepôt de destination est requis');
      }
      if (formData.fromWarehouseId === formData.toWarehouseId) {
        errors.push('L\'entrepôt source et de destination doivent être différents');
      }
    } else if (formData.transferType === 'shop_to_shop') {
      if (!formData.fromShopId) {
        errors.push('Le magasin source est requis');
      }
      if (!formData.toShopId) {
        errors.push('Le magasin de destination est requis');
      }
      if (formData.fromShopId === formData.toShopId) {
        errors.push('Le magasin source et de destination doivent être différents');
      }
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateTransfer({
        transferType: formData.transferType,
        productId: formData.productId,
        quantity: parseFloat(formData.quantity),
        fromWarehouseId: formData.fromWarehouseId || undefined,
        fromShopId: formData.fromShopId || undefined,
        fromProductionId: formData.fromProductionId || undefined,
        toWarehouseId: formData.toWarehouseId || undefined,
        toShopId: formData.toShopId || undefined,
        inventoryMethod: formData.inventoryMethod,
        notes: formData.notes || undefined
      });

      showSuccessToast('Transfert effectué avec succès');
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      showErrorToast(error.message || 'Erreur lors du transfert');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Product options
  const productOptions = useMemo(() => {
    return (products || [])
      .filter(p => p.isAvailable)
      .map(product => ({
        label: product.name,
        value: product.id
      }));
  }, [products]);

  // Shop options
  const shopOptions = useMemo(() => {
    return (shops || []).map(shop => ({
      label: shop.name,
      value: shop.id
    }));
  }, [shops]);

  // Warehouse options
  const warehouseOptions = useMemo(() => {
    return (warehouses || []).map(warehouse => ({
      label: warehouse.name,
      value: warehouse.id
    }));
  }, [warehouses]);

  // Transfer type options
  const transferTypeOptions = [
    { label: 'Production → Entrepôt', value: 'production_to_warehouse' },
    { label: 'Entrepôt → Magasin', value: 'warehouse_to_shop' },
    { label: 'Entrepôt → Entrepôt', value: 'warehouse_to_warehouse' },
    { label: 'Magasin → Magasin', value: 'shop_to_shop' }
  ];

  const selectedProduct = products?.find(p => p.id === formData.productId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transfert de Stock"
      size="lg"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleSubmit}
          cancelText="Annuler"
          confirmText="Effectuer le transfert"
          isLoading={isSubmitting}
          disabled={isSubmitting}
        />
      }
    >
      <div className="space-y-4">
        {validationErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Transfer Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type de transfert <span className="text-red-500">*</span>
          </label>
          <Select
            value={formData.transferType}
            onChange={(e) => {
              handleInputChange('transferType', e.target.value);
              // Reset location fields when type changes
              setFormData(prev => ({
                ...prev,
                transferType: e.target.value as StockTransfer['transferType'],
                fromWarehouseId: '',
                fromShopId: '',
                fromProductionId: '',
                toWarehouseId: '',
                toShopId: ''
              }));
            }}
            options={transferTypeOptions}
          />
        </div>

        {/* Product Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Produit <span className="text-red-500">*</span>
          </label>
          <Select
            value={formData.productId}
            onChange={(e) => handleInputChange('productId', e.target.value)}
            options={productOptions}
            placeholder="Sélectionner un produit"
          />
        </div>

        {/* Source Location */}
        {formData.transferType === 'production_to_warehouse' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Production source <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formData.fromProductionId}
              onChange={(e) => handleInputChange('fromProductionId', e.target.value)}
              placeholder="ID de la production"
            />
            <p className="text-xs text-gray-500 mt-1">
              Note: L'intégration avec les productions sera ajoutée dans une phase ultérieure
            </p>
          </div>
        )}

        {formData.transferType === 'warehouse_to_shop' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entrepôt source <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.fromWarehouseId}
              onChange={(e) => handleInputChange('fromWarehouseId', e.target.value)}
              options={warehouseOptions}
              placeholder="Sélectionner un entrepôt"
            />
          </div>
        )}

        {formData.transferType === 'warehouse_to_warehouse' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entrepôt source <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.fromWarehouseId}
              onChange={(e) => handleInputChange('fromWarehouseId', e.target.value)}
              options={warehouseOptions}
              placeholder="Sélectionner un entrepôt"
            />
          </div>
        )}

        {formData.transferType === 'shop_to_shop' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Magasin source <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.fromShopId}
              onChange={(e) => handleInputChange('fromShopId', e.target.value)}
              options={shopOptions}
              placeholder="Sélectionner un magasin"
            />
          </div>
        )}

        {/* Destination Location */}
        {formData.transferType === 'production_to_warehouse' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entrepôt de destination <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.toWarehouseId}
              onChange={(e) => handleInputChange('toWarehouseId', e.target.value)}
              options={warehouseOptions}
              placeholder="Sélectionner un entrepôt"
            />
          </div>
        )}

        {(formData.transferType === 'warehouse_to_shop' || formData.transferType === 'shop_to_shop') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Magasin de destination <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.toShopId}
              onChange={(e) => handleInputChange('toShopId', e.target.value)}
              options={shopOptions}
              placeholder="Sélectionner un magasin"
            />
          </div>
        )}

        {formData.transferType === 'warehouse_to_warehouse' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entrepôt de destination <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.toWarehouseId}
              onChange={(e) => handleInputChange('toWarehouseId', e.target.value)}
              options={warehouseOptions}
              placeholder="Sélectionner un entrepôt"
            />
          </div>
        )}

        {/* Available Stock Display */}
        {formData.productId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Stock disponible:</span>
              <span className="text-lg font-bold text-blue-600">
                {loadingStock ? '...' : availableStock}
              </span>
            </div>
          </div>
        )}

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantité <span className="text-red-500">*</span>
          </label>
          <Input
            type="number"
            value={formData.quantity}
            onChange={(e) => handleInputChange('quantity', e.target.value)}
            placeholder="Quantité à transférer"
            min="1"
            step="1"
          />
        </div>

        {/* Inventory Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Méthode d'inventaire
          </label>
          <Select
            value={formData.inventoryMethod}
            onChange={(e) => handleInputChange('inventoryMethod', e.target.value)}
            options={[
              { label: 'FIFO (Premier entré, premier sorti)', value: 'FIFO' },
              { label: 'LIFO (Dernier entré, premier sorti)', value: 'LIFO' }
            ]}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optionnel)
          </label>
          <Textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder="Notes sur le transfert"
            rows={3}
          />
        </div>
      </div>
    </Modal>
  );
};

export default StockTransferModal;

