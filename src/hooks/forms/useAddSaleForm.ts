import { useState, useRef, useEffect, useMemo } from 'react';
import { useSales, useProducts, useCustomers } from '@hooks/data/useFirestore';
import { useCustomerSources } from '@hooks/business/useCustomerSources';
import { useCheckoutSettings } from '@hooks/data/useCheckoutSettings';
import { useAuth } from '@contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import { getCurrentEmployeeRef } from '@utils/business/employeeUtils';
import { getUserById } from '@services/utilities/userService';
import { validateSaleData, normalizeSaleData } from '@utils/calculations/saleUtils';
import type { OrderStatus, SaleProduct, Customer, Product, Sale } from '../../types/models';
import { logError } from '@utils/core/logger';
import { normalizePhoneForComparison, normalizePhoneNumber } from '@utils/core/phoneUtils';
import { ensureCustomerExists } from '@services/firestore/customers/customerService';
import { useAllStockBatches } from '@hooks/business/useStockBatches';
import { buildProductStockMap, getEffectiveProductStock } from '@utils/inventory/stockHelpers';

export interface FormProduct {
  id: string; // Unique identifier for React key
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
  inventoryMethod: 'fifo' | 'lifo' | 'cmup';
  products: FormProduct[];
  // Location fields for shop/warehouse system
  sourceType: 'shop' | 'warehouse' | '';
  shopId: string;
  warehouseId: string;
}

export function useAddSaleForm(_onSaleAdded?: (sale: Sale) => void) {
  const { t } = useTranslation();
  const { addSale } = useSales();
  const { products } = useProducts();
  const { customers, addCustomer } = useCustomers();
  const { activeSources } = useCustomerSources();
  const { batches: allBatches } = useAllStockBatches('product');
  const { settings: checkoutSettings } = useCheckoutSettings();

  const { user, company, currentEmployee, isOwner } = useAuth();
  
  // Build stock map from batches
  const stockMap = useMemo(
    () => buildProductStockMap(allBatches || []),
    [allBatches]
  );

  /* ----------------------------- UI helpers ----------------------------- */
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSaveCustomer, setAutoSaveCustomer] = useState(true);
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [activeSearchField, setActiveSearchField] = useState<'phone' | 'name' | null>(null);

  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Get default inventory method from settings (lowercase for form, will be converted to uppercase for API)
  const getDefaultInventoryMethod = (): 'fifo' | 'lifo' | 'cmup' => {
    const defaultMethod = checkoutSettings?.defaultInventoryMethod || 'FIFO';
    return defaultMethod.toLowerCase() as 'fifo' | 'lifo' | 'cmup';
  };

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
    inventoryMethod: getDefaultInventoryMethod(),
    products: [{ id: crypto.randomUUID(), product: null, quantity: '', negotiatedPrice: '' }],
    sourceType: '', // No default - user must select
    shopId: '',
    warehouseId: ''
  });

  // Update inventory method when settings change
  useEffect(() => {
    if (checkoutSettings?.defaultInventoryMethod) {
      const defaultMethod = checkoutSettings.defaultInventoryMethod.toLowerCase() as 'fifo' | 'lifo' | 'cmup';
      setFormData(prev => ({ ...prev, inventoryMethod: defaultMethod }));
    }
  }, [checkoutSettings?.defaultInventoryMethod]);



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
    
    // Improved unified search: search by both name AND phone simultaneously
    if (name === 'customerName') {
      // Mark that we're searching in the name field
      setActiveSearchField('name');
      
      const searchTerm = value.toLowerCase().trim();
      const normalizedSearch = normalizePhone(value);
      
      // Search by both name and phone simultaneously
      const matchingCustomers = customers.filter(c => {
        // Search by name (case-insensitive, partial match)
        const nameMatch = c.name?.toLowerCase().includes(searchTerm) || false;
        
        // Search by phone (normalized comparison for partial match)
        const phoneMatch = c.phone && normalizedSearch.length >= 1
          ? normalizePhone(c.phone).includes(normalizedSearch) || 
            normalizedSearch.includes(normalizePhone(c.phone))
          : false;
        
        // Return true if EITHER name OR phone matches
        return nameMatch || phoneMatch;
      });
      
      // Show dropdown if there are results AND user has typed at least 1 character
      setCustomerSearch(value);
      setShowCustomerDropdown(searchTerm.length >= 1 && matchingCustomers.length > 0);
    } else {
      // If typing in other fields, clear the active search field
      setActiveSearchField(null);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Mark that we're searching in the phone field
    setActiveSearchField('phone');
    
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
      // Clear active search field if it was phone
      if (activeSearchField === 'phone') {
        setActiveSearchField(null);
      }
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
      products: [{ id: crypto.randomUUID(), product: null, quantity: '', negotiatedPrice: '' }, ...prev.products],
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
      inventoryMethod: getDefaultInventoryMethod(),
      products: [{ id: crypto.randomUUID(), product: null, quantity: '', negotiatedPrice: '' }],
      sourceType: '',
      shopId: '',
      warehouseId: ''
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
    
    // Validate credit sales: require customer name only (phone and quarter are optional)
    if (formData.status === 'credit') {
      if (!formData.customerName || formData.customerName.trim() === '') {
        errors.customerName = t('sales.messages.errors.customerNameRequiredForCredit') || 'Customer name is required for credit sales. Please enter customer name.';
      }
    }
    
    // Validate location selection
    if (!formData.sourceType) {
      errors.sourceType = t('sales.messages.warnings.sourceTypeRequired') || 'Veuillez sélectionner un type de source (boutique ou entrepôt)';
    } else if (formData.sourceType === 'shop') {
      if (!formData.shopId) {
        errors.shopId = t('sales.messages.warnings.shopRequired') || 'Veuillez sélectionner une boutique';
      }
    } else if (formData.sourceType === 'warehouse') {
      if (!formData.warehouseId) {
        errors.warehouseId = t('sales.messages.warnings.warehouseRequired') || 'Veuillez sélectionner un entrepôt';
      }
    }
    
    formData.products.forEach((prod, idx) => {
      if (!prod.product) return;
      const qty = parseInt(prod.quantity, 10);
      
      if (Number.isNaN(qty) || qty <= 0) {
        errors[`quantity_${idx}`] = t('sales.messages.warnings.quantityInvalid');
      } else {
        const availableStock = getEffectiveProductStock(prod.product, stockMap);
        if (qty > availableStock) {
          errors[`quantity_${idx}`] = t('sales.messages.warnings.quantityExceeded', { stock: availableStock });
        }
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
      const customerName = formData.customerName.trim() || '';
      const customerPhone = formData.customerPhone.trim() || '';
      const customerQuarter = formData.customerQuarter || '';
      // Use "Client de passage" for name only if phone exists but name doesn't
      const finalCustomerName = customerName || (customerPhone ? 'Client de passage' : '');
      // Normalize phone number to ensure consistent format (+237XXXXXXXXX)
      const normalizedPhone = customerPhone ? normalizePhoneNumber(customerPhone) : '';
      const customerInfo = { name: finalCustomerName, phone: normalizedPhone, ...(customerQuarter && { quarter: customerQuarter }) };
      
      // Determine payment status based on sale status
      const saleStatus = formData.status;
      const isCreditSale = saleStatus === 'credit';
      const paymentStatus: 'pending' | 'paid' | 'cancelled' = 
        isCreditSale ? 'pending' :
        saleStatus === 'paid' ? 'paid' :
        'pending';
      
      // Prepare raw sale data for validation
      const rawSaleData = {
        products: saleProducts,
        totalAmount,
        userId: user.uid,
        companyId: company.id,
        status: saleStatus,
        customerInfo,
        customerSourceId: formData.customerSourceId || '',
        deliveryFee: formData.deliveryFee ? parseFloat(formData.deliveryFee) : 0,
        paymentStatus,
        inventoryMethod: formData.inventoryMethod,
        saleDate: formData.saleDate || new Date().toISOString(),
        // Location fields
        sourceType: formData.sourceType,
        ...(formData.shopId && { shopId: formData.shopId }),
        ...(formData.warehouseId && { warehouseId: formData.warehouseId })
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
      // Save customer if name OR phone is provided (not both empty)
      const hasCustomerInfo = customerName || customerPhone;
      if (autoSaveCustomer && hasCustomerInfo && company?.id && user?.uid) {
        try {
          // Use ensureCustomerExists to handle duplicate detection and creation/update
          await ensureCustomerExists(
            {
              phone: customerPhone,
              name: customerName,
              quarter: customerQuarter,
              firstName: formData.customerFirstName,
              lastName: formData.customerLastName,
              address: formData.customerAddress,
              town: formData.customerTown,
              customerSourceId: formData.customerSourceId
            },
            company.id,
            user.uid
          );
          
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
        } catch (error: any) {
          logError('Error ensuring customer exists during sale', error);
          /* ignore duplicate errors - sale was successful */
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
        } else if (errorMsg.includes('credit sales') || errorMsg.includes('customer source') || errorMsg.includes('customer name') || errorMsg.includes('customer phone') || errorMsg.includes('required for credit') || errorMsg.includes('please select') || errorMsg.includes('please enter')) {
          // Show the actual error message for credit sales validation
          errorMessage = error.message || t('sales.messages.errors.invalidCustomerData') || 'Invalid customer data for credit sale';
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
          createdAt: {
                seconds: Math.floor(new Date().getTime() / 1000),
                nanoseconds: (new Date().getTime() % 1000) * 1000000
              } // Will be replaced by serverTimestamp() in addCustomer
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
    setActiveSearchField(null); // Clear active search field
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
    activeSearchField,
    setActiveSearchField,

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