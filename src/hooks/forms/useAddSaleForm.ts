import { useState, useRef, useEffect } from 'react';
import { useSales, useProducts, useCustomers } from '@hooks/data/useFirestore';
import { useCustomerSources } from '@hooks/business/useCustomerSources';
import { useAuth } from '@contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import { getCurrentEmployeeRef } from '@utils/business/employeeUtils';
import { getUserById } from '@services/utilities/userService';
import { validateSaleData, normalizeSaleData } from '@utils/calculations/saleUtils';
import type { OrderStatus, SaleProduct, Customer, Product, Sale } from '../types/models';
import { logError } from '@utils/core/logger';
import { normalizePhoneForComparison } from '@utils/core/phoneUtils';

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
  customerSourceId?: string; // Source clientelle
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
  const { activeSources } = useCustomerSources();

  const { user, company, currentEmployee, isOwner } = useAuth();

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
    customerSourceId: '',
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
  // Use centralized phone normalization for comparison
  const normalizePhone = normalizePhoneForComparison;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Allow searching/selecting customer when typing name
    if (name === 'customerName') {
      const searchTerm = value.toLowerCase().trim();
      
      // Filter customers by name match
      const matchingCustomers = customers.filter(c => {
        if (!c.name) {
          return false;
        }
        const customerName = (c.name || '').toLowerCase();
        return customerName.includes(searchTerm);
      });
      
      // Show dropdown only if there are results AND user has typed something
      // Only set customerSearch if the value doesn't contain digits (to avoid conflicts with phone search)
      if (!/\d/.test(value)) {
        setCustomerSearch(value);
        setShowCustomerDropdown(searchTerm.length >= 2 && matchingCustomers.length > 0);
      } else {
        // If name contains digits, don't show name dropdown
        setShowCustomerDropdown(false);
      }
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Ne pas normaliser la valeur dans le champ (garder les caractères pour l'affichage)
    setFormData(prev => ({ ...prev, customerPhone: value }));
    
    // Normaliser pour la recherche
    const normalizedSearch = normalizePhone(value);
    setCustomerSearch(normalizedSearch);
    
    // Filter customers by phone number match
    if (normalizedSearch.length >= 2) {
      const matchingCustomers = customers.filter(c => {
        if (!c.phone) {
          return false;
        }
        const customerPhone = normalizePhone(c.phone);
        return customerPhone.includes(normalizedSearch) || normalizedSearch.includes(customerPhone);
      });
      
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
      customerSourceId: '',
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

    if (!company?.id) {
      showErrorToast(t('sales.validation.companyIdRequired'));
      return undefined;
    }
    
    try {
      setIsSubmitting(true);
      
      const totalAmount = calculateTotal();
      
      // Note: costPrice, profit, and profitMargin will be added by createSale
      const saleProducts = formData.products
        .filter(p => p.product && p.quantity)
        .map(p => ({
          productId: p.product!.id,
          quantity: parseInt(p.quantity, 10),
          basePrice: p.product!.sellingPrice,
          negotiatedPrice: p.negotiatedPrice ? parseFloat(p.negotiatedPrice) : p.product!.sellingPrice,
          // These will be enriched by createSale:
          costPrice: 0, // Placeholder - will be calculated by createSale
          profit: 0, // Placeholder - will be calculated by createSale
          profitMargin: 0, // Placeholder - will be calculated by createSale
        } as SaleProduct));
      
      // Récupérer les données client AVANT de créer la vente
      const customerName = formData.customerName.trim() || t('sales.modals.add.customerInfo.divers');
      const customerPhone = formData.customerPhone.trim() || '';
      const customerQuarter = formData.customerQuarter || '';
      const customerInfo = { name: customerName, phone: customerPhone, ...(customerQuarter && { quarter: customerQuarter }) };
      
      // Prepare raw sale data for validation
      const rawSaleData = {
        products: saleProducts,
        totalAmount,
        userId: user.uid,
        companyId: company.id,
        status: formData.status,
        customerInfo,
        customerSourceId: formData.customerSourceId || '',
        deliveryFee: formData.deliveryFee ? parseFloat(formData.deliveryFee) : 0,
        paymentStatus: 'pending' as const,
        inventoryMethod: formData.inventoryMethod,
        saleDate: formData.saleDate || new Date().toISOString(),
      };

      // Validate sale data with translations
      if (!validateSaleData(rawSaleData, t)) {
        return undefined;
      }

      // Normalize sale data with defaults
      const normalizedData = normalizeSaleData(rawSaleData, user.uid, company.id);
      
      // Get createdBy employee reference
      let createdBy: ReturnType<typeof getCurrentEmployeeRef> = null;
      if (user && company) {
        let userData: Awaited<ReturnType<typeof getUserById>> | null = null;
        if (isOwner && !currentEmployee) {
          // If owner, fetch user data to create EmployeeRef
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            logError('Error fetching user data for createdBy', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }
      
      const newSale = await addSale(normalizedData, createdBy);
      
      // Show success toast notification for sale completion
      showSuccessToast(t('sales.messages.saleAdded') + ` - ${totalAmount.toLocaleString()} XAF`);
      
      // Sauvegarder le client AVANT de réinitialiser le formulaire
      if (autoSaveCustomer && customerPhone && customerName && company?.id) {
        try {
          const existing = customers.find(c => normalizePhone(c.phone) === normalizePhone(customerPhone));
          
          if (!existing) {
            const customerData: Omit<Customer, 'id'> = { 
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
              companyId: company.id,
              createdAt: new Date() // Will be replaced by serverTimestamp() in addCustomer
            };
            
            await addCustomer(customerData);
            
            // Réinitialiser les champs client après l'ajout réussi
            setFormData(prev => ({
              ...prev,
              customerName: '',
              customerPhone: '',
              customerQuarter: '',
              customerFirstName: '',
              customerLastName: '',
              customerAddress: '',
              customerTown: '',
              customerBirthdate: '',
              customerHowKnown: '',
              customerSourceId: ''
            }));
            setFoundCustomer(null);
            setShowCustomerDropdown(false);
            setCustomerSearch('');
          } else {
            
            // Réinitialiser les champs client même si le client existe déjà
            setFormData(prev => ({
              ...prev,
              customerName: '',
              customerPhone: '',
              customerQuarter: '',
              customerFirstName: '',
              customerLastName: '',
              customerAddress: '',
              customerTown: '',
              customerBirthdate: '',
              customerHowKnown: ''
            }));
            setFoundCustomer(null);
            setShowCustomerDropdown(false);
            setCustomerSearch('');
          }
        } catch (error: any) {
          logError('Error adding customer during sale', error);
          /* ignore duplicate errors */
        }
      }
      
      return newSale;
    } catch (error: any) {
      // Provide more specific error messages
      let errorMessage = t('sales.messages.errors.addSale');
      
      if (error?.message) {
        const errorMsg = error.message.toLowerCase();
        
        // Check for specific error types
        if (errorMsg.includes('product') && errorMsg.includes('not found')) {
          errorMessage = t('sales.messages.errors.productNotFound') || 'Product not found';
        } else if (errorMsg.includes('insufficient stock') || errorMsg.includes('stock')) {
          errorMessage = t('sales.messages.errors.insufficientStock') || 'Insufficient stock for one or more products';
        } else if (errorMsg.includes('unauthorized')) {
          errorMessage = t('sales.messages.errors.unauthorized') || 'Unauthorized to perform this action';
        } else if (errorMsg.includes('quarter') || errorMsg.includes('customer')) {
          errorMessage = t('sales.messages.errors.invalidCustomerData') || 'Invalid customer data. Please check the quarter field.';
        } else {
          // Show the actual error message if available
          errorMessage = error.message || errorMessage;
        }
      }
      
      console.error('Error creating sale:', error);
      showErrorToast(errorMessage);
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
        const data: Omit<Customer, 'id'> = { 
          phone: formData.customerPhone, 
          name: customerName, 
          quarter: customerQuarter,
          customerSourceId: formData.customerSourceId || undefined,
          firstName: formData.customerFirstName || undefined,
          lastName: formData.customerLastName || undefined,
          address: formData.customerAddress || undefined,
          town: formData.customerTown || undefined,
          birthdate: formData.customerBirthdate || undefined,
          howKnown: formData.customerHowKnown || undefined,
          userId: user.uid,
          companyId: company.id,
          createdAt: new Date() // Will be replaced by serverTimestamp() in addCustomer
        };
        await addCustomer(data);
        setFoundCustomer(data);
        showSuccessToast(t('sales.messages.customerSaved'));
      } else {
        setFoundCustomer(existing);
        showWarningToast(t('sales.messages.warnings.customerExists'));
      }
    } catch (error) {
      logError('Error saving customer', error);
      showErrorToast(t('sales.messages.errors.saveCustomer'));
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    // Update form data with customer information
    setFormData(prev => ({
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
    }));
    
    // Update search state and hide dropdown
    setCustomerSearch(customer.phone);
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

    phoneInputRef,
    products,
    customers,
    activeSources,
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