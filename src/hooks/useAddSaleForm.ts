import { useState, useRef, useEffect } from 'react';
import { useSales, useProducts, useCustomers } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { showSuccessToast, showErrorToast, showWarningToast } from '../utils/toast';
import { addCustomer } from '../services/firestore';
import { getCurrentEmployeeRef } from '../utils/employeeUtils';
import { getUserById } from '../services/userService';
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
      
      // Log all customers first
      console.log('📋 [handleInputChange] All customers (name search):', {
        total: customers.length,
        customers: customers.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          companyId: c.companyId
        }))
      });
      
      // Filter customers by name match
      const matchingCustomers = customers.filter(c => {
        if (!c.name) {
          console.log('⚠️ [handleInputChange] Customer without name:', c.id, c.phone);
          return false;
        }
        const customerName = (c.name || '').toLowerCase();
        const matches = customerName.includes(searchTerm);
        if (matches) {
          console.log('✅ [handleInputChange] Customer matches (name):', {
            id: c.id,
            name: c.name,
            phone: c.phone,
            customerNameLower: customerName,
            searchTerm: searchTerm
          });
        }
        return matches;
      });
      
      console.log('🔍 [handleInputChange] Name search result:', {
        searchTerm,
        value,
        matchingCustomersCount: matchingCustomers.length,
        customersCount: customers.length,
        matchingCustomers: matchingCustomers.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone
        })),
        hasDigits: /\d/.test(value),
        willShowDropdown: !/\d/.test(value) && searchTerm.length >= 2 && matchingCustomers.length > 0
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
    console.log('📞 [handlePhoneChange] Phone input changed to:', value);
    
    // Ne pas normaliser la valeur dans le champ (garder les caractères pour l'affichage)
    setFormData(prev => ({ ...prev, customerPhone: value }));
    
    // Normaliser pour la recherche
    const normalizedSearch = normalizePhone(value);
    setCustomerSearch(normalizedSearch);
    
    // Log all customers first
    console.log('📋 [handlePhoneChange] All customers:', {
      total: customers.length,
      customers: customers.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        normalizedPhone: normalizePhone(c.phone || ''),
        companyId: c.companyId
      }))
    });
    
    // Filter customers by phone number match
    if (normalizedSearch.length >= 2) {
      const matchingCustomers = customers.filter(c => {
        if (!c.phone) {
          console.log('⚠️ [handlePhoneChange] Customer without phone:', c.id, c.name);
          return false;
        }
        const customerPhone = normalizePhone(c.phone);
        const matches = customerPhone.includes(normalizedSearch) || normalizedSearch.includes(customerPhone);
        if (matches) {
          console.log('✅ [handlePhoneChange] Customer matches:', {
            id: c.id,
            name: c.name,
            phone: c.phone,
            normalizedPhone: customerPhone,
            search: normalizedSearch
          });
        }
        return matches;
      });
      
      console.log('🔍 [handlePhoneChange] Matching customers result:', {
        normalizedSearch,
        value,
        matchingCustomersCount: matchingCustomers.length,
        customersCount: customers.length,
        matchingCustomers: matchingCustomers.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          normalizedPhone: normalizePhone(c.phone || '')
        })),
        willShowDropdown: matchingCustomers.length > 0
      });
      
      setShowCustomerDropdown(matchingCustomers.length > 0);
    } else {
      console.log('⚠️ [handlePhoneChange] Normalized search too short:', normalizedSearch);
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
      
      // Récupérer les données client AVANT de créer la vente
      const customerName = formData.customerName.trim() || t('sales.modals.add.customerInfo.divers');
      const customerPhone = formData.customerPhone.trim() || '';
      const customerQuarter = formData.customerQuarter || '';
      const customerInfo = { name: customerName, phone: customerPhone, ...(customerQuarter && { quarter: customerQuarter }) };
      
      console.log('📝 [handleAddSale] Données client récupérées:', {
        customerName,
        customerPhone,
        customerQuarter,
        autoSaveCustomer,
        companyId: company?.id
      });
      
      // Get createdBy employee reference
      let createdBy = null;
      if (user && company) {
        let userData = null;
        if (isOwner && !currentEmployee) {
          // If owner, fetch user data to create EmployeeRef
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            console.error('Error fetching user data for createdBy:', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }
      
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
      
      const newSale = await addSale(saleData, createdBy);
      
      // Sauvegarder le client AVANT de réinitialiser le formulaire
      if (autoSaveCustomer && customerPhone && customerName && company?.id) {
        try {
          console.log('🔍 [handleAddSale] Vérification du client existant:', {
            customerPhone,
            normalizedPhone: normalizePhone(customerPhone),
            customersCount: customers.length,
            companyId: company.id,
            autoSaveCustomer
          });
          
          // Log all customers for debugging
          console.log('📋 [handleAddSale] Tous les clients actuels:', customers.map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            normalizedPhone: normalizePhone(c.phone || ''),
            companyId: c.companyId
          })));
          
          const existing = customers.find(c => normalizePhone(c.phone) === normalizePhone(customerPhone));
          
          if (!existing) {
            const customerData = { 
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
              companyId: company.id // createdAt sera ajouté automatiquement par addCustomer avec serverTimestamp()
            };
            
            console.log('💾 [handleAddSale] Ajout du client avec les données:', customerData);
            console.log('💾 [handleAddSale] Company ID:', company.id);
            
            const newCustomer = await addCustomer(customerData);
            
            console.log('✅ [handleAddSale] Client ajouté avec succès:', {
              id: newCustomer.id,
              name: newCustomer.name,
              phone: newCustomer.phone,
              companyId: newCustomer.companyId
            });
            
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
              customerHowKnown: ''
            }));
            setFoundCustomer(null);
            setShowCustomerDropdown(false);
            setCustomerSearch('');
            
            console.log('🔄 [handleAddSale] Champs client réinitialisés après ajout réussi');
          } else {
            console.log('ℹ️ [handleAddSale] Client existe déjà:', {
              id: existing.id,
              name: existing.name,
              phone: existing.phone,
              companyId: existing.companyId
            });
            
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
          console.error('❌ [handleAddSale] Erreur lors de l\'ajout du client:', error);
          console.error('❌ [handleAddSale] Détails de l\'erreur:', {
            message: error.message,
            code: error.code,
            stack: error.stack
          });
          /* ignore duplicate errors */
        }
      } else {
        console.log('⚠️ [handleAddSale] Client non sauvegardé:', {
          autoSaveCustomer,
          customerPhone,
          customerName,
          companyId: company?.id,
          reason: !autoSaveCustomer ? 'autoSaveCustomer désactivé' : 
                  !customerPhone ? 'pas de téléphone' : 
                  !customerName ? 'pas de nom' : 
                  !company?.id ? 'pas de companyId' : 'inconnu'
        });
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
          companyId: company.id // createdAt sera ajouté automatiquement par addCustomer avec serverTimestamp()
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