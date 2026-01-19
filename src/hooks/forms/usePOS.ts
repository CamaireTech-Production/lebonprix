import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useSales, useProducts, useCustomers, useShops } from '@hooks/data/useFirestore';
import { useCustomerSources } from '@hooks/business/useCustomerSources';
import { useAuth } from '@contexts/AuthContext';
import { getDefaultShop } from '@services/firestore/shops/shopService';
import { useTranslation } from 'react-i18next';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import { getCurrentEmployeeRef, formatCreatorName } from '@utils/business/employeeUtils';
import { getUserById } from '@services/utilities/userService';
import { validateSaleData, normalizeSaleData } from '@utils/calculations/saleUtils';
import type { OrderStatus, Customer, Product } from '../../types/models';
import { logError } from '@utils/core/logger';
import { normalizePhoneForComparison } from '@utils/core/phoneUtils';
import { saveDraft as saveDraftToStorage, getDrafts, deleteDraft, type POSDraft } from '@utils/pos/posDraftStorage';
import { useAllStockBatches } from '@hooks/business/useStockBatches';
import { buildProductStockMap, getEffectiveProductStock } from '@utils/inventory/stockHelpers';
import { useCheckoutSettings } from '@hooks/data/useCheckoutSettings';
import type { POSPaymentData } from '../../components/pos/POSPaymentModal';

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
  inventoryMethod: 'fifo' | 'lifo' | 'cmup';
  applyTVA: boolean;
  tvaRate: number;
  // Location fields for shop/warehouse system
  shopId: string;
  sourceType: 'shop' | 'warehouse';
}

export function usePOS(shopId?: string) {
  const { t } = useTranslation();
  const { addSale } = useSales();
  const { products } = useProducts();
  const { customers, addCustomer } = useCustomers();
  const { shops } = useShops();
  const { activeSources } = useCustomerSources();
  const { user, company, currentEmployee, isOwner } = useAuth();
  const { batches: allBatches } = useAllStockBatches();
  const { settings: checkoutSettings } = useCheckoutSettings();

  // Get default inventory method from settings (lowercase for form)
  const getDefaultInventoryMethod = (): 'fifo' | 'lifo' | 'cmup' => {
    const defaultMethod = checkoutSettings?.defaultInventoryMethod || 'FIFO';
    return defaultMethod.toLowerCase() as 'fifo' | 'lifo' | 'cmup';
  };

  const [state, setState] = useState<POSState>({
    cart: [],
    customer: null,
    searchQuery: '',
    selectedCategory: null,
    deliveryFee: 0,
    status: 'commande',
    inventoryMethod: getDefaultInventoryMethod(),
    applyTVA: false,
    tvaRate: 19.24,
    shopId: shopId || '',
    sourceType: 'shop', // POS is always for shops
  });

  // Initialize default shop if not provided
  useEffect(() => {
    if (!state.shopId && company?.id) {
      const initializeDefaultShop = async () => {
        try {
          const defaultShop = await getDefaultShop(company.id);
          if (defaultShop) {
            setState(prev => ({
              ...prev,
              shopId: defaultShop.id
            }));
          }
        } catch (error) {
          logError('Error loading default shop for POS', error);
        }
      };
      initializeDefaultShop();
    }
  }, [company?.id, state.shopId]);

  // Update inventory method when settings change
  useEffect(() => {
    if (checkoutSettings?.defaultInventoryMethod) {
      const defaultMethod = checkoutSettings.defaultInventoryMethod.toLowerCase() as 'fifo' | 'lifo' | 'cmup';
      setState(prev => ({ ...prev, inventoryMethod: defaultMethod }));
    }
  }, [checkoutSettings?.defaultInventoryMethod]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSaveCustomer, setAutoSaveCustomer] = useState(true);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  // Build stock map from batches filtered by shop (location-aware)
  const stockMap = useMemo(() => {
    if (!state.shopId) {
      // If no shop selected, use all batches (backward compatible)
      return buildProductStockMap(allBatches || []);
    }
    // Filter batches by shop
    const shopBatches = (allBatches || []).filter(batch => 
      batch.type === 'product' && 
      batch.locationType === 'shop' && 
      batch.shopId === state.shopId &&
      batch.status === 'active' &&
      (batch.remainingQuantity || 0) > 0
    );
    return buildProductStockMap(shopBatches);
  }, [allBatches, state.shopId]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  // Filter products based on search and category, using effective stock
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    let filtered = products.filter(p => {
      if (!p.isAvailable) return false;
      const effectiveStock = getEffectiveProductStock(p, stockMap);
      return effectiveStock > 0;
    });
    
    // Filter by search query
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        (p.name || '').toLowerCase().includes(query) ||
        (p.reference || '').toLowerCase().includes(query) ||
        (p.barCode && p.barCode.includes(query))
      );
    }
    
    // Filter by category
    if (state.selectedCategory) {
      filtered = filtered.filter(p => p.category === state.selectedCategory);
    }
    
    return filtered;
  }, [products, stockMap, state.searchQuery, state.selectedCategory]);

  // Calculate cart totals
  const cartTotals = useMemo(() => {
    const subtotal = state.cart.reduce((sum, item) => {
      const price = item.negotiatedPrice ?? item.product.sellingPrice;
      return sum + (price * item.quantity);
    }, 0);
    
    const tvaAmount = state.applyTVA ? subtotal * (state.tvaRate / 100) : 0;
    const total = subtotal + state.deliveryFee + tvaAmount;
    
    return { subtotal, tvaAmount, total };
  }, [state.cart, state.deliveryFee, state.applyTVA, state.tvaRate]);

  // Add product to cart
  const addToCart = useCallback((product: Product, quantity: number = 1, negotiatedPrice?: number) => {
    const effectiveStock = getEffectiveProductStock(product, stockMap);
    if (effectiveStock < quantity) {
      showWarningToast(t('pos.messages.insufficientStock', { stock: effectiveStock }));
      return;
    }

    setState(prev => {
      const existingItem = prev.cart.find(item => item.product.id === product.id);
      
      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (newQuantity > effectiveStock) {
          showWarningToast(t('pos.messages.insufficientStock', { stock: effectiveStock }));
          return prev;
        }
        
        return {
          ...prev,
          cart: prev.cart.map(item =>
            item.product.id === product.id
              ? { ...item, quantity: newQuantity, negotiatedPrice: negotiatedPrice ?? item.negotiatedPrice }
              : item
          ),
        };
      } else {
        return {
          ...prev,
          cart: [...prev.cart, { product, quantity, negotiatedPrice }],
        };
      }
    });
  }, [stockMap, t]);

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
      
      const effectiveStock = getEffectiveProductStock(item.product, stockMap);
      if (quantity > effectiveStock) {
        showWarningToast(t('pos.messages.insufficientStock', { stock: effectiveStock }));
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
  }, [removeFromCart, stockMap, t]);

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

  const handleCustomerSearch = useCallback((value: string) => {
    setCustomerSearch(value);
    
    if (!value.trim() || value.length < 1) {
      setShowCustomerDropdown(false);
      return;
    }
    
    const searchTerm = value.trim().toLowerCase();
    const normalizedSearch = normalizePhoneForComparison(value);
    
    // Search by both name and phone simultaneously
    const matchingCustomers = customers.filter(c => {
      // Search by name (case-insensitive, partial match)
      const nameMatch = c.name?.toLowerCase().includes(searchTerm) || false;
      
      // Search by phone (normalized comparison for partial match)
      const phoneMatch = c.phone && normalizedSearch.length >= 1
        ? normalizePhoneForComparison(c.phone).includes(normalizedSearch) || 
          normalizedSearch.includes(normalizePhoneForComparison(c.phone))
        : false;
      
      // Return true if EITHER name OR phone matches
      return nameMatch || phoneMatch;
    });
    
    setShowCustomerDropdown(matchingCustomers.length > 0);
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
        name: 'Client de passage',
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

  // Toggle TVA
  const toggleTVA = useCallback((apply: boolean) => {
    setState(prev => ({ ...prev, applyTVA: apply }));
  }, []);

  // Update state
  const updateState = useCallback((updates: Partial<POSState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Complete sale
  const completeSale = useCallback(async (paymentData?: POSPaymentData) => {
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

      // Note: saleProducts will be enriched with costPrice, profit, profitMargin by createSale
      const saleProducts = state.cart.map(item => ({
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
      } : (state.customer ? {
        name: state.customer.name,
        phone: state.customer.phone || '',
        quarter: state.customer.quarter || '',
        address: '',
        town: '',
      } : {
        name: 'Client de passage',
        phone: '',
        quarter: '',
        address: '',
        town: '',
      });

      // Calculate final total with discount and tax
      const discountAmount = paymentData?.discountValue || 0;
      const tvaAmount = state.applyTVA ? cartTotals.subtotal * (state.tvaRate / 100) : 0;
      const finalTotal = cartTotals.subtotal + (paymentData?.deliveryFee ?? state.deliveryFee) - discountAmount + tvaAmount;

      // Prepare raw sale data for validation
      // Note: products will be enriched with costPrice, profit, profitMargin by createSale
      const rawSaleData = {
        products: saleProducts as any, // Products will be enriched by createSale
        totalAmount: finalTotal,
        userId: user.uid,
        companyId: company.id,
        status: paymentData?.status || state.status,
        paymentStatus: paymentData?.paymentMethod === 'cash' && paymentData.amountReceived && paymentData.amountReceived >= finalTotal 
          ? 'paid' as const 
          : 'pending' as const,
        customerInfo: {
          name: customerInfo.name || 'Client de passage',
          phone: customerInfo.phone || '',
          quarter: customerInfo.quarter || '',
        },
        deliveryFee: paymentData?.deliveryFee ?? state.deliveryFee ?? 0,
        inventoryMethod: paymentData?.inventoryMethod || state.inventoryMethod || getDefaultInventoryMethod(),
        saleDate: paymentData?.saleDate || new Date().toISOString(),
        customerSourceId: paymentData?.customerSourceId || state.customer?.sourceId || '',
        paymentMethod: paymentData?.paymentMethod || '',
        transactionReference: paymentData?.transactionReference || '',
        notes: paymentData?.notes || '',
        tax: tvaAmount, // TVA amount
        tvaRate: state.applyTVA ? state.tvaRate : 0, // TVA percentage rate
        tvaApplied: state.applyTVA, // Whether TVA was applied
        // Location fields for shop/warehouse system
        sourceType: state.sourceType,
        ...(state.shopId && { shopId: state.shopId }),
      };

      // Validate sale data with translations
      if (!validateSaleData(rawSaleData, t)) {
        return null;
      }

      // Normalize sale data with defaults
      const normalizedData = normalizeSaleData(rawSaleData, user.uid, company.id);

      // Get createdBy employee reference
      let createdBy: ReturnType<typeof getCurrentEmployeeRef> = null;
      if (user && company) {
        let userData: Awaited<ReturnType<typeof getUserById>> | null = null;
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

      // Auto-save customer if enabled (only when phone is provided)
      if (autoSaveCustomer && customerInfo.phone && company?.id) {
        try {
          // Only check for existing customer if phone is provided
          const existing = customers.find(c => 
            c.phone && normalizePhoneForComparison(c.phone) === normalizePhoneForComparison(customerInfo.phone)
          );

          if (!existing) {
            await addCustomer({
              phone: customerInfo.phone,
              name: customerInfo.name || 'Divers',
              quarter: customerInfo.quarter || paymentData?.customerQuarter || '',
              address: customerInfo.address || paymentData?.customerAddress || '',
              town: customerInfo.town || paymentData?.customerTown || '',
              customerSourceId: paymentData?.customerSourceId || state.customer?.sourceId || '',
              userId: user.uid,
              companyId: company.id,
              createdAt: {
                seconds: Math.floor(Date.now() / 1000),
                nanoseconds: (Date.now() % 1000) * 1000000
              },
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
      console.error('Error completing sale:', error);
      logError('Error completing sale', error);
      showErrorToast(t('sales.messages.errors.addSale'));
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [state, cartTotals, user, company, currentEmployee, isOwner, autoSaveCustomer, customers, addSale, addCustomer, clearCart, clearCustomer, t]);

  // Save draft (save without completing sale) - now uses localStorage
  const saveDraft = useCallback(async (paymentData?: import('../../components/pos/POSPaymentModal').POSPaymentData) => {
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

      // Use payment data if provided, otherwise use state
      const customerInfo = paymentData ? {
        name: paymentData.customerName,
        phone: paymentData.customerPhone,
        quarter: paymentData.customerQuarter || '',
        address: paymentData.customerAddress || '',
        town: paymentData.customerTown || '',
        sourceId: paymentData.customerSourceId || '',
      } : (state.customer ? {
        name: state.customer.name,
        phone: state.customer.phone || '',
        quarter: state.customer.quarter || '',
        address: '',
        town: '',
        sourceId: state.customer.sourceId || '',
      } : null);

      // Calculate final total with discount and tax
      const discountAmount = paymentData?.discountValue || 0;
      const tvaAmount = state.applyTVA ? cartTotals.subtotal * (state.tvaRate / 100) : 0;
      const finalTotal = cartTotals.subtotal + (paymentData?.deliveryFee ?? state.deliveryFee) - discountAmount + tvaAmount;

      // Get createdBy employee reference for metadata
      let createdBy: { id: string; name: string } | null = null;
      if (user && company) {
        let userData: Awaited<ReturnType<typeof getUserById>> | null = null;
        if (isOwner && !currentEmployee) {
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            logError('Error fetching user data for createdBy', error);
          }
        }
        const employeeRef = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
        if (employeeRef) {
          createdBy = {
            id: employeeRef.id,
            name: formatCreatorName(employeeRef),
          };
        }
      }

      // Save draft to localStorage
      const newDraft = saveDraftToStorage(
        user.uid,
        company.id,
        {
          cart: state.cart,
          customer: customerInfo,
          paymentData: paymentData ? {
            paymentMethod: paymentData.paymentMethod,
            amountReceived: paymentData.amountReceived,
            change: paymentData.change,
            transactionReference: paymentData.transactionReference,
            mobileMoneyPhone: paymentData.mobileMoneyPhone,
            customerPhone: paymentData.customerPhone,
            customerName: paymentData.customerName,
            customerQuarter: paymentData.customerQuarter,
            customerSourceId: paymentData.customerSourceId,
            customerAddress: paymentData.customerAddress,
            customerTown: paymentData.customerTown,
            saleDate: paymentData.saleDate,
            deliveryFee: paymentData.deliveryFee,
            status: paymentData.status,
            inventoryMethod: paymentData.inventoryMethod,
            discountType: paymentData.discountType,
            discountValue: paymentData.discountValue,
            promoCode: paymentData.promoCode,
            tax: paymentData.tax,
            notes: paymentData.notes,
            printReceipt: paymentData.printReceipt,
          } : {},
          deliveryFee: paymentData?.deliveryFee ?? state.deliveryFee ?? 0,
          subtotal: cartTotals.subtotal,
          total: finalTotal,
          createdBy,
        }
      );

      // Auto-save customer if enabled (only when phone is provided)
      if (autoSaveCustomer && customerInfo && customerInfo.phone && company?.id) {
        try {
          // Only check for existing customer if phone is provided
          const existing = customers.find(c => 
            c.phone && normalizePhoneForComparison(c.phone) === normalizePhoneForComparison(customerInfo.phone)
          );

          if (!existing) {
            await addCustomer({
              phone: customerInfo.phone,
              name: customerInfo.name || 'Divers',
              quarter: customerInfo.quarter || '',
              address: customerInfo.address || '',
              town: customerInfo.town || '',
              customerSourceId: customerInfo.sourceId || '',
              userId: user.uid,
              companyId: company.id,
              createdAt: {
                seconds: Math.floor(Date.now() / 1000),
                nanoseconds: (Date.now() % 1000) * 1000000
              },
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
  }, [state, cartTotals, user, company, currentEmployee, isOwner, autoSaveCustomer, customers, addCustomer, t]);

  // Resume draft (load draft into cart) - now uses localStorage
  const resumeDraft = useCallback((draft: POSDraft) => {
    if (!draft || !draft.cart || draft.cart.length === 0) {
      showErrorToast(t('pos.transactions.draftResumeError') || 'Draft has no products');
      return null;
    }

    try {
      // Clear current cart
      clearCart();

      // Load products from draft into cart
      draft.cart.forEach((cartItem) => {
        const product = products?.find(p => p.id === cartItem.product.id);
        if (product && product.isAvailable) {
          // Add product to cart with negotiated price if available
          addToCart(product, cartItem.quantity, cartItem.negotiatedPrice);
        } else {
          showWarningToast(t('pos.transactions.productNotFoundInDraft') || `Product ${cartItem.product.id} not found`);
        }
      });

      // Load customer info if available
      if (draft.customer) {
        // Create a temporary Customer object for selectCustomer
        const tempCustomer: Customer = {
          name: draft.customer.name,
          phone: draft.customer.phone || '',
          quarter: draft.customer.quarter,
          address: draft.customer.address,
          town: draft.customer.town,
          customerSourceId: draft.customer.sourceId,
          userId: user?.uid || '',
          companyId: company?.id || '',
          createdAt: {
            seconds: Math.floor(Date.now() / 1000),
            nanoseconds: (Date.now() % 1000) * 1000000
          },
        };
        selectCustomer(tempCustomer);
      } else {
        clearCustomer();
      }

      // Load delivery fee
      if (draft.deliveryFee !== undefined) {
        updateState({ deliveryFee: draft.deliveryFee });
      }

      // Return draft data for pre-filling payment modal
      return {
        customerName: draft.customer?.name || '',
        customerPhone: draft.customer?.phone || '',
        customerQuarter: draft.customer?.quarter || '',
        customerSourceId: draft.customer?.sourceId || '',
        customerAddress: draft.customer?.address || '',
        customerTown: draft.customer?.town || '',
        deliveryFee: draft.deliveryFee || 0,
        status: draft.paymentData?.status || 'commande',
        inventoryMethod: (draft.paymentData?.inventoryMethod || getDefaultInventoryMethod()) as 'fifo' | 'lifo' | 'cmup',
        saleDate: draft.paymentData?.saleDate || new Date().toISOString().slice(0, 10),
        notes: draft.paymentData?.notes || '',
        paymentMethod: draft.paymentData?.paymentMethod || undefined,
        discountType: draft.paymentData?.discountType,
        discountValue: draft.paymentData?.discountValue,
        promoCode: draft.paymentData?.promoCode || '',
        tax: draft.paymentData?.tax,
      };
    } catch (error) {
      logError('Error resuming draft', error);
      showErrorToast(t('pos.transactions.draftResumeError') || 'Failed to resume draft');
      return null;
    }
  }, [products, clearCart, addToCart, selectCustomer, clearCustomer, updateState, t]);

  // Get all drafts from localStorage
  const getDraftsList = useCallback((): POSDraft[] => {
    if (!user?.uid || !company?.id) {
      return [];
    }
    return getDrafts(user.uid, company.id);
  }, [user, company]);

  // Delete draft from localStorage
  const deleteDraftById = useCallback((draftId: string): boolean => {
    if (!user?.uid || !company?.id) {
      return false;
    }
    return deleteDraft(user.uid, company.id, draftId);
  }, [user, company]);

  // Handle barcode scan
  const handleBarcodeScan = useCallback((productId: string) => {
    const product = products?.find(p => p.id === productId);
    const stock = getEffectiveProductStock(product, stockMap);
    if (product && product.isAvailable && stock > 0) {
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
    applyTVA: state.applyTVA,
    tvaRate: state.tvaRate,
    filteredProducts,
    cartTotals,
    isSubmitting,
    autoSaveCustomer,
    showCustomerDropdown,
    customerSearch,
    customers,
    activeSources,
    products,
    checkoutSettings,
    shops,
    selectedShop: shops?.find(s => s.id === state.shopId) || null,
    shopId: state.shopId,

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
    toggleTVA,
    completeSale,
    saveDraft,
    resumeDraft,
    getDraftsList,
    deleteDraftById,
    handleBarcodeScan,
    focusSearch,
    setAutoSaveCustomer,
    setShowCustomerDropdown,
    setShop: (shopId: string) => {
      setState(prev => ({ ...prev, shopId, cart: [] })); // Clear cart when shop changes
    },
    stockMap, // Expose stockMap for components that need it
  };
}

