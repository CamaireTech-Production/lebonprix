import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@contexts/AuthContext';
import { subscribeToSuppliers } from '@services/firestore/suppliers/supplierService';
import { restockProduct } from '@services/firestore/stock/stockAdjustments';
import { getProductStockBatches } from '@services/firestore/stock/stockService';
import { getDefaultShop } from '@services/firestore/shops/shopService';
import { getDefaultWarehouse } from '@services/firestore/warehouse/warehouseService';
import { useShops, useWarehouses } from '@hooks/data/useFirestore';
import { useModules } from '@hooks/business/useModules';
import type { Product, Supplier } from '../../types/models';
import { Modal, Button, Input, PriceInput, Select } from '@components/common';
import { formatCostPrice } from '@utils/inventory/inventoryManagement';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';

interface RestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  batchTotals?: { remaining: number; total: number };
  onSuccess?: () => void;
}

const ProductRestockModal: React.FC<RestockModalProps> = ({
  isOpen,
  onClose,
  product,
  batchTotals,
  onSuccess
}) => {
  const { t } = useTranslation();
  const { user, company } = useAuth();
  const { shops, loading: shopsLoading } = useShops();
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const { isStarter } = useModules(); // Check if Starter plan (no warehouse access)

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDefaultLocation, setLoadingDefaultLocation] = useState(false);
  const [formData, setFormData] = useState({
    quantity: '',
    costPrice: '',
    supplierId: '',
    isOwnPurchase: true, // Default to own purchase
    paymentType: 'paid' as 'paid' | 'credit', // Always require payment type
    notes: '',
    sourceType: '' as 'shop' | 'warehouse' | '',
    shopId: '',
    warehouseId: ''
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const derivedRemaining = batchTotals?.remaining ?? 0;
  const derivedTotal = batchTotals?.total;

  // Load suppliers
  useEffect(() => {
    if (isOpen && company) {
      const unsubscribe = subscribeToSuppliers(company.id, setSuppliers);
      return unsubscribe;
    }
  }, [isOpen, company]);

  // Filter active shops/warehouses
  const activeShops = useMemo(() => {
    if (!shops) return [];
    if (user?.isOwner || user?.role === 'admin') {
      return shops; // Owner/admin can see all shops (including inactive)
    }
    return shops.filter(shop => shop.isActive !== false);
  }, [shops, user]);

  const activeWarehouses = useMemo(() => {
    if (!warehouses) return [];
    if (user?.isOwner || user?.role === 'admin') {
      return warehouses; // Owner/admin can see all warehouses (including inactive)
    }
    return warehouses.filter(warehouse => warehouse.isActive !== false);
  }, [warehouses, user]);

  // Load latest cost price, default location and reset form when modal opens
  useEffect(() => {
    if (isOpen && product && company) {
      const loadDefaults = async () => {
        try {
          if (!company?.id) {
            throw new Error('Company ID not available');
          }

          setLoadingDefaultLocation(true);

          // Get stock batches ordered by creation date (newest first)
          const batches = await getProductStockBatches(product.id, company.id);

          // Get cost price from the most recent batch, or fallback to product's costPrice
          let latestCostPrice = '';
          if (batches.length > 0 && batches[0].costPrice > 0) {
            latestCostPrice = batches[0].costPrice.toString();
          } else if (product.costPrice > 0) {
            latestCostPrice = product.costPrice.toString();
          }

          // Try to get default shop first, then default warehouse
          let defaultSourceType: 'shop' | 'warehouse' | '' = '';
          let defaultShopId = '';
          let defaultWarehouseId = '';

          try {
            const defaultShop = await getDefaultShop(company.id);
            if (defaultShop && defaultShop.isActive !== false) {
              defaultSourceType = 'shop';
              defaultShopId = defaultShop.id;
            } else {
              const defaultWarehouse = await getDefaultWarehouse(company.id);
              if (defaultWarehouse && defaultWarehouse.isActive !== false) {
                defaultSourceType = 'warehouse';
                defaultWarehouseId = defaultWarehouse.id;
              }
            }
          } catch (error) {
            console.error('Error loading default location:', error);
            // Continue without default location - user will need to select manually
          }

          setFormData({
            quantity: '',
            costPrice: latestCostPrice,
            supplierId: '',
            isOwnPurchase: true, // Default to own purchase
            paymentType: 'paid',
            notes: '',
            sourceType: defaultSourceType,
            shopId: defaultShopId,
            warehouseId: defaultWarehouseId
          });
        } catch (error) {
          console.error('Error loading defaults:', error);
          // Fallback to product's costPrice if batch fetch fails
          setFormData({
            quantity: '',
            costPrice: product.costPrice > 0 ? product.costPrice.toString() : '',
            supplierId: '',
            isOwnPurchase: true, // Default to own purchase
            paymentType: 'paid',
            notes: '',
            sourceType: '',
            shopId: '',
            warehouseId: ''
          });
        } finally {
          setLoadingDefaultLocation(false);
        }
      };

      loadDefaults();
    }
  }, [isOpen, product, company]);

  const handleInputChange = (field: string, value: string | boolean) => {
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
      errors.push(t('products.restockModal.validation.invalidQuantity'));
    }

    // Validate cost price
    const costPrice = parseFloat(formData.costPrice);
    if (isNaN(costPrice) || costPrice < 0) {
      errors.push(t('products.restockModal.validation.invalidCostPrice'));
    }

    // Validate location selection if quantity > 0
    if (quantity > 0) {
      if (!formData.sourceType) {
        errors.push('Veuillez choisir un type de source (Boutique ou Entrepôt) pour ce réapprovisionnement.');
      } else if (formData.sourceType === 'shop' && !formData.shopId) {
        errors.push('Veuillez sélectionner une boutique pour ce réapprovisionnement.');
      } else if (formData.sourceType === 'warehouse' && !formData.warehouseId) {
        errors.push('Veuillez sélectionner un entrepôt pour ce réapprovisionnement.');
      }

      // Validate that selected shop/warehouse is active
      if (formData.sourceType === 'shop' && formData.shopId) {
        const selectedShop = activeShops.find(s => s.id === formData.shopId);
        if (selectedShop && selectedShop.isActive === false) {
          errors.push('La boutique sélectionnée est désactivée. Veuillez sélectionner une boutique active.');
        }
      } else if (formData.sourceType === 'warehouse' && formData.warehouseId) {
        const selectedWarehouse = activeWarehouses.find(w => w.id === formData.warehouseId);
        if (selectedWarehouse && selectedWarehouse.isActive === false) {
          errors.push('L\'entrepôt sélectionné est désactivé. Veuillez sélectionner un entrepôt actif.');
        }
      }
    }

    // Validate supplier selection for non-own purchases
    if (!formData.isOwnPurchase && !formData.supplierId) {
      errors.push(t('products.restockModal.validation.supplierRequired'));
    }

    // Validate own purchase vs supplier selection
    if (formData.isOwnPurchase && formData.supplierId) {
      errors.push(t('products.restockModal.validation.ownPurchaseCannotHaveSupplier'));
    }

    // Validate payment type for credit purchases
    if (formData.paymentType === 'credit' && formData.isOwnPurchase) {
      errors.push(t('products.restockModal.validation.ownPurchaseCannotBeCredit'));
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!product || !company) return;

    // Validate form
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    const quantity = parseInt(formData.quantity, 10);
    const costPrice = parseFloat(formData.costPrice);
    const isCredit = formData.paymentType === 'credit';

    setLoading(true);

    // Resolve location info
    let locationType: 'shop' | 'warehouse' | undefined;
    let shopId: string | undefined;
    let warehouseId: string | undefined;

    if (formData.sourceType === 'shop' && formData.shopId) {
      locationType = 'shop';
      shopId = formData.shopId;
    } else if (formData.sourceType === 'warehouse' && formData.warehouseId) {
      locationType = 'warehouse';
      warehouseId = formData.warehouseId;
    }

    try {
      await restockProduct(
        product.id,
        quantity,
        costPrice,
        company.id,
        formData.supplierId || undefined,
        formData.isOwnPurchase,
        isCredit,
        formData.notes || undefined,
        locationType,
        shopId,
        warehouseId
      );

      showSuccessToast(t('products.restockModal.messages.success'));
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error restocking product:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showErrorToast(t('products.restockModal.messages.error', { error: errorMessage }));
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalCost = () => {
    const quantity = parseInt(formData.quantity, 10) || 0;
    const costPrice = parseFloat(formData.costPrice) || 0;
    return quantity * costPrice;
  };

  const getSupplierOptions = () => {
    return [
      { value: '', label: t('products.restockModal.purchaseInfo.selectSupplier') },
      ...suppliers.map(supplier => ({
        value: supplier.id,
        label: supplier.name
      }))
    ];
  };

  const getPaymentTypeOptions = () => {
    return [
      { value: 'paid', label: t('products.restockModal.purchaseInfo.paid') },
      { value: 'credit', label: t('products.restockModal.purchaseInfo.credit') }
    ];
  };

  if (!product) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('products.restockModal.title', { name: product.name })}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product Information */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('products.restockModal.productInfo.title')}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">{t('products.restockModal.productInfo.name')}</span>
              <p className="text-gray-900">{product.name}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">{t('products.restockModal.productInfo.reference')}</span>
              <p className="text-gray-900">{product.reference}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">{t('products.restockModal.productInfo.currentStock')}</span>
              <p className="text-gray-900">
                {derivedTotal !== undefined
                  ? `${derivedRemaining} / ${derivedTotal}`
                  : derivedRemaining}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700">{t('products.restockModal.productInfo.sellingPrice')}</span>
              <p className="text-gray-900">{formatCostPrice(product.sellingPrice)}</p>
            </div>
          </div>
        </div>

        {/* Source Location Selection - Hidden for Starter (auto-selected), shown for Enterprise */}
        {!isStarter && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Source du réapprovisionnement</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Type de source <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.sourceType}
                  onChange={(e) => {
                    const newSourceType = e.target.value as 'shop' | 'warehouse' | '';
                    setFormData(prev => ({
                      ...prev,
                      sourceType: newSourceType,
                      // Clear the opposite location when type changes
                      shopId: newSourceType === 'shop' ? prev.shopId : '',
                      warehouseId: newSourceType === 'warehouse' ? prev.warehouseId : ''
                    }));
                    // Clear validation errors when user changes selection
                    if (validationErrors.length > 0) {
                      setValidationErrors([]);
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loadingDefaultLocation}
                >
                  <option value="">Sélectionner un type de source</option>
                  <option value="shop">Boutique</option>
                  {/* Only show warehouse option for Enterprise users */}
                  {!isStarter && <option value="warehouse">Entrepôt</option>}
                </select>
              </div>

              {formData.sourceType === 'shop' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Boutique <span className="text-red-500">*</span>
                  </label>
                  {shopsLoading ? (
                    <div className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                      Chargement des boutiques...
                    </div>
                  ) : activeShops.length === 0 ? (
                    <div className="w-full px-3 py-2 text-sm border border-yellow-300 rounded-md bg-yellow-50 text-yellow-700">
                      Aucune boutique disponible. Veuillez créer une boutique.
                    </div>
                  ) : (
                    <select
                      value={formData.shopId}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, shopId: e.target.value }));
                        if (validationErrors.length > 0) {
                          setValidationErrors([]);
                        }
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Sélectionner une boutique</option>
                      {activeShops.map(shop => (
                        <option key={shop.id} value={shop.id}>
                          {shop.name} {shop.isDefault ? '(Par défaut)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {formData.sourceType === 'warehouse' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Entrepôt <span className="text-red-500">*</span>
                  </label>
                  {warehousesLoading ? (
                    <div className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                      Chargement des entrepôts...
                    </div>
                  ) : activeWarehouses.length === 0 ? (
                    <div className="w-full px-3 py-2 text-sm border border-yellow-300 rounded-md bg-yellow-50 text-yellow-700">
                      Aucun entrepôt disponible. Veuillez créer un entrepôt.
                    </div>
                  ) : (
                    <select
                      value={formData.warehouseId}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, warehouseId: e.target.value }));
                        if (validationErrors.length > 0) {
                          setValidationErrors([]);
                        }
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Sélectionner un entrepôt</option>
                      {activeWarehouses.map(warehouse => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name} {warehouse.isDefault ? '(Par défaut)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {formData.sourceType === 'shop'
                ? 'Le stock sera créé directement dans la boutique sélectionnée'
                : formData.sourceType === 'warehouse'
                  ? 'Le stock sera créé directement dans l\'entrepôt sélectionné'
                  : 'Sélectionnez une boutique ou un entrepôt pour ce réapprovisionnement'}
            </p>
          </div>
        )}

        {/* Restock Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">{t('products.restockModal.restockDetails.title')}</h3>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('products.restockModal.restockDetails.quantity')}
              type="number"
              value={formData.quantity}
              onChange={(e) => handleInputChange('quantity', e.target.value)}
              placeholder={t('products.restockModal.restockDetails.quantityPlaceholder')}
              required
              min="1"
              step="1"
            />

            <PriceInput
              label={t('products.restockModal.restockDetails.costPrice')}
              name="costPrice"
              value={formData.costPrice}
              onChange={(e) => handleInputChange('costPrice', e.target.value)}
              placeholder={t('products.restockModal.restockDetails.costPricePlaceholder')}
              required
              allowDecimals={true}
            />
          </div>

          {/* Total Cost Display */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-sm font-medium text-blue-800">{t('products.restockModal.restockDetails.totalCost')}</div>
            <div className="text-lg font-semibold text-blue-900">
              {formatCostPrice(calculateTotalCost())}
            </div>
          </div>
        </div>

        {/* Purchase Type and Supplier Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">{t('products.restockModal.purchaseInfo.title')}</h3>

          {/* Purchase Type Selection - Made more visible */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="isOwnPurchase"
                checked={formData.isOwnPurchase}
                onChange={(e) => handleInputChange('isOwnPurchase', e.target.checked)}
                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
              />
              <label htmlFor="isOwnPurchase" className="flex-1 cursor-pointer">
                <span className="text-base font-semibold text-gray-900">{t('products.restockModal.purchaseInfo.ownPurchase')}</span>
                <p className="text-sm text-gray-600 mt-1">
                  {t('products.restockModal.purchaseInfo.ownPurchaseDescription')}
                </p>
              </label>
              {formData.isOwnPurchase && (
                <span className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-full">
                  {t('products.restockModal.purchaseInfo.selected')}
                </span>
              )}
            </div>
          </div>

          {/* Supplier Selection */}
          <Select
            label={t('products.restockModal.purchaseInfo.supplier')}
            value={formData.supplierId}
            onChange={(e) => handleInputChange('supplierId', e.target.value)}
            options={getSupplierOptions()}
            disabled={formData.isOwnPurchase}
          />

          {/* Payment Type Selection */}
          <Select
            label={t('products.restockModal.purchaseInfo.paymentType')}
            value={formData.paymentType}
            onChange={(e) => handleInputChange('paymentType', e.target.value)}
            options={getPaymentTypeOptions()}
            disabled={formData.isOwnPurchase}
          />

          {/* Information Messages */}
          {formData.isOwnPurchase && (
            <div className="text-sm text-gray-600 bg-yellow-50 p-2 rounded">
              {t('products.restockModal.purchaseInfo.ownPurchaseSelected')}
            </div>
          )}

          {formData.paymentType === 'credit' && !formData.isOwnPurchase && formData.supplierId && (
            <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
              {t('products.restockModal.purchaseInfo.creditSelected')}
            </div>
          )}

          {formData.paymentType === 'paid' && !formData.isOwnPurchase && formData.supplierId && (
            <div className="text-sm text-gray-600 bg-green-50 p-2 rounded">
              {t('products.restockModal.purchaseInfo.paidSelected')}
            </div>
          )}
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <h4 className="text-md font-medium text-red-800 mb-2">{t('products.restockModal.validation.title')}</h4>
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
            {t('products.restockModal.notes.label')}
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder={t('products.restockModal.notes.placeholder')}
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
            {t('products.restockModal.actions.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={loading}
          >
            {loading ? t('products.restockModal.actions.restocking') : t('products.restockModal.actions.restock')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ProductRestockModal;

