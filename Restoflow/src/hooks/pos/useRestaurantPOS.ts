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
  PartialKitchenTicket,
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

  // Edit order state
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [originalOrderItems, setOriginalOrderItems] = useState<POSCartItem[]>([]);

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

  // Subscribe to active orders (only today's orders)
  useEffect(() => {
    if (!restaurantId) return;

    const unsubscribe = FirestoreService.subscribeToAllOrders(restaurantId, (orders) => {
      // Get start of today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = today.getTime();

      // Filter to only show non-completed orders from today
      const active = orders.filter(o => {
        // Must not be completed/cancelled/deleted
        if (o.status === 'completed' || o.status === 'cancelled' || o.deleted) {
          return false;
        }

        // Check if order is from today
        let orderDate: Date | null = null;
        if (o.createdAt) {
          if (typeof o.createdAt === 'object' && 'seconds' in o.createdAt) {
            orderDate = new Date((o.createdAt as any).seconds * 1000);
          } else if (o.createdAt instanceof Date) {
            orderDate = o.createdAt;
          }
        }

        // Only include orders from today
        if (orderDate && orderDate.getTime() >= todayTimestamp) {
          return true;
        }

        return false;
      });

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
      // Build order items (remove undefined values)
      const orderItems: OrderItem[] = state.cart.map(item => {
        const itemData: OrderItem = {
          id: item.dish.id,
          menuItemId: item.dish.id,
          title: item.dish.title,
          price: item.modifiedPrice ?? item.dish.price,
          quantity: item.quantity,
        };
        
        // Only add optional fields if they have values
        if (item.specialInstructions) {
          itemData.notes = item.specialInstructions;
        }
        if (item.dish.image) {
          itemData.image = item.dish.image;
        }
        
        return itemData;
      });

      // Create the order (remove undefined values)
      const orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> = {
        items: orderItems,
        restaurantId,
        status: 'pending',
        totalAmount: cartTotals.total,
        orderType: state.orderType === 'dine-in' ? 'restaurant' : 'online',
        paymentStatus: paymentData.skipPayment ? 'pending' : 'completed',
      };

      // Only add optional fields if they have values
      if (paymentData.tableNumber) {
        orderData.tableNumber = paymentData.tableNumber;
      }
      
      const customerName = paymentData.customerName || state.customer?.name;
      if (customerName) {
        orderData.customerName = customerName;
      }
      
      const customerPhone = paymentData.customerPhone || state.customer?.phone;
      if (customerPhone) {
        orderData.customerPhone = customerPhone;
      }
      
      const customerLocation = paymentData.customerLocation || state.customer?.location;
      if (customerLocation) {
        orderData.customerLocation = customerLocation;
      }
      
      if (state.orderType === 'delivery' && state.deliveryFee > 0) {
        orderData.deliveryFee = state.deliveryFee;
      }
      
      const paymentMethod = paymentData.paymentMethod === 'mobile_money' ? 'campay' : paymentData.paymentMethod;
      if (paymentMethod) {
        orderData.paymentMethod = paymentMethod;
      }

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

      // Create sale record for financial tracking (only if payment is not skipped)
      let sale: Sale | undefined;
      if (!paymentData.skipPayment) {
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
          },
          paymentMethod: paymentData.paymentMethod,
          orderId,
          restaurantId,
          userId,
          isAvailable: true,
        };

        // Only add optional fields if they have values
        if (paymentData.customerLocation) {
          saleData.customerInfo.quarter = paymentData.customerLocation;
        }
        if (paymentData.amountReceived !== undefined) {
          saleData.amountReceived = paymentData.amountReceived;
        }
        if (paymentData.change !== undefined) {
          saleData.change = paymentData.change;
        }
        if (state.orderType === 'delivery' && state.deliveryFee > 0) {
          saleData.deliveryFee = state.deliveryFee;
        }
        if (paymentData.tableNumber) {
          saleData.tableNumber = paymentData.tableNumber;
        }

        sale = await createSale(saleData);
      }

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
  // ORDER EDITING
  // ============================================================

  const loadOrderForEditing = useCallback(async (orderId: string) => {
    try {
      setIsSubmitting(true);

      // Fetch all orders and filter by ID
      const orders = await FirestoreService.getOrders(restaurantId);
      const order = orders.find(o => o.id === orderId);

      if (!order) {
        throw new Error(t('pos_order_not_found', language) || 'Order not found');
      }

      // Convert order items to cart items
      const cartItems: POSCartItem[] = order.items
        .map(item => {
          const dish = dishes.find(d => d.id === item.menuItemId);
          if (!dish) return null;

          return {
            dish,
            quantity: item.quantity,
            specialInstructions: item.notes,
            modifiedPrice: item.price !== dish.price ? item.price : undefined,
          };
        })
        .filter((item): item is POSCartItem => item !== null);

      // Store original items for comparison
      setOriginalOrderItems(cartItems);

      // Load items into cart
      setState(prev => ({
        ...prev,
        cart: cartItems,
        selectedTable: order.tableNumber ? tables.find(t => t.number === order.tableNumber) || null : null,
        customer: order.customerName || order.customerPhone
          ? {
              name: order.customerName || '',
              phone: order.customerPhone || '',
              location: order.customerLocation,
            }
          : null,
      }));

      setEditingOrderId(orderId);
      toast.success(t('pos_order_loaded', language) || 'Order loaded for editing');
    } catch (error: any) {
      console.error('Error loading order for editing:', error);
      toast.error(error.message || t('pos_order_load_error', language) || 'Failed to load order');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [restaurantId, dishes, tables, language]);

  const addItemsToExistingOrder = useCallback(async (
    orderId: string,
    newItems: POSCartItem[],
    kitchenTickets: number
  ) => {
    try {
      setIsSubmitting(true);

      // Convert new items to OrderItem[] (remove undefined values)
      const orderItems: OrderItem[] = newItems.map(item => {
        const itemData: OrderItem = {
          id: item.dish.id,
          menuItemId: item.dish.id,
          title: item.dish.title,
          price: item.modifiedPrice ?? item.dish.price,
          quantity: item.quantity,
        };
        
        // Only add optional fields if they have values
        if (item.specialInstructions) {
          itemData.notes = item.specialInstructions;
        }
        if (item.dish.image) {
          itemData.image = item.dish.image;
        }
        
        return itemData;
      });

      // Fetch existing order
      const orders = await FirestoreService.getOrders(restaurantId);
      const existingOrder = orders.find(o => o.id === orderId);

      if (!existingOrder) {
        throw new Error(t('pos_order_not_found', language) || 'Order not found');
      }

      // Merge items (if item already exists, increment quantity)
      const mergedItems = [...existingOrder.items];
      orderItems.forEach(newItem => {
        const existingIndex = mergedItems.findIndex(i => i.menuItemId === newItem.menuItemId);
        if (existingIndex >= 0) {
          mergedItems[existingIndex].quantity += newItem.quantity;
        } else {
          mergedItems.push(newItem);
        }
      });

      // Calculate new total
      const newTotal = mergedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Update order
      await FirestoreService.updateOrder(restaurantId, orderId, {
        items: mergedItems,
        totalAmount: newTotal,
      });

      // Create partial kitchen ticket
      const partialTicket: PartialKitchenTicket = {
        orderId,
        orderNumber: `#${orderId.slice(-6)}`,
        isPartial: true,
        newItemsOnly: newItems.map(item => ({
          name: item.dish.title,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions,
        })),
        tableNumber: existingOrder.tableNumber,
        orderType: state.orderType,
        createdAt: new Date(),
        note: `Additional items for Order #${orderId.slice(-6)}`,
      };

      // Print partial tickets
      for (let i = 0; i < kitchenTickets; i++) {
        printPartialKitchenTicket(partialTicket);
      }

      // Clear cart and reset edit state
      setState(initialState);
      setEditingOrderId(null);
      setOriginalOrderItems([]);

      toast.success(t('pos_items_added', language) || 'Items added to order');
    } catch (error: any) {
      console.error('Error adding items to order:', error);
      toast.error(error.message || t('pos_add_items_error', language) || 'Failed to add items');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [restaurantId, state, language]);

  // ============================================================
  // PRINTING (Placeholder - to be implemented)
  // ============================================================

  // Helper function to create and print HTML ticket
  const printHTMLTicket = useCallback((htmlContent: string) => {
    // Create a print window
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) {
      toast.error(t('pos_print_blocked', language) || 'Please allow popups to print tickets');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Kitchen Ticket</title>
          <style>
            @media print {
              @page {
                size: 80mm auto;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 10px;
                font-family: 'Courier New', monospace;
                font-size: 12px;
              }
            }
            body {
              margin: 0;
              padding: 10px;
              font-family: 'Courier New', monospace;
              font-size: 12px;
              line-height: 1.4;
            }
            .ticket {
              max-width: 80mm;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              border-bottom: 2px dashed #000;
              padding-bottom: 10px;
              margin-bottom: 10px;
            }
            .item {
              margin: 8px 0;
              padding-bottom: 8px;
              border-bottom: 1px dotted #ccc;
            }
            .item-name {
              font-weight: bold;
            }
            .item-instructions {
              font-style: italic;
              color: #d97706;
              margin-top: 4px;
              font-size: 11px;
            }
            .footer {
              border-top: 2px dashed #000;
              margin-top: 15px;
              padding-top: 10px;
              text-align: center;
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `;

    // Write content to the window
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for the document to be ready, then trigger print
    // Use multiple fallback methods to ensure print dialog opens
    const triggerPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
        
        // Close window after a delay (user may cancel print)
        // Don't close immediately to allow print dialog to show
        setTimeout(() => {
          // Only close if window is still open (user might have closed it)
          if (!printWindow.closed) {
            printWindow.close();
          }
        }, 1000);
      } catch (error) {
        console.error('Error triggering print:', error);
        toast.error(t('pos_print_error', language) || 'Failed to open print dialog');
      }
    };

    // Try multiple methods to ensure print dialog opens
    if (printWindow.document.readyState === 'complete') {
      // Document is already loaded
      setTimeout(triggerPrint, 100);
    } else {
      // Wait for document to load
      printWindow.addEventListener('load', () => {
        setTimeout(triggerPrint, 100);
      }, { once: true });
      
      // Fallback: try after a short delay regardless
      setTimeout(triggerPrint, 500);
    }
  }, [language]);

  const printKitchenTicket = useCallback((order: POSOrder) => {
    const orderTypeLabel = order.orderType === 'dine-in' 
      ? t('pos_dine_in', language) || 'Dine In'
      : order.orderType === 'takeaway'
      ? t('pos_takeaway', language) || 'Takeaway'
      : t('pos_delivery', language) || 'Delivery';

    const htmlContent = `
      <div class="ticket">
        <div class="header">
          <h2 style="margin: 0; font-size: 16px;">${t('pos_kitchen_ticket', language) || 'KITCHEN TICKET'}</h2>
          <div style="margin-top: 5px; font-size: 11px;">
            ${new Date().toLocaleString()}
          </div>
          <div style="margin-top: 8px;">
            <span style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-size: 10px;">${orderTypeLabel}</span>
            ${order.tableNumber ? `<span style="background: #dbeafe; padding: 2px 8px; border-radius: 4px; font-size: 10px; margin-left: 5px;">${t('table', language) || 'Table'} ${order.tableNumber}</span>` : ''}
          </div>
        </div>
        <div class="items">
          ${order.items.map(item => `
            <div class="item">
              <div class="item-name">${item.quantity}x ${item.title}</div>
              ${item.specialInstructions || item.notes ? `<div class="item-instructions">*** ${item.specialInstructions || item.notes} ***</div>` : ''}
            </div>
          `).join('')}
        </div>
        <div class="footer">
          <div>Order #${order.id.slice(-6)}</div>
          <div style="margin-top: 5px;">${new Date().toLocaleTimeString()}</div>
        </div>
      </div>
    `;

    printHTMLTicket(htmlContent);
  }, [language, printHTMLTicket]);

  const printReceipt = useCallback((order: POSOrder, sale: Sale) => {
    // TODO: Implement receipt printing with proper formatting
    console.log('Print receipt for sale:', sale.id);
    toast.success(t('pos_receipt_printed', language) || 'Receipt printed');
  }, [language]);

  const printPartialKitchenTicket = useCallback((ticket: PartialKitchenTicket) => {
    const orderTypeLabel = ticket.orderType === 'dine-in' 
      ? t('pos_dine_in', language) || 'Dine In'
      : ticket.orderType === 'takeaway'
      ? t('pos_takeaway', language) || 'Takeaway'
      : t('pos_delivery', language) || 'Delivery';

    const htmlContent = `
      <div class="ticket">
        <div class="header">
          <h2 style="margin: 0; font-size: 16px; color: #d97706;">ADDITIONAL ITEMS</h2>
          <div style="margin-top: 5px; font-size: 11px;">
            ${ticket.createdAt.toLocaleString()}
          </div>
          <div style="margin-top: 8px;">
            <span style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-size: 10px;">${orderTypeLabel}</span>
            ${ticket.tableNumber ? `<span style="background: #dbeafe; padding: 2px 8px; border-radius: 4px; font-size: 10px; margin-left: 5px;">${t('table', language) || 'Table'} ${ticket.tableNumber}</span>` : ''}
          </div>
          ${ticket.note ? `<div style="margin-top: 8px; font-size: 11px; font-weight: bold; color: #d97706;">${ticket.note}</div>` : ''}
        </div>
        <div class="items">
          ${ticket.newItemsOnly.map(item => `
            <div class="item">
              <div class="item-name">${item.quantity}x ${item.name}</div>
              ${item.specialInstructions ? `<div class="item-instructions">*** ${item.specialInstructions} ***</div>` : ''}
            </div>
          `).join('')}
        </div>
        <div class="footer">
          <div>Order ${ticket.orderNumber}</div>
          <div style="margin-top: 5px;">${ticket.createdAt.toLocaleTimeString()}</div>
        </div>
      </div>
    `;

    printHTMLTicket(htmlContent);
  }, [language, printHTMLTicket]);

  // ============================================================
  // RETURN
  // ============================================================

  return {
    // State
    state,
    isSubmitting,
    isLoading,
    editingOrderId,
    originalOrderItems,

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

    // Order editing
    loadOrderForEditing,
    addItemsToExistingOrder,

    // Draft management
    saveDraft,
    resumeDraft,
    deleteDraft: handleDeleteDraft,

    // Printing
    printKitchenTicket,
    printReceipt,
    printPartialKitchenTicket,
  };
}

export default useRestaurantPOS;
