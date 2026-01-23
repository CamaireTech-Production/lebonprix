import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalFooter, Input, Select, Textarea } from '@components/common';
import { useAuth } from '@contexts/AuthContext';
import { useProducts } from '@hooks/data/useFirestore';
import { useShops } from '@hooks/data/useFirestore';
import { useWarehouses } from '@hooks/data/useFirestore';
import { getAvailableStockBatches, getStockBatchesByLocation } from '@services/firestore/stock/stockService';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import type { StockTransfer, Product, Shop, Warehouse, StockBatch } from '../../types/models';

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

interface ProductWithStock {
  product: Product;
  stock: number;
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
    transferType: initialTransferType || ('' as StockTransfer['transferType'] | ''),
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
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [productsWithStock, setProductsWithStock] = useState<Map<string, ProductWithStock>>(new Map());

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        transferType: initialTransferType || ('' as StockTransfer['transferType'] | ''),
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
      setProductsWithStock(new Map());
      setValidationErrors([]);
    }
  }, [isOpen, initialProductId, initialTransferType]);

  // Load products with stock when source location is selected
  useEffect(() => {
    if (!isOpen || !company?.id || !formData.transferType) {
      setProductsWithStock(new Map());
      return;
    }

    const loadProductsWithStock = async () => {
      // Determine source location based on transfer type
      let sourceShopId: string | undefined;
      let sourceWarehouseId: string | undefined;
      let sourceLocationType: 'warehouse' | 'shop' | undefined;

      if (formData.transferType === 'warehouse_to_shop' || formData.transferType === 'warehouse_to_warehouse') {
        if (!formData.fromWarehouseId) {
          setProductsWithStock(new Map());
          return;
        }
        sourceWarehouseId = formData.fromWarehouseId;
        sourceLocationType = 'warehouse';
      } else if (formData.transferType === 'shop_to_shop' || formData.transferType === 'shop_to_warehouse') {
        if (!formData.fromShopId) {
          setProductsWithStock(new Map());
          return;
        }
        sourceShopId = formData.fromShopId;
        sourceLocationType = 'shop';
      } else {
        setProductsWithStock(new Map());
        return;
      }

      setLoadingProducts(true);
      try {
        // Get all stock batches for the source location
        const batches = await getStockBatchesByLocation(
          company.id,
          'product',
          sourceShopId,
          sourceWarehouseId,
          sourceLocationType
        );

        // Filter batches with remaining quantity > 0
        const availableBatches = batches.filter(
          batch => batch.remainingQuantity && batch.remainingQuantity > 0 && batch.status === 'active'
        );

        // Aggregate by product
        const productStockMap = new Map<string, ProductWithStock>();

        availableBatches.forEach((batch) => {
          if (!batch.productId) return;

          const product = products?.find(p => p.id === batch.productId);
          if (!product || product.isDeleted === true || product.isAvailable === false) {
            return;
          }

          const existing = productStockMap.get(batch.productId);
          const stock = batch.remainingQuantity || 0;

          if (existing) {
            existing.stock += stock;
          } else {
            productStockMap.set(batch.productId, {
              product,
              stock
            });
          }
        });

        setProductsWithStock(productStockMap);
      } catch (error) {
        console.error('Error loading products with stock:', error);
        setProductsWithStock(new Map());
      } finally {
        setLoadingProducts(false);
      }
    };

    loadProductsWithStock();
  }, [isOpen, formData.transferType, formData.fromWarehouseId, formData.fromShopId, company?.id, products]);

  // Load available stock when product and source location change
  useEffect(() => {
    if (!isOpen || !formData.productId || !company?.id || !formData.transferType) {
      setAvailableStock(0);
      return;
    }

    const loadAvailableStock = async () => {
      let sourceShopId: string | undefined;
      let sourceWarehouseId: string | undefined;
      let sourceLocationType: 'warehouse' | 'shop' | undefined;

      if (formData.transferType === 'warehouse_to_shop' || formData.transferType === 'warehouse_to_warehouse') {
        if (!formData.fromWarehouseId) {
          setAvailableStock(0);
          return;
        }
        sourceWarehouseId = formData.fromWarehouseId;
        sourceLocationType = 'warehouse';
      } else if (formData.transferType === 'shop_to_shop' || formData.transferType === 'shop_to_warehouse') {
        if (!formData.fromShopId) {
          setAvailableStock(0);
          return;
        }
        sourceShopId = formData.fromShopId;
        sourceLocationType = 'shop';
      } else {
        setAvailableStock(0);
        return;
      }

      setLoadingStock(true);
      try {
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
    // When transfer type changes, reset dependent fields
    if (field === 'transferType') {
      setFormData(prev => ({
        ...prev,
        transferType: value as StockTransfer['transferType'],
        fromWarehouseId: '',
        fromShopId: '',
        toWarehouseId: '',
        toShopId: '',
        productId: '',
        quantity: ''
      }));
    }
    // When source location changes, reset product and quantity
    else if (field === 'fromWarehouseId' || field === 'fromShopId') {
      setFormData(prev => ({
        ...prev,
        [field]: value,
        productId: '',
        quantity: ''
      }));
    }
    // When destination changes, no reset needed
    else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
    setValidationErrors([]);
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!formData.transferType) {
      errors.push('Le type de transfert est requis');
    }

    if (!formData.productId) {
      errors.push('Le produit est requis');
    }

    const quantity = parseFloat(formData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      errors.push('La quantité doit être supérieure à 0');
    }

    if (formData.productId && quantity > availableStock) {
      errors.push(`Stock insuffisant. Disponible: ${availableStock}`);
    }

    // Validate based on transfer type
    if (formData.transferType === 'warehouse_to_shop') {
      if (!formData.fromWarehouseId) {
        errors.push('L\'entrepôt source est requis');
      } else {
        const sourceWarehouse = warehouses?.find(w => w.id === formData.fromWarehouseId);
        if (sourceWarehouse && sourceWarehouse.isActive === false) {
          errors.push('L\'entrepôt source est désactivé');
        }
      }
      if (!formData.toShopId) {
        errors.push('La boutique de destination est requise');
      } else {
        const destShop = shops?.find(s => s.id === formData.toShopId);
        if (destShop && destShop.isActive === false) {
          errors.push('La boutique de destination est désactivée');
        }
      }
    } else if (formData.transferType === 'warehouse_to_warehouse') {
      if (!formData.fromWarehouseId) {
        errors.push('L\'entrepôt source est requis');
      } else {
        const sourceWarehouse = warehouses?.find(w => w.id === formData.fromWarehouseId);
        if (sourceWarehouse && sourceWarehouse.isActive === false) {
          errors.push('L\'entrepôt source est désactivé');
        }
      }
      if (!formData.toWarehouseId) {
        errors.push('L\'entrepôt de destination est requis');
      } else {
        const destWarehouse = warehouses?.find(w => w.id === formData.toWarehouseId);
        if (destWarehouse && destWarehouse.isActive === false) {
          errors.push('L\'entrepôt de destination est désactivé');
        }
      }
      if (formData.fromWarehouseId === formData.toWarehouseId) {
        errors.push('L\'entrepôt source et de destination doivent être différents');
      }
    } else if (formData.transferType === 'shop_to_shop') {
      if (!formData.fromShopId) {
        errors.push('La boutique source est requise');
      } else {
        const sourceShop = shops?.find(s => s.id === formData.fromShopId);
        if (sourceShop && sourceShop.isActive === false) {
          errors.push('La boutique source est désactivée');
        }
      }
      if (!formData.toShopId) {
        errors.push('La boutique de destination est requise');
      } else {
        const destShop = shops?.find(s => s.id === formData.toShopId);
        if (destShop && destShop.isActive === false) {
          errors.push('La boutique de destination est désactivée');
        }
      }
      if (formData.fromShopId === formData.toShopId) {
        errors.push('La boutique source et de destination doivent être différentes');
      }
    } else if (formData.transferType === 'shop_to_warehouse') {
      if (!formData.fromShopId) {
        errors.push('La boutique source est requise');
      } else {
        const sourceShop = shops?.find(s => s.id === formData.fromShopId);
        if (sourceShop && sourceShop.isActive === false) {
          errors.push('La boutique source est désactivée');
        }
      }
      if (!formData.toWarehouseId) {
        errors.push('L\'entrepôt de destination est requis');
      } else {
        const destWarehouse = warehouses?.find(w => w.id === formData.toWarehouseId);
        if (destWarehouse && destWarehouse.isActive === false) {
          errors.push('L\'entrepôt de destination est désactivé');
        }
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
        transferType: formData.transferType as StockTransfer['transferType'],
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

  // Helper to determine if product field should be enabled
  const isProductEnabled = () => {
    if (!formData.transferType) return false;
    if (formData.transferType === 'warehouse_to_shop' || formData.transferType === 'warehouse_to_warehouse') {
      return !!formData.fromWarehouseId;
    } else if (formData.transferType === 'shop_to_shop' || formData.transferType === 'shop_to_warehouse') {
      return !!formData.fromShopId;
    }
    return false;
  };

  // Product options - filtered by stock availability in source location
  const productOptions = useMemo(() => {
    const options: Array<{ label: string; value: string }> = [];
    const productEnabled = isProductEnabled();
    
    // Add placeholder option
    if (!productEnabled || productsWithStock.size === 0) {
      options.push({
        label: !productEnabled
          ? "Sélectionnez d'abord la source"
          : "Aucun produit avec stock disponible",
        value: ''
      });
    } else {
      // Add empty option for placeholder effect
      options.push({
        label: "Sélectionner un produit",
        value: ''
      });
      
      // Add products with stock
      const productList = Array.from(productsWithStock.values())
        .sort((a, b) => a.product.name.localeCompare(b.product.name))
        .map(({ product, stock }) => ({
          label: `${product.name} (Stock: ${stock})`,
          value: product.id
        }));
      
      options.push(...productList);
    }

    return options;
  }, [productsWithStock, formData.transferType, formData.fromWarehouseId, formData.fromShopId]);

  // Shop options - filter out inactive shops
  const shopOptions = useMemo(() => {
    const options: Array<{ label: string; value: string }> = [
      { label: 'Sélectionner une boutique', value: '' }
    ];
    const activeShops = (shops || [])
      .filter(shop => shop.isActive !== false)
      .map(shop => ({
        label: shop.name,
        value: shop.id
      }));
    options.push(...activeShops);
    return options;
  }, [shops]);

  // Warehouse options - filter out inactive warehouses
  const warehouseOptions = useMemo(() => {
    const options: Array<{ label: string; value: string }> = [
      { label: 'Sélectionner un entrepôt', value: '' }
    ];
    const activeWarehouses = (warehouses || [])
      .filter(warehouse => warehouse.isActive !== false)
      .map(warehouse => ({
        label: warehouse.name,
        value: warehouse.id
      }));
    options.push(...activeWarehouses);
    return options;
  }, [warehouses]);

  // Transfer type options - removed production_to_warehouse, added shop_to_warehouse
  const transferTypeOptions = [
    { label: 'Sélectionner un type de transfert', value: '' },
    { label: 'Entrepôt → Boutique', value: 'warehouse_to_shop' },
    { label: 'Entrepôt → Entrepôt', value: 'warehouse_to_warehouse' },
    { label: 'Boutique → Boutique', value: 'shop_to_shop' },
    { label: 'Boutique → Entrepôt', value: 'shop_to_warehouse' }
  ];

  // Helper to determine if source location field should be enabled
  const isSourceLocationEnabled = () => {
    return !!formData.transferType;
  };

  // Helper to determine if destination location field should be enabled
  const isDestinationLocationEnabled = () => {
    if (!formData.transferType) return false;
    if (formData.transferType === 'warehouse_to_shop' || formData.transferType === 'warehouse_to_warehouse') {
      return !!formData.fromWarehouseId;
    } else if (formData.transferType === 'shop_to_shop' || formData.transferType === 'shop_to_warehouse') {
      return !!formData.fromShopId;
    }
    return false;
  };

  // Helper to determine if quantity field should be enabled
  const isQuantityEnabled = () => {
    return !!formData.productId && availableStock > 0;
  };

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

        {/* Step 1: Transfer Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type de transfert <span className="text-red-500">*</span>
          </label>
          <Select
            value={formData.transferType || ''}
            onChange={(e) => handleInputChange('transferType', e.target.value)}
            options={transferTypeOptions}
          />
        </div>

        {/* Step 2: Source Location */}
        {(formData.transferType === 'warehouse_to_shop' || formData.transferType === 'warehouse_to_warehouse') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entrepôt source <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.fromWarehouseId || ''}
              onChange={(e) => handleInputChange('fromWarehouseId', e.target.value)}
              options={warehouseOptions}
              disabled={!isSourceLocationEnabled()}
            />
          </div>
        )}

        {(formData.transferType === 'shop_to_shop' || formData.transferType === 'shop_to_warehouse') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Boutique source <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.fromShopId || ''}
              onChange={(e) => handleInputChange('fromShopId', e.target.value)}
              options={shopOptions}
              disabled={!isSourceLocationEnabled()}
            />
          </div>
        )}

        {/* Step 3: Destination Location */}
        {(formData.transferType === 'warehouse_to_shop' || formData.transferType === 'shop_to_shop') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Boutique de destination <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.toShopId || ''}
              onChange={(e) => handleInputChange('toShopId', e.target.value)}
              options={shopOptions}
              disabled={!isDestinationLocationEnabled()}
            />
          </div>
        )}

        {(formData.transferType === 'warehouse_to_warehouse' || formData.transferType === 'shop_to_warehouse') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entrepôt de destination <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.toWarehouseId || ''}
              onChange={(e) => handleInputChange('toWarehouseId', e.target.value)}
              options={warehouseOptions}
              disabled={!isDestinationLocationEnabled()}
            />
          </div>
        )}

        {/* Step 4: Product Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Produit <span className="text-red-500">*</span>
          </label>
          {loadingProducts ? (
            <div className="text-sm text-gray-500">Chargement des produits...</div>
          ) : (
            <Select
              value={formData.productId || ''}
              onChange={(e) => handleInputChange('productId', e.target.value)}
              options={productOptions}
              disabled={!isProductEnabled() || loadingProducts}
            />
          )}
          {isProductEnabled() && productsWithStock.size === 0 && !loadingProducts && (
            <p className="text-xs text-gray-500 mt-1">
              Aucun produit avec stock disponible dans cette source
            </p>
          )}
        </div>

        {/* Available Stock Display */}
        {formData.productId && availableStock > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Stock disponible:</span>
              <span className="text-lg font-bold text-blue-600">
                {loadingStock ? '...' : availableStock}
              </span>
            </div>
          </div>
        )}

        {/* Step 5: Quantity */}
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
            disabled={!isQuantityEnabled()}
          />
          {formData.quantity && parseFloat(formData.quantity) > availableStock && (
            <p className="text-xs text-red-500 mt-1">
              La quantité ne peut pas dépasser le stock disponible ({availableStock})
            </p>
          )}
        </div>

        {/* Step 6: Inventory Method */}
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

        {/* Step 7: Notes */}
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
