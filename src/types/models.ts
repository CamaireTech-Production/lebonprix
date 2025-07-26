export type Timestamp = {
  seconds: number;
  nanoseconds: number;
};

export interface BaseModel {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: string; // Reference to the user who owns this record
}

export interface Company extends BaseModel {
  name: string;
  logo?: string; // Base64 string for logo
  description?: string;
  phone: string;
  location?: string;
  email: string;
}

export interface Category extends BaseModel {
  name: string;
  description?: string;
  productCount?: number;
}

export interface Product extends BaseModel {
  name: string;
  reference: string;
  costPrice: number;
  sellingPrice: number;
  cataloguePrice?: number;
  stock: number;
  category: string;
  images?: string[];
  isAvailable: boolean;
  isDeleted?: boolean;
}

export interface SaleProduct {
  productId: string;
  quantity: number;
  basePrice: number;
  negotiatedPrice?: number;
}

export interface Sale extends BaseModel {
  products: SaleProduct[];
  totalAmount: number;
  status: 'commande' | 'under_delivery' | 'paid';
  paymentStatus: 'pending' | 'paid' | 'cancelled';
  customerInfo: {
    name: string;
    phone: string;
    quarter?: string;
  };
  deliveryFee?: number;
  statusHistory?: Array<{ status: string; timestamp: string }>;
  isAvailable?: boolean;
}

export interface Expense extends BaseModel {
  description: string;
  amount: number;
  category: 'transportation' | 'purchase' | 'other';
  isAvailable?: boolean;
}

export interface DashboardStats extends BaseModel {
  totalSales: number;
  totalExpenses: number;
  totalProfit: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
}

export type OrderStatus = 'commande' | 'under_delivery' | 'paid';
export type PaymentStatus = 'pending' | 'paid' | 'cancelled';

export interface SaleDetails extends Sale {
  statusHistory: Array<{ status: string; timestamp: string }>;
}

export interface Customer {
  id?: string;
  phone: string;
  name?: string;
  quarter?: string;
  userId: string;
  createdAt: Date;
}

export interface Objective extends BaseModel {
  title: string;
  description?: string;
  metric: string; // key of stat
  targetAmount: number;
  periodType: 'predefined' | 'custom';
  predefined?: string; // this_month, this_year, etc.
  startAt?: any; // Firebase Timestamp
  endAt?: any;
  userId: string;
  isAvailable?: boolean;
}

// Stock change event for product inventory tracking
export interface StockChange {
  id: string;
  productId: string;
  change: number; // + for restock, - for sale, etc.
  reason: 'sale' | 'restock' | 'adjustment';
  createdAt: Timestamp;
  userId: string;
}

export interface FinanceEntry {
  id: string;
  userId: string;
  sourceType: 'sale' | 'expense' | 'manual';
  sourceId?: string; // saleId or expenseId if applicable
  type: string; // e.g., "sale", "expense", "loan", "deposit", etc.
  amount: number;
  description?: string;
  date: Timestamp;
  isDeleted: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  refundedDebtId?: string; // NEW: for refunds, links to a specific debt entry
}

export interface FinanceEntryType {
  id: string;
  name: string;
  userId?: string; // undefined for default/global types
  isDefault: boolean;
  createdAt: Timestamp;
}

// Rest of the existing interfaces...