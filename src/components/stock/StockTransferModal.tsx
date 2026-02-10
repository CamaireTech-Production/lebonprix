import React, { useState, useEffect, useMemo } from 'react';
import { Modal, ModalFooter, Input, Select, Textarea, Button } from '@components/common';
import { useAuth } from '@contexts/AuthContext';
import { useProducts } from '@hooks/data/useFirestore';
import { useShops } from '@hooks/data/useFirestore';
import { useWarehouses } from '@hooks/data/useFirestore';
import { getAvailableStockBatches, getStockBatchesByLocation } from '@services/firestore/stock/stockService';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import { Plus } from 'lucide-react';
import type { StockTransfer, Product } from '../../types/models';

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onCreateTransfer: (transferData: {
    transferType: StockTransfer['transferType'];
    products: { productId: string; quantity: number }[];
    fromWarehouseId?: string;
    fromShopId?: string;
    fromProductionId?: string;
    toWarehouseId?: string;
    toShopId?: string;
    inventoryMethod?: 'FIFO' | 'LIFO';
    notes?: string;
    date?: Date | any;
  }) => Promise<void>;
  initialProductId?: string;
  initialTransferType?: StockTransfer['transferType'];
}

interface ProductWithStock {
  product: Product;
  stock: number;
}

interface SelectedProduct {
  productId: string;
  productName: string;
  quantity: string;
  availableStock: number;
}

const StockTransferModal: React.FC<StockTransferModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onCreateTransfer,
  initialProductId,
  initialTransferType
}) => {
  const { company } = useAuth();
  const { products } = useProducts();
  const { shops } = useShops();
  const { warehouses } = useWarehouses();

  // Get current date string in YYYY-MM-DD format for the date input
  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    transferType: initialTransferType || ('' as StockTransfer['transferType'] | ''),
    fromWarehouseId: '',
    fromShopId: '',
    fromProductionId: '',
    toWarehouseId: '',
    toShopId: '',
    inventoryMethod: 'FIFO' as 'FIFO' | 'LIFO',
    notes: '',
    date: today,
    // Temporary fields for the product currently being added
    currentProductId: initialProductId || '',
    currentQuantity: ''
  });

  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
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
        fromWarehouseId: '',
        fromShopId: '',
        fromProductionId: '',
        toWarehouseId: '',
        toShopId: '',
        inventoryMethod: 'FIFO',
        notes: '',
        date: today,
        currentProductId: initialProductId || '',
        currentQuantity: ''
      });
      setSelectedProducts([]);
      setAvailableStock(0);
      setLoadingStock(false);
      setProductsWithStock(new Map());
      setValidationErrors([]);
    }
  }, [isOpen, initialProductId, initialTransferType, today]);

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

  // Load available stock when current product and source location change
  useEffect(() => {
    if (!isOpen || !formData.currentProductId || !company?.id || !formData.transferType) {
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
          formData.currentProductId,
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
  }, [isOpen, formData.currentProductId, formData.transferType, formData.fromWarehouseId, formData.fromShopId, company?.id]);

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
        currentProductId: '',
        currentQuantity: ''
      }));
      setSelectedProducts([]);
    }
    // When source location changes, reset products and current selection
    else if (field === 'fromWarehouseId' || field === 'fromShopId') {
      setFormData(prev => ({
        ...prev,
        [field]: value,
        currentProductId: '',
        currentQuantity: ''
      }));
      setSelectedProducts([]);
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

  const addProduct = () => {
    if (!formData.currentProductId || !formData.currentQuantity) {
      setValidationErrors(['Veuillez sélectionner un produit et une quantité']);
      return;
    }

    const qty = parseFloat(formData.currentQuantity);
    if (isNaN(qty) || qty <= 0) {
      setValidationErrors(['La quantité doit être supérieure à 0']);
      return;
    }

    if (qty > availableStock) {
      setValidationErrors([`Stock insuffisant. Disponible: ${availableStock}`]);
      return;
    }

    // Check if product already added
    if (selectedProducts.some(p => p.productId === formData.currentProductId)) {
      setValidationErrors(['Ce produit est déjà dans la liste']);
      return;
    }

    const product = products?.find(p => p.id === formData.currentProductId);
    if (!product) return;

    setSelectedProducts(prev => [
      ...prev,
      {
        productId: formData.currentProductId,
        productName: product.name,
        quantity: formData.currentQuantity,
        availableStock: availableStock
      }
    ]);

    // Reset current product fields
    setFormData(prev => ({
      ...prev,
      currentProductId: '',
      currentQuantity: ''
    }));
    setAvailableStock(0);
    setValidationErrors([]);
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.productId !== productId));
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!formData.transferType) {
      errors.push('Le type de transfert est requis');
    }

    if (selectedProducts.length === 0) {
      errors.push('Veuillez ajouter au moins un produit pour le transfert');
    }

    if (!formData.date) {
      errors.push('La date de transfert est requise');
    }

    // Validate based on transfer type
    if (formData.transferType === 'warehouse_to_shop') {
      if (!formData.fromWarehouseId) {
        errors.push('L\'entrepôt source est requis');
      }
      if (!formData.toShopId) {
        errors.push('La boutique de destination est requise');
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
        errors.push('La boutique source est requise');
      }
      if (!formData.toShopId) {
        errors.push('La boutique de destination est requise');
      }
      if (formData.fromShopId === formData.toShopId) {
        errors.push('La boutique source et de destination doivent être différentes');
      }
    } else if (formData.transferType === 'shop_to_warehouse') {
      if (!formData.fromShopId) {
        errors.push('La boutique source est requise');
      }
      if (!formData.toWarehouseId) {
        errors.push('L\'entrepôt de destination est requis');
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
        products: selectedProducts.map(p => ({
          productId: p.productId,
          quantity: parseFloat(p.quantity)
        })),
        fromWarehouseId: formData.fromWarehouseId || undefined,
        fromShopId: formData.fromShopId || undefined,
        fromProductionId: formData.fromProductionId || undefined,
        toWarehouseId: formData.toWarehouseId || undefined,
        toShopId: formData.toShopId || undefined,
        inventoryMethod: formData.inventoryMethod,
        notes: formData.notes || undefined,
        date: new Date(formData.date)
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

  // Shop options
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

  // Warehouse options
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

  const transferTypeOptions = [
    { label: 'Sélectionner un type de transfert', value: '' },
    { label: 'Entrepôt → Boutique', value: 'warehouse_to_shop' },
    { label: 'Entrepôt → Entrepôt', value: 'warehouse_to_warehouse' },
    { label: 'Boutique → Boutique', value: 'shop_to_shop' },
    { label: 'Boutique → Entrepôt', value: 'shop_to_warehouse' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transfert de Stock Multi-Produits"
      size="lg"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleSubmit}
          cancelText="Annuler"
          confirmText="Effectuer le transfert"
          isLoading={isSubmitting}
          disabled={isSubmitting || selectedProducts.length === 0}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Transfer Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date du transfert <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
            />
          </div>

          {/* Transfer Type */}
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Source Location */}
          {(formData.transferType === 'warehouse_to_shop' || formData.transferType === 'warehouse_to_warehouse') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Entrepôt source <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.fromWarehouseId || ''}
                onChange={(e) => handleInputChange('fromWarehouseId', e.target.value)}
                options={warehouseOptions}
                disabled={!formData.transferType}
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
                disabled={!formData.transferType}
              />
            </div>
          )}

          {/* Destination Location */}
          {(formData.transferType === 'warehouse_to_shop' || formData.transferType === 'shop_to_shop') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Boutique de destination <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.toShopId || ''}
                onChange={(e) => handleInputChange('toShopId', e.target.value)}
                options={shopOptions}
                disabled={!isProductEnabled()}
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
                disabled={!isProductEnabled()}
              />
            </div>
          )}
        </div>

        <hr className="my-4 border-gray-200" />

        {/* Product Selection Area */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Ajouter des produits</h3>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-7">
              <label className="block text-xs font-medium text-gray-600 mb-1">Produit</label>
              <Select
                value={formData.currentProductId || ''}
                onChange={(e) => handleInputChange('currentProductId', e.target.value)}
                options={productOptions}
                disabled={!isProductEnabled() || loadingProducts}
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Quantité {availableStock > 0 && `(Dispo: ${availableStock})`}
              </label>
              <Input
                type="number"
                value={formData.currentQuantity}
                onChange={(e) => handleInputChange('currentQuantity', e.target.value)}
                placeholder="0"
                disabled={!formData.currentProductId || availableStock <= 0 || loadingStock}
              />
            </div>
            <div className="md:col-span-2">
              <Button
                type="button"
                onClick={addProduct}
                disabled={!formData.currentProductId || !formData.currentQuantity}
                icon={<Plus size={16} />}
                className="w-full"
              >
                {null}
              </Button>
            </div>
          </div>
        </div>

        {/* Selected Products List */}
        {selectedProducts.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Produits à transférer</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedProducts.map((p) => (
                    <tr key={p.productId}>
                      <td className="px-4 py-2 text-sm text-gray-900">{p.productName}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 font-medium">{p.quantity}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => removeProduct(p.productId)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          Retirer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
              rows={2}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default StockTransferModal;
