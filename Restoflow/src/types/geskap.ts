/**
 * Geskap Types for Restaurant Management
 * Adapted from Geskap ERP for restaurant-specific use
 */

export type Timestamp = {
  seconds: number;
  nanoseconds: number;
};

export interface BaseModel {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: string;
  restaurantId: string; // Changed from companyId for restaurant context
  createdBy?: EmployeeRef;
}

// ============================================================================
// CUSTOMER MANAGEMENT
// ============================================================================

export interface Customer {
  id?: string;
  phone: string;
  name?: string;
  quarter?: string;
  userId: string;
  restaurantId: string;
  createdAt: Timestamp;
  firstName?: string;
  lastName?: string;
  address?: string;
  town?: string;
  birthdate?: string;
  howKnown?: string;
  customerSourceId?: string;
  firstSourceId?: string;
}

export interface CustomerSource extends BaseModel {
  name: string;
  description?: string;
  color?: string;
  isActive: boolean;
}

// ============================================================================
// EXPENSE MANAGEMENT
// ============================================================================

export interface Expense extends BaseModel {
  description: string;
  amount: number;
  category: string;
  isAvailable?: boolean;
  date?: Timestamp;
  image?: string;
  imagePath?: string;
}

export interface ExpenseType {
  id: string;
  name: string;
  userId?: string;
  restaurantId?: string;
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// Default expense categories for restaurants
export const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'food_supplies', name: 'Food Supplies', isDefault: true },
  { id: 'beverages', name: 'Beverages', isDefault: true },
  { id: 'utilities', name: 'Utilities', isDefault: true },
  { id: 'rent', name: 'Rent', isDefault: true },
  { id: 'salaries', name: 'Salaries', isDefault: true },
  { id: 'equipment', name: 'Equipment', isDefault: true },
  { id: 'maintenance', name: 'Maintenance', isDefault: true },
  { id: 'marketing', name: 'Marketing', isDefault: true },
  { id: 'delivery', name: 'Delivery', isDefault: true },
  { id: 'other', name: 'Other', isDefault: true },
];

// ============================================================================
// SUPPLIER MANAGEMENT
// ============================================================================

export interface Supplier extends BaseModel {
  name: string;
  contact: string;
  location?: string;
  email?: string;
  notes?: string;
  isDeleted?: boolean;
}

export interface SupplierDebtEntry {
  id: string;
  type: 'debt' | 'refund';
  amount: number;
  description: string;
  batchId?: string;
  refundedDebtId?: string;
  createdAt: Timestamp;
}

export interface SupplierDebt extends BaseModel {
  supplierId: string;
  totalDebt: number;
  totalRefunded: number;
  outstanding: number;
  entries: SupplierDebtEntry[];
}

// ============================================================================
// INVENTORY / INGREDIENT MANAGEMENT
// ============================================================================

export interface Category extends BaseModel {
  name: string;
  description?: string;
  image?: string;
  imagePath?: string;
  type: 'product' | 'matiere';
  productCount?: number;
  matiereCount?: number;
  isActive?: boolean;
}

export interface Matiere extends BaseModel {
  name: string;
  description?: string;
  images?: string[];
  imagePaths?: string[];
  refCategorie?: string;
  refStock: string;
  unit?: string;
  costPrice: number;
  isDeleted?: boolean;
}

export interface CustomUnit extends BaseModel {
  value: string;
  label: string;
  isDeleted?: boolean;
}

export interface Stock {
  id: string;
  type: 'product' | 'matiere';
  productId?: string;
  matiereId?: string;
  quantity: number;
  restaurantId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StockBatch {
  id: string;
  type: 'product' | 'matiere';
  productId?: string;
  matiereId?: string;
  quantity: number;
  costPrice: number;
  supplierId?: string;
  isOwnPurchase?: boolean;
  isCredit?: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  userId: string;
  restaurantId: string;
  remainingQuantity: number;
  damagedQuantity?: number;
  status: 'active' | 'depleted' | 'corrected' | 'deleted';
  notes?: string;
  isDeleted?: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
}

export type StockChangeReason =
  | 'sale'
  | 'restock'
  | 'adjustment'
  | 'creation'
  | 'cost_correction'
  | 'damage'
  | 'manual_adjustment'
  | 'production'
  | 'batch_deletion'
  | 'quantity_correction'
  | 'direct_consumption';

export interface StockChange {
  id: string;
  type: 'product' | 'matiere';
  productId?: string;
  matiereId?: string;
  change: number;
  reason: StockChangeReason;
  supplierId?: string;
  isOwnPurchase?: boolean;
  isCredit?: boolean;
  costPrice?: number;
  batchId?: string;
  saleId?: string;
  createdAt: Timestamp;
  userId: string;
  restaurantId: string;
  notes?: string;
  adjustmentType?: 'quantity_correction' | 'remaining_adjustment' | 'damage' | 'cost_correction' | 'combined';
  adjustmentReason?: 'error_correction' | 'inventory_audit' | 'damage' | 'theft' | 'expiry' | 'return_to_supplier' | 'other';
  oldQuantity?: number;
  newQuantity?: number;
  oldCostPrice?: number;
  newCostPrice?: number;
  batchConsumptions?: Array<{
    batchId: string;
    costPrice: number;
    consumedQuantity: number;
    remainingQuantity: number;
  }>;
}

export interface BatchAdjustment {
  batchId: string;
  adjustmentType: 'quantity_correction' | 'remaining_adjustment' | 'damage' | 'cost_correction' | 'combined';
  adjustmentReason: 'error_correction' | 'inventory_audit' | 'damage' | 'theft' | 'expiry' | 'return_to_supplier' | 'other';
  newTotalQuantity?: number;
  remainingQuantityDelta?: number;
  damageQuantity?: number;
  newCostPrice?: number;
  notes?: string;
}

// ============================================================================
// SALES / POS MANAGEMENT
// ============================================================================

export interface SaleProduct {
  productId: string;
  quantity: number;
  basePrice: number;
  negotiatedPrice?: number;
  costPrice: number;
  batchId?: string;
  profit: number;
  profitMargin: number;
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
  }>;
}

export type SaleStatus = 'commande' | 'under_delivery' | 'paid' | 'draft' | 'credit';
export type PaymentStatus = 'pending' | 'paid' | 'cancelled';
export type PaymentMethod = 'cash' | 'mobile_money' | 'card';

export interface Sale extends BaseModel {
  products: SaleProduct[];
  totalAmount: number;
  status: SaleStatus;
  paymentStatus: PaymentStatus;
  customerInfo: {
    name: string;
    phone: string;
    quarter?: string;
  };
  customerSourceId?: string;
  deliveryFee?: number;
  discountType?: 'amount' | 'percentage';
  discountValue?: number;
  discountOriginalValue?: number;
  tax?: number;
  paymentMethod?: PaymentMethod;
  amountReceived?: number;
  change?: number;
  statusHistory?: Array<{ status: string; timestamp: string; userId?: string }>;
  isAvailable?: boolean;
  inventoryMethod?: 'FIFO' | 'LIFO' | 'CMUP';
  totalCost?: number;
  totalProfit?: number;
  averageProfitMargin?: number;
  tvaRate?: number;
  tvaApplied?: boolean;
  creditDueDate?: Timestamp;
  paidAmount?: number;
  remainingAmount?: number;
  refunds?: Array<{
    id: string;
    amount: number;
    timestamp: string;
    userId: string;
    reason?: string;
    paymentMethod?: PaymentMethod;
    transactionReference?: string;
  }>;
  totalRefunded?: number;
  // Restaurant-specific
  tableNumber?: number;
  orderId?: string; // Link to Restoflow order if applicable
}

// ============================================================================
// FINANCE MANAGEMENT
// ============================================================================

export type FinanceSourceType = 'sale' | 'expense' | 'manual' | 'supplier' | 'order' | 'matiere';

export interface FinanceEntry {
  id: string;
  userId: string;
  restaurantId: string;
  sourceType: FinanceSourceType;
  sourceId?: string;
  type: string;
  amount: number;
  description?: string;
  date: Timestamp;
  isDeleted: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  refundedDebtId?: string;
  supplierId?: string;
  batchId?: string;
}

// ============================================================================
// STAFF / HR MANAGEMENT
// ============================================================================

export type UserRole = 'owner' | 'admin' | 'manager' | 'staff';

// Restaurant-specific roles
export type RestaurantRole = 'owner' | 'manager' | 'chef' | 'server' | 'cashier' | 'delivery';

export interface EmployeeRef {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  permissionTemplateId?: string;
  phone?: string;
  photo?: string;
  isActive: boolean;
  passwordHash?: string; // Stored securely
  addedAt: Timestamp;
  updatedAt?: Timestamp;
  createdBy: string; // Owner who created this employee
}

export interface UserCompanyRef {
  companyId: string; // restaurantId in our context
  name: string;
  description?: string;
  logo?: string;
  role: UserRole;
  joinedAt: Timestamp;
  permissionTemplateId?: string;
  userId?: string;
}

export interface CompanyEmployee {
  id: string;
  username: string;
  email: string;
  phone?: string;
  role: UserRole;
  birthday?: string;
  loginLink?: string;
  firebaseUid?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface User {
  id: string;
  username: string;
  email: string;
  photoURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  companies: UserCompanyRef[];
  status: 'active' | 'suspended' | 'invited';
  lastLogin?: Timestamp;
}

// ============================================================================
// INVITATION & PERMISSION SYSTEM
// ============================================================================

export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface Invitation {
  id: string;
  restaurantId: string;
  restaurantName: string;
  invitedBy: string;
  invitedByName: string;
  email: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  status: InvitationStatus;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  acceptedAt?: Timestamp;
  permissionTemplateId: string;
}

// Permission resources for restaurant
export const RESTAURANT_RESOURCES = {
  DASHBOARD: 'dashboard',
  MENU: 'menu',
  ORDERS: 'orders',
  TABLES: 'tables',
  POS: 'pos',
  SALES: 'sales',
  INVENTORY: 'inventory',
  CUSTOMERS: 'customers',
  SUPPLIERS: 'suppliers',
  EXPENSES: 'expenses',
  FINANCE: 'finance',
  REPORTS: 'reports',
  STAFF: 'staff',
  PERMISSIONS: 'permissions',
  SETTINGS: 'settings',
} as const;

export type ResourceKey = keyof typeof RESTAURANT_RESOURCES;
export type ResourceValue = typeof RESTAURANT_RESOURCES[ResourceKey];

export interface PermissionTemplate {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  baseRole: UserRole;
  permissions: {
    canView: ResourceValue[];
    canCreate: ResourceValue[];
    canEdit: ResourceValue[];
    canDelete: ResourceValue[];
  };
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

// ============================================================================
// ACTION REQUESTS
// ============================================================================

export type ActionRequestStatus = 'pending' | 'approved' | 'rejected';
export type GrantType = 'one_time' | 'permanent';

export interface ActionRequest {
  id: string;
  restaurantId: string;
  requesterId: string;
  requesterName: string;
  requesterEmail?: string;
  requestedAction: string;
  resource: string;
  resourceId?: string;
  resourceName?: string;
  reason?: string;
  status: ActionRequestStatus;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: Timestamp;
  reviewNote?: string;
  grantType?: GrantType;
  expiresAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type ProfitPeriodType =
  | 'custom'
  | 'this_month'
  | 'last_30_days'
  | 'last_2_months'
  | 'last_3_months'
  | 'this_quarter'
  | 'this_year'
  | 'all_time';

export interface DashboardStats {
  totalSales: number;
  totalExpenses: number;
  totalProfit: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
}
