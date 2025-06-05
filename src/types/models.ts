export type Timestamp = {
  seconds: number;
  nanoseconds: number;
};

export interface BaseModel {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Category extends BaseModel {
  name: string;
  description?: string;
  createdBy: string;
  productCount?: number;
}

export interface Product extends BaseModel {
  name: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  category: string;
  imageUrl?: string;
  isAvailable: boolean;
}

export interface Sale extends BaseModel {
  productId: string;
  quantity: number;
  basePrice: number;
  negotiatedPrice?: number;
  totalAmount: number;
  status: 'commande' | 'under_delivery' | 'paid';
  paymentStatus: 'pending' | 'paid' | 'cancelled';
  customerInfo: {
    name: string;
    phone: string;
  };
  deliveryFee?: number; // Add deliveryFee property
  statusHistory?: Array<{ status: string; timestamp: string }>; // Optional statusHistory property
}

export interface Expense extends BaseModel {
  description: string;
  amount: number;
  category: 'delivery' | 'purchase' | 'other';
  createdBy: string;
}

export interface DashboardStats {
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

// Rest of the existing interfaces...