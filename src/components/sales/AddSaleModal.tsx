import { useAddSaleForm } from '@hooks/forms/useAddSaleForm';
import { Modal, ModalFooter, Input, PriceInput, Button, ImageWithSkeleton, LocationAutocomplete, Select as CommonSelect } from '@components/common';
import Select from 'react-select';
import { Plus, Trash2, Info, ChevronDown, ChevronUp} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { logError } from '@utils/core/logger';
import { formatPrice } from '@utils/formatting/formatPrice';
import type { Sale, StockBatch } from '../../types/models';
import SaleDetailsModal from './SaleDetailsModal';
import { getProductStockBatches, getAvailableStockBatches, getStockBatchesByLocation } from '@services/firestore/stock/stockService';
import { showWarningToast } from '@utils/core/toast';
import { useAuth } from '@contexts/AuthContext';
import { useAllStockBatches } from '@hooks/business/useStockBatches';
import { buildProductStockMap, getEffectiveProductStock } from '@utils/inventory/stockHelpers';
import { useShops, useWarehouses } from '@hooks/data/useFirestore';
import { getDefaultShop } from '@services/firestore/shops/shopService';

const LOW_STOCK_THRESHOLD = 5;

interface AddSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaleAdded?: () => void;
}

interface ProductStockInfo {
  productId: string;
  batches: StockBatch[];
  totalStock: number;
  averageCostPrice: number;
}

const AddSaleModal: React.FC<AddSaleModalProps> = ({ isOpen, onClose, onSaleAdded }) => {
  const { t } = useTranslation();
  const { company, user } = useAuth();
  const { shops, loading: shopsLoading, error: shopsError } = useShops();
  const { warehouses, loading: warehousesLoading, error: warehousesError } = useWarehouses();
  
  // Load all stock batches to display stock in product selection list
  const { batches: allBatches, loading: batchesLoading } = useAllStockBatches('product');
  
  // Build stock map from batches for quick stock lookup
  const stockMap = useMemo(
    () => buildProductStockMap(allBatches || []),
    [allBatches]
  );

  const {
    formData,
    setFormData,
    isSubmitting,
    autoSaveCustomer,
    setAutoSaveCustomer,
    showCustomerDropdown,
    customerSearch,

    phoneInputRef,
    products,
    customers,
    activeSources,
    handleInputChange,
    handlePhoneChange,
    handlePhoneBlur,
    handleProductChange,
    handleProductInputChange,
    addProductField,
    removeProductField,
    resetForm,
    calculateProductTotal,
    calculateTotal,
    handleAddSale,
    handleSelectCustomer,
  } = useAddSaleForm();

  // No default shop initialization - user must explicitly select

  // Filter active shops/warehouses (for employees, owner/admin can see all)
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



  const [viewedSale, setViewedSale] = useState<Sale | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [productStockInfo, setProductStockInfo] = useState<Map<string, ProductStockInfo>>(new Map());
  const [loadingStockInfo, setLoadingStockInfo] = useState<Set<string>>(new Set());
  const [showAdditionalCustomerInfo, setShowAdditionalCustomerInfo] = useState(false);
  const [productsWithStock, setProductsWithStock] = useState<Map<string, { product: any; stock: number }>>(new Map());
  const [loadingProductsWithStock, setLoadingProductsWithStock] = useState(false);
  const [isLocationUserSelected, setIsLocationUserSelected] = useState(false);



  // Load stock batch information for products (location-aware)
  const loadProductStockInfo = async (productId: string) => {
    // Clear cached info when location changes to force reload
    const cacheKey = `${productId}-${formData.sourceType}-${formData.shopId}-${formData.warehouseId}`;
    if (productStockInfo.has(cacheKey) || loadingStockInfo.has(productId)) {
      return;
    }

    setLoadingStockInfo(prev => new Set(prev).add(productId));
    
    try {
      if (!company?.id) {
        throw new Error('Company ID not available');
      }
      
      // Determine location filters based on form data
      let locationType: 'warehouse' | 'shop' | 'production' | 'global' | undefined;
      let queryShopId: string | undefined;
      let queryWarehouseId: string | undefined;
      
      if (formData.sourceType === 'shop' && formData.shopId) {
        locationType = 'shop';
        queryShopId = formData.shopId;
      } else if (formData.sourceType === 'warehouse' && formData.warehouseId) {
        locationType = 'warehouse';
        queryWarehouseId = formData.warehouseId;
      }
      
      // Get location-aware stock batches
      const batches = await getAvailableStockBatches(
        productId,
        company.id,
        'product',
        queryShopId,
        queryWarehouseId,
        locationType
      );
      
      const totalStock = batches.reduce((sum, batch) => sum + (batch.remainingQuantity || 0), 0);
      const totalValue = batches.reduce((sum, batch) => sum + (batch.costPrice * (batch.remainingQuantity || 0)), 0);
      const averageCostPrice = totalStock > 0 ? totalValue / totalStock : 0;

      setProductStockInfo(prev => {
        const newMap = new Map(prev);
        // Use cache key to store location-specific stock info
        newMap.set(cacheKey, {
          productId,
          batches: batches.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)), // Sort by creation time (FIFO order)
          totalStock,
          averageCostPrice
        });
        return newMap;
      });
    } catch (error) {
      logError('Error loading stock info for product', error);
    } finally {
      setLoadingStockInfo(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  // Helper function to get product stock info
  const getProductStockInfo = (productId: string): ProductStockInfo | undefined => {
    const cacheKey = `${productId}-${formData.sourceType}-${formData.shopId}-${formData.warehouseId}`;
    return productStockInfo.get(cacheKey);
  };

  // Load products with stock when source location is USER-SELECTED
  useEffect(() => {
    if (!isOpen || !company?.id) {
      setProductsWithStock(new Map());
      return;
    }

    // Only load products if location was explicitly selected by user
    if (!isLocationUserSelected) {
      setProductsWithStock(new Map());
      return;
    }

    // Also check if we have a valid source type and location ID
    if (!formData.sourceType || (formData.sourceType === 'shop' && !formData.shopId) || (formData.sourceType === 'warehouse' && !formData.warehouseId)) {
      setProductsWithStock(new Map());
      return;
    }

    const loadProductsWithStock = async () => {
      // Determine source location based on form data
      let sourceShopId: string | undefined;
      let sourceWarehouseId: string | undefined;
      let sourceLocationType: 'warehouse' | 'shop' | undefined;

      if (formData.sourceType === 'shop' && formData.shopId) {
        sourceShopId = formData.shopId;
        sourceLocationType = 'shop';
      } else if (formData.sourceType === 'warehouse' && formData.warehouseId) {
        sourceWarehouseId = formData.warehouseId;
        sourceLocationType = 'warehouse';
      } else {
        // No location selected, clear products with stock
        setProductsWithStock(new Map());
        return;
      }

      setLoadingProductsWithStock(true);
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
        const productStockMap = new Map<string, { product: any; stock: number }>();

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
        logError('Error loading products with stock:', error);
        setProductsWithStock(new Map());
      } finally {
        setLoadingProductsWithStock(false);
      }
    };

    loadProductsWithStock();
  }, [isOpen, formData.sourceType, formData.shopId, formData.warehouseId, company?.id, products, isLocationUserSelected]);

  // Load stock info when products are selected or location changes
  useEffect(() => {
    formData.products.forEach(formProduct => {
      if (formProduct.product) {
        // Reload stock info when location changes or product is selected
        loadProductStockInfo(formProduct.product.id);
      }
    });
  }, [formData.products, formData.sourceType, formData.shopId, formData.warehouseId]);



  // Product options for react-select
  // Filter by stock availability in selected location (similar to transfer modal)
  const availableProducts = useMemo(() => {
    // Only filter by location if user has explicitly selected a location
    if (!isLocationUserSelected) {
      // If no location is user-selected, return empty array (products will show message to select location first)
      return [];
    }
    
    // If a location is selected, only show products with stock in that location
    if (formData.sourceType === 'shop' && formData.shopId) {
      return Array.from(productsWithStock.values())
        .map(({ product }) => product)
        .filter(product => product && product.isAvailable !== false);
    } else if (formData.sourceType === 'warehouse' && formData.warehouseId) {
      return Array.from(productsWithStock.values())
        .map(({ product }) => product)
        .filter(product => product && product.isAvailable !== false);
    }
    // If no location selected, return empty array
    return [];
  }, [products, productsWithStock, formData.sourceType, formData.shopId, formData.warehouseId, isLocationUserSelected]);

  const filteredProducts = (productSearchQuery
    ? availableProducts.filter(product =>
        product.name.toLowerCase().includes(productSearchQuery.toLowerCase())
      )
    : availableProducts).slice(0, showAllProducts ? undefined : 10);
  const productOptions = availableProducts.map(product => ({
    label: (
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
          <ImageWithSkeleton 
            src={product.images && product.images.length > 0 ? product.images[0] : '/placeholder.png'} 
            alt={product.name}
            className="w-full h-full object-cover"
            placeholder="/placeholder.png"
          />
        </div>
        <div>
          <div className="font-medium">{product.name}</div>
          <div className="text-sm text-gray-500">
            {(() => {
              // First check if we have detailed stock info (for products already added to form)
              const cacheKey = `${product.id}-${formData.sourceType}-${formData.shopId}-${formData.warehouseId}`;
              const stockInfo = productStockInfo.get(cacheKey);
              if (stockInfo) {
                return `${stockInfo.totalStock} in stock`;
              }
              // Check productsWithStock for location-specific stock
              const productWithStock = productsWithStock.get(product.id);
              if (productWithStock) {
                return `${productWithStock.stock} in stock`;
              }
              // Otherwise, use stockMap from batches (already loaded) - this is global stock
              if (!batchesLoading && stockMap) {
                const stock = getEffectiveProductStock(product, stockMap);
                return `${stock} in stock (global)`;
              }
              return 'Loading stock...';
            })()} - {formatPrice(product.sellingPrice)} XAF
          </div>
        </div>
      </div>
    ),
    value: product
  }));

  // Patch handleAddSale to set viewedSale after success
  const handleAddSaleWithView = async () => {
    try {
      const newSale = await handleAddSale();
      if (newSale) {
        setViewedSale(newSale);
        // finance:refresh is now handled centrally in useSales().addSale()
        // No need to trigger it here to avoid duplication
        if (onSaleAdded) {
          onSaleAdded();
        }
      }
    } catch (error) {
      // console.error('[AddSaleModal] Error in handleAddSaleWithView', error);
    }
  };

  // Handle close with reset
  const handleClose = () => {
    resetForm();
    setProductStockInfo(new Map());
    setProductsWithStock(new Map());
    setIsLocationUserSelected(false);
    onClose();
  };

  // Format stock batch display
  const formatStockBatchInfo = (stockInfo: ProductStockInfo) => {
    if (stockInfo.batches.length === 0) {
      return 'No stock batches available';
    }

    const batchInfo = stockInfo.batches.map(batch => 
      `${batch.remainingQuantity} at ${formatPrice(batch.costPrice)} XAF`
    ).join(', ');

    return `${stockInfo.totalStock} units total (${batchInfo})`;
  };

  // Patch: if viewedSale is set, show details modal instead of form
  if (!isOpen) {
    return null;
  }

  // Low-stock wrappers for product handlers
  const onProductChange = (index: number, option: any) => {
    handleProductChange(index, option);
    if (option && option.value) {
      const productId = option.value.id;
      const stockInfo = getProductStockInfo(productId);
      const currentStock = stockInfo?.totalStock ?? 0;
      const remainingAfter = currentStock - 1;
      if (remainingAfter <= LOW_STOCK_THRESHOLD && remainingAfter >= 0) {
        showWarningToast(`Low stock: ${remainingAfter} left for ${option.value.name}`);
      }
      // Load stock info if not already loaded
      if (!stockInfo && !loadingStockInfo.has(productId)) {
        loadProductStockInfo(productId);
      }
    }
  };

  const onProductInputChange = (index: number, field: any, value: string) => {
    handleProductInputChange(index, field, value);
    const fp = formData.products[index];
    const product = fp?.product;
    const qty = field === 'quantity' ? parseInt(value || '0', 10) : parseInt(fp?.quantity || '0', 10);
    if (product && !isNaN(qty) && qty > 0) {
      const stockInfo = getProductStockInfo(product.id);
      const currentStock = stockInfo?.totalStock ?? 0;
      const remainingAfter = currentStock - qty;
      if (remainingAfter <= LOW_STOCK_THRESHOLD && remainingAfter >= 0) {
        showWarningToast(`Low stock: ${remainingAfter} left for ${product.name}`);
      }
    }
  };

  return (
    <>
      <Modal 
        isOpen={isOpen && !viewedSale} 
        onClose={handleClose} 
        title={'Add Sale'} 
        size="xl"
        closeButtonClassName="text-red-500 hover:text-red-700 focus:outline-none"
        footer={
          <ModalFooter
            onCancel={handleClose}
            onConfirm={handleAddSaleWithView}
            confirmText="Add Sale"
            cancelText="Cancel"
            isLoading={isSubmitting}
          />
        }
      >
      <div className="flex flex-col lg:flex-row gap-6 max-w-4xl mx-auto">
        {/* Main Form */}
        <div className="flex-1 space-y-6">
          {/* Source Location Selection */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Source de la vente</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Type de source
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
                    // Reset location selection flag when source type changes
                    setIsLocationUserSelected(false);
                    setProductsWithStock(new Map()); // Clear products when type changes
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sélectionner un type de source</option>
                  <option value="shop">Boutique</option>
                  <option value="warehouse">Entrepôt</option>
                </select>
              </div>
              
              {formData.sourceType === 'shop' ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Boutique <span className="text-red-500">*</span>
                  </label>
                  {shopsLoading ? (
                    <div className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50">
                      Chargement des boutiques...
                    </div>
                  ) : shopsError ? (
                    <div className="w-full px-3 py-2 text-sm border border-red-300 rounded-md bg-red-50 text-red-700">
                      Erreur lors du chargement des boutiques
                    </div>
                  ) : activeShops.length === 0 ? (
                    <div className="w-full px-3 py-2 text-sm border border-yellow-300 rounded-md bg-yellow-50 text-yellow-700">
                      Aucune boutique active disponible. Veuillez créer une boutique ou activer une boutique existante.
                    </div>
                  ) : (
                    <select
                      value={formData.shopId}
                      onChange={(e) => {
                        const selectedShop = activeShops.find(s => s.id === e.target.value);
                        if (selectedShop && selectedShop.isActive === false) {
                          showWarningToast('Cette boutique est désactivée. Veuillez sélectionner une boutique active.');
                          return;
                        }
                        setFormData(prev => ({ ...prev, shopId: e.target.value }));
                        // Mark as user-selected when shop is explicitly chosen
                        setIsLocationUserSelected(true);
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Sélectionner une boutique</option>
                      {activeShops.map(shop => (
                        <option key={shop.id} value={shop.id}>
                          {shop.name} {shop.isDefault && '(Par défaut)'} {shop.isActive === false && '(Désactivé)'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : formData.sourceType === 'warehouse' ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Entrepôt <span className="text-red-500">*</span>
                  </label>
                  {warehousesLoading ? (
                    <div className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50">
                      Chargement des entrepôts...
                    </div>
                  ) : warehousesError ? (
                    <div className="w-full px-3 py-2 text-sm border border-red-300 rounded-md bg-red-50 text-red-700">
                      Erreur lors du chargement des entrepôts
                    </div>
                  ) : activeWarehouses.length === 0 ? (
                    <div className="w-full px-3 py-2 text-sm border border-yellow-300 rounded-md bg-yellow-50 text-yellow-700">
                      Aucun entrepôt actif disponible. Veuillez créer un entrepôt ou activer un entrepôt existant.
                    </div>
                  ) : (
                    <select
                      value={formData.warehouseId}
                      onChange={(e) => {
                        const selectedWarehouse = activeWarehouses.find(w => w.id === e.target.value);
                        if (selectedWarehouse && selectedWarehouse.isActive === false) {
                          showWarningToast('Cet entrepôt est désactivé. Veuillez sélectionner un entrepôt actif.');
                          return;
                        }
                        setFormData(prev => ({ ...prev, warehouseId: e.target.value }));
                        // Mark as user-selected when warehouse is explicitly chosen
                        setIsLocationUserSelected(true);
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Sélectionner un entrepôt</option>
                      {activeWarehouses.map(warehouse => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name} {warehouse.isDefault && '(Par défaut)'} {warehouse.isActive === false && '(Désactivé)'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : null}
            </div>
            <p className="text-xs text-gray-500">
              Le stock sera consommé depuis l'emplacement sélectionné
            </p>
          </div>

          {/* Customer Information Section */}
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
              </label>
              <div className="flex space-x-2">
                <Input
                  type="tel"
                  name="customerPhone"
                  value={formData.customerPhone}
                  onChange={handlePhoneChange}
                  onBlur={handlePhoneBlur}
                    placeholder="Phone"
                  className="flex-1"
                  helpText="Enter customer phone number (optional for credit sales)"
                  ref={phoneInputRef}
                />
              </div>
              
              {/* Customer Dropdown - Phone based recommendations */}
{showCustomerDropdown && customerSearch && customerSearch.length >= 2 && /\d/.test(customerSearch) && (() => {
  const normalizedSearch = customerSearch.replace(/\D/g, '');
  
  // Don't show if normalized search is too short
  if (normalizedSearch.length < 2) {
    return null;
  }
  
  // Filter customers by phone number match
  const filteredCustomers = customers.filter(c => {
    if (!c.phone) {
      return false;
    }
    const customerPhone = c.phone.replace(/\D/g, '');
    return customerPhone.includes(normalizedSearch) || normalizedSearch.includes(customerPhone);
  });
  
  // Don't show dropdown if no results
  if (filteredCustomers.length === 0) {
    return null;
  }
  
  return (
    <div 
      data-dropdown="customer"
      className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto mt-1"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-2 bg-gray-50 border-b">
        <div className="text-xs font-medium text-gray-600">Sélectionner un client par téléphone:</div>
      </div>
      
      {filteredCustomers.slice(0, 5).map(c => (
        <button
          key={c.id}
          type="button"
          className="w-full text-left p-3 hover:bg-emerald-50 border-b border-gray-100 last:border-b-0 transition-colors"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Use handleSelectCustomer from the hook
            handleSelectCustomer(c);
          }}
        >
          <div className="font-medium text-gray-900">{c.name || 'Divers'}</div>
          <div className="text-sm text-gray-500">{c.phone}{c.quarter ? ` • ${c.quarter}` : ''}</div>
        </button>
      ))}
    </div>
  );
})()}
            </div>
            <div className="flex items-center space-x-2 mb-2">
              <input
                type="checkbox"
                id="autoSaveCustomerCheckbox"
                checked={autoSaveCustomer}
                onChange={e => setAutoSaveCustomer(e.target.checked)}
                className="form-checkbox h-4 w-4 text-emerald-600 border-gray-300 rounded"
              />
              <label htmlFor="autoSaveCustomerCheckbox" className="text-sm text-gray-700">
                  Auto-save customer
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <Input
                    label={formData.status === 'credit' ? "Name *" : "Name"}
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleInputChange}
                  className={formData.status === 'credit' && !formData.customerName ? 'border-red-300' : ''}
                />
                
                {/* Customer Dropdown - Name based recommendations */}
{showCustomerDropdown && customerSearch && customerSearch.length >= 2 && !/\d/.test(customerSearch) && (() => {
  const searchTerm = customerSearch.toLowerCase().trim();
  
  // Filter customers by name match
  const filteredCustomers = customers.filter(c => {
    if (!c.name) {
      return false;
    }
    const customerName = (c.name || '').toLowerCase();
    return customerName.includes(searchTerm);
  });
  
  // Don't show dropdown if no results
  if (filteredCustomers.length === 0) {
    return null;
  }
  
  return (
    <div 
      data-dropdown="customer"
      className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto mt-1"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-2 bg-gray-50 border-b">
        <div className="text-xs font-medium text-gray-600">Sélectionner un client par nom:</div>
      </div>
      
      {filteredCustomers.slice(0, 5).map(c => (
        <button
          key={c.id}
          type="button"
          className="w-full text-left p-3 hover:bg-emerald-50 border-b border-gray-100 last:border-b-0 transition-colors"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Use handleSelectCustomer from the hook
            handleSelectCustomer(c);
          }}
        >
          <div className="font-medium text-gray-900">{c.name || 'Divers'}</div>
          <div className="text-sm text-gray-500">{c.phone}{c.quarter ? ` • ${c.quarter}` : ''}</div>
        </button>
      ))}
    </div>
  );
})()}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quarter
                </label>
                <LocationAutocomplete
                  value={formData.customerQuarter}
                  onChange={(value) => {
                    setFormData(prev => ({
                      ...prev,
                      customerQuarter: value
                    }));
                  }}
                  placeholder="Quarter (optional)"
                />
              </div>
            </div>
            
            {/* Customer Source Dropdown */}
            {activeSources.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source Clientelle <span className="text-gray-500 font-normal">(optionnel)</span>
                </label>
                <Select
                  options={[
                    { value: '', label: 'Aucune source', color: '#9CA3AF' },
                    ...activeSources.map(source => ({
                      value: source.id,
                      label: source.name,
                      color: source.color || '#3B82F6'
                    }))
                  ]}
                  value={
                    formData.customerSourceId && activeSources.find(s => s.id === formData.customerSourceId)
                      ? { 
                          value: formData.customerSourceId, 
                          label: activeSources.find(s => s.id === formData.customerSourceId)?.name || '',
                          color: activeSources.find(s => s.id === formData.customerSourceId)?.color || '#3B82F6'
                        }
                      : null
                  }
                  onChange={(option) => {
                    setFormData(prev => ({
                      ...prev,
                      customerSourceId: option?.value || ''
                    }));
                  }}
                  formatOptionLabel={({ label, color }) => (
                    <div className="flex items-center gap-2">
                      {color && (
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      )}
                      <span>{label}</span>
                    </div>
                  )}
                  className="react-select-container"
                  classNamePrefix="react-select"
                  isClearable
                  placeholder="Sélectionner une source (optionnel)..."
                  isSearchable={false}
                />
              </div>
            )}
            
            {/* Bouton pour afficher/masquer les informations supplémentaires */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowAdditionalCustomerInfo(!showAdditionalCustomerInfo)}
                className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors py-2"
              >
                <span className="flex items-center">
                  <Info className="h-4 w-4 mr-2" />
                  Informations supplémentaires
                </span>
                {showAdditionalCustomerInfo ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              
              {showAdditionalCustomerInfo && (
                <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200 border-t border-gray-200 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Prénom"
                      name="customerFirstName"
                      value={formData.customerFirstName || ''}
                      onChange={handleInputChange}
                      placeholder="Prénom (optionnel)"
                    />
                    <Input
                      label="Nom de famille"
                      name="customerLastName"
                      value={formData.customerLastName || ''}
                      onChange={handleInputChange}
                      placeholder="Nom de famille (optionnel)"
                    />
                  </div>
                  <Input
                    label="Adresse"
                    name="customerAddress"
                    value={formData.customerAddress || ''}
                    onChange={handleInputChange}
                    placeholder="Adresse complète (optionnel)"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Ville"
                      name="customerTown"
                      value={formData.customerTown || ''}
                      onChange={handleInputChange}
                      placeholder="Ville (optionnel)"
                    />
                    <Input
                      label="Date de naissance"
                      name="customerBirthdate"
                      type="date"
                      value={formData.customerBirthdate || ''}
                      onChange={handleInputChange}
                      placeholder="Date de naissance (optionnel)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Comment il a connu l'entreprise
                    </label>
                    <textarea
                      name="customerHowKnown"
                      value={formData.customerHowKnown || ''}
                      onChange={(e) => handleInputChange({ target: { name: 'customerHowKnown', value: e.target.value } } as any)}
                      placeholder="Comment il a connu l'entreprise (optionnel)"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
            {/* Selected Products Section - Desktop View */}
            <div className="hidden lg:block space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Selected Products</h3>
              <div className="space-y-4">
                {formData.products.map((product, index) => (
                  product.product && (
                    <div key={product.id} className="p-4 border rounded-lg space-y-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                          <ImageWithSkeleton 
                            src={product.product.images && product.product.images.length > 0 ? product.product.images[0] : '/placeholder.png'} 
                            alt={product.product.name}
                            className="w-full h-full object-cover"
                            placeholder="/placeholder.png"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{product.product.name}</p>
                          <p className="text-sm text-gray-500">
                            {(() => {
                              const stockInfo = getProductStockInfo(product.product.id);
                              if (stockInfo) {
                                return `${stockInfo.totalStock} in stock`;
                              }
                              // Use stockMap from batches if available
                              if (!batchesLoading && stockMap) {
                                const stock = getEffectiveProductStock(product.product, stockMap);
                                return `${stock} in stock`;
                              }
                              return 'Loading stock...';
                            })()} - {formatPrice(product.product.sellingPrice)} XAF
                          </p>
                        </div>
                        <button
                          onClick={() => removeProductField(index)}
                          className="p-2 text-red-600 hover:text-red-900"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      
                      {/* Stock Batch Information */}
                      {(() => {
                        const stockInfo = getProductStockInfo(product.product.id);
                        const isLoading = loadingStockInfo.has(product.product.id);
                        
                        return (
                          <div className="p-3 bg-blue-50 rounded-md">
                            <div className="flex items-center space-x-2 mb-2">
                              <Info size={16} className="text-blue-600" />
                              <span className="text-sm font-medium text-blue-700">Available Stock Batches</span>
                            </div>
                            {isLoading ? (
                              <div className="text-sm text-blue-600">Loading stock information...</div>
                            ) : stockInfo ? (
                              <div className="text-sm text-blue-800">
                                {formatStockBatchInfo(stockInfo)}
                                {stockInfo.averageCostPrice > 0 && (
                                  <div className="mt-1 text-xs text-blue-600">
                                    Average cost: {formatPrice(stockInfo.averageCostPrice)} XAF
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-blue-600">No stock batch information available</div>
                            )}
                          </div>
                        );
                      })()}
                      
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Quantity"
                          type="number"
                          min="1"
                          max={(() => {
                            const stockInfo = getProductStockInfo(product.product.id);
                            return (stockInfo?.totalStock ?? 0).toString();
                          })()}
                          value={product.quantity}
                          onChange={(e) => onProductInputChange(index, 'quantity', e.target.value)}
                          required
                          helpText={(() => {
                            const stockInfo = getProductStockInfo(product.product.id);
                            const stock = stockInfo?.totalStock ?? 0;
                            return `Cannot exceed ${stock}`;
                          })()}
                        />
                        <PriceInput
                          label="Negotiated Price"
                          name={`negotiatedPrice-${index}`}
                          value={product.negotiatedPrice}
                          onChange={(e) => onProductInputChange(index, 'negotiatedPrice', e.target.value)}
                          // helpText="Enter the negotiated price (can exceed standard price)"
                        />
                      </div>
                      {/* Individual Product Total - changed bg color to blue-50 */}
                      {product.quantity && (
                        <div className="p-3 bg-blue-50 rounded-md">
                          <span className="text-sm font-medium text-blue-700">Product Total:</span>
                          <span className="ml-2 text-blue-900">{formatPrice(calculateProductTotal(product))} XAF</span>
                        </div>
                      )}
                    </div>
                  )
                ))}
            </div>
          </div>
          {/* Products Section - Mobile View */}
          <div className="lg:hidden space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Products</h3>
              <Button
                variant="outline"
                icon={<Plus size={16} />}
                onClick={addProductField}
              >
                  Add Product
              </Button>
            </div>
            {formData.products.map((product, index) => (
              <div key={product.id} className="p-4 border rounded-lg space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <Select
                      options={productOptions}
                      value={productOptions.find(option => option.value.id === product.product?.id)}
                      onChange={(option) => onProductChange(index, option)}
                      isSearchable
                        placeholder="Select product..."
                      className="text-sm"
                      classNamePrefix="select"
                        noOptionsMessage={() => 'No products found'}
                      formatOptionLabel={(option) => option.label}
                      filterOption={(option: any, inputValue: string) => {
                        return option.value.name.toLowerCase().includes(inputValue.toLowerCase());
                      }}
                    />
                  </div>
                  {formData.products.length > 1 && (
                    <button
                      onClick={() => removeProductField(index)}
                      className="ml-2 p-2 text-red-600 hover:text-red-900"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                {product.product && (
                  <>
                    <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-md">
                      <div>
                          <span className="text-sm font-medium text-gray-700">Standard Price:</span>
                        <span className="ml-2">{formatPrice(product.product.sellingPrice)} XAF</span>
                      </div>
                      <div>
                          <span className="text-sm font-medium text-gray-700">Available Stock:</span>
                        <span className="ml-2">
                          {(() => {
                            const stockInfo = getProductStockInfo(product.product.id);
                            return stockInfo?.totalStock ?? 0;
                          })()}
                        </span>
                      </div>
                    </div>
                    
                    {/* Stock Batch Information - Mobile */}
                    {(() => {
                            const stockInfo = getProductStockInfo(product.product.id);
                      const isLoading = loadingStockInfo.has(product.product.id);
                      
                      return (
                        <div className="p-3 bg-blue-50 rounded-md">
                          <div className="flex items-center space-x-2 mb-2">
                            <Info size={16} className="text-blue-600" />
                            <span className="text-sm font-medium text-blue-700">Available Stock Batches</span>
                          </div>
                          {isLoading ? (
                            <div className="text-sm text-blue-600">Loading stock information...</div>
                          ) : stockInfo ? (
                            <div className="text-sm text-blue-800">
                              {formatStockBatchInfo(stockInfo)}
                              {stockInfo.averageCostPrice > 0 && (
                                <div className="mt-1 text-xs text-blue-600">
                                  Average cost: {stockInfo.averageCostPrice.toLocaleString()} XAF
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-blue-600">No stock batch information available</div>
                          )}
                        </div>
                      );
                    })()}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                          label="Quantity"
                        type="number"
                        min="1"
                        step="1"
                        max={(() => {
                          const stockInfo = getProductStockInfo(product.product.id);
                          return (stockInfo?.totalStock ?? 0).toString();
                        })()}
                        value={product.quantity}
                        onChange={(e) => onProductInputChange(index, 'quantity', e.target.value)}
                        required
                          helpText={(() => {
                            const stockInfo = getProductStockInfo(product.product.id);
                            const stock = stockInfo?.totalStock ?? 0;
                            return `Cannot exceed ${stock}`;
                          })()}
                      />
                      <PriceInput
                          label="Negotiated Price"
                        name={`negotiatedPrice-${index}`}
                        value={product.negotiatedPrice}
                        onChange={(e) => onProductInputChange(index, 'negotiatedPrice', e.target.value)}
                          // helpText="Enter the negotiated price (can exceed standard price)"
                      />
                    </div>
                      {/* Individual Product Total - changed bg color to blue-50 (mobile view) */}
                    {product.quantity && (
                        <div className="p-3 bg-blue-50 rounded-md">
                          <span className="text-sm font-medium text-blue-700">Product Total:</span>
                          <span className="ml-2 text-blue-900">{formatPrice(calculateProductTotal(product))} XAF</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
              {/* Overall Total Amount - changed bg color to green-50 */}
            {formData.products.some(p => p.quantity) && (
                <div className="p-4 bg-green-50 rounded-md">
                  <span className="text-lg font-medium text-green-700">Total Amount:</span>
                  <span className="ml-2 text-green-900 text-lg">{formatPrice(calculateTotal())} XAF</span>
              </div>
            )}
          </div>
          {/* Date Field */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Sale Date"
              name="saleDate"
              type="date"
              value={formData.saleDate}
              onChange={handleInputChange}
              helpText="Select the date for this sale (defaults to today)"
            />
          </div>
          {/* Delivery Fee and Status */}
          <div className="grid grid-cols-2 gap-4">
            <PriceInput
                label="Delivery Fee"
              name="deliveryFee"
              value={formData.deliveryFee}
              onChange={(e) => handleInputChange({ target: { name: e.target.name, value: e.target.value } } as any)}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
              </label>
              <select
                name="status"
                className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={formData.status}
                onChange={(e) => handleInputChange({ target: { name: e.target.name, value: e.target.value } } as any)}
              >
                  <option value="commande">{t('sales.filters.status.commande') || 'Commande'}</option>
                  <option value="under_delivery">{t('sales.filters.status.under_delivery') || 'Under Delivery'}</option>
                  <option value="paid">{t('sales.filters.status.paid') || 'Paid'}</option>
                  <option value="credit">{t('sales.filters.status.credit') || 'Credit'}</option>
                  <option value="draft">{t('sales.filters.status.draft') || 'Draft'}</option>
              </select>
              {formData.status === 'credit' && (
                <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-800 font-medium">
                    {t('sales.modals.add.creditSaleWarning') || '⚠️ For credit sales, customer name and phone are required.'}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Inventory Method Selection */}
          <div>
            <CommonSelect
              label={t('sales.modals.add.inventoryMethod.title')}
              name="inventoryMethod"
              value={formData.inventoryMethod}
              onChange={(e) => {
                handleInputChange({
                  target: {
                    name: 'inventoryMethod',
                    value: e.target.value
                  }
                } as React.ChangeEvent<HTMLInputElement>);
              }}
              options={[
                {
                  value: 'fifo',
                  label: t('sales.modals.add.inventoryMethod.fifo')
                },
                {
                  value: 'lifo',
                  label: t('sales.modals.add.inventoryMethod.lifo')
                },
                {
                  value: 'cmup',
                  label: t('sales.modals.add.inventoryMethod.cmup')
                }
              ]}
              helpText={
                formData.inventoryMethod === 'fifo'
                  ? t('sales.modals.add.inventoryMethod.fifoDescription')
                  : formData.inventoryMethod === 'lifo'
                  ? t('sales.modals.add.inventoryMethod.lifoDescription')
                  : t('sales.modals.add.inventoryMethod.cmupDescription')
              }
            />
          </div>
        </div>
        {/* Products Side Panel - Desktop View */}
        <div className="hidden lg:block w-80 border-l pl-6">
          <div className="sticky top-0">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Products</h3>
              {/* Search Bar */}
              <div className="mb-4">
                <Input
                  type="text"
                  placeholder="Search product..."
                  value={productSearchQuery}
                  onChange={e => setProductSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
            {/* Available Products */}
              <div className="space-y-2">
            {!isLocationUserSelected ? (
              <div className="text-sm text-gray-500 p-3">Sélectionnez d'abord une boutique ou un entrepôt pour voir les produits disponibles</div>
            ) : loadingProductsWithStock && (formData.shopId || formData.warehouseId) ? (
              <div className="text-sm text-gray-500 p-3">Chargement des produits...</div>
            ) : productsWithStock.size === 0 && (formData.shopId || formData.warehouseId) && !loadingProductsWithStock ? (
              <div className="text-sm text-gray-500 p-3">Aucun produit avec stock disponible dans cette source</div>
            ) : (
            <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
                  {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => {
                    const newProduct = { id: crypto.randomUUID(), product, quantity: '1', negotiatedPrice: '' };
                    setFormData(prev => ({
                      ...prev,
                      products: [...prev.products, newProduct]
                    }));
                  }}
                  className="w-full p-3 bg-white border rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                      <ImageWithSkeleton 
                        src={product.images && product.images.length > 0 ? product.images[0] : '/placeholder.png'} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                        placeholder="/placeholder.png"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-sm text-gray-500">
                            {(() => {
                              // First check if we have detailed stock info (for products already added to form)
                              const stockInfo = getProductStockInfo(product.id);
                              if (stockInfo) {
                                return `${stockInfo.totalStock} in stock`;
                              }
                              // Check productsWithStock for location-specific stock
                              const productWithStock = productsWithStock.get(product.id);
                              if (productWithStock) {
                                return `${productWithStock.stock} in stock`;
                              }
                              // Otherwise, use stockMap from batches (already loaded) - this is global stock
                              if (!batchesLoading && stockMap) {
                                const stock = getEffectiveProductStock(product, stockMap);
                                return `${stock} in stock (global)`;
                              }
                              return 'Loading stock...';
                            })()} - {formatPrice(product.sellingPrice)} XAF
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            )}
                {/* View More Button */}
                {availableProducts.length > 10 && (
                  <button
                    onClick={() => setShowAllProducts(true)}
                    className="w-full p-2 text-center text-sm text-blue-600 hover:text-blue-900 border-t"
                  >
                    View More
                  </button>
                )}
              </div>
              {/* Overall Total Amount - changed bg color to green-50 (desktop view) */}
            {formData.products.some(p => p.quantity) && (
                <div className="mt-6 p-4 bg-green-50 rounded-md">
                  <span className="text-lg font-medium text-green-700">Total Amount:</span>
                  <span className="ml-2 text-green-900 text-lg">{formatPrice(calculateTotal())} XAF</span>
              </div>
            )}
          </div>
        </div>
      </div>
      </Modal>
      {viewedSale && (
        <SaleDetailsModal
          isOpen={!!viewedSale}
          onClose={() => { setViewedSale(null); onClose(); }}
          sale={viewedSale}
          products={products || []}
        />
      )}
      
    </>
  );
};

export default AddSaleModal; 