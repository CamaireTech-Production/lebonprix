import { db } from '../../core/firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy,
  limit,
  onSnapshot, 
  serverTimestamp,
  Timestamp,
  Unsubscribe,
  arrayUnion
} from 'firebase/firestore';
import { 
  Order, 
  OrderFilters, 
  OrderStats, 
  OrderEvent, 
  OrderStatus, 
  PaymentStatus, 
  OrderItem,
  CustomerInfo,
  OrderPricing,
  DeliveryInfo,
  OrderMetadata,
  CartItem,
  CampayDetails
} from '../../../types/order';
import { logError } from '@utils/core/logger';
import { createFinanceEntry, updateFinanceEntry } from '../finance/financeService';
import { getAvailableStockBatches } from '../stock/stockService';
import { createSale } from '../sales/saleService';
import { ensureCustomerExists } from '../customers/customerService';
import type { Product } from '../../../types/models';
import type { Sale } from '../../../types/models';

const COLLECTION_NAME = 'orders';

// Generate unique order ID
const generateOrderId = (): string => {
  return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Generate human-readable order number
const generateOrderNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const sequence = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${year}${month}${day}-${sequence}`;
};

// Convert cart items to order items
const convertCartToOrderItems = (cartItems: CartItem[]): OrderItem[] => {
  return cartItems.map(item => ({
    productId: item.productId || '',
    name: item.name || '',
    price: item.price || 0,
    quantity: item.quantity || 0,
    image: item.image || '',
    category: item.category || '',
    selectedColor: item.selectedColor || '',
    selectedSize: item.selectedSize || '',
    variations: {
      color: item.selectedColor || '',
      size: item.selectedSize || ''
    }
  }));
};

// Create initial order event
const createInitialOrderEvent = (userId: string, status: OrderStatus = 'commande', paymentStatus: PaymentStatus = 'pending'): OrderEvent => {
  return {
    id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'created',
    status,
    paymentStatus,
    timestamp: new Date(),
    userId: userId || '',
    metadata: {}
  };
};

// Create order in Firestore
export const createOrder = async (
  companyId: string,
  orderData: {
    customerInfo: CustomerInfo;
    cartItems: CartItem[];
    pricing: OrderPricing;
    paymentMethod: string;
    paymentOption?: string;
    paymentFormData?: Record<string, string>;
    deliveryInfo?: DeliveryInfo;
    metadata?: OrderMetadata;
    campayPaymentDetails?: CampayDetails;
  }
): Promise<Order> => {
  try {
    const orderId = generateOrderId();
    const orderNumber = generateOrderNumber();
    
    // Sanitize customer info to prevent undefined values
    // Support both new structure and legacy structure for backward compatibility
    const sanitizedCustomerInfo: CustomerInfo = {
      // Contact info
      name: orderData.customerInfo.name || '',
      phone: orderData.customerInfo.phone || '',
      quarter: orderData.customerInfo.quarter || orderData.customerInfo.location || '',
      email: orderData.customerInfo.email || '',
      // Delivery info
      deliveryName: orderData.customerInfo.deliveryName || orderData.customerInfo.name || '',
      deliveryPhone: orderData.customerInfo.deliveryPhone || orderData.customerInfo.phone || '',
      deliveryAddressLine1: orderData.customerInfo.deliveryAddressLine1 || orderData.customerInfo.address || orderData.customerInfo.location || '',
      deliveryAddressLine2: orderData.customerInfo.deliveryAddressLine2 || '',
      deliveryQuarter: orderData.customerInfo.deliveryQuarter || orderData.customerInfo.location || '',
      deliveryCity: orderData.customerInfo.deliveryCity || orderData.customerInfo.city || '',
      deliveryInstructions: orderData.customerInfo.deliveryInstructions || '',
      deliveryCountry: orderData.customerInfo.deliveryCountry || 'CM',
      // Legacy fields for backward compatibility
      location: orderData.customerInfo.deliveryQuarter || orderData.customerInfo.location || '',
      address: orderData.customerInfo.deliveryAddressLine1 || orderData.customerInfo.address || '',
      city: orderData.customerInfo.deliveryCity || orderData.customerInfo.city || '',
      zipCode: orderData.customerInfo.zipCode || ''
    };

    // Convert cart items to order items
    const orderItems = convertCartToOrderItems(orderData.cartItems);
    
    // Sanitize pricing to prevent undefined values
    const sanitizedPricing: OrderPricing = {
      subtotal: orderData.pricing.subtotal || 0,
      deliveryFee: orderData.pricing.deliveryFee || 0,
      tax: orderData.pricing.tax || 0,
      discount: orderData.pricing.discount || 0,
      total: orderData.pricing.total || 0
    };

    // Check stock availability for all items (without debiting)
    for (const item of orderData.cartItems) {
      const productRef = doc(db, 'products', item.productId);
      const productSnap = await getDoc(productRef);
      
      if (!productSnap.exists()) {
        throw new Error(`Product with ID ${item.productId} not found`);
      }
      
      const productData = productSnap.data() as Product;
      if (productData.companyId !== companyId) {
        throw new Error(`Unauthorized to order product ${productData.name}`);
      }
      
      // Check available stock from batches (without debiting)
      const availableBatches = await getAvailableStockBatches(
        item.productId,
        companyId,
        'product'
      );
      const availableStock = availableBatches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
      
      if (availableStock < item.quantity) {
        throw new Error(`Insufficient stock for product ${productData.name}. Available: ${availableStock}, Requested: ${item.quantity}`);
      }
    }

    // Determine initial status: always 'commande' for orders created from catalogue
    // Stock is NOT debited at this stage
    const isCampayPaymentSuccessful = orderData.paymentMethod === 'campay' && 
                                      orderData.campayPaymentDetails?.status === 'SUCCESS';
    const initialStatus: OrderStatus = 'commande';
    
    // For Campay: if campayPaymentDetails is provided with status 'SUCCESS', payment is already completed
    // For CinetPay: payment status starts as 'awaiting_payment' since payment happens after order creation
    // For pay_onsite: payment is pending
    const initialPaymentStatus: PaymentStatus = 
      orderData.paymentMethod === 'pay_onsite' ? 'pending' : 
      isCampayPaymentSuccessful ? 'paid' :
      (orderData.paymentMethod === 'campay' || orderData.paymentMethod?.startsWith('cinetpay_')) ? 'awaiting_payment' :
      'awaiting_payment';

    // Get userId from orderData metadata if available, otherwise use companyId
    const userId = orderData.metadata?.userId || companyId;
    
    // Create initial order event with correct status
    const initialEvent = createInitialOrderEvent(userId, initialStatus, initialPaymentStatus);

    // Sanitize delivery info
    const sanitizedDeliveryInfo: DeliveryInfo = {
      method: orderData.deliveryInfo?.method || 'delivery',
      address: orderData.deliveryInfo?.address || '',
      instructions: orderData.deliveryInfo?.instructions || ''
    };

    // Only add optional fields if they have values
    if (orderData.deliveryInfo?.scheduledDate) {
      sanitizedDeliveryInfo.scheduledDate = orderData.deliveryInfo.scheduledDate;
    }
    if (orderData.deliveryInfo?.deliveredAt) {
      sanitizedDeliveryInfo.deliveredAt = orderData.deliveryInfo.deliveredAt;
    }

    // Sanitize metadata
    const sanitizedMetadata: OrderMetadata = {
      source: orderData.metadata?.source || 'catalogue',
      ipAddress: orderData.metadata?.ipAddress || '',
      userAgent: orderData.metadata?.userAgent || '',
      referrer: orderData.metadata?.referrer || '',
      deviceInfo: orderData.metadata?.deviceInfo || {
        type: 'desktop',
        os: '',
        browser: ''
      }
    };

    // Get createdBy from metadata if provided
    const createdBy = orderData.metadata?.createdBy;
    
    // Create order document
    const orderDoc: any = {
      orderId: orderId || '',
      orderNumber: orderNumber || '',
      customerInfo: sanitizedCustomerInfo,
      items: orderItems,
      pricing: sanitizedPricing,
      orderType: 'online' as const,
      status: initialStatus,
      paymentStatus: initialPaymentStatus,
      paymentMethod: orderData.paymentMethod as any,
      deliveryInfo: sanitizedDeliveryInfo,
      timeline: [initialEvent],
      metadata: sanitizedMetadata,
      userId: userId || '',
      companyId: companyId, // Ensure companyId is set
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Add createdBy if provided
    if (createdBy) {
      orderDoc.createdBy = createdBy;
    }

    // Add Campay payment details if provided
    if (orderData.campayPaymentDetails) {
      orderDoc.campayPaymentDetails = {
        reference: orderData.campayPaymentDetails.reference || '',
        transactionId: orderData.campayPaymentDetails.transactionId || '',
        campayStatus: orderData.campayPaymentDetails.campayStatus || '',
        status: orderData.campayPaymentDetails.status || '',
        paidAt: orderData.campayPaymentDetails.paidAt ? Timestamp.fromDate(orderData.campayPaymentDetails.paidAt) : null,
        paymentMethod: orderData.campayPaymentDetails.paymentMethod || '',
        amount: orderData.campayPaymentDetails.amount || 0,
        currency: orderData.campayPaymentDetails.currency || 'XAF',
        metadata: orderData.campayPaymentDetails.metadata || {}
      };
    }

    const docRef = await addDoc(collection(db, COLLECTION_NAME), orderDoc);
    
    const createdOrder = {
      id: docRef.id,
      ...orderDoc,
      createdAt: new Date(),
      updatedAt: new Date()
    } as Order;

    // If order is paid, create finance entry with isPending: true (stock not debited yet)
    if (initialPaymentStatus === 'paid') {
      try {
        await syncFinanceEntryWithOrder(createdOrder);
        // Mark finance entry as pending since stock is not debited yet
        const financeQuery = query(
          collection(db, 'finances'),
          where('sourceType', '==', 'order'),
          where('sourceId', '==', createdOrder.id)
        );
        const financeSnap = await getDocs(financeQuery);
        if (!financeSnap.empty) {
          const financeDoc = financeSnap.docs[0];
          await updateDoc(doc(db, 'finances', financeDoc.id), {
            isPending: true,
            description: `Order ${createdOrder.orderNumber} (Pending conversion) - ${createdOrder.customerInfo.name}`
          });
        }
      } catch (error) {
        logError('Error creating finance entry for paid order', error);
        // Don't throw - order was created successfully
      }
    }
    
    return createdOrder;
  } catch (error) {
    logError('Error creating order', error);
    throw error;
  }
};

// Get order by ID
export const getOrderById = async (orderId: string): Promise<Order | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, orderId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as Order;
    }
    
    return null;
  } catch (error) {
    logError('Error getting order', error);
    throw error;
  }
};

// Subscribe to orders for a company
export const subscribeToOrders = (
  companyId: string, 
  callback: (orders: Order[]) => void,
  filters?: OrderFilters,
  limitCount?: number
): Unsubscribe => {
  const defaultLimit = 100; // OPTIMIZATION: Default limit to reduce Firebase reads
  let q = query(
    collection(db, COLLECTION_NAME),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );

  // Apply filters if provided
  if (filters?.status && filters.status.length > 0) {
    q = query(q, where('status', 'in', filters.status));
  }
  
  if (filters?.paymentStatus && filters.paymentStatus.length > 0) {
    q = query(q, where('paymentStatus', 'in', filters.paymentStatus));
  }

  if (filters?.paymentMethod && filters.paymentMethod.length > 0) {
    q = query(q, where('paymentMethod', 'in', filters.paymentMethod));
  }

  if (filters?.dateFrom) {
    q = query(q, where('createdAt', '>=', Timestamp.fromDate(filters.dateFrom)));
  }

  if (filters?.dateTo) {
    q = query(q, where('createdAt', '<=', Timestamp.fromDate(filters.dateTo)));
  }

  // Add limit at the end (after all filters)
  q = query(q, limit(limitCount || defaultLimit));

  return onSnapshot(q, (snapshot) => {
    const orders: Order[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      orders.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as Order);
    });
    callback(orders);
  }, (error) => {
    console.error('Error subscribing to orders:', error);
    callback([]);
  });
};

// Update order status
export const updateOrderStatus = async (
  orderId: string, 
  status: OrderStatus,
  companyId: string,
  note?: string
): Promise<void> => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    const orderSnap = await getDoc(orderRef);
    
    if (!orderSnap.exists()) {
      throw new Error('Order not found');
    }
    
    const order = orderSnap.data() as Order;
    // Verify companyId matches
    if (order.companyId !== companyId) {
      throw new Error('Unauthorized: Order belongs to different company');
    }
    
    // Get userId from order for audit
    const userId = order.userId || companyId;
    
    // Create status change event
    const statusEvent: OrderEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'status_changed',
      status,
      timestamp: new Date(),
      userId,
      metadata: note ? { note } : {} // Only include note if it exists
    };

    // Prepare update data
    const updateData: any = {
      status,
      updatedAt: serverTimestamp(),
      timeline: arrayUnion({
        ...statusEvent,
        timestamp: Timestamp.fromDate(statusEvent.timestamp) // Convert Date to Timestamp for Firestore
      })
    };

    // If status is "delivered", set deliveredAt in deliveryInfo
    if (status === 'delivered') {
      const currentDeliveryInfo = order.deliveryInfo || { method: 'delivery' };
      updateData.deliveryInfo = {
        ...currentDeliveryInfo,
        deliveredAt: Timestamp.fromDate(new Date()) // Convert Date to Timestamp for Firestore
      };
    }

    // If status is "cancelled", add cancellation timestamp to metadata
    if (status === 'cancelled') {
      const currentMetadata = order.metadata || {};
      updateData.metadata = {
        ...currentMetadata,
        cancelledAt: Timestamp.fromDate(new Date()) // Convert Date to Timestamp for Firestore
      };
    }

    // Update order with new status and event
    await updateDoc(orderRef, updateData);
  } catch (error) {
    logError('Error updating order status', error);
    throw error;
  }
};

// Sync finance entry with order payment
const syncFinanceEntryWithOrder = async (order: Order): Promise<void> => {
  try {
    // Only create finance entry if order is paid
    if (order.paymentStatus !== 'paid') {
      return;
    }

    if (!order || !order.id || !order.userId || !order.companyId) {
      logError('syncFinanceEntryWithOrder: Invalid order object received, skipping sync');
      return;
    }

    // Find existing finance entry for this order
    const q = query(
      collection(db, 'finances'), 
      where('sourceType', '==', 'order'), 
      where('sourceId', '==', order.id)
    );
    const snap = await getDocs(q);
    
    // Convert order createdAt to Timestamp if it's a Date
    let orderDate: Timestamp;
    if (order.createdAt instanceof Date) {
      orderDate = Timestamp.fromDate(order.createdAt);
    } else if (order.createdAt && typeof order.createdAt === 'object' && 'seconds' in order.createdAt) {
      orderDate = order.createdAt as Timestamp;
    } else {
      orderDate = Timestamp.now();
    }
    
    const entry: Omit<import('../../../types/models').FinanceEntry, 'id' | 'createdAt' | 'updatedAt'> = {
      userId: order.userId,
      companyId: order.companyId,
      sourceType: 'order',
      sourceId: order.id,
      type: 'sale', // Use 'sale' type for orders (revenue)
      amount: order.pricing.total,
      description: `Order ${order.orderNumber} - ${order.customerInfo.name}`,
      date: orderDate,
      isDeleted: false,
    };
    
    if (snap.empty) {
      await createFinanceEntry(entry);
    } else {
      const docId = snap.docs[0].id;
      await updateFinanceEntry(docId, entry);
    }
  } catch (error) {
    logError('Error syncing finance entry with order', error);
    // Don't throw - allow order update to succeed even if finance sync fails
  }
};

// Update payment status
export const updateOrderPaymentStatus = async (
  orderId: string,
  paymentStatus: PaymentStatus,
  companyId: string,
  cinetpayTransactionId?: string,
  cinetpayStatus?: string,
  campayReference?: string,
  campayTransactionId?: string,
  campayStatus?: string,
  campayPaymentMethod?: string
): Promise<void> => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    const orderSnap = await getDoc(orderRef);
    
    if (!orderSnap.exists()) {
      throw new Error('Order not found');
    }
    
    const order = orderSnap.data() as Order;
    // Verify companyId matches
    if (order.companyId !== companyId) {
      throw new Error('Unauthorized: Order belongs to different company');
    }
    
    // Get userId from order for audit
    const userId = order.userId || companyId;
    const previousPaymentStatus = order.paymentStatus;
    
    // Create payment update event
    const paymentEvent: OrderEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'payment_updated',
      paymentStatus,
      timestamp: new Date(),
      userId,
      metadata: { 
        ...(cinetpayTransactionId && { cinetpayTransactionId }),
        ...(cinetpayStatus && { cinetpayStatus }),
        ...(campayReference && { campayReference }),
        ...(campayTransactionId && { campayTransactionId }),
        ...(campayStatus && { campayStatus }),
        ...(campayPaymentMethod && { campayPaymentMethod })
      }
    };

    const updateData: any = {
      paymentStatus,
      updatedAt: serverTimestamp(),
      timeline: arrayUnion({
        ...paymentEvent,
        timestamp: Timestamp.fromDate(paymentEvent.timestamp) // Convert Date to Timestamp for Firestore
      })
    };

    // If payment status changes from awaiting_payment to paid:
    // 1. Update order status to 'confirmed' (if current status is pending)
    // 2. Finance entry will be created after update (see below)
    if (previousPaymentStatus === 'awaiting_payment' && paymentStatus === 'paid') {
      // Update order status to confirmed if it's currently pending
      if (order.status === 'pending') {
        updateData.status = 'confirmed';
      }
    }

    // If payment status is 'paid' and order status is 'pending', also update order status to 'confirmed'
    if (paymentStatus === 'paid' && order.status === 'pending') {
      updateData.status = 'confirmed';
    }

    // Add CinetPay details if provided
    if (cinetpayTransactionId || cinetpayStatus) {
      const currentPaymentDetails = order.paymentDetails || {};
      updateData.paymentDetails = {
        ...currentPaymentDetails,
        ...(cinetpayTransactionId && { cinetpayTransactionId }),
        ...(cinetpayStatus && { cinetpayStatus })
      };
    }

    // Add Campay details if provided
    if (campayReference || campayTransactionId || campayStatus) {
      const currentCampayDetails = order.campayPaymentDetails || {};
      updateData.campayPaymentDetails = {
        ...currentCampayDetails,
        ...(campayReference && { reference: campayReference }),
        ...(campayTransactionId && { transactionId: campayTransactionId }),
        ...(campayStatus && { campayStatus, status: campayStatus }),
        ...(campayPaymentMethod && { paymentMethod: campayPaymentMethod }),
        ...(paymentStatus === 'paid' && { paidAt: Timestamp.fromDate(new Date()) })
      };
    }

    await updateDoc(orderRef, updateData);

    // Create finance entry if payment is now paid (after successful order update)
    if (previousPaymentStatus === 'awaiting_payment' && paymentStatus === 'paid') {
      // Get updated order data for finance sync
      const updatedOrderSnap = await getDoc(orderRef);
      if (updatedOrderSnap.exists()) {
        const updatedOrder = {
          ...order,
          ...updatedOrderSnap.data(),
          id: updatedOrderSnap.id
        } as Order;
        await syncFinanceEntryWithOrder(updatedOrder);
      }
    }
  } catch (error) {
    logError('Error updating payment status', error);
    throw error;
  }
};

// Add note to order
export const addOrderNote = async (
  orderId: string,
  _note: string,
  companyId: string
): Promise<void> => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    const orderSnap = await getDoc(orderRef);
    
    if (!orderSnap.exists()) {
      throw new Error('Order not found');
    }
    
    const order = orderSnap.data() as Order;
    // Verify companyId matches
    if (order.companyId !== companyId) {
      throw new Error('Unauthorized: Order belongs to different company');
    }

    await updateDoc(orderRef, {
      updatedAt: serverTimestamp()
      // Note: In a real implementation, you'd use arrayUnion to add the event with note
    });
  } catch (error) {
    console.error('Error adding order note:', error);
    throw error;
  }
};

// Get order statistics
export const getOrderStats = async (companyId: string): Promise<OrderStats> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('companyId', '==', companyId)
    );
    
    const snapshot = await getDocs(q);
    const orders: Order[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      orders.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as Order);
    });

    // Calculate statistics
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const completedOrders = orders.filter(o => o.status === 'delivered').length;
    const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
    const totalRevenue = orders
      .filter(o => o.paymentStatus === 'paid')
      .reduce((sum, o) => sum + o.pricing.total, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Orders by status
    const ordersByStatus = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<OrderStatus, number>);

    // Orders by payment method
    const ordersByPaymentMethod = orders.reduce((acc, order) => {
      acc[order.paymentMethod] = (acc[order.paymentMethod] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Recent orders (last 10)
    const recentOrders = orders
      .sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      })
      .slice(0, 10);

    return {
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      totalRevenue,
      averageOrderValue,
      ordersByStatus,
      ordersByPaymentMethod: ordersByPaymentMethod as any,
      recentOrders
    };
  } catch (error) {
    logError('Error getting order stats', error);
    throw error;
  }
};

// Generate and save purchase order number
export const generatePurchaseOrderNumber = async (
  orderId: string,
  companyId: string
): Promise<string> => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    const orderSnap = await getDoc(orderRef);
    
    if (!orderSnap.exists()) {
      throw new Error('Order not found');
    }
    
    const orderData = orderSnap.data() as Order;
    if (orderData.companyId !== companyId) {
      throw new Error('Unauthorized to update this order');
    }
    
    // If purchase order number already exists, return it
    if (orderData.purchaseOrderNumber) {
      return orderData.purchaseOrderNumber;
    }
    
    // Generate new purchase order number (BC-YYYY-NNNN)
    const now = new Date();
    const year = now.getFullYear();
    
    // Get count of purchase orders for this year to generate sequence
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);
    
    const q = query(
      collection(db, COLLECTION_NAME),
      where('companyId', '==', companyId),
      where('purchaseOrderNumber', '!=', null),
      where('createdAt', '>=', Timestamp.fromDate(yearStart)),
      where('createdAt', '<', Timestamp.fromDate(yearEnd))
    );
    
    const snapshot = await getDocs(q);
    const sequenceNumber = snapshot.size + 1;
    const purchaseOrderNumber = `BC-${year}-${String(sequenceNumber).padStart(4, '0')}`;
    
    // Update order with purchase order number
    await updateDoc(orderRef, {
      purchaseOrderNumber,
      updatedAt: serverTimestamp()
    });
    
    return purchaseOrderNumber;
  } catch (error) {
    logError('Error generating purchase order number', error);
    throw error;
  }
};

// Delete order
export const deleteOrder = async (
  orderId: string,
  userId: string
): Promise<void> => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    const orderDoc = await getDoc(orderRef);
    
    if (!orderDoc.exists()) {
      throw new Error('Order not found');
    }
    
    const orderData = orderDoc.data() as Order;
    
    // Verify ownership
    if (orderData.userId !== userId) {
      throw new Error('Unauthorized to delete this order');
    }
    
    // Option 1: Soft delete - mark as deleted (recommended for data retention)
    // Note: Cancellation event would be added to timeline in a real implementation
    // const cancelEvent: OrderEvent = {
    //   id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    //   type: 'cancelled',
    //   status: 'cancelled',
    //   timestamp: new Date(),
    //   userId: orderData.userId,
    //   metadata: { note: 'Order deleted by user' }
    // };
    // await updateDoc(orderRef, {
    //   status: 'cancelled',
    //   deletedAt: serverTimestamp(),
    //   updatedAt: serverTimestamp(),
    //   timeline: [cancelEvent]
    // });
    
    // Option 2: Hard delete - actually remove from database
    await deleteDoc(orderRef);
  } catch (error) {
    logError('Error deleting order', error);
    throw error;
  }
};

/**
 * Convert order to sale
 * Creates a sale from order data, debits stock according to sale status, creates finance entry if paid
 * @param orderId - Order ID to convert
 * @param saleStatus - Status for the created sale ('paid', 'credit', 'commande', 'under_delivery')
 * @param companyId - Company ID
 * @param userId - User ID performing the conversion
 * @param createdBy - Employee reference who is converting
 * @param paymentMethod - Payment method if sale status is 'paid' ('cash', 'mobile_money', 'card')
 * @param creditDueDate - Optional due date if sale status is 'credit'
 * @returns Created sale
 */
export const convertOrderToSale = async (
  orderId: string,
  saleStatus: 'paid' | 'credit' | 'commande' | 'under_delivery',
  companyId: string,
  userId: string,
  createdBy?: import('../../../types/models').EmployeeRef | null,
  paymentMethod?: 'cash' | 'mobile_money' | 'card',
  creditDueDate?: Date
): Promise<Sale> => {
  try {
    // Get order
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    const orderSnap = await getDoc(orderRef);
    
    if (!orderSnap.exists()) {
      throw new Error('Order not found');
    }
    
    const order = { id: orderSnap.id, ...orderSnap.data() } as Order;
    
    // Verify companyId matches
    if (order.companyId !== companyId) {
      throw new Error('Unauthorized to convert this order');
    }
    
    // Check if order is already converted
    if (order.status === 'converted' || order.convertedToSaleId) {
      throw new Error('Order is already converted to sale');
    }
    
    // Check if order is cancelled
    if (order.status === 'cancelled') {
      throw new Error('Cannot convert cancelled order');
    }
    
    // Validate stock availability for all items
    for (const item of order.items) {
      const productRef = doc(db, 'products', item.productId);
      const productSnap = await getDoc(productRef);
      
      if (!productSnap.exists()) {
        throw new Error(`Product with ID ${item.productId} not found`);
      }
      
      const productData = productSnap.data() as Product;
      if (productData.companyId !== companyId) {
        throw new Error(`Unauthorized to sell product ${productData.name}`);
      }
      
      // Check available stock from batches
      const availableBatches = await getAvailableStockBatches(
        item.productId,
        companyId,
        'product'
      );
      const availableStock = availableBatches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
      
      if (availableStock < item.quantity) {
        throw new Error(`Insufficient stock for product ${productData.name}. Available: ${availableStock}, Requested: ${item.quantity}`);
      }
    }
    
    // Map order items to sale products
    const saleProducts = order.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      basePrice: item.price,
      negotiatedPrice: item.price
    }));
    
    // Determine payment status based on sale status
    const paymentStatus: 'pending' | 'paid' | 'cancelled' = 
      saleStatus === 'paid' ? 'paid' :
      saleStatus === 'credit' ? 'pending' :
      'pending';
    
    // Prepare sale data
    const saleData: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'> = {
      products: saleProducts as any,
      totalAmount: order.pricing.total,
      status: saleStatus,
      paymentStatus,
      customerInfo: {
        name: order.customerInfo.name || 'Client de passage',
        phone: order.customerInfo.phone || '',
        quarter: order.customerInfo.quarter || order.customerInfo.location || ''
      },
      deliveryFee: order.pricing.deliveryFee || 0,
      inventoryMethod: 'FIFO', // Default, can be customized
      userId,
      companyId,
      saleDate: order.createdAt instanceof Date 
        ? order.createdAt.toISOString() 
        : new Date((order.createdAt as any).seconds * 1000).toISOString()
    };
    
    // Add payment method if paid
    if (saleStatus === 'paid' && paymentMethod) {
      saleData.paymentMethod = paymentMethod;
    }
    
    // Add credit fields if credit sale
    if (saleStatus === 'credit') {
      saleData.remainingAmount = order.pricing.total;
      saleData.paidAmount = 0;
      if (creditDueDate) {
        saleData.creditDueDate = Timestamp.fromDate(creditDueDate);
      }
    }
    
    // Create customer in company database when converting order to sale
    // This is the only time we create the customer - not during order creation
    if (order.customerInfo.phone && userId) {
      try {
        await ensureCustomerExists(
          {
            phone: order.customerInfo.phone,
            name: order.customerInfo.name || 'Client de passage',
            quarter: order.customerInfo.quarter || order.customerInfo.location || '',
            address: order.customerInfo.deliveryAddressLine1 || order.customerInfo.address,
            city: order.customerInfo.deliveryCity || order.customerInfo.city,
            email: order.customerInfo.email
          },
          companyId,
          userId
        );
      } catch (error) {
        logError('Error ensuring customer exists during order conversion', error);
        // Don't throw - continue with sale creation even if customer creation fails
      }
    }
    
    // Create sale (will handle stock debiting based on status)
    const createdSale = await createSale(saleData, companyId, createdBy);
    
    // Update order to mark as converted
    await updateDoc(orderRef, {
      status: 'converted' as OrderStatus,
      convertedToSaleId: createdSale.id,
      updatedAt: serverTimestamp(),
      timeline: arrayUnion({
        id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'status_changed',
        status: 'converted',
        timestamp: new Date(),
        userId,
        metadata: { convertedToSaleId: createdSale.id }
      } as OrderEvent)
    });
    
    // Update finance entry if order was paid (remove isPending flag)
    if (order.paymentStatus === 'paid') {
      try {
        const financeQuery = query(
          collection(db, 'finances'),
          where('sourceType', '==', 'order'),
          where('sourceId', '==', order.id)
        );
        const financeSnap = await getDocs(financeQuery);
        if (!financeSnap.empty) {
          const financeDoc = financeSnap.docs[0];
          await updateDoc(doc(db, 'finances', financeDoc.id), {
            isPending: false,
            description: `Order ${order.orderNumber} (Converted to sale) - ${order.customerInfo.name}`
          });
        }
      } catch (error) {
        logError('Error updating finance entry after conversion', error);
        // Don't throw - sale was created successfully
      }
    }
    
    return createdSale;
  } catch (error) {
    logError('Error converting order to sale', error);
    throw error;
  }
};