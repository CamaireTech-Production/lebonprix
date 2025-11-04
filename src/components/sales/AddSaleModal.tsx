import { useAddSaleForm } from '../../hooks/useAddSaleForm';
import Modal, { ModalFooter } from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import Select from 'react-select';
import { Plus, Trash2, Save, Info} from 'lucide-react';
import { createPortal } from 'react-dom';
import { ImageWithSkeleton } from '../common/ImageWithSkeleton';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Sale, StockBatch } from '../../types/models';
import SaleDetailsModal from './SaleDetailsModal';
import { getProductStockBatches } from '../../services/firestore';
import { showWarningToast } from '../../utils/toast';

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

  const {
    formData,
    setFormData,
    isSubmitting,
    autoSaveCustomer,
    setAutoSaveCustomer,
    foundCustomer,
    isSavingCustomer,
    showCustomerDropdown,
    setShowCustomerDropdown,
    customerSearch,

    phoneInputRef,
    products,
    customers,
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
    handleSaveCustomer,
    handleSelectCustomer,
  } = useAddSaleForm();



  const [viewedSale, setViewedSale] = useState<Sale | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [productStockInfo, setProductStockInfo] = useState<Map<string, ProductStockInfo>>(new Map());
  const [loadingStockInfo, setLoadingStockInfo] = useState<Set<string>>(new Set());



  // Load stock batch information for products
  const loadProductStockInfo = async (productId: string) => {
    if (productStockInfo.has(productId) || loadingStockInfo.has(productId)) {
      return;
    }

    setLoadingStockInfo(prev => new Set(prev).add(productId));
    
    try {
      const batches = await getProductStockBatches(productId);
      const availableBatches = batches.filter(batch => batch.remainingQuantity > 0 && batch.status === 'active');
      const totalStock = availableBatches.reduce((sum, batch) => sum + batch.remainingQuantity, 0);
      const totalValue = availableBatches.reduce((sum, batch) => sum + (batch.costPrice * batch.remainingQuantity), 0);
      const averageCostPrice = totalStock > 0 ? totalValue / totalStock : 0;

      setProductStockInfo(prev => new Map(prev).set(productId, {
        productId,
        batches: availableBatches.sort((a, b) => (a.createdAt.seconds || 0) - (b.createdAt.seconds || 0)), // Sort by creation time (FIFO order)
        totalStock,
        averageCostPrice
      }));
    } catch (error) {
      console.error('Error loading stock info for product:', productId, error);
    } finally {
      setLoadingStockInfo(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  // Load stock info when products are selected
  useEffect(() => {
    formData.products.forEach(formProduct => {
      if (formProduct.product && !productStockInfo.has(formProduct.product.id)) {
        loadProductStockInfo(formProduct.product.id);
      }
    });
  }, [formData.products]);



  // Product options for react-select
  const availableProducts = products?.filter(p => p.isAvailable && p.stock > 0) || [];
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
            {product.stock} in stock - {product.sellingPrice.toLocaleString()} XAF
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
    onClose();
  };

  // Format stock batch display
  const formatStockBatchInfo = (stockInfo: ProductStockInfo) => {
    if (stockInfo.batches.length === 0) {
      return 'No stock batches available';
    }

    const batchInfo = stockInfo.batches.map(batch => 
      `${batch.remainingQuantity} at ${batch.costPrice.toLocaleString()} XAF`
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
      const remainingAfter = (option.value.stock || 0) - 1;
      if (remainingAfter <= LOW_STOCK_THRESHOLD && remainingAfter >= 0) {
        showWarningToast(`Low stock: ${remainingAfter} left for ${option.value.name}`);
      }
    }
  };

  const onProductInputChange = (index: number, field: any, value: string) => {
    handleProductInputChange(index, field, value);
    const fp = formData.products[index];
    const product = fp?.product;
    const qty = field === 'quantity' ? parseInt(value || '0', 10) : parseInt(fp?.quantity || '0', 10);
    if (product && !isNaN(qty) && qty > 0) {
      const remainingAfter = (product.stock || 0) - qty;
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
                  required
                    helpText="Enter customer phone number"
                  ref={phoneInputRef}
                />
              </div>
              
              {/* Customer Dropdown - Phone based recommendations */}
{showCustomerDropdown && customerSearch && /\d/.test(customerSearch) && (() => {
  const normalizedSearch = customerSearch.replace(/\D/g, '');
  
  // Filter customers by phone number match
  const filteredCustomers = customers.filter(c => {
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
        <div className="text-xs font-medium text-gray-600">Select Customer by Phone:</div>
      </div>
      
      {filteredCustomers.slice(0, 5).map(c => (
        <button
          key={c.id}
          type="button"
          className="w-full text-left p-3 hover:bg-emerald-50 border-b border-gray-100 last:border-b-0 transition-colors"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Update the form data with the selected customer's information
            setFormData(prev => ({
              ...prev,
              customerPhone: c.phone,
              customerName: c.name || '',
              customerQuarter: c.quarter || ''
            }));
            
            // Hide the dropdown after selection
            setShowCustomerDropdown(false);
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
                    label="Name"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleInputChange}
                />
                
                {/* Customer Dropdown - Name based recommendations */}
{showCustomerDropdown && customerSearch && !/\d/.test(customerSearch) && (() => {
  const searchTerm = customerSearch.toLowerCase().trim();
  
  // Filter customers by name match
  const filteredCustomers = customers.filter(c => {
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
        <div className="text-xs font-medium text-gray-600">Select Customer by Name:</div>
      </div>
      
      {filteredCustomers.slice(0, 5).map(c => (
        <button
          key={c.id}
          type="button"
          className="w-full text-left p-3 hover:bg-emerald-50 border-b border-gray-100 last:border-b-0 transition-colors"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Update the form data with the selected customer's information
            setFormData(prev => ({
              ...prev,
              customerPhone: c.phone,
              customerName: c.name || '',
              customerQuarter: c.quarter || ''
            }));
            
            // Hide the dropdown after selection
            setShowCustomerDropdown(false);
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
              <Input
                  label="Quarter"
                name="customerQuarter"
                value={formData.customerQuarter}
                onChange={handleInputChange}
                  placeholder="Quarter (optional)"
              />
            </div>
          </div>
            {/* Selected Products Section - Desktop View */}
            <div className="hidden lg:block space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Selected Products</h3>
              <div className="space-y-4">
                {formData.products.map((product, index) => (
                  product.product && (
                    <div key={index} className="p-4 border rounded-lg space-y-4">
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
                            {product.product.stock} in stock - {product.product.sellingPrice.toLocaleString()} XAF
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
                        const stockInfo = productStockInfo.get(product.product.id);
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
                          max={product.product.stock.toString()}
                          value={product.quantity}
                          onChange={(e) => onProductInputChange(index, 'quantity', e.target.value)}
                          required
                          helpText={`Cannot exceed ${product.product.stock}`}
                        />
                        <Input
                          label="Negotiated Price"
                          type="number"
                          value={product.negotiatedPrice}
                          onChange={(e) => onProductInputChange(index, 'negotiatedPrice', e.target.value)}
                          // helpText="Enter the negotiated price (can exceed standard price)"
                        />
                      </div>
                      {/* Individual Product Total - changed bg color to blue-50 */}
                      {product.quantity && (
                        <div className="p-3 bg-blue-50 rounded-md">
                          <span className="text-sm font-medium text-blue-700">Product Total:</span>
                          <span className="ml-2 text-blue-900">{calculateProductTotal(product).toLocaleString()} XAF</span>
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
              <div key={index} className="p-4 border rounded-lg space-y-4">
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
                  {index > 0 && (
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
                        <span className="ml-2">{product.product.sellingPrice.toLocaleString()} XAF</span>
                      </div>
                      <div>
                          <span className="text-sm font-medium text-gray-700">Available Stock:</span>
                        <span className="ml-2">{product.product.stock}</span>
                      </div>
                    </div>
                    
                    {/* Stock Batch Information - Mobile */}
                    {(() => {
                      const stockInfo = productStockInfo.get(product.product.id);
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
                        max={product.product.stock.toString()}
                        value={product.quantity}
                        onChange={(e) => onProductInputChange(index, 'quantity', e.target.value)}
                        required
                          helpText={`Cannot exceed ${product.product.stock}`}
                      />
                      <Input
                          label="Negotiated Price"
                        type="number"
                        value={product.negotiatedPrice}
                        onChange={(e) => onProductInputChange(index, 'negotiatedPrice', e.target.value)}
                          // helpText="Enter the negotiated price (can exceed standard price)"
                      />
                    </div>
                      {/* Individual Product Total - changed bg color to blue-50 (mobile view) */}
                    {product.quantity && (
                        <div className="p-3 bg-blue-50 rounded-md">
                          <span className="text-sm font-medium text-blue-700">Product Total:</span>
                          <span className="ml-2 text-blue-900">{calculateProductTotal(product).toLocaleString()} XAF</span>
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
                  <span className="ml-2 text-green-900 text-lg">{calculateTotal().toLocaleString()} XAF</span>
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
            <Input
                label="Delivery Fee"
              name="deliveryFee"
              type="number"
              value={formData.deliveryFee}
              onChange={handleInputChange}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
              </label>
              <select
                name="status"
                className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={formData.status}
                onChange={handleInputChange}
              >
                  <option value="commande">Commande</option>
                  <option value="under_delivery">Under Delivery</option>
                  <option value="paid">Paid</option>
              </select>
            </div>
          </div>
          
          {/* Inventory Method Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t('sales.modals.add.inventoryMethod.title')}
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="inventoryMethod"
                  value="fifo"
                  checked={formData.inventoryMethod === 'fifo'}
                  onChange={handleInputChange}
                  className="form-radio h-4 w-4 text-emerald-600 border-gray-300"
                />
                <span className="text-sm text-gray-700">
                  <strong>{t('sales.modals.add.inventoryMethod.fifo')}</strong>
                </span>
                <span className="text-xs text-gray-500">
                  {t('sales.modals.add.inventoryMethod.fifoDescription')}
                </span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="inventoryMethod"
                  value="lifo"
                  checked={formData.inventoryMethod === 'lifo'}
                  onChange={handleInputChange}
                  className="form-radio h-4 w-4 text-emerald-600 border-gray-300"
                />
                <span className="text-sm text-gray-700">
                  <strong>{t('sales.modals.add.inventoryMethod.lifo')}</strong>
                </span>
                <span className="text-xs text-gray-500">
                  {t('sales.modals.add.inventoryMethod.lifoDescription')}
                </span>
              </label>
            </div>
            <p className="text-xs text-gray-500">
              {t('sales.modals.add.inventoryMethod.helpText')}
            </p>
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
            <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
                  {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => {
                    const newProduct = { product, quantity: '1', negotiatedPrice: '' };
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
                            {product.stock} in stock - {product.sellingPrice.toLocaleString()} XAF
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
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
                  <span className="ml-2 text-green-900 text-lg">{calculateTotal().toLocaleString()} XAF</span>
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