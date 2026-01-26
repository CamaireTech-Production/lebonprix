// useRestaurantPOS - Main POS hook for Restoflow restaurant management
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { FirestoreService } from '../../services/FirestoreService';
import { useSales } from '../business/useSales';
import { t } from '../../utils/i18n';
import toast from 'react-hot-toast';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

import type {
  POSState,
  POSCartItem,
  POSCustomerInfo,
  POSOrderType,
  POSPaymentData,
  POSOrder,
  POSDraft,
  POSCartTotals,
  UseRestaurantPOSReturn,
} from '../../types/pos';
import type { Dish, Category, Table, Order, OrderItem } from '../../types/index';
import type { Sale, SaleProduct } from '../../types/geskap';

import {
  saveDraft as saveDraftToStorage,
  getDrafts as getDraftsFromStorage,
  deleteDraft as deleteDraftFromStorage,
  cleanupOldDrafts,
} from '../../utils/pos/posDraftStorage';

// Initial state
const initialState: POSState = {
  cart: [],
  customer: null,
  selectedTable: null,
  searchQuery: '',
  selectedCategory: null,
  orderType: 'dine-in',
  tip: 0,
  deliveryFee: 0,
  notes: '',
};

export function useRestaurantPOS(): UseRestaurantPOSReturn {
  const { currentUser, restaurant } = useAuth();
  const { language } = useLanguage();
  const restaurantId = restaurant?.id || currentUser?.uid || '';
  const userId = currentUser?.uid || '';

  // State
  const [state, setState] = useState<POSState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Data state
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [drafts, setDrafts] = useState<POSDraft[]>([]);

  // Use sales hook for creating sales records
  const { createSale } = useSales({ restaurantId, userId });

  // Load data on mount
  useEffect(() => {
    if (!restaurantId) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);

      try {
        // Load dishes from top-level menuItems collection (same as MenuManagement)
        const dishesQuery = query(
          collection(db, 'menuItems'),
          where('restaurantId', '==', restaurantId),
          where('status', '==', 'active'),
          orderBy('createdAt', 'desc')
        );
        const dishesSnapshot = await getDocs(dishesQuery);
        const loadedDishes = dishesSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Dish))
          .filter(dish => !dish.deleted);
        setDishes(loadedDishes);

        // Load categories from top-level categories collection
        const categoriesQuery = query(
          collection(db, 'categories'),
          where('restaurantId', '==', restaurantId),
          orderBy('title')
        );
        const categoriesSnapshot = await getDocs(categoriesQuery);
        const loadedCategories = categoriesSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Category))
          .filter(cat => !cat.deleted && cat.status === 'active');
        setCategories(loadedCategories);

        // Load tables from localStorage (following existing pattern)
        try {
          const cached = localStorage.getItem(`offline_tables_${restaurantId}`);
          if (cached) {
            setTables(JSON.parse(cached));
          }
        } catch (error) {
          console.error('Error loading tables:', error);
        }
      } catch (error) {
        console.error('Error loading POS data:', error);
      } finally {
        setIsLoading(false);
      }

      // Cleanup old drafts
      cleanupOldDrafts();
    };

    loadData();
  }, [restaurantId]);

  // Load drafts when dishes are loaded
  useEffect(() => {
    if (restaurantId && userId && dishes.length > 0) {
      const loadedDrafts = getDraftsFromStorage(restaurantId, userId, dishes);
      setDrafts(loadedDrafts);
    }
  }, [restaurantId, userId, dishes]);

  // Subscribe to active orders
  useEffect(() => {
    if (!restaurantId) return;

    const unsubscribe = FirestoreService.subscribeToAllOrders(restaurantId, (orders) => {
      // Filter to only show non-completed orders
      const active = orders.filter(
        o => o.status !== 'completed' && o.status !== 'cancelled' && !o.deleted
      );
      setActiveOrders(active);
    });

    return () => unsubscribe();
  }, [restaurantId]);

  // Filter dishes based on search and category
  const filteredDishes = useMemo(() => {
    let filtered = dishes.filter(d => d.status === 'active');

    // Filter by search query
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(d =>
        d.title.toLowerCase().includes(query) ||
        (d.description && d.description.toLowerCase().includes(query))
      );
    }

    // Filter by category
    if (state.selectedCategory) {
      filtered = filtered.filter(d => d.categoryId === state.selectedCategory);
    }

    return filtered;
  }, [dishes, state.searchQuery, state.selectedCategory]);

  // Calculate cart totals
  const cartTotals = useMemo<POSCartTotals>(() => {
    const subtotal = state.cart.reduce((sum, item) => {
      const price = item.modifiedPrice ?? item.dish.price;
      return sum + (price * item.quantity);
    }, 0);

    const itemCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);

    return {
      subtotal,
      tip: state.tip,
      deliveryFee: state.orderType === 'delivery' ? state.deliveryFee : 0,
      total: subtotal + state.tip + (state.orderType === 'delivery' ? state.deliveryFee : 0),
      itemCount,
    };
  }, [state.cart, state.tip, state.deliveryFee, state.orderType]);

  // ============================================================
  // CART OPERATIONS
  // ============================================================

  const addToCart = useCallback((dish: Dish, quantity: number = 1, specialInstructions?: string) => {
    setState(prev => {
      const existingItem = prev.cart.find(item => item.dish.id === dish.id);

      if (existingItem) {
        // Update quantity if item exists
        return {
          ...prev,
          cart: prev.cart.map(item =>
            item.dish.id === dish.id
              ? {
                  ...item,
                  quantity: item.quantity + quantity,
                  specialInstructions: specialInstructions || item.specialInstructions,
                }
              : item
          ),
        };
      }

      // Add new item
      return {
        ...prev,
        cart: [
          ...prev.cart,
          {
            dish,
            quantity,
            specialInstructions,
          },
        ],
      };
    });

    toast.success(t('pos_item_added', language) || 'Item added to order');
  }, [language]);

  const updateCartItem = useCallback((dishId: string, updates: Partial<POSCartItem>) => {
    setState(prev => ({
      ...prev,
      cart: prev.cart.map(item =>
        item.dish.id === dishId
          ? { ...item, ...updates }
          : item
      ),
    }));
  }, []);

  const updateCartQuantity = useCallback((dishId: string, quantity: number) => {
    if (quantity <= 0) {
      setState(prev => ({
        ...prev,
        cart: prev.cart.filter(item => item.dish.id !== dishId),
      }));
    } else {
      setState(prev => ({
        ...prev,
        cart: prev.cart.map(item =>
          item.dish.id === dishId
            ? { ...item, quantity }
            : item
        ),
      }));
    }
  }, []);

  const removeFromCart = useCallback((dishId: string) => {
    setState(prev => ({
      ...prev,
      cart: prev.cart.filter(item => item.dish.id !== dishId),
    }));
  }, []);

  const clearCart = useCallback(() => {
    setState(prev => ({
      ...prev,
      cart: [],
      tip: 0,
      notes: '',
    }));
  }, []);

  // ============================================================
  // CUSTOMER OPERATIONS
  // ============================================================

  const setCustomer = useCallback((customer: POSCustomerInfo | null) => {
    setState(prev => ({ ...prev, customer }));
  }, []);

  const clearCustomer = useCallback(() => {
    setState(prev => ({ ...prev, customer: null }));
  }, []);

  // ============================================================
  // TABLE OPERATIONS
  // ============================================================

  const selectTable = useCallback((table: Table | null) => {
    setState(prev => ({ ...prev, selectedTable: table }));
  }, []);

  // ============================================================
  // ORDER TYPE & DELIVERY
  // ============================================================

  const setOrderType = useCallback((type: POSOrderType) => {
    setState(prev => ({
      ...prev,
      orderType: type,
      // Clear table if not dine-in
      selectedTable: type !== 'dine-in' ? null : prev.selectedTable,
      // Reset delivery fee if not delivery
      deliveryFee: type === 'delivery' ? prev.deliveryFee : 0,
    }));
  }, []);

  const setDeliveryFee = useCallback((fee: number) => {
    setState(prev => ({ ...prev, deliveryFee: fee }));
  }, []);

  // ============================================================
  // TIP & NOTES
  // ============================================================

  const setTip = useCallback((tip: number) => {
    setState(prev => ({ ...prev, tip }));
  }, []);

  const setNotes = useCallback((notes: string) => {
    setState(prev => ({ ...prev, notes }));
  }, []);

  // ============================================================
  // SEARCH & FILTER
  // ============================================================

  const setSearchQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const setSelectedCategory = useCallback((categoryId: string | null) => {
    setState(prev => ({ ...prev, selectedCategory: categoryId }));
  }, []);

  // ============================================================
  // ORDER COMPLETION
  // ============================================================

  const completeOrder = useCallback(async (paymentData: POSPaymentData): Promise<{ order: POSOrder; sale?: Sale }> => {
    if (state.cart.length === 0) {
      throw new Error(t('pos_cart_empty', language) || 'Cart is empty');
    }

    setIsSubmitting(true);

    try {
      // Build order items
      const orderItems: OrderItem[] = state.cart.map(item => ({
        id: item.dish.id,
        menuItemId: item.dish.id,
        title: item.dish.title,
        price: item.modifiedPrice ?? item.dish.price,
        quantity: item.quantity,
        notes: item.specialInstructions,
        image: item.dish.image,
      }));

      // Create the order
      const orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> = {
        items: orderItems,
        restaurantId,
        status: 'pending',
        totalAmount: cartTotals.total,
        tableNumber: paymentData.tableNumber,
        customerName: paymentData.customerName || state.customer?.name,
        customerPhone: paymentData.customerPhone || state.customer?.phone,
        customerLocation: paymentData.customerLocation || state.customer?.location,
        deliveryFee: state.orderType === 'delivery' ? state.deliveryFee : undefined,
        orderType: state.orderType === 'dine-in' ? 'restaurant' : 'online',
        paymentMethod: paymentData.paymentMethod === 'mobile_money' ? 'campay' : paymentData.paymentMethod,
        paymentStatus: 'completed',
      };

      const orderId = await FirestoreService.createOrder(restaurantId, orderData);

      // Build the POSOrder object
      const posOrder: POSOrder = {
        id: orderId,
        ...orderData,
        items: state.cart.map(item => ({
          id: item.dish.id,
          menuItemId: item.dish.id,
          title: item.dish.title,
          price: item.modifiedPrice ?? item.dish.price,
          quantity: item.quantity,
          notes: item.specialInstructions,
          image: item.dish.image,
          specialInstructions: item.specialInstructions,
          modifiedPrice: item.modifiedPrice,
        })),
        tip: paymentData.tip,
        orderType: state.orderType,
        paymentMethod: paymentData.paymentMethod,
      };

      // Create sale record for financial tracking
      const saleProducts: SaleProduct[] = state.cart.map(item => ({
        productId: item.dish.id,
        quantity: item.quantity,
        basePrice: item.dish.price,
        negotiatedPrice: item.modifiedPrice,
        costPrice: 0, // Would need ingredient cost tracking
        profit: (item.modifiedPrice ?? item.dish.price) * item.quantity,
        profitMargin: 100, // 100% since no cost tracking yet
      }));

      const saleData: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'> = {
        products: saleProducts,
        totalAmount: cartTotals.total,
        status: 'paid',
        paymentStatus: 'paid',
        customerInfo: {
          name: paymentData.customerName || state.customer?.name || '',
          phone: paymentData.customerPhone || state.customer?.phone || '',
          quarter: paymentData.customerLocation,
        },
        paymentMethod: paymentData.paymentMethod,
        amountReceived: paymentData.amountReceived,
        change: paymentData.change,
        deliveryFee: state.orderType === 'delivery' ? state.deliveryFee : undefined,
        tableNumber: paymentData.tableNumber,
        orderId,
        restaurantId,
        userId,
        isAvailable: true,
      };

      const sale = await createSale(saleData);

      // Update table status if dine-in
      if (state.orderType === 'dine-in' && state.selectedTable) {
        // Update table to occupied in localStorage
        const tablesKey = `offline_tables_${restaurantId}`;
        const cached = localStorage.getItem(tablesKey);
        if (cached) {
          const currentTables: Table[] = JSON.parse(cached);
          const updatedTables = currentTables.map(t =>
            t.id === state.selectedTable?.id
              ? { ...t, status: 'occupied' as const }
              : t
          );
          localStorage.setItem(tablesKey, JSON.stringify(updatedTables));
          setTables(updatedTables);
        }
      }

      // Clear cart and reset state
      setState(initialState);

      toast.success(t('pos_order_completed', language) || 'Order completed successfully!');

      return { order: posOrder, sale };
    } catch (error: any) {
      console.error('Error completing order:', error);
      toast.error(error.message || t('pos_order_error', language) || 'Failed to complete order');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [state, cartTotals, restaurantId, userId, createSale, language]);

  // ============================================================
  // DRAFT MANAGEMENT
  // ============================================================

  const saveDraft = useCallback(() => {
    if (state.cart.length === 0) {
      toast.error(t('pos_cart_empty', language) || 'Cart is empty');
      return;
    }

    saveDraftToStorage(
      restaurantId,
      userId,
      state.cart,
      state.customer,
      state.selectedTable?.id,
      state.selectedTable?.number,
      state.orderType,
      state.tip,
      state.deliveryFee,
      state.notes
    );

    // Reload drafts
    const loadedDrafts = getDraftsFromStorage(restaurantId, userId, dishes);
    setDrafts(loadedDrafts);

    // Clear current cart
    setState(initialState);

    toast.success(t('pos_draft_saved', language) || 'Draft saved');
  }, [state, restaurantId, userId, dishes, language]);

  const resumeDraft = useCallback((draft: POSDraft) => {
    // Find the table if it exists
    const table = draft.tableId
      ? tables.find(t => t.id === draft.tableId) || null
      : null;

    setState({
      cart: draft.cart,
      customer: draft.customer,
      selectedTable: table,
      searchQuery: '',
      selectedCategory: null,
      orderType: draft.orderType,
      tip: draft.tip,
      deliveryFee: draft.deliveryFee,
      notes: draft.notes,
    });

    // Delete the draft after resuming
    deleteDraftFromStorage(draft.id);

    // Reload drafts
    const loadedDrafts = getDraftsFromStorage(restaurantId, userId, dishes);
    setDrafts(loadedDrafts);

    toast.success(t('pos_draft_resumed', language) || 'Draft resumed');
  }, [tables, restaurantId, userId, dishes, language]);

  const handleDeleteDraft = useCallback((draftId: string) => {
    deleteDraftFromStorage(draftId);

    // Reload drafts
    const loadedDrafts = getDraftsFromStorage(restaurantId, userId, dishes);
    setDrafts(loadedDrafts);

    toast.success(t('pos_draft_deleted', language) || 'Draft deleted');
  }, [restaurantId, userId, dishes, language]);

  // ============================================================
  // PRINTING (Placeholder - to be implemented)
  // ============================================================

  const printKitchenTicket = useCallback((order: POSOrder) => {
    // TODO: Implement kitchen ticket printing
    console.log('Print kitchen ticket for order:', order.id);
    toast.success(t('pos_ticket_printed', language) || 'Kitchen ticket sent');
  }, [language]);

  const printReceipt = useCallback((order: POSOrder, sale: Sale) => {
    // TODO: Implement receipt printing
    console.log('Print receipt for sale:', sale.id);
    toast.success(t('pos_receipt_printed', language) || 'Receipt printed');
  }, [language]);

  // ============================================================
  // RETURN
  // ============================================================

  return {
    // State
    state,
    isSubmitting,
    isLoading,

    // Data
    dishes,
    categories,
    tables,
    filteredDishes,
    cartTotals,
    activeOrders: activeOrders as unknown as POSOrder[],
    drafts,

    // Cart operations
    addToCart,
    updateCartItem,
    updateCartQuantity,
    removeFromCart,
    clearCart,

    // Customer operations
    setCustomer,
    clearCustomer,

    // Table operations
    selectTable,

    // Order type & delivery
    setOrderType,
    setDeliveryFee,

    // Tip
    setTip,

    // Notes
    setNotes,

    // Search & Filter
    setSearchQuery,
    setSelectedCategory,

    // Order completion
    completeOrder,

    // Draft management
    saveDraft,
    resumeDraft,
    deleteDraft: handleDeleteDraft,

    // Printing
    printKitchenTicket,
    printReceipt,
  };
}

export default useRestaurantPOS;
