import { useAddSaleForm } from '../../hooks/useAddSaleForm';
import Modal, { ModalFooter } from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import Select from 'react-select';
import { Plus, Trash2, Save} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useState } from 'react';
import type { Sale } from '../../types/models';
import SaleDetailsModal from './SaleDetailsModal';
import type { Product } from '../../types/models';

interface AddSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaleAdded?: () => void;
}

const AddSaleModal: React.FC<AddSaleModalProps> = ({ isOpen, onClose, onSaleAdded }) => {
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
    customerDropdownPos,
    phoneInputRef,
    products,
    customers,
    handleInputChange,
    handlePhoneChange,
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
    normalizePhone,
  } = useAddSaleForm();

  const [viewedSale, setViewedSale] = useState<Sale | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showAllProducts, setShowAllProducts] = useState(false);

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
          <img 
            src={product.images && product.images.length > 0 ? (product.images[0].startsWith('data:image') ? product.images[0] : `data:image/jpeg;base64,${product.images[0]}`) : '/placeholder.png'} 
            alt={product.name}
            className="w-full h-full object-cover"
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
    const newSale = await handleAddSale();
    if (newSale) {
      setViewedSale(newSale);
      if (onSaleAdded) onSaleAdded();
    }
  };

  // Handle close with reset
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Patch: if viewedSale is set, show details modal instead of form
  if (!isOpen) return null;

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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
              </label>
              <div className="flex space-x-2">
                <Input
                  type="tel"
                  name="customerPhone"
                  value={formData.customerPhone}
                  onChange={handlePhoneChange}
                    placeholder="Phone"
                  className="flex-1"
                  required
                    helpText="Enter customer phone number"
                  ref={phoneInputRef}
                />
                {!foundCustomer && formData.customerPhone.length >= 10 && (
                  <Button
                    variant="outline"
                    icon={<Save size={16} />}
                    onClick={handleSaveCustomer}
                    isLoading={isSavingCustomer}
                  >
                      Save Customer
                  </Button>
                )}
                </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                  label="Name"
                name="customerName"
                value={formData.customerName}
                onChange={handleInputChange}
              />
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
                          <img 
                            src={product.product.images && product.product.images.length > 0 ? (product.product.images[0].startsWith('data:image') ? product.product.images[0] : `data:image/jpeg;base64,${product.product.images[0]}`) : '/placeholder.png'} 
                            alt={product.product.name}
                            className="w-full h-full object-cover"
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
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Quantity"
                          type="number"
                          min="1"
                          max={product.product.stock.toString()}
                          value={product.quantity}
                          onChange={(e) => handleProductInputChange(index, 'quantity', e.target.value)}
                          required
                          helpText={`Cannot exceed ${product.product.stock}`}
                        />
                        <Input
                          label="Negotiated Price"
                          type="number"
                          value={product.negotiatedPrice}
                          onChange={(e) => handleProductInputChange(index, 'negotiatedPrice', e.target.value)}
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
                      onChange={(option) => handleProductChange(index, option)}
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
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                          label="Quantity"
                        type="number"
                        min="1"
                        max={product.product.stock.toString()}
                        value={product.quantity}
                        onChange={(e) => handleProductInputChange(index, 'quantity', e.target.value)}
                        required
                          helpText={`Cannot exceed ${product.product.stock}`}
                      />
                      <Input
                          label="Negotiated Price"
                        type="number"
                        value={product.negotiatedPrice}
                        onChange={(e) => handleProductInputChange(index, 'negotiatedPrice', e.target.value)}
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
                      <img 
                        src={product.images && product.images.length > 0 ? (product.images[0].startsWith('data:image') ? product.images[0] : `data:image/jpeg;base64,${product.images[0]}`) : '/placeholder.png'} 
                        alt={product.name}
                        className="w-full h-full object-cover"
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
      {/* Customer Dropdown */}
      {showCustomerDropdown && customerSearch && customerDropdownPos &&
        createPortal(
          <div
            className="bg-white border border-gray-200 rounded shadow z-50 max-h-48 overflow-y-auto mt-1"
            style={{
              position: 'absolute',
              top: customerDropdownPos.top,
              left: customerDropdownPos.left,
              width: customerDropdownPos.width,
            }}
          >
            {customers.filter(c =>
              normalizePhone(c.phone).startsWith(normalizePhone(customerSearch)) ||
              (c.name && c.name.toLowerCase().includes(customerSearch.toLowerCase()))
            ).slice(0, 5).map(c => (
              <button
                key={c.id}
                className="block w-full text-left px-4 py-2 hover:bg-emerald-50"
                onClick={() => handleSelectCustomer(c)}
              >
                <div className="font-medium">{c.name || 'Divers'}</div>
                <div className="text-xs text-gray-500">{c.phone}{c.quarter ? ` • ${c.quarter}` : ''}</div>
              </button>
            ))}
            {customers.filter(c =>
              normalizePhone(c.phone).startsWith(normalizePhone(customerSearch)) ||
              (c.name && c.name.toLowerCase().includes(customerSearch.toLowerCase()))
            ).length === 0 && (
              <div className="px-4 py-2 text-gray-400 text-sm">No results</div>
            )}
          </div>,
          document.body
        )
      }
    </>
  );
};

export default AddSaleModal; 