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
  CartItem
} from '../../../types/order';
import { logError } from '@utils/core/logger';
import { createFinanceEntry, updateFinanceEntry } from '../finance/financeService';

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
const createInitialOrderEvent = (userId: string): OrderEvent => {
  return {
    id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'created',
    status: 'pending',
    paymentStatus: 'pending',
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
  }
): Promise<Order> => {
  try {
    const orderId = generateOrderId();
    const orderNumber = generateOrderNumber();
    
    // Sanitize customer info to prevent undefined values
    const sanitizedCustomerInfo: CustomerInfo = {
      name: orderData.customerInfo.name || '',
      phone: orderData.customerInfo.phone || '',
      location: orderData.customerInfo.location || '',
      deliveryInstructions: orderData.customerInfo.deliveryInstructions || '',
      email: orderData.customerInfo.email || '',
      address: orderData.customerInfo.address || '',
      city: orderData.customerInfo.city || '',
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

    // Determine initial status based on payment method
    const initialStatus: OrderStatus = 'pending';
    const initialPaymentStatus: PaymentStatus = orderData.paymentMethod === 'pay_onsite' ? 'pending' : 'awaiting_payment';

    // Get userId from orderData metadata if available, otherwise use companyId
    const userId = orderData.metadata?.userId || companyId;
    
    // Create initial order event
    const initialEvent = createInitialOrderEvent(userId);

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

    const docRef = await addDoc(collection(db, COLLECTION_NAME), orderDoc);
    
    return {
      id: docRef.id,
      ...orderDoc,
      createdAt: new Date(),
      updatedAt: new Date()
    } as Order;
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
  filters?: OrderFilters
): Unsubscribe => {
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
  cinetpayStatus?: string
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
        ...(cinetpayStatus && { cinetpayStatus })
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

    // Add CinetPay details if provided
    if (cinetpayTransactionId) {
      updateData['paymentDetails.cinetpayTransactionId'] = cinetpayTransactionId;
    }
    if (cinetpayStatus) {
      updateData['paymentDetails.cinetpayStatus'] = cinetpayStatus;
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