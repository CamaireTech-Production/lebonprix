import { useState, useRef, useEffect } from 'react';
import { useSales, useProducts, useCustomers } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { showSuccessToast, showErrorToast, showWarningToast } from '../utils/toast';
import { addCustomer } from '../services/firestore';
import type { OrderStatus, SaleProduct, Customer, Product, Sale } from '../types/models';

export interface FormProduct {
  product: Product | null;
  quantity: string;
  negotiatedPrice: string;
}

interface FormState {
  customerName: string;
  customerPhone: string;
  customerQuarter: string;
  status: OrderStatus;
  deliveryFee: string;
  saleDate: string;
  products: FormProduct[];
}

export function useAddSaleForm(onSaleAdded?: (sale: Sale) => void) {
  const { t } = useTranslation();
  const { addSale } = useSales();
  const { products } = useProducts();
  const { customers } = useCustomers();
  const { user } = useAuth();

  /* ----------------------------- UI helpers ----------------------------- */
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSaveCustomer, setAutoSaveCustomer] = useState(true);
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDropdownPos, setCustomerDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  /* ------------------------------- Form ------------------------------- */
  const [formData, setFormData] = useState<FormState>({
    customerName: '',
    customerPhone: '',
    customerQuarter: '',
    status: 'commande',
    deliveryFee: '',
    saleDate: new Date().toISOString().slice(0, 10),
    products: [{ product: null, quantity: '', negotiatedPrice: '' }],
  });

  /* -------------------------- Dropdown position ------------------------- */
  useEffect(() => {
    if (showCustomerDropdown && phoneInputRef.current) {
      const rect = phoneInputRef.current.getBoundingClientRect();
      setCustomerDropdownPos({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [showCustomerDropdown, formData.customerPhone]);

  /* ------------------------------ Helpers ------------------------------ */
  const normalizePhone = (phone: string) => phone.replace(/\D/g, '');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setFormData(prev => ({ ...prev, customerPhone: value }));
    setCustomerSearch(value);
    setShowCustomerDropdown(Boolean(value));
  };

  const handleProductChange = (index: number, option: { value: Product } | null) => {
    setFormData(prev => {
      const newProducts = [...prev.products];
      newProducts[index] = {
        ...newProducts[index],
        product: option?.value ?? null,
        quantity: option?.value ? '1' : '',
        negotiatedPrice: option?.value ? option.value.sellingPrice.toString() : '',
      };
      return { ...prev, products: newProducts };
    });
  };

  const handleProductInputChange = (index: number, field: keyof FormProduct, value: string) => {
    setFormData(prev => {
      const newProducts = [...prev.products];
      newProducts[index] = { ...newProducts[index], [field]: value };
      return { ...prev, products: newProducts };
    });
  };

  const addProductField = () => setFormData(prev => ({
    ...prev,
    products: [...prev.products, { product: null, quantity: '', negotiatedPrice: '' }],
  }));

  const removeProductField = (index: number) => setFormData(prev => ({
    ...prev,
    products: prev.products.filter((_, i) => i !== index),
  }));

  const resetForm = () => {
    setFormData({
      customerName: '',
      customerPhone: '',
      customerQuarter: '',
      status: 'commande',
      deliveryFee: '',
      saleDate: new Date().toISOString().slice(0, 10),
      products: [{ product: null, quantity: '', negotiatedPrice: '' }],
    });
    setFoundCustomer(null);
    setShowCustomerDropdown(false);
    setCustomerSearch('');
  };

  const calculateProductTotal = (p: FormProduct): number => {
    if (!p.product || !p.quantity) return 0;
    const qty = parseInt(p.quantity, 10);
    const price = p.negotiatedPrice ? parseFloat(p.negotiatedPrice) : p.product.sellingPrice;
    return qty * price;
  };
  const calculateTotal = () => formData.products.reduce((acc, p) => acc + calculateProductTotal(p), 0);

  /* -------------------------- Validation -------------------------- */
  const validateForm = () => {
    const errors: Record<string, string> = {};
    const hasProduct = formData.products.some(p => p.product);
    if (!hasProduct) {
      errors.products = t('sales.messages.warnings.atLeastOneProduct');
      return errors;
    }
    formData.products.forEach((prod, idx) => {
      if (!prod.product) return;
      const qty = parseInt(prod.quantity, 10);
      if (Number.isNaN(qty) || qty <= 0) errors[`quantity_${idx}`] = t('sales.messages.warnings.quantityInvalid');
      else if (qty > prod.product.stock) errors[`quantity_${idx}`] = t('sales.messages.warnings.quantityExceeded', { stock: prod.product.stock });
      // Removed negotiated price validation - can now exceed selling price
    });
    const fee = parseFloat(formData.deliveryFee);
    if (!Number.isNaN(fee) && fee < 0) errors.deliveryFee = t('sales.messages.warnings.deliveryFeeInvalid');
    return errors;
  };

  /* ----------------------------- Submit ----------------------------- */
  const handleAddSale = async () => {
    const errs = validateForm();
    if (Object.keys(errs).length) {
      Object.values(errs).forEach(showWarningToast);
      return undefined;
    }
    if (!user?.uid) {
      showErrorToast(t('sales.messages.errors.notLoggedIn'));
      return undefined;
    }
    try {
      setIsSubmitting(true);
      const totalAmount = calculateTotal();
      const saleProducts: SaleProduct[] = formData.products
        .filter(p => p.product && p.quantity)
        .map(p => ({
          productId: p.product!.id,
          quantity: parseInt(p.quantity, 10),
          basePrice: p.product!.sellingPrice,
          negotiatedPrice: p.negotiatedPrice ? parseFloat(p.negotiatedPrice) : p.product!.sellingPrice,
        }));
      const customerName = formData.customerName.trim() || t('sales.modals.add.customerInfo.divers');
      const customerPhone = formData.customerPhone.trim() || '';
      const customerQuarter = formData.customerQuarter || '';
      const customerInfo = { name: customerName, phone: customerPhone, ...(customerQuarter && { quarter: customerQuarter }) };
      const newSale = await addSale({
        products: saleProducts,
        totalAmount,
        status: formData.status,
        customerInfo,
        deliveryFee: formData.deliveryFee ? parseFloat(formData.deliveryFee) : 0,
        paymentStatus: 'pending',
        userId: user.uid,
      });
      showSuccessToast(t('sales.messages.saleAdded'));
      resetForm();
      if (autoSaveCustomer && customerPhone && customerName) {
        try {
          const existing = customers.find(c => normalizePhone(c.phone) === normalizePhone(customerPhone));
          if (!existing) {
            await addCustomer({ phone: customerPhone, name: customerName, quarter: customerQuarter, userId: user.uid, createdAt: new Date() });
          }
        } catch { /* ignore duplicate errors */ }
      }
      return newSale;
    } catch {
      showErrorToast(t('sales.messages.errors.addSale'));
      return undefined;
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ----------- Customer save / select ----------- */
  const handleSaveCustomer = async () => {
    if (!user?.uid || !formData.customerPhone) return;
    try {
      setIsSavingCustomer(true);
      const customerName = formData.customerName.trim() || t('sales.modals.add.customerInfo.divers');
      const customerQuarter = formData.customerQuarter || '';
      const existing = customers.find(c => normalizePhone(c.phone) === normalizePhone(formData.customerPhone));
      if (!existing) {
        const data: Customer = { phone: formData.customerPhone, name: customerName, quarter: customerQuarter, userId: user.uid, createdAt: new Date() };
        await addCustomer(data);
        setFoundCustomer(data);
        showSuccessToast(t('sales.messages.customerSaved'));
      } else {
        setFoundCustomer(existing);
        showWarningToast(t('sales.messages.warnings.customerExists'));
      }
    } catch {
      showErrorToast(t('sales.messages.errors.saveCustomer'));
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setFormData(prev => ({ ...prev, customerPhone: customer.phone, customerName: customer.name ?? '', customerQuarter: customer.quarter ?? '' }));
    setShowCustomerDropdown(false);
    setFoundCustomer(customer);
  };

  /* ------------------------------------------------------------------ */
  return {
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
    normalizePhone,
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
  };
} 