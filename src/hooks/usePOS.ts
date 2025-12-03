import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSales, useProducts, useCustomers } from './useFirestore';
import { useCustomerSources } from './useCustomerSources';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { showSuccessToast, showErrorToast, showWarningToast } from '../utils/toast';
import { getCurrentEmployeeRef } from '../utils/employeeUtils';
import { getUserById } from '../services/userService';
import { validateSaleData, normalizeSaleData } from '../utils/saleUtils';
import type { OrderStatus, PaymentStatus, SaleProduct, Customer, Product, Sale } from '../types/models';
import { logError } from '../utils/logger';

export interface CartItem {
  product: Product;
  quantity: number;
  negotiatedPrice?: number;
}

interface POSState {
  cart: CartItem[];
  customer: {
    name: string;
    phone: string;
    quarter?: string;
    sourceId?: string;
  } | null;
  searchQuery: string;
  selectedCategory: string | null;
  deliveryFee: number;
  status: OrderStatus;
  inventoryMethod: 'fifo' | 'lifo';
}

export function usePOS() {
  const { t } = useTranslation();
  const { addSale } = useSales();
  const { products } = useProducts();
  const { customers, addCustomer } = useCustomers();
  const { activeSources } = useCustomerSources();
  const { user, company, currentEmployee, isOwner } = useAuth();

  const [state, setState] = useState<POSState>({
    cart: [],
    customer: null,
    searchQuery: '',
    selectedCategory: null,
    deliveryFee: 0,
    status: 'commande',
    inventoryMethod: 'fifo',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSaveCustomer, setAutoSaveCustomer] = useState(true);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    let filtered = products.filter(p => p.isAvailable && p.stock > 0);
    
    // Filter by search query
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.reference.toLowerCase().includes(query) ||
        (p.barCode && p.barCode.includes(query))
      );
    }
    
    // Filter by category
    if (state.selectedCategory) {
      filtered = filtered.filter(p => p.category === state.selectedCategory);
    }
    
    return filtered;
  }, [products, state.searchQuery, state.selectedCategory]);

  // Calculate cart totals
  const cartTotals = useMemo(() => {
    const subtotal = state.cart.reduce((sum, item) => {
      const price = item.negotiatedPrice ?? item.product.sellingPrice;
      return sum + (price * item.quantity);
    }, 0);
    
    const total = subtotal + state.deliveryFee;
    
    return { subtotal, total };
  }, [state.cart, state.deliveryFee]);

  // Add product to cart
  const addToCart = useCallback((product: Product, quantity: number = 1) => {
    if (product.stock < quantity) {
      showWarningToast(t('pos.messages.insufficientStock', { stock: product.stock }));
      return;
    }

    setState(prev => {
      const existingItem = prev.cart.find(item => item.product.id === product.id);
      
      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (newQuantity > product.stock) {
          showWarningToast(t('pos.messages.insufficientStock', { stock: product.stock }));
          return prev;
        }
        
        return {
          ...prev,
          cart: prev.cart.map(item =>
            item.product.id === product.id
              ? { ...item, quantity: newQuantity }
              : item
          ),
        };
      } else {
        return {
          ...prev,
          cart: [...prev.cart, { product, quantity, negotiatedPrice: undefined }],
        };
      }
    });
  }, [t]);

  // Remove product from cart
  const removeFromCart = useCallback((productId: string) => {
    setState(prev => ({
      ...prev,
      cart: prev.cart.filter(item => item.product.id !== productId),
    }));
  }, []);

  // Update cart item quantity
  const updateCartQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setState(prev => {
      const item = prev.cart.find(item => item.product.id === productId);
      if (!item) return prev;
      
      if (quantity > item.product.stock) {
        showWarningToast(t('pos.messages.insufficientStock', { stock: item.product.stock }));
        return prev;
      }
      
      return {
        ...prev,
        cart: prev.cart.map(item =>
          item.product.id === productId
            ? { ...item, quantity }
            : item
        ),
      };
    });
  }, [removeFromCart, t]);

  // Update negotiated price
  const updateNegotiatedPrice = useCallback((productId: string, price: number | undefined) => {
    setState(prev => ({
      ...prev,
      cart: prev.cart.map(item =>
        item.product.id === productId
          ? { ...item, negotiatedPrice: price }
          : item
      ),
    }));
  }, []);

  // Clear cart
  const clearCart = useCallback(() => {
    setState(prev => ({
      ...prev,
      cart: [],
    }));
  }, []);

  // Handle customer search
  const normalizePhone = (phone: string) => phone.replace(/\D/g, '');

  const handleCustomerSearch = useCallback((value: string) => {
    setCustomerSearch(value);
    
    const normalizedSearch = normalizePhone(value);
    if (normalizedSearch.length >= 2) {
      const matchingCustomers = customers.filter(c => {
        if (!c.phone) return false;
        const customerPhone = normalizePhone(c.phone);
        return customerPhone.includes(normalizedSearch) || normalizedSearch.includes(customerPhone);
      });
      setShowCustomerDropdown(matchingCustomers.length > 0);
    } else if (value.length >= 2 && !/\d/.test(value)) {
      // Name search
      const matchingCustomers = customers.filter(c => {
        if (!c.name) return false;
        return c.name.toLowerCase().includes(value.toLowerCase());
      });
      setShowCustomerDropdown(matchingCustomers.length > 0);
    } else {
      setShowCustomerDropdown(false);
    }
  }, [customers]);

  // Select customer
  const selectCustomer = useCallback((customer: Customer) => {
    setState(prev => ({
      ...prev,
      customer: {
        name: customer.name || t('sales.modals.add.customerInfo.divers'),
        phone: customer.phone,
        quarter: customer.quarter,
        sourceId: customer.customerSourceId,
      },
    }));
    setShowCustomerDropdown(false);
    setCustomerSearch('');
  }, [t]);

  // Set walk-in customer
  const setWalkInCustomer = useCallback(() => {
    setState(prev => ({
      ...prev,
      customer: {
        name: t('sales.modals.add.customerInfo.divers'),
        phone: '',
        quarter: '',
      },
    }));
    setShowCustomerDropdown(false);
    setCustomerSearch('');
  }, [t]);

  // Clear customer
  const clearCustomer = useCallback(() => {
    setState(prev => ({
      ...prev,
      customer: null,
    }));
    setCustomerSearch('');
  }, []);

  // Update state
  const updateState = useCallback((updates: Partial<POSState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Complete sale
  const completeSale = useCallback(async (paymentData?: import('../components/pos/POSPaymentModal').POSPaymentData) => {
    if (state.cart.length === 0) {
      showWarningToast(t('pos.messages.emptyCart'));
      return null;
    }

    if (!user?.uid) {
      showErrorToast(t('sales.messages.errors.notLoggedIn'));
      return null;
    }

    if (!company?.id) {
      showErrorToast(t('sales.validation.companyIdRequired'));
      return null;
    }

    try {
      setIsSubmitting(true);

      const saleProducts: SaleProduct[] = state.cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        basePrice: item.product.sellingPrice,
        negotiatedPrice: item.negotiatedPrice ?? item.product.sellingPrice,
      }));

      // Use payment data if provided, otherwise use state
      const customerInfo = paymentData ? {
        name: paymentData.customerName,
        phone: paymentData.customerPhone,
        quarter: paymentData.customerQuarter || '',
        address: paymentData.customerAddress || '',
        town: paymentData.customerTown || '',
      } : (state.customer || {
        name: t('sales.modals.add.customerInfo.divers'),
        phone: '',
      });

      // Calculate final total with discount and tax
      const discountAmount = paymentData?.discountValue || 0;
      const taxAmount = paymentData?.tax || 0;
      const finalTotal = cartTotals.subtotal + (paymentData?.deliveryFee ?? state.deliveryFee) - discountAmount + taxAmount;

      // Prepare raw sale data for validation
      const rawSaleData = {
        products: saleProducts,
        totalAmount: finalTotal,
        userId: user.uid,
        companyId: company.id,
        status: paymentData?.status || state.status,
        paymentStatus: paymentData?.paymentMethod === 'cash' && paymentData.amountReceived && paymentData.amountReceived >= finalTotal 
          ? 'paid' as const 
          : 'pending' as const,
        customerInfo: {
          name: customerInfo.name || t('sales.modals.add.customerInfo.divers'),
          phone: customerInfo.phone || '',
          quarter: customerInfo.quarter || '',
        },
        deliveryFee: paymentData?.deliveryFee ?? state.deliveryFee ?? 0,
        inventoryMethod: paymentData?.inventoryMethod || state.inventoryMethod || 'fifo',
        saleDate: paymentData?.saleDate || new Date().toISOString(),
        customerSourceId: paymentData?.customerSourceId || state.customer?.sourceId || '',
        paymentMethod: paymentData?.paymentMethod || '',
        transactionReference: paymentData?.transactionReference || '',
        notes: paymentData?.notes || '',
      };

      // Validate sale data with translations
      if (!validateSaleData(rawSaleData, t)) {
        return null;
      }

      // Normalize sale data with defaults
      const normalizedData = normalizeSaleData(rawSaleData, user.uid, company.id);

      // Get createdBy employee reference
      let createdBy = null;
      if (user && company) {
        let userData = null;
        if (isOwner && !currentEmployee) {
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            logError('Error fetching user data for createdBy', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }

      const newSale = await addSale(normalizedData, createdBy);

      // Auto-save customer if enabled (phone is optional for POS)
      if (autoSaveCustomer && customerInfo.name && company?.id) {
        try {
          // Only check for existing customer if phone is provided
          const existing = customerInfo.phone ? customers.find(c => 
            c.phone && normalizePhone(c.phone) === normalizePhone(customerInfo.phone)
          ) : null;

          if (!existing) {
            await addCustomer({
              phone: customerInfo.phone || '',
              name: customerInfo.name,
              quarter: customerInfo.quarter || paymentData?.customerQuarter || '',
              address: customerInfo.address || paymentData?.customerAddress || '',
              town: customerInfo.town || paymentData?.customerTown || '',
              customerSourceId: paymentData?.customerSourceId || state.customer?.sourceId || '',
              userId: user.uid,
              companyId: company.id,
            });
          }
        } catch (error: any) {
          logError('Error adding customer during sale', error);
        }
      }

      // Reset POS state
      clearCart();
      clearCustomer();
      setState(prev => ({
        ...prev,
        searchQuery: '',
        deliveryFee: 0,
      }));

      // Show success toast notification with total amount
      // Reuse the finalTotal calculated earlier in the function
      showSuccessToast(t('pos.messages.saleCompleted') + ` - ${finalTotal.toLocaleString()} XAF`);
      return newSale;
    } catch (error) {
      showErrorToast(t('sales.messages.errors.addSale'));
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [state, cartTotals, user, company, currentEmployee, isOwner, autoSaveCustomer, customers, addSale, addCustomer, clearCart, clearCustomer, t]);

  // Save draft (save without completing sale)
  const saveDraft = useCallback(async (paymentData?: import('../components/pos/POSPaymentModal').POSPaymentData) => {
    if (state.cart.length === 0) {
      showWarningToast(t('pos.messages.emptyCart'));
      return null;
    }

    if (!user?.uid) {
      showErrorToast(t('sales.messages.errors.notLoggedIn'));
      return null;
    }

    if (!company?.id) {
      showErrorToast(t('sales.validation.companyIdRequired'));
      return null;
    }

    try {
      setIsSubmitting(true);

      const saleProducts: SaleProduct[] = state.cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        basePrice: item.product.sellingPrice,
        negotiatedPrice: item.negotiatedPrice ?? item.product.sellingPrice,
      }));

      // Use payment data if provided, otherwise use state
      const customerInfo = paymentData ? {
        name: paymentData.customerName,
        phone: paymentData.customerPhone,
        quarter: paymentData.customerQuarter || '',
        address: paymentData.customerAddress || '',
        town: paymentData.customerTown || '',
      } : (state.customer || {
        name: t('sales.modals.add.customerInfo.divers'),
        phone: '',
      });

      // Calculate final total with discount and tax
      const discountAmount = paymentData?.discountValue || 0;
      const taxAmount = paymentData?.tax || 0;
      const finalTotal = cartTotals.subtotal + (paymentData?.deliveryFee ?? state.deliveryFee) - discountAmount + taxAmount;

      // Prepare raw sale data for validation (draft always has status 'draft' and paymentStatus 'pending')
      const rawSaleData = {
        products: saleProducts,
        totalAmount: finalTotal,
        userId: user.uid,
        companyId: company.id,
        status: 'draft' as const,
        paymentStatus: 'pending' as const,
        customerInfo: {
          name: customerInfo.name || t('sales.modals.add.customerInfo.divers'),
          phone: customerInfo.phone || '',
          quarter: customerInfo.quarter || '',
        },
        deliveryFee: paymentData?.deliveryFee ?? state.deliveryFee ?? 0,
        inventoryMethod: paymentData?.inventoryMethod || state.inventoryMethod || 'fifo',
        saleDate: paymentData?.saleDate || new Date().toISOString(),
        customerSourceId: paymentData?.customerSourceId || state.customer?.sourceId || '',
        paymentMethod: paymentData?.paymentMethod || '',
        transactionReference: paymentData?.transactionReference || '',
        notes: paymentData?.notes || '',
      };

      // Validate sale data with translations
      if (!validateSaleData(rawSaleData, t)) {
        return null;
      }

      // Normalize sale data with defaults
      const normalizedData = normalizeSaleData(rawSaleData, user.uid, company.id);
      // Override status and paymentStatus to ensure draft
      normalizedData.status = 'draft' as OrderStatus;
      normalizedData.paymentStatus = 'pending' as PaymentStatus;

      // Get createdBy employee reference
      let createdBy = null;
      if (user && company) {
        let userData = null;
        if (isOwner && !currentEmployee) {
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            logError('Error fetching user data for createdBy', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }

      const newDraft = await addSale(normalizedData, createdBy);

      // Auto-save customer if enabled (phone is optional for POS)
      if (autoSaveCustomer && customerInfo.name && company?.id) {
        try {
          // Only check for existing customer if phone is provided
          const existing = customerInfo.phone ? customers.find(c => 
            c.phone && normalizePhone(c.phone) === normalizePhone(customerInfo.phone)
          ) : null;

          if (!existing) {
            await addCustomer({
              phone: customerInfo.phone || '',
              name: customerInfo.name,
              quarter: customerInfo.quarter || paymentData?.customerQuarter || '',
              address: customerInfo.address || paymentData?.customerAddress || '',
              town: customerInfo.town || paymentData?.customerTown || '',
              customerSourceId: paymentData?.customerSourceId || state.customer?.sourceId || '',
              userId: user.uid,
              companyId: company.id,
            });
          }
        } catch (error: any) {
          logError('Error adding customer during draft save', error);
        }
      }

      // DO NOT clear cart or customer - allow user to continue editing
      // DO NOT reset search query or delivery fee

      // Show success toast notification
      showSuccessToast(t('pos.payment.draftSaved') || 'Draft saved successfully');
      return newDraft;
    } catch (error) {
      showErrorToast(t('pos.payment.draftSaveError') || 'Failed to save draft');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [state, cartTotals, user, company, currentEmployee, isOwner, autoSaveCustomer, customers, addSale, addCustomer, t]);

  // Resume draft (load draft into cart)
  const resumeDraft = useCallback((sale: Sale) => {
    if (!sale || !sale.products || sale.products.length === 0) {
      showErrorToast(t('pos.transactions.draftResumeError') || 'Draft has no products');
      return null;
    }

    try {
      // Clear current cart
      clearCart();

      // Load products from draft into cart
      sale.products.forEach((saleProduct: any) => {
        const product = products?.find(p => p.id === saleProduct.productId);
        if (product && product.isAvailable) {
          // Add product to cart with negotiated price if available
          addToCart(product, saleProduct.quantity, saleProduct.negotiatedPrice || saleProduct.basePrice);
        } else {
          showWarningToast(t('pos.transactions.productNotFoundInDraft') || `Product ${saleProduct.productId} not found`);
        }
      });

      // Load customer info if available
      if (sale.customerInfo) {
        selectCustomer({
          name: sale.customerInfo.name,
          phone: sale.customerInfo.phone || '',
          quarter: sale.customerInfo.quarter || '',
          sourceId: sale.customerSourceId || '',
        });
      } else {
        clearCustomer();
      }

      // Load delivery fee
      if (sale.deliveryFee) {
        updateState({ deliveryFee: sale.deliveryFee });
      }

      // Return draft data for pre-filling payment modal
      return {
        customerName: sale.customerInfo?.name || '',
        customerPhone: sale.customerInfo?.phone || '',
        customerQuarter: sale.customerInfo?.quarter || '',
        customerSourceId: sale.customerSourceId || '',
        deliveryFee: sale.deliveryFee || 0,
        status: sale.status,
        inventoryMethod: sale.inventoryMethod?.toLowerCase() as 'fifo' | 'lifo' || 'fifo',
        saleDate: sale.createdAt?.seconds 
          ? new Date(sale.createdAt.seconds * 1000).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        notes: (sale as any).notes || '',
        paymentMethod: (sale as any).paymentMethod || undefined,
      };
    } catch (error) {
      logError('Error resuming draft', error);
      showErrorToast(t('pos.transactions.draftResumeError') || 'Failed to resume draft');
      return null;
    }
  }, [products, clearCart, addToCart, selectCustomer, clearCustomer, updateState, t]);

  // Handle barcode scan
  const handleBarcodeScan = useCallback((productId: string) => {
    const product = products?.find(p => p.id === productId);
    if (product && product.isAvailable && product.stock > 0) {
      addToCart(product, 1);
      showSuccessToast(t('pos.messages.productAdded'));
    } else {
      showErrorToast(t('pos.messages.productNotFound'));
    }
  }, [products, addToCart, t]);

  // Focus search input
  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  return {
    // State
    cart: state.cart,
    customer: state.customer,
    searchQuery: state.searchQuery,
    selectedCategory: state.selectedCategory,
    deliveryFee: state.deliveryFee,
    status: state.status,
    inventoryMethod: state.inventoryMethod,
    filteredProducts,
    cartTotals,
    isSubmitting,
    autoSaveCustomer,
    showCustomerDropdown,
    customerSearch,
    customers,
    activeSources,
    products,

    // Refs
    searchInputRef,
    customerInputRef,

    // Actions
    addToCart,
    removeFromCart,
    updateCartQuantity,
    updateNegotiatedPrice,
    clearCart,
    selectCustomer,
    setWalkInCustomer,
    clearCustomer,
    handleCustomerSearch,
    updateState,
    completeSale,
    saveDraft,
    resumeDraft,
    handleBarcodeScan,
    focusSearch,
    setAutoSaveCustomer,
    setShowCustomerDropdown,
  };
}

