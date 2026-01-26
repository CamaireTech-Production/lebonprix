// POS Types for Restoflow Restaurant Management
import type { Dish, Category, Table, Order, OrderItem } from './index';
import type { Sale, SaleProduct, PaymentMethod, SaleStatus, PaymentStatus } from './geskap';
import type { Timestamp } from 'firebase/firestore';

// ============================================================
// CART TYPES
// ============================================================

export interface POSCartItem {
  dish: Dish;
  quantity: number;
  specialInstructions?: string;
  modifiedPrice?: number; // For special pricing/discounts on specific item
}

// ============================================================
// STATE TYPES
// ============================================================

export type POSOrderType = 'dine-in' | 'takeaway' | 'delivery';

export interface POSCustomerInfo {
  name: string;
  phone: string;
  location?: string; // For delivery
  address?: string;
}

export interface POSState {
  cart: POSCartItem[];
  customer: POSCustomerInfo | null;
  selectedTable: Table | null;
  searchQuery: string;
  selectedCategory: string | null;
  orderType: POSOrderType;
  tip: number;
  deliveryFee: number;
  notes: string;
}

// ============================================================
// PAYMENT TYPES
// ============================================================

export type POSPaymentMethod = 'cash' | 'card' | 'mobile_money';

export interface POSPaymentData {
  paymentMethod: POSPaymentMethod;
  amountReceived?: number; // For cash payments
  change?: number; // Calculated change for cash
  tip: number;
  transactionReference?: string; // For card/mobile money
  mobileMoneyPhone?: string; // For mobile money payments

  // Customer info
  customerName: string;
  customerPhone: string;
  customerLocation?: string;

  // Order info
  tableId?: string;
  tableNumber?: number;
  orderType: POSOrderType;
  specialInstructions?: string;

  // Optional
  printReceipt?: boolean;
  printKitchenTicket?: boolean;
}

// ============================================================
// ORDER TYPES (Extended for POS)
// ============================================================

export interface POSOrderItem extends OrderItem {
  specialInstructions?: string;
  modifiedPrice?: number;
}

export interface POSOrder extends Omit<Order, 'items'> {
  items: POSOrderItem[];
  tip?: number;
  orderType: POSOrderType;
  paymentMethod?: POSPaymentMethod;
  paidAt?: Timestamp;
  saleId?: string; // Link to Sale record when paid
  draftId?: string; // If resumed from draft
}

// ============================================================
// DRAFT TYPES
// ============================================================

export interface POSDraft {
  id: string;
  restaurantId: string;
  userId: string;
  cart: POSCartItem[];
  customer: POSCustomerInfo | null;
  tableId?: string;
  tableNumber?: number;
  orderType: POSOrderType;
  tip: number;
  deliveryFee: number;
  notes: string;
  createdAt: number; // Timestamp for sorting
  updatedAt: number;
}

// ============================================================
// KITCHEN TICKET TYPES
// ============================================================

export interface KitchenTicket {
  orderId: string;
  orderNumber: string;
  tableNumber?: number;
  orderType: POSOrderType;
  customerName?: string;
  items: KitchenTicketItem[];
  notes?: string;
  createdAt: Date;
  priority?: 'normal' | 'rush';
}

export interface KitchenTicketItem {
  name: string;
  quantity: number;
  specialInstructions?: string;
}

// ============================================================
// RECEIPT TYPES
// ============================================================

export interface POSReceipt {
  receiptNumber: string;
  restaurantName: string;
  restaurantLogo?: string;
  restaurantAddress?: string;
  restaurantPhone?: string;

  // Order details
  orderId: string;
  tableNumber?: number;
  orderType: POSOrderType;
  customerName?: string;

  // Items
  items: POSReceiptItem[];

  // Totals
  subtotal: number;
  tip: number;
  deliveryFee: number;
  total: number;

  // Payment
  paymentMethod: POSPaymentMethod;
  amountReceived?: number;
  change?: number;

  // Timestamps
  createdAt: Date;
  paidAt: Date;

  // Footer
  footerMessage?: string;
}

export interface POSReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specialInstructions?: string;
}

// ============================================================
// HOOK RETURN TYPE
// ============================================================

export interface POSCartTotals {
  subtotal: number;
  tip: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
}

export interface UseRestaurantPOSReturn {
  // State
  state: POSState;
  isSubmitting: boolean;
  isLoading: boolean;

  // Data
  dishes: Dish[];
  categories: Category[];
  tables: Table[];
  filteredDishes: Dish[];
  cartTotals: POSCartTotals;
  activeOrders: POSOrder[];
  drafts: POSDraft[];

  // Cart operations
  addToCart: (dish: Dish, quantity?: number, specialInstructions?: string) => void;
  updateCartItem: (dishId: string, updates: Partial<POSCartItem>) => void;
  updateCartQuantity: (dishId: string, quantity: number) => void;
  removeFromCart: (dishId: string) => void;
  clearCart: () => void;

  // Customer operations
  setCustomer: (customer: POSCustomerInfo | null) => void;
  clearCustomer: () => void;

  // Table operations
  selectTable: (table: Table | null) => void;

  // Order type & delivery
  setOrderType: (type: POSOrderType) => void;
  setDeliveryFee: (fee: number) => void;

  // Tip
  setTip: (tip: number) => void;

  // Notes
  setNotes: (notes: string) => void;

  // Search & Filter
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (categoryId: string | null) => void;

  // Order completion
  completeOrder: (paymentData: POSPaymentData) => Promise<{ order: POSOrder; sale?: Sale }>;

  // Draft management
  saveDraft: () => void;
  resumeDraft: (draft: POSDraft) => void;
  deleteDraft: (draftId: string) => void;

  // Printing
  printKitchenTicket: (order: POSOrder) => void;
  printReceipt: (order: POSOrder, sale: Sale) => void;
}

// ============================================================
// UTILITY TYPES
// ============================================================

export interface POSSettings {
  defaultOrderType: POSOrderType;
  defaultTip: number;
  enableTips: boolean;
  enableKitchenTickets: boolean;
  enableReceipts: boolean;
  autoSelectFirstTable: boolean;
  currency: string;
}

export const DEFAULT_POS_SETTINGS: POSSettings = {
  defaultOrderType: 'dine-in',
  defaultTip: 0,
  enableTips: true,
  enableKitchenTickets: true,
  enableReceipts: true,
  autoSelectFirstTable: false,
  currency: 'XAF',
};
