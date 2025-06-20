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
  stock: number;
  category: string;
  imageUrl?: string;
  isAvailable: boolean;
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
}

export interface Expense extends BaseModel {
  description: string;
  amount: number;
  category: 'delivery' | 'purchase' | 'other';
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

// Rest of the existing interfaces...