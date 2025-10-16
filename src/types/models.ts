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
  // Color customization for catalogue
  primaryColor?: string; // Primary brand color (default: #183524)
  secondaryColor?: string; // Secondary brand color (default: #e2b069)
  tertiaryColor?: string; // Tertiary/accent color (default: #2a4a3a)
}

export interface Category extends BaseModel {
  name: string;
  description?: string;
  productCount?: number;
}

export interface Product extends BaseModel {
  costPrice: number;
  name: string;
  reference: string;
  sellingPrice: number;
  cataloguePrice?: number;
  stock: number;
  category: string;
  images?: string[]; // Now stores Firebase Storage URLs instead of base64
  imagePaths?: string[]; // Optional: store storage paths for deletion
  migratedAt?: Date; // Track migration status
  isAvailable: boolean;
  isDeleted?: boolean;
  isVisible?: boolean; // Controls visibility in catalogue (default: true)
  inventoryMethod?: 'FIFO' | 'LIFO';
  enableBatchTracking?: boolean;
  tags?: ProductTag[]; // Dynamic product tags for variations
}

export interface ProductTag {
  id: string;
  name: string; // e.g., "Model", "Color", "Size", "Material"
  variations: TagVariation[];
}

export interface TagVariation {
  id: string;
  name: string; // e.g., "N1", "N2", "Red", "Blue", "Large"
  imageIndex?: number; // Which image in the images array corresponds to this variation
}

export interface SaleProduct {
  productId: string;
  quantity: number;
  basePrice: number; // Selling price
  negotiatedPrice?: number;
  costPrice: number; // Cost price at time of sale (NEW!)
  batchId?: string; // Which batch this came from (NEW!)
  profit: number; // Calculated profit (NEW!)
  profitMargin: number; // Profit margin percentage (NEW!)
  consumedBatches?: Array<{
    batchId: string;
    costPrice: number;
    consumedQuantity: number;
    profit: number;
  }>;
  batchLevelProfits?: Array<{
    batchId: string;
    costPrice: number;
    consumedQuantity: number;
    profit: number;
  }>; // Detailed profit breakdown per batch (NEW!)
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
  inventoryMethod?: 'FIFO' | 'LIFO';
  totalCost?: number;
  totalProfit?: number;
  averageProfitMargin?: number;
}

export interface Expense extends BaseModel {
  description: string;
  amount: number;
  category: string;
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
  reason: 'sale' | 'restock' | 'adjustment' | 'creation' | 'cost_correction' | 'damage' | 'manual_adjustment';
  supplierId?: string; // Reference to supplier if applicable
  isOwnPurchase?: boolean; // true if own purchase, false if from supplier
  isCredit?: boolean; // true if on credit, false if paid (only relevant if from supplier)
  costPrice?: number; // Cost price for this stock entry (legacy, kept for backward compatibility)
  batchId?: string; // Reference to stock batch (legacy, kept for backward compatibility)
  saleId?: string; // Reference to sale if applicable
  createdAt: Timestamp;
  userId: string;
  // NEW: Detailed batch consumption tracking
  batchConsumptions?: Array<{
    batchId: string;
    costPrice: number;
    consumedQuantity: number;
    remainingQuantity: number; // remaining after this consumption
  }>;
}

// Stock batch for FIFO inventory tracking (NEW!)
export interface StockBatch {
  id: string;
  productId: string;
  quantity: number; // Total quantity in this batch
  costPrice: number; // Cost per unit for this batch
  supplierId?: string; // Reference to supplier if applicable
  isOwnPurchase?: boolean; // true if own purchase, false if from supplier
  isCredit?: boolean; // true if on credit, false if paid
  createdAt: Timestamp;
  updatedAt?: Timestamp; // Last update timestamp
  userId: string;
  remainingQuantity: number; // How many units left from this batch
  damagedQuantity?: number; // How many units damaged from this batch
  status: 'active' | 'depleted' | 'corrected'; // Batch status
  notes?: string; // Optional notes for the batch
}

export interface Supplier extends BaseModel {
  name: string;
  contact: string;
  location?: string;
  email?: string;
  notes?: string;
  isDeleted?: boolean;
}

export interface FinanceEntry {
  id: string;
  userId: string;
  sourceType: 'sale' | 'expense' | 'manual' | 'supplier';
  sourceId?: string; // saleId, expenseId, or supplierId if applicable
  type: string; // e.g., "sale", "expense", "loan", "deposit", "supplier_debt", "supplier_refund", etc.
  amount: number;
  description?: string;
  date: Timestamp;
  isDeleted: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  refundedDebtId?: string; // for refunds, links to a specific debt entry
  supplierId?: string; // for supplier-related entries
  batchId?: string; // for supplier debts, links to the specific stock batch
}

export interface FinanceEntryType {
  id: string;
  name: string;
  userId?: string; // undefined for default/global types
  isDefault: boolean;
  createdAt: Timestamp;
}

export interface ExpenseType {
  id: string;
  name: string;
  userId?: string; // undefined for default/global types
  isDefault: boolean;
  createdAt: Timestamp;
}

// Rest of the existing interfaces...