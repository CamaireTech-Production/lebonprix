export type Timestamp = {
  seconds: number;
  nanoseconds: number;
};

export interface BaseModel {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: string; // Legacy field - kept for audit trail, user who created the record
  companyId: string; // Reference to the company this record belongs to (primary field for data isolation)
}

export interface Company extends BaseModel {
  name: string;
  logo?: string; // Base64 string for logo
  description?: string;
  phone: string;
  location?: string;
  email: string;
  website?: string; // Company website URL
  
  // Color customization for catalogue
  catalogueColors?: {
    primary?: string; // Primary brand color (default: #183524)
    secondary?: string; // Secondary brand color (default: #e2b069)
    tertiary?: string; // Tertiary/accent color (default: #2a4a3a)
  };
  
  // Color customization for dashboard
  dashboardColors?: {
    primary?: string; // Primary brand color (default: #183524)
    secondary?: string; // Secondary brand color (default: #e2b069)
    tertiary?: string; // Tertiary/accent color (default: #2a4a3a)
    headerText?: string; // Header text color (default: #ffffff)
  };
  
  // Legacy color fields (for backward compatibility)
  primaryColor?: string; // Primary brand color (default: #183524)
  secondaryColor?: string; // Secondary brand color (default: #e2b069)
  tertiaryColor?: string; // Tertiary/accent color (default: #2a4a3a)
}

export interface Category extends BaseModel {
  name: string;
  description?: string;
  image?: string; // Firebase Storage URL or base64
  imagePath?: string; // Storage path for deletion
  productCount?: number;
  isActive?: boolean; // For soft delete capability
  userId: string; // Owner of the category
}

export interface Product extends BaseModel {
  costPrice: number;
  name: string;
  reference: string;
  sellingPrice: number;
  cataloguePrice?: number;
  stock: number;
  category?: string;
  images?: string[]; // Stores Firebase Storage URLs only
  imagePaths?: string[]; // Optional: store storage paths for deletion
  migratedAt?: Date; // Track migration status
  isAvailable: boolean;
  isDeleted?: boolean;
  isVisible?: boolean; // Controls visibility in catalogue (default: true)
  inventoryMethod?: 'FIFO' | 'LIFO';
  enableBatchTracking?: boolean;
  tags?: ProductTag[]; // Dynamic product tags for variations
  description?: string; // Product description for catalogue
  barCode?: string; // EAN-13 barcode for product identification
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
  companyId: string; // Reference to the company this customer belongs to
  createdAt: Date;
  // Informations optionnelles supplémentaires
  firstName?: string; // Prénom
  lastName?: string; // Nom de famille
  address?: string; // Adresse complète
  town?: string; // Ville
  birthdate?: string; // Date de naissance (format ISO: YYYY-MM-DD)
  howKnown?: string; // Comment il a connu l'entreprise
}

export interface Objective extends BaseModel {
  title: string;
  description?: string;
  metric: string; // key of stat
  targetAmount: number;
  periodType: 'predefined' | 'custom';
  predefined?: string; // this_month, this_year, etc.
  startAt?: Timestamp; // Firebase Timestamp
  endAt?: Timestamp;
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
  userId: string; // Legacy field - kept for audit trail
  companyId: string; // Reference to the company this stock change belongs to
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
  userId: string; // Legacy field - kept for audit trail
  companyId: string; // Reference to the company this stock batch belongs to
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
  userId: string; // Legacy field - kept for audit trail
  companyId: string; // Reference to the company this finance entry belongs to
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

// Employee invitation system types
export interface Invitation {
  id: string;
  companyId: string;
  companyName: string;
  invitedBy: string;
  invitedByName: string;
  email: string;
  firstname: string;
  lastname: string;
  phone?: string;
  role: 'staff' | 'manager' | 'admin';
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: Timestamp;
  expiresAt: Timestamp;
  acceptedAt?: Timestamp;
  permissionTemplateId?: string; // Optional template assignment
}

// Employee management types
export type UserRole = 'admin' | 'manager' | 'staff';

export interface CompanyEmployee {
  id: string; // ID unique généré automatiquement
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  role: UserRole;
  birthday?: string; // ISO date (YYYY-MM-DD)
  loginLink?: string; // lien d'invitation / connexion
  firebaseUid?: string; // UID Firebase Auth (optionnel, pour liaison)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Nouvelle interface pour les références d'employés
export interface EmployeeRef {
  id: string;              // firebaseUid du user
  firstname: string;       // Dupliqué depuis users
  lastname: string;        // Dupliqué depuis users
  email: string;          // Dupliqué depuis users
  role: 'admin' | 'manager' | 'staff';  // Rôle dans cette companie
  addedAt: Timestamp;     // Date d'ajout comme employé
}

// Référence d'une entreprise pour un utilisateur
export interface UserCompanyRef {
  companyId: string;
  name: string;
  description?: string;
  logo?: string;
  role: 'owner' | 'admin' | 'manager' | 'staff';
  joinedAt: Timestamp;
  // Optional: assigned permission template for this company
  permissionTemplateId?: string;
  // Optional: userId (firebaseUid) - needed for operations like deletion
  userId?: string;
}

// ❌ SUPPRIMÉ - Plus utilisé dans l'architecture simplifiée
// Les références sont maintenant uniquement dans users[].companies[]

// Nouveau modèle User unifié
export interface User {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  photoURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  companies: UserCompanyRef[];
  status: 'active' | 'suspended' | 'invited';
  lastLogin?: Timestamp;
  // Optional: last selected permission template per company (future use)
  // selectedTemplates?: Record<string /*companyId*/, string /*templateId*/>;
}

// Update Company interface to include employees
export interface Company extends BaseModel {
  name: string;
  logo?: string; // Base64 string for logo
  description?: string;
  phone: string;
  role : "Companie"
  location?: string;
  email: string;
  companyId: string; // ID du propriétaire de l'entreprise
  employees?: Record<string, CompanyEmployee>; // Mirroir de employeeRefs pour lecture rapide
  employeeCount?: number; // Nombre total d'employés
  // Nouvelle architecture: employeeRefs via sous-collection companies/{id}/employeeRefs/{firebaseUid}
}