import { BaseModel } from './models';

// Customer info structure (following documentation)
export interface CustomerInfo {
  name: string;
  surname?: string;
  phone: string;
  location: string;
  deliveryInstructions?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  zipCode?: string;
}

// Order item interface for order line items
export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  category: string;
  selectedColor?: string;
  selectedSize?: string;
  variations?: {
    color?: string;
    size?: string;
  };
}

// Order pricing breakdown
export interface OrderPricing {
  subtotal: number;
  deliveryFee: number;
  tax?: number;
  discount?: number;
  total: number;
}

// Order delivery information
export interface DeliveryInfo {
  method: 'pickup' | 'delivery';
  address?: string;
  scheduledDate?: Date;
  deliveredAt?: Date;
  instructions?: string;
}

// Order event for timeline tracking
export interface OrderEvent {
  id: string;
  type: 'created' | 'status_changed' | 'payment_updated' | 'note_added' | 'cancelled';
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  note?: string;
  timestamp: Date;
  userId: string;
  metadata?: Record<string, unknown>;
}

// Order status types
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

// Payment status types
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'awaiting_payment' | 'awaiting_cinetpay_payment' | 'cancelled';

// Payment method types for orders
export type OrderPaymentMethod = 'onsite' | 'online' | 'whatsapp';

// CinetPay payment details (for future integration)
export interface CinetPayDetails {
  transactionId?: string;
  cinetpayTransactionId?: string;
  cinetpayStatus?: string;
  status?: string;
  paymentUrl?: string;
  paidAt?: Date;
  method?: string;
  operatorId?: string;
  channel?: string;
  operator?: string;
}

// Order metadata
export interface OrderMetadata {
  source: 'catalogue' | 'admin';
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  deviceInfo?: {
    type: 'mobile' | 'tablet' | 'desktop';
    os?: string;
    browser?: string;
  };
  userId?: string; // Legacy field
  createdBy?: import('./models').EmployeeRef; // Employee who created the order
}

// Main Order interface
export interface Order extends BaseModel {
  orderId: string;                    // Unique order identifier
  orderNumber: string;                // Human-readable order number (ORD-2024-001)
  customerInfo: CustomerInfo;
  items: OrderItem[];                 // Order line items
  pricing: OrderPricing;
  orderType: 'whatsapp' | 'online';  // Order source
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: OrderPaymentMethod;
  paymentDetails?: CinetPayDetails;
  deliveryInfo: DeliveryInfo;
  timeline: OrderEvent[];            // Complete order history
  metadata: OrderMetadata;
}

// Order filters for admin interface
export interface OrderFilters {
  status?: OrderStatus[];
  paymentStatus?: PaymentStatus[];
  paymentMethod?: OrderPaymentMethod[];
  dateFrom?: Date;
  dateTo?: Date;
  search?: string; // Search by order number, customer name, or phone
}

// Order statistics for dashboard
export interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<OrderStatus, number>;
  ordersByPaymentMethod: Record<OrderPaymentMethod, number>;
  recentOrders: Order[];
}

// Order structure for WhatsApp integration (legacy)
export interface OrderData {
  customerInfo: CustomerInfo;
  cartItems: CartItem[];
  totalAmount: number;
  deliveryFee?: number;
  finalTotal: number;
  orderId: string;
  timestamp: Date;
}

// Cart item interface (from existing cart context)
export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  category: string;
  selectedColor?: string;
  selectedSize?: string;
}

// Payment method types
// Note: 'mtn_money', 'orange_money', 'visa_card' are deprecated - they don't process payments
// Only 'pay_onsite' (cash on delivery) and CinetPay methods are actively used
export type PaymentMethodType = 'phone' | 'ussd' | 'link' | 'mtn_money' | 'orange_money' | 'visa_card' | 'pay_onsite' | 'cinetpay_mobile_money' | 'cinetpay_credit_card' | 'cinetpay_wallet';

export interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  value: string; // phone number, USSD code, or URL
  isActive: boolean;
  createdAt: Date;
}

// Seller settings structure (for Phase 4)
export interface SellerSettings {
  whatsappNumber: string;
  businessName: string;
  paymentMethods: {
    mobileMoney?: boolean;
    bankTransfer?: boolean;
    cashOnDelivery?: boolean;
    customMethods?: PaymentMethod[]; // Dynamic payment methods
  };
  deliveryFee?: number;
  currency: string;
}
