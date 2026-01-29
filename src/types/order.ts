import { BaseModel } from './models';

// Customer info structure (standard e-commerce structure)
export interface CustomerInfo {
  // === INFORMATIONS DE CONTACT (Identité du client) ===
  name: string;              // Nom complet - REQUIS
  phone: string;             // Téléphone - REQUIS
  quarter?: string;          // Quartier/résidence du client (optionnel)
  email?: string;            // Email (optionnel)
  
  // === INFORMATIONS DE LIVRAISON (Adresse de livraison) ===
  deliveryName?: string;     // Nom pour livraison (si différent) - modifiable
  deliveryPhone?: string;    // Téléphone pour livraison (si différent) - modifiable
  deliveryAddressLine1: string;  // Adresse ligne 1 (Rue + Numéro) - REQUIS
  deliveryAddressLine2?: string; // Adresse ligne 2 (Complément) - optionnel
  deliveryQuarter: string;   // Quartier/Zone de livraison - REQUIS
  deliveryCity?: string;     // Ville de livraison - optionnel
  deliveryInstructions?: string; // Instructions spéciales - optionnel
  deliveryCountry?: string;   // Pays (optionnel)
  
  // === CHAMPS LEGACY (pour compatibilité) ===
  surname?: string;          // Legacy - utiliser name à la place
  location?: string;         // Legacy - utiliser quarter pour contact, deliveryQuarter pour livraison
  address?: string;         // Legacy - utiliser deliveryAddressLine1
  city?: string;             // Legacy - utiliser deliveryCity
  country?: string;         // Legacy - utiliser deliveryCountry
  zipCode?: string;         // Legacy - non utilisé dans la nouvelle structure
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
  scheduledDate?: Date; // Planned delivery date
  deliveredAt?: Date; // Actual delivery date
  instructions?: string;
  alertSent?: boolean; // Whether delivery alert has been sent
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
// 'commande': Order created from catalogue (stock NOT debited)
// 'confirmed': Order confirmed by admin
// 'preparing': Order being prepared
// 'ready': Order ready for delivery
// 'delivered': Order delivered to customer
// 'converted': Order converted to sale
// 'cancelled': Order cancelled
export type OrderStatus = 'commande' | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'converted' | 'cancelled';

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

// Campay payment details
export interface CampayDetails {
  reference?: string;
  transactionId?: string;
  campayStatus?: string;
  status?: string;
  paidAt?: Date;
  paymentMethod?: string; // MTN, Orange, etc.
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
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
  campayPaymentDetails?: CampayDetails;
  deliveryInfo: DeliveryInfo;
  timeline: OrderEvent[];            // Complete order history
  metadata: OrderMetadata;
  convertedToSaleId?: string;        // ID of sale created when order is converted (if converted)
  purchaseOrderNumber?: string;       // Purchase order number (BC-YYYY-NNNN) if purchase order generated
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

// Payment method types (legacy)
export type PaymentMethodType = 'phone' | 'ussd' | 'link' | 'mtn_money' | 'orange_money' | 'visa_card' | 'pay_onsite' | 'cinetpay_mobile_money' | 'cinetpay_credit_card' | 'cinetpay_wallet' | 'campay';

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
