import { useState, useRef, useEffect } from 'react';
import Modal, { ModalFooter } from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import Select from 'react-select';
import { Plus, Trash2, Save } from 'lucide-react';
import { useSales, useProducts, useCustomers } from '../../hooks/useFirestore';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { showSuccessToast, showErrorToast, showWarningToast } from '../../utils/toast';
import type { OrderStatus, SaleProduct, Customer, Product } from '../../types/models';
import { createPortal } from 'react-dom';

interface AddSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaleAdded?: () => void;
}

interface FormProduct {
  product: Product | null;
  quantity: string;
  negotiatedPrice: string;
}

const AddSaleModal: React.FC<AddSaleModalProps> = ({ isOpen, onClose, onSaleAdded }) => {
  const { t } = useTranslation();
  const { addSale } = useSales();
  const { products } = useProducts();
  const { customers } = useCustomers();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSaveCustomer, setAutoSaveCustomer] = useState(true);
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDropdownPos, setCustomerDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerQuarter: '',
    status: 'commande' as OrderStatus,
    deliveryFee: '',
    products: [{ product: null, quantity: '', negotiatedPrice: '' }] as FormProduct[]
  });

  useEffect(() => {
    if (showCustomerDropdown && phoneInputRef.current) {
      const rect = phoneInputRef.current.getBoundingClientRect();
      setCustomerDropdownPos({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [showCustomerDropdown, formData.customerPhone]);

  const normalizePhone = (phone: string) => phone.replace(/\D/g, '');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setFormData(prev => ({ ...prev, customerPhone: value }));
    setCustomerSearch(value);
    setShowCustomerDropdown(!!value);
  };

  const handleProductChange = (index: number, option: any) => {
    setFormData(prev => {
      const newProducts = [...prev.products];
      newProducts[index] = {
        ...newProducts[index],
        product: option?.value || null,
        quantity: option?.value ? '1' : '',
        negotiatedPrice: option?.value ? option.value.sellingPrice.toString() : ''
      };
      return { ...prev, products: newProducts };
    });
  };

  const handleProductInputChange = (index: number, field: keyof FormProduct, value: string) => {
    setFormData(prev => {
      const newProducts = [...prev.products];
      newProducts[index] = {
        ...newProducts[index],
        [field]: value
      };
      return { ...prev, products: newProducts };
    });
  };

  const addProductField = () => {
    setFormData(prev => ({
      ...prev,
      products: [...prev.products, { product: null, quantity: '', negotiatedPrice: '' }]
    }));
  };

  const removeProductField = (index: number) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index)
    }));
  };

  const resetForm = () => {
    setFormData({
      customerName: '',
      customerPhone: '',
      customerQuarter: '',
      status: 'commande' as OrderStatus,
      deliveryFee: '',
      products: [{ product: null, quantity: '', negotiatedPrice: '' }]
    });
    setFoundCustomer(null);
    setShowCustomerDropdown(false);
    setCustomerSearch('');
  };

  const calculateProductTotal = (product: FormProduct) => {
    if (!product.product || !product.quantity) return 0;
    const quantity = parseInt(product.quantity);
    const price = product.negotiatedPrice 
      ? parseFloat(product.negotiatedPrice)
      : product.product.sellingPrice;
    return quantity * price;
  };

  const calculateTotal = () => {
    return formData.products.reduce((total, product) => total + calculateProductTotal(product), 0);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.customerPhone.trim()) {
      errors.customerPhone = t('sales.messages.warnings.customerPhone');
    }
    const hasSelectedProducts = formData.products.some(p => p.product !== null);
    if (!hasSelectedProducts) {
      errors.products = t('sales.messages.warnings.atLeastOneProduct');
      return errors;
    }
    formData.products.forEach((product, index) => {
      if (!product.product) return;
      const quantity = parseInt(product.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        errors[`quantity_${index}`] = t('sales.messages.warnings.quantityInvalid');
      } else if (quantity > product.product.stock) {
        errors[`quantity_${index}`] = t('sales.messages.warnings.quantityExceeded', { stock: product.product.stock });
      }
      const negotiatedPrice = parseFloat(product.negotiatedPrice);
      if (!isNaN(negotiatedPrice) && negotiatedPrice > product.product.sellingPrice) {
        errors[`price_${index}`] = t('sales.messages.warnings.priceExceeded');
      }
    });
    const deliveryFee = parseFloat(formData.deliveryFee);
    if (!isNaN(deliveryFee) && deliveryFee < 0) {
      errors.deliveryFee = t('sales.messages.warnings.deliveryFeeInvalid');
    }
    return errors;
  };

  const handleAddSale = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      Object.values(errors).forEach(error => showWarningToast(error));
      return;
    }
    if (!user?.uid) {
      showErrorToast(t('sales.messages.errors.notLoggedIn'));
      return;
    }
    try {
      setIsSubmitting(true);
      const totalAmount = calculateTotal();
      const saleProducts: SaleProduct[] = formData.products
        .filter(p => p.product !== null && p.quantity)
        .map(p => ({
          productId: p.product!.id,
          quantity: parseInt(p.quantity),
          basePrice: p.product!.sellingPrice,
          negotiatedPrice: p.negotiatedPrice ? parseFloat(p.negotiatedPrice) : p.product!.sellingPrice,
        }));
      const customerName = formData.customerName.trim() || t('sales.modals.add.customerInfo.divers');
      const customerInfo = {
        name: customerName,
        phone: formData.customerPhone,
        ...(formData.customerQuarter && { quarter: formData.customerQuarter })
      };
      await addSale({
        products: saleProducts,
        totalAmount,
        status: formData.status,
        customerInfo,
        deliveryFee: formData.deliveryFee ? parseFloat(formData.deliveryFee) : 0,
        paymentStatus: 'pending',
        userId: user.uid
      });
      showSuccessToast(t('sales.messages.saleAdded'));
      resetForm();
      onClose();
      if (onSaleAdded) onSaleAdded();
    } catch (err) {
      showErrorToast(t('sales.messages.errors.addSale'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableProducts = products?.filter(p => p.isAvailable && p.stock > 0) || [];
  const productOptions = availableProducts.map(product => ({
    label: (
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
          <img 
            src={product.imageUrl || '/placeholder.png'} 
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <div className="font-medium">{product.name}</div>
          <div className="text-sm text-gray-500">
            {product.stock} {t('sales.modals.add.products.inStock')} - {product.sellingPrice.toLocaleString()} XAF
          </div>
        </div>
      </div>
    ),
    value: product
  }));

  const handleSaveCustomer = async () => {
    if (!user?.uid || !formData.customerPhone) return;
    try {
      setIsSavingCustomer(true);
      const customerData: Customer = {
        phone: formData.customerPhone,
        name: formData.customerName,
        quarter: formData.customerQuarter,
        userId: user.uid,
        createdAt: new Date()
      };
      // Save customer
      setFoundCustomer(customerData);
      showSuccessToast(t('sales.messages.customerSaved'));
    } catch (err) {
      showErrorToast(t('sales.messages.errors.saveCustomer'));
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setFormData(prev => ({
      ...prev,
      customerPhone: customer.phone,
      customerName: customer.name || '',
      customerQuarter: customer.quarter || ''
    }));
    setShowCustomerDropdown(false);
    setFoundCustomer(customer);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('sales.actions.addSale')} size="xl"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleAddSale}
          confirmText={t('sales.actions.addSale')}
          cancelText={t('sales.modals.common.cancel')}
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
                {t('sales.modals.add.customerInfo.phone')}
              </label>
              <div className="flex space-x-2">
                <Input
                  type="tel"
                  name="customerPhone"
                  value={formData.customerPhone}
                  onChange={handlePhoneChange}
                  placeholder={t('sales.modals.add.customerInfo.phone')}
                  className="flex-1"
                  required
                  helpText={t('sales.modals.add.customerInfo.phoneHelp')}
                  ref={phoneInputRef}
                />
                {!foundCustomer && formData.customerPhone.length >= 10 && (
                  <Button
                    variant="outline"
                    icon={<Save size={16} />}
                    onClick={handleSaveCustomer}
                    isLoading={isSavingCustomer}
                  >
                    {t('sales.actions.saveCustomer')}
                  </Button>
                )}
              </div>
              {foundCustomer && (
                <div className="mt-2 p-2 bg-emerald-50 rounded-md">
                  <p className="text-sm text-emerald-700">
                    {t('sales.messages.customerFound', { name: foundCustomer.name || t('sales.messages.unnamedCustomer') })}
                  </p>
                </div>
              )}
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
                {t('sales.modals.add.customerInfo.autoSave')}
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t('sales.modals.add.customerInfo.name')}
                name="customerName"
                value={formData.customerName}
                onChange={handleInputChange}
              />
              <Input
                label={t('sales.modals.add.customerInfo.quarter')}
                name="customerQuarter"
                value={formData.customerQuarter}
                onChange={handleInputChange}
                placeholder={t('sales.modals.add.customerInfo.quarterPlaceholder')}
              />
            </div>
          </div>
          {/* Products Section - Mobile View */}
          <div className="lg:hidden space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">{t('sales.modals.add.products.title')}</h3>
              <Button
                variant="outline"
                icon={<Plus size={16} />}
                onClick={addProductField}
              >
                {t('sales.modals.add.products.addProduct')}
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
                      placeholder={t('sales.modals.add.products.searchPlaceholder')}
                      className="text-sm"
                      classNamePrefix="select"
                      noOptionsMessage={() => t('sales.modals.add.products.noProductsFound')}
                      formatOptionLabel={(option) => option.label}
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
                        <span className="text-sm font-medium text-gray-700">{t('sales.modals.add.products.standardPrice')}:</span>
                        <span className="ml-2">{product.product.sellingPrice.toLocaleString()} XAF</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">{t('sales.modals.add.products.availableStock')}:</span>
                        <span className="ml-2">{product.product.stock}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label={t('sales.modals.add.products.quantity')}
                        type="number"
                        min="1"
                        max={product.product.stock.toString()}
                        value={product.quantity}
                        onChange={(e) => handleProductInputChange(index, 'quantity', e.target.value)}
                        required
                        helpText={t('sales.modals.add.products.cannotExceed', { stock: product.product.stock })}
                      />
                      <Input
                        label={t('sales.modals.add.products.negotiatedPrice')}
                        type="number"
                        max={product.product.sellingPrice.toString()}
                        value={product.negotiatedPrice}
                        onChange={(e) => handleProductInputChange(index, 'negotiatedPrice', e.target.value)}
                        helpText={t('sales.modals.add.products.cannotExceed', { price: product.product.sellingPrice.toLocaleString() })}
                      />
                    </div>
                    {product.quantity && (
                      <div className="p-3 bg-emerald-50 rounded-md">
                        <span className="text-sm font-medium text-emerald-700">{t('sales.modals.add.products.productTotal')}:</span>
                        <span className="ml-2 text-emerald-900">{calculateProductTotal(product).toLocaleString()} XAF</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            {formData.products.some(p => p.quantity) && (
              <div className="p-4 bg-emerald-50 rounded-md">
                <span className="text-lg font-medium text-emerald-700">{t('sales.modals.add.products.totalAmount')}:</span>
                <span className="ml-2 text-emerald-900 text-lg">{calculateTotal().toLocaleString()} XAF</span>
              </div>
            )}
          </div>
          {/* Delivery Fee and Status */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('sales.modals.add.delivery.fee')}
              name="deliveryFee"
              type="number"
              value={formData.deliveryFee}
              onChange={handleInputChange}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('sales.modals.add.status.label')}
              </label>
              <select
                name="status"
                className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={formData.status}
                onChange={handleInputChange}
              >
                <option value="commande">{t('sales.filters.status.commande')}</option>
                <option value="under_delivery">{t('sales.filters.status.under_delivery')}</option>
                <option value="paid">{t('sales.filters.status.paid')}</option>
              </select>
            </div>
          </div>
        </div>
        {/* Products Side Panel - Desktop View */}
        <div className="hidden lg:block w-80 border-l pl-6">
          <div className="sticky top-0">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('sales.modals.add.products.title')}</h3>
            {/* Available Products */}
            <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
              {availableProducts.map(product => (
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
                        src={product.imageUrl || '/placeholder.png'} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-sm text-gray-500">
                        {product.stock} {t('sales.modals.add.products.inStock')} - {product.sellingPrice.toLocaleString()} XAF
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {/* Total Amount */}
            {formData.products.some(p => p.quantity) && (
              <div className="mt-6 p-4 bg-emerald-50 rounded-md">
                <span className="text-lg font-medium text-emerald-700">{t('sales.modals.add.products.totalAmount')}:</span>
                <span className="ml-2 text-emerald-900 text-lg">{calculateTotal().toLocaleString()} XAF</span>
              </div>
            )}
          </div>
        </div>
      </div>
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
                <div className="font-medium">{c.name || t('sales.modals.add.customerInfo.divers')}</div>
                <div className="text-xs text-gray-500">{c.phone}{c.quarter ? ` • ${c.quarter}` : ''}</div>
              </button>
            ))}
            {customers.filter(c =>
              normalizePhone(c.phone).startsWith(normalizePhone(customerSearch)) ||
              (c.name && c.name.toLowerCase().includes(customerSearch.toLowerCase()))
            ).length === 0 && (
              <div className="px-4 py-2 text-gray-400 text-sm">{t('common.noResults')}</div>
            )}
          </div>,
          document.body
        )
      }
    </Modal>
  );
};

export default AddSaleModal; 