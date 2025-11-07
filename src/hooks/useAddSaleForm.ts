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
  // Informations supplémentaires du client
  customerFirstName?: string;
  customerLastName?: string;
  customerAddress?: string;
  customerTown?: string;
  customerBirthdate?: string;
  customerHowKnown?: string;
  status: OrderStatus;
  deliveryFee: string;
  saleDate: string;
  inventoryMethod: 'fifo' | 'lifo';
  products: FormProduct[];
}

export function useAddSaleForm(onSaleAdded?: (sale: Sale) => void) {
  const { t } = useTranslation();
  const { addSale } = useSales();
  const { products } = useProducts();
  const { customers, addCustomer } = useCustomers();
  

  const { user, company } = useAuth();

  /* ----------------------------- UI helpers ----------------------------- */
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSaveCustomer, setAutoSaveCustomer] = useState(true);
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const phoneInputRef = useRef<HTMLInputElement>(null);

  /* ------------------------------- Form ------------------------------- */
  const [formData, setFormData] = useState<FormState>({
    customerName: '',
    customerPhone: '',
    customerQuarter: '',
    customerFirstName: '',
    customerLastName: '',
    customerAddress: '',
    customerTown: '',
    customerBirthdate: '',
    customerHowKnown: '',
    status: 'commande',
    deliveryFee: '',
    saleDate: new Date().toISOString().slice(0, 10),
    inventoryMethod: 'fifo',
    products: [{ product: null, quantity: '', negotiatedPrice: '' }],
  });



  /* -------------------------- Click outside handler ------------------------- */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showCustomerDropdown && phoneInputRef.current && !phoneInputRef.current.contains(event.target as Node)) {
        // Check if the click is on the dropdown itself
        const target = event.target as Element;
        const isDropdownClick = target.closest('[data-dropdown="customer"]');
        
        if (!isDropdownClick) {
          setShowCustomerDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCustomerDropdown]);



  /* ------------------------------ Helpers ------------------------------ */
  const normalizePhone = (phone: string) => phone.replace(/\D/g, '');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Allow searching/selecting customer when typing name
    if (name === 'customerName') {
      const searchTerm = value.toLowerCase().trim();
      
      // Filter customers by name match
      const matchingCustomers = customers.filter(c => {
        const customerName = (c.name || '').toLowerCase();
        return customerName.includes(searchTerm);
      });
      
      // Show dropdown only if there are results AND user has typed something
      setCustomerSearch(value);
      setShowCustomerDropdown(searchTerm.length > 0 && matchingCustomers.length > 0);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    console.log('📞 Phone input changed to:', value);
    
    // Ne pas normaliser la valeur dans le champ (garder les caractères pour l'affichage)
    setFormData(prev => ({ ...prev, customerPhone: value }));
    
    // Normaliser pour la recherche
    const normalizedSearch = normalizePhone(value);
    setCustomerSearch(normalizedSearch);
    
    // Filter customers by phone number match
    if (normalizedSearch.length >= 2) {
      const matchingCustomers = customers.filter(c => {
        const customerPhone = normalizePhone(c.phone);
        return customerPhone.includes(normalizedSearch) || normalizedSearch.includes(customerPhone);
      });
      console.log('🔍 [handlePhoneChange] Matching customers:', matchingCustomers.length, 'for search:', normalizedSearch);
      setShowCustomerDropdown(matchingCustomers.length > 0);
    } else {
      setShowCustomerDropdown(false);
    }
    
    // Clear found customer when phone changes manually
    if (foundCustomer && normalizePhone(foundCustomer.phone) !== normalizedSearch) {
      setFoundCustomer(null);
    }
  };

  const handlePhoneBlur = () => {
    // Delay hiding the dropdown to allow for clicks on dropdown items
    setTimeout(() => {
      setShowCustomerDropdown(false);
    }, 300);
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

  const addProductField = () => {
    setFormData(prev => ({
      ...prev,
      products: [...prev.products, { product: null, quantity: '', negotiatedPrice: '' }],
    }));
  };

  const removeProductField = (index: number) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index),
    }));
  };

  const resetForm = () => {
    setFormData({
      customerName: '',
      customerPhone: '',
      customerQuarter: '',
      customerFirstName: '',
      customerLastName: '',
      customerAddress: '',
      customerTown: '',
      customerBirthdate: '',
      customerHowKnown: '',
      status: 'commande',
      deliveryFee: '',
      saleDate: new Date().toISOString().slice(0, 10),
      inventoryMethod: 'fifo',
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
    const total = qty * price;
    return total;
  };
  
  const calculateTotal = () => {
    const total = formData.products.reduce((acc, p) => acc + calculateProductTotal(p), 0);
    return total;
  };

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
      
      if (Number.isNaN(qty) || qty <= 0) {
        errors[`quantity_${idx}`] = t('sales.messages.warnings.quantityInvalid');
      } else if (qty > prod.product.stock) {
        errors[`quantity_${idx}`] = t('sales.messages.warnings.quantityExceeded', { stock: prod.product.stock });
      }
    });
    
    const fee = parseFloat(formData.deliveryFee);
    if (!Number.isNaN(fee) && fee < 0) {
      errors.deliveryFee = t('sales.messages.warnings.deliveryFeeInvalid');
    }
    
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
      
      const saleData = {
        products: saleProducts,
        totalAmount,
        status: formData.status,
        customerInfo,
        deliveryFee: formData.deliveryFee ? parseFloat(formData.deliveryFee) : 0,
        paymentStatus: 'pending' as const,
        userId: user.uid,
        inventoryMethod: formData.inventoryMethod,
      };
      
      const newSale = await addSale(saleData);
      
      showSuccessToast(t('sales.messages.saleAdded'));
      resetForm();
      
      if (autoSaveCustomer && customerPhone && customerName && company?.id) {
        try {
          const existing = customers.find(c => normalizePhone(c.phone) === normalizePhone(customerPhone));
          if (!existing) {
            console.log('💾 [handleAddSale] Ajout du client avec companyId:', company.id);
            await addCustomer({ 
              phone: customerPhone, 
              name: customerName, 
              quarter: customerQuarter,
              firstName: formData.customerFirstName || undefined,
              lastName: formData.customerLastName || undefined,
              address: formData.customerAddress || undefined,
              town: formData.customerTown || undefined,
              birthdate: formData.customerBirthdate || undefined,
              howKnown: formData.customerHowKnown || undefined,
              userId: user.uid,
              companyId: company.id, // Ajouter le companyId
              createdAt: new Date() 
            });
            console.log('✅ [handleAddSale] Client ajouté avec succès');
          }
        } catch (error) {
          console.error('❌ [handleAddSale] Erreur lors de l\'ajout du client:', error);
          /* ignore duplicate errors */
        }
      }
      
      return newSale;
    } catch (error) {
      showErrorToast(t('sales.messages.errors.addSale'));
      return undefined;
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ----------- Customer save / select ----------- */
  const handleSaveCustomer = async () => {
    
    if (!user?.uid || !formData.customerPhone || !company?.id) return;
    
    try {
      setIsSavingCustomer(true);
      const customerName = formData.customerName.trim() || t('sales.modals.add.customerInfo.divers');
      const customerQuarter = formData.customerQuarter || '';
      const existing = customers.find(c => normalizePhone(c.phone) === normalizePhone(formData.customerPhone));
      
      if (!existing) {
        console.log('💾 [handleSaveCustomer] Ajout du client avec companyId:', company.id);
        const data: Customer = { 
          phone: formData.customerPhone, 
          name: customerName, 
          quarter: customerQuarter,
          firstName: formData.customerFirstName || undefined,
          lastName: formData.customerLastName || undefined,
          address: formData.customerAddress || undefined,
          town: formData.customerTown || undefined,
          birthdate: formData.customerBirthdate || undefined,
          howKnown: formData.customerHowKnown || undefined,
          userId: user.uid,
          companyId: company.id, // Ajouter le companyId
          createdAt: new Date() 
        };
        await addCustomer(data);
        setFoundCustomer(data);
        console.log('✅ [handleSaveCustomer] Client ajouté avec succès');
        showSuccessToast(t('sales.messages.customerSaved'));
      } else {
        setFoundCustomer(existing);
        showWarningToast(t('sales.messages.warnings.customerExists'));
      }
    } catch (error) {
      console.error('❌ [handleSaveCustomer] Erreur lors de l\'ajout du client:', error);
      showErrorToast(t('sales.messages.errors.saveCustomer'));
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    console.log('🔄 handleSelectCustomer called with:', customer);
    console.log('📝 Customer data:', {
      phone: customer.phone,
      name: customer.name,
      quarter: customer.quarter,
      firstName: customer.firstName,
      lastName: customer.lastName,
      address: customer.address,
      town: customer.town,
      birthdate: customer.birthdate,
      howKnown: customer.howKnown
    });
    
    // Update form data with customer information
    setFormData(prev => {
      const newFormData = { 
        ...prev, 
        customerPhone: customer.phone,
        customerName: customer.name || '',
        customerQuarter: customer.quarter || '',
        customerFirstName: customer.firstName || '',
        customerLastName: customer.lastName || '',
        customerAddress: customer.address || '',
        customerTown: customer.town || '',
        customerBirthdate: customer.birthdate || '',
        customerHowKnown: customer.howKnown || ''
      };
      console.log('📋 Updated formData:', newFormData);
      return newFormData;
    });
    
    // Update search state and hide dropdown
    setCustomerSearch(customer.phone);
    setShowCustomerDropdown(false);
    setFoundCustomer(customer);
    
    console.log('✅ handleSelectCustomer completed');
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

    phoneInputRef,
    products,
    customers,
    normalizePhone,
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
  };
} 