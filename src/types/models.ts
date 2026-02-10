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
  createdBy?: EmployeeRef; // Employee who created this record (optional for backward compatibility)
}

export interface Company extends BaseModel {
  name: string;
  logo?: string; // Base64 string for logo
  description?: string;
  phone: string;
  location?: string;
  email: string;
  website?: string; // Company website URL
  report_mail?: string; // Email pour les rapports de vente
  report_time?: string | number; // Format: "HH:mm" (e.g., "19:30") or number (0-23) for backward compatibility
  emailReportsEnabled?: boolean; // Active/désactive l'envoi automatique des rapports par email (par défaut: true)

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

  // SEO settings for catalogue site
  seoSettings?: {
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string[];
    ogImage?: string; // Open Graph image URL
    twitterCard?: 'summary' | 'summary_large_image';
  };

  // Stock management settings
  lowStockThreshold?: number; // Global threshold for low stock alerts (in units)

  // Employee management
  employees?: Record<string, CompanyEmployee>; // Mirroir de employeeRefs pour lecture rapide
  employeeCount?: number; // Nombre total d'employés
  // Nouvelle architecture: employeeRefs via sous-collection companies/{id}/employeeRefs/{firebaseUid}
}

export interface Category extends BaseModel {
  name: string;
  description?: string;
  image?: string; // Firebase Storage URL or base64
  imagePath?: string; // Storage path for deletion
  type: 'product' | 'matiere'; // Category type: either product or matiere, never both
  productCount?: number;
  matiereCount?: number; // Count of matieres in this category
  isActive?: boolean; // For soft delete capability
  userId: string; // Owner of the category
}

export interface Product extends BaseModel {
  costPrice: number;
  name: string;
  reference: string;
  sellingPrice: number;
  cataloguePrice?: number;
  /** @deprecated Use stock batches (stockBatches collection) instead. This field will be removed. */
  stock?: number;
  category?: string;
  images?: string[]; // Stores Firebase Storage URLs only
  imagePaths?: string[]; // Optional: store storage paths for deletion
  migratedAt?: Date; // Track migration status
  isAvailable: boolean;
  isDeleted?: boolean;
  isVisible?: boolean; // Controls visibility in catalogue (default: true)
  inventoryMethod?: 'FIFO' | 'LIFO' | 'CMUP';
  enableBatchTracking?: boolean;
  tags?: ProductTag[]; // Dynamic product tags for variations
  description?: string; // Product description for catalogue
  barCode?: string; // EAN-13 barcode for product identification
}

export interface Matiere extends BaseModel {
  name: string;
  description?: string;
  images?: string[]; // Firebase Storage URLs
  imagePaths?: string[]; // Storage paths for deletion
  refCategorie?: string; // Category name (not ID) - optional
  refStock: string; // Reference to stock document ID
  unit?: string; // Unit of measurement (from units.ts or customUnits) - optional
  costPrice: number; // Last purchase price
  companyId: string;
  createdBy?: EmployeeRef;
  isDeleted?: boolean;
}

export interface CustomUnit extends BaseModel {
  value: string; // Technical code (e.g., "custom_box")
  label: string; // Display label (e.g., "Boîte personnalisée")
  companyId: string; // Company that owns this custom unit
  createdBy?: EmployeeRef; // Employee who created the unit
  isDeleted?: boolean; // Soft delete
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
  /**
   * Sale status with business rules:
   * - 'paid': Stock DEBITED, Finance entry CREATED (if paymentStatus === 'paid')
   * - 'credit': Stock DEBITED, Finance entry NOT CREATED (debt tracked separately)
   * - 'commande': Stock NOT DEBITED, Finance entry NOT CREATED (reservation only)
   * - 'under_delivery': Stock DEBITED, Finance entry NOT CREATED (delivery in progress)
   * - 'draft': Stock NOT DEBITED, Finance entry NOT CREATED (draft/saved for later)
   */
  status: 'commande' | 'under_delivery' | 'paid' | 'draft' | 'credit';
  paymentStatus: 'pending' | 'paid' | 'cancelled';
  customerInfo: {
    name: string;
    phone: string;
    quarter?: string;
  };
  customerSourceId?: string; // Source clientelle de la vente (optionnel pour rétrocompatibilité, mais requis pour credit)
  deliveryFee?: number;
  discountType?: 'amount' | 'percentage'; // Type de remise
  discountValue?: number; // Montant de la remise
  discountOriginalValue?: number; // Valeur originale (pourcentage si applicable)
  tax?: number; // Taxe appliquée
  paymentMethod?: 'cash' | 'mobile_money' | 'card'; // Méthode de paiement
  amountReceived?: number; // Montant reçu (pour calculer la monnaie)
  change?: number; // Monnaie à rendre
  statusHistory?: Array<{ status: string; timestamp: string; userId?: string }>; // Enhanced with userId for audit trail
  isAvailable?: boolean;
  inventoryMethod?: 'FIFO' | 'LIFO' | 'CMUP';
  totalCost?: number;
  totalProfit?: number;
  averageProfitMargin?: number;
  tvaRate?: number; // TVA percentage rate
  tvaApplied?: boolean; // Whether TVA was applied
  // Location tracking for warehouse/shop system
  sourceType?: 'shop' | 'warehouse'; // Where the sale originated from
  shopId?: string; // Only if sourceType === 'shop'
  warehouseId?: string; // Only if sourceType === 'warehouse'
  // Credit sale fields
  creditDueDate?: Timestamp; // Optional due date for credit sales
  paidAmount?: number; // Amount paid (for partial payments, future enhancement)
  remainingAmount?: number; // Remaining amount to be paid (for credit sales)
  // Refund fields
  refunds?: Array<{
    id: string; // Unique refund ID
    amount: number; // Refunded amount
    timestamp: string; // ISO timestamp when refund was made
    userId: string; // Who made the refund
    reason?: string; // Optional reason for refund
    paymentMethod?: 'cash' | 'mobile_money' | 'card'; // How refund was processed
    transactionReference?: string; // Transaction reference if applicable
  }>;
  totalRefunded?: number; // Total amount refunded so far
}

export interface Expense extends BaseModel {
  description: string;
  amount: number;
  category: string;
  isAvailable?: boolean;
  date?: Timestamp; // Date de la transaction (modifiable par l'utilisateur)
  image?: string; // Firebase Storage URL or base64
  imagePath?: string; // Storage path for deletion
}

export interface DashboardStats extends BaseModel {
  totalSales: number;
  totalExpenses: number;
  totalProfit: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
}

export type OrderStatus = 'commande' | 'under_delivery' | 'paid' | 'draft' | 'credit';
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
  companyId: string; // Reference to company this customer belongs to
  createdAt: Timestamp;
  // Informations optionnelles supplémentaires
  firstName?: string; // Prénom
  lastName?: string; // Nom de famille
  address?: string; // Adresse complète
  town?: string; // Ville
  birthdate?: string; // Date de naissance (format ISO: YYYY-MM-DD)
  howKnown?: string; // Comment il a connu l'entreprise
  customerSourceId?: string; // Source principale du client
  firstSourceId?: string; // Première source enregistrée (pour historique)
  // Shop association for warehouse/shop system
  primaryShopId?: string; // Preferred shop for this customer
  associatedShops?: string[]; // Array of shop IDs where customer has made purchases
}

export interface CustomerSource extends BaseModel {
  name: string; // Nom de la source (ex: "TikTok", "Facebook", "Influenceur")
  description?: string; // Description optionnelle
  color?: string; // Couleur pour les graphiques (format hex)
  isActive: boolean; // Actif/inactif
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

export type ProfitPeriodType =
  | 'custom'
  | 'this_month'
  | 'last_30_days'
  | 'last_2_months'
  | 'last_3_months'
  | 'this_quarter'
  | 'this_year'
  | 'all_time';

export interface ProfitPeriodPreference {
  id: string;
  companyId: string;
  periodStartDate: Timestamp | null; // null for non-custom types, Date for custom
  periodType: ProfitPeriodType; // Type of period
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy: string;
}

// Stock document for tracking current quantity
export interface Stock {
  id: string;
  type: 'product' | 'matiere'; // Stock type: either product or matiere, never both
  productId?: string; // Only if type === 'product'
  matiereId?: string; // Only if type === 'matiere'
  quantity: number;
  companyId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Stock change event for product/matiere inventory tracking
export interface StockChange {
  id: string;
  type: 'product' | 'matiere'; // Stock type: either product or matiere, never both
  productId?: string; // Only if type === 'product'
  matiereId?: string; // Only if type === 'matiere'
  change: number; // + for restock, - for sale, etc.
  reason: 'sale' | 'restock' | 'adjustment' | 'creation' | 'cost_correction' | 'damage' | 'manual_adjustment' | 'production' | 'batch_deletion' | 'quantity_correction' | 'transfer' | 'direct_consumption';
  supplierId?: string; // Reference to supplier if applicable
  isOwnPurchase?: boolean; // true if own purchase, false if from supplier
  isCredit?: boolean; // true if on credit, false if paid (only relevant if from supplier)
  costPrice?: number; // Cost price for this stock entry (legacy, kept for backward compatibility)
  batchId?: string; // Reference to stock batch (legacy, kept for backward compatibility)
  saleId?: string; // Reference to sale if applicable
  createdAt: Timestamp;
  userId: string; // Legacy field - kept for audit trail
  companyId: string; // Reference to the company this stock change belongs to
  notes?: string; // Optional notes for the stock change
  // NEW: Unified adjustment tracking fields
  adjustmentType?: 'quantity_correction' | 'remaining_adjustment' | 'damage' | 'cost_correction' | 'combined';
  adjustmentReason?: 'error_correction' | 'inventory_audit' | 'damage' | 'theft' | 'expiry' | 'return_to_supplier' | 'other';
  oldQuantity?: number; // For quantity_correction: old total quantity
  newQuantity?: number; // For quantity_correction: new total quantity
  oldCostPrice?: number; // For cost_correction: old cost price
  newCostPrice?: number; // For cost_correction: new cost price
  // NEW: Detailed batch consumption tracking
  batchConsumptions?: Array<{
    batchId: string;
    costPrice: number;
    consumedQuantity: number;
    remainingQuantity: number; // remaining after this consumption
  }>;
  // Location tracking for warehouse/shop system
  locationType?: 'warehouse' | 'shop' | 'production' | 'global'; // Where this stock change occurred
  warehouseId?: string; // Only if locationType === 'warehouse'
  shopId?: string; // Only if locationType === 'shop'
  transferId?: string; // Reference to StockTransfer if this change is part of a transfer
}

// Stock batch for FIFO inventory tracking (NEW!)
export interface StockBatch {
  id: string;
  type: 'product' | 'matiere'; // Stock type: either product or matiere, never both
  productId?: string; // Only if type === 'product'
  matiereId?: string; // Only if type === 'matiere'
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
  status: 'active' | 'depleted' | 'corrected' | 'deleted'; // Batch status
  notes?: string; // Optional notes for the batch
  isDeleted?: boolean; // Soft delete flag
  deletedAt?: Timestamp; // When the batch was deleted
  deletedBy?: string; // User who deleted the batch
  // Location tracking for warehouse/shop system
  locationType?: 'warehouse' | 'shop' | 'production' | 'global'; // Where this stock batch is located
  warehouseId?: string; // Only if locationType === 'warehouse'
  shopId?: string; // Only if locationType === 'shop'
  productionId?: string; // Only if locationType === 'production'
}

/**
 * Unified batch adjustment request
 * Supports all types of batch adjustments in a single interface
 */
export interface BatchAdjustment {
  batchId: string;
  adjustmentType: 'quantity_correction' | 'remaining_adjustment' | 'damage' | 'cost_correction' | 'combined';
  adjustmentReason: 'error_correction' | 'inventory_audit' | 'damage' | 'theft' | 'expiry' | 'return_to_supplier' | 'other';
  // For quantity_correction: correct the total quantity of the batch
  newTotalQuantity?: number;
  // For remaining_adjustment: adjust only the remaining quantity (delta)
  remainingQuantityDelta?: number;
  // For damage: record damaged quantity
  damageQuantity?: number;
  // For cost_correction: update cost price
  newCostPrice?: number;
  // Optional notes
  notes?: string;
}

export interface Supplier extends BaseModel {
  name: string;
  contact: string;
  location?: string;
  email?: string;
  notes?: string;
  isDeleted?: boolean;
}

/**
 * Supplier Debt Entry - Individual transaction record
 * Part of the entries array in SupplierDebt
 */
export interface SupplierDebtEntry {
  id: string;
  type: 'debt' | 'refund';
  amount: number;
  description: string;
  batchId?: string; // Link to stock batch if applicable (for debt entries from stock purchases)
  refundedDebtId?: string; // For refunds, links to the original debt entry ID (from finance entry)
  createdAt: Timestamp;
}

/**
 * Supplier Debt - Main debt tracking document
 * One document per supplier per company
 * Tracks total debt, refunds, and outstanding amount
 */
export interface SupplierDebt extends BaseModel {
  supplierId: string;
  totalDebt: number; // Sum of all debt entries
  totalRefunded: number; // Sum of all refund entries
  outstanding: number; // totalDebt - totalRefunded (calculated field)
  entries: SupplierDebtEntry[]; // History of all debt/refund transactions
}

export interface FinanceEntry {
  id: string;
  userId: string; // Legacy field - kept for audit trail
  companyId: string; // Reference to the company this finance entry belongs to
  sourceType: 'sale' | 'expense' | 'manual' | 'supplier' | 'order' | 'matiere';
  sourceId?: string; // saleId, expenseId, orderId, supplierId, or matiereId if applicable
  type: string; // e.g., "sale", "expense", "loan", "deposit", "supplier_debt", "supplier_refund", "matiere_purchase", etc.
  amount: number;
  description?: string;
  date: Timestamp;
  isDeleted: boolean;
  isPending?: boolean; // true if entry is pending (e.g., order paid but not yet converted to sale)
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
  id: string;                    // Document ID (auto-generated)
  name: string;                  // Category name (e.g., "transportation", "purchase")
  userId?: string;               // User ID who created it (optional, undefined for defaults)
  companyId?: string;            // Company ID (optional, undefined for default types)
  isDefault: boolean;            // true for system defaults, false for custom
  createdAt: Timestamp;          // Firestore timestamp
  updatedAt?: Timestamp;         // Firestore timestamp (set when updated)
}

// Employee invitation system types
export interface Invitation {
  id: string;
  companyId: string;
  companyName: string;
  invitedBy: string;
  invitedByName: string;
  email: string;
  firstname?: string; // Optional - will be filled when user registers
  lastname?: string; // Optional - will be filled when user registers
  phone?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: Timestamp;
  expiresAt: Timestamp;
  acceptedAt?: Timestamp;
  permissionTemplateId: string; // Required: Permission template for this invitation
}

// Employee management types
export type UserRole = 'admin' | 'manager' | 'staff';

export interface CompanyEmployee {
  id: string; // ID unique généré automatiquement
  username: string; // Username from user document
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
  username: string;        // Username from user document
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
  // Shop and warehouse assignments for warehouse/shop system
  assignedShops?: string[]; // Array of shop IDs assigned to this user
  assignedWarehouses?: string[]; // Array of warehouse IDs assigned to this user
}

// ❌ SUPPRIMÉ - Plus utilisé dans l'architecture simplifiée
// Les références sont maintenant uniquement dans users[].companies[]

// Nouveau modèle User unifié
export interface User {
  id: string;
  username: string; // Unique username identifier (used for display name)
  email: string;
  photoURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  companies: UserCompanyRef[];
  status: 'active' | 'suspended' | 'invited';
  phone?: string;
  lastLogin?: Timestamp;
  // Optional: last selected permission template per company (future use)
  // selectedTemplates?: Record<string /*companyId*/, string /*templateId*/>;
}


// ============================================================================
// PRODUCTION MODELS
// ============================================================================

/**
 * Production Flow Step - Individual step definition (reusable across flows)
 */
export interface ProductionFlowStep extends BaseModel {
  name: string; // e.g., "Design", "Cutting", "Sewing", "Quality Check", "Packaging"
  description?: string;
  image?: string; // Firebase Storage URL
  imagePath?: string; // Storage path for deletion
  estimatedDuration?: number; // Hours (optional guidance)
  isActive: boolean; // Can be deactivated without deleting
  usageCount?: number; // How many times used in flows (for analytics)
}

/**
 * Production Flow - Collection of flow steps
 */
export interface ProductionFlow extends BaseModel {
  name: string; // e.g., "Standard Production", "Custom Orders", "Bulk Production"
  description?: string;
  isDefault: boolean; // Default flow for new productions
  isActive: boolean;

  // Ordered steps in this flow (references to ProductionFlowStep IDs)
  stepIds: string[]; // Array of step IDs in desired order (for UI display)
  // Note: User can still move freely, this is just the suggested/display order

  // Flow metadata
  estimatedDuration?: number; // Total days (sum of step durations)
  stepCount?: number; // Count of steps (denormalized)
}

/**
 * Production Category
 */
export interface ProductionCategory extends BaseModel {
  name: string;
  description?: string;
  image?: string; // Firebase Storage URL
  imagePath?: string; // Storage path for deletion
  productionCount?: number; // Count of productions in this category
  isActive: boolean;
}

/**
 * Production Material - Material required for production
 */
export interface ProductionMaterial {
  matiereId: string;
  matiereName: string; // Denormalized for display
  requiredQuantity: number;
  unit: string;
  consumedQuantity?: number; // Actual consumed when published
  costPrice: number; // Cost at time of production
  batchIds?: string[]; // Which batches were consumed
}

/**
 * Production Article - Individual article/item produced in a production
 * Each production can produce multiple articles with different quantities
 */
/**
 * Production Article Publication - Tracks individual publication batch
 */
export interface ProductionArticlePublication {
  id: string; // Unique ID for this publication
  quantity: number; // Quantity published in this batch
  productId: string; // ID of the product (same product for all publications of this article)
  stockBatchId: string; // ID of the stock batch created for this publication
  publishedAt: Timestamp;
  publishedBy: string; // User ID who published
  costPrice: number; // Cost price at time of publication
  sellingPrice: number; // Selling price at time of publication
  selectedChargeIds?: string[]; // Charge IDs included in this publication
}

export interface ProductionArticle {
  id: string; // Unique ID (auto-generated)
  name: string; // User-entered OR auto-generated from production name
  quantity: number; // Number of units to produce for this article (total quantity)
  status: 'draft' | 'in_progress' | 'ready' | 'partially_published' | 'published' | 'cancelled';

  // Flow stage tracking (uses production flowId)
  currentStepId?: string; // Current step in production flow
  currentStepName?: string; // Denormalized step name

  // Publishing tracking (NEW: supports partial publishing)
  publishedQuantity: number; // Total quantity already published across all publications
  remainingQuantity: number; // Quantity remaining to be published (quantity - publishedQuantity)
  publications: ProductionArticlePublication[]; // History of all publications for this article

  // Legacy fields (kept for backward compatibility)
  publishedProductId?: string; // ID of the product (first publication or current product)
  publishedAt?: Timestamp; // Date of first publication
  publishedBy?: string; // User who made first publication

  // Optional metadata
  description?: string;
  images?: string[]; // Article-specific images

  // Materials - Specific to this article (not shared with other articles)
  materials: ProductionMaterial[]; // Materials required for this article
  calculatedCostPrice?: number; // Cost calculated from this article's materials only (without charges)
}

/**
 * Production State Change - Tracks state evolution
 * Supports two modes:
 * - Flow mode: Uses stepId/stepName (when flowId exists)
 * - Simple mode: Uses status (when no flowId)
 */
export interface ProductionStateChange {
  id: string;

  // Flow mode (if flowId exists)
  fromStepId?: string; // Previous step (null if initial)
  toStepId?: string; // New step (must be from associated flow)
  fromStepName?: string; // Denormalized for display
  toStepName?: string; // Denormalized for display

  // Simple mode (if no flowId)
  fromStatus?: string; // Previous status: 'draft' | 'in_progress' | 'ready' | etc.
  toStatus?: string; // New status: 'draft' | 'in_progress' | 'ready' | etc.

  // Common fields
  changedBy: string; // User ID
  changedByName?: string; // Denormalized for display
  timestamp: Timestamp;
  note?: string; // Optional note for the state change
}

/**
 * Production Charge - Charge linked to production
 * @deprecated Use Charge model instead. This is kept for backward compatibility during migration.
 */
export interface ProductionCharge extends BaseModel {
  productionId: string;
  description: string;
  amount: number;
  category: string; // e.g., "labor", "overhead", "equipment"
  date: Timestamp;
  financeEntryId?: string; // Link to FinanceEntry
}

/**
 * Charge - Unified charge model (company-scoped, no productionId)
 * Can be either fixed (reusable) or custom (production-specific context)
 */
export interface Charge extends BaseModel {
  companyId: string;
  type: 'fixed' | 'custom'; // Distinguishes charge types

  // Fixed charges (type="fixed"):
  // - Reusable across multiple productions
  // - Created in Charges management page
  // - Can be selected during production creation

  // Custom charges (type="custom"):
  // - Created for specific production context
  // - Can be created in Charges page, production creation, or production detail

  name: string; // For fixed: "Électricité", "Commission". For custom: same as description
  description?: string; // Full description (optional)
  amount: number;
  category?: string; // Same categories as before: "main_oeuvre", "overhead", "transport", etc. (optional)
  date: Timestamp;
  isActive?: boolean; // For fixed charges: can disable without deleting

  // User tracking (like products/sales)
  userId: string; // Firebase UID who created
  createdBy?: EmployeeRef; // Employee who created (optional)

  financeEntryId?: string; // Link to FinanceEntry (optional)

  // NO productionId - all charges are company-scoped
}

/**
 * Production Charge Reference - Charge snapshot stored in Production.charges array
 * Contains all necessary fields for cost calculation without needing to fetch the charge document
 */
export interface ProductionChargeRef {
  chargeId: string; // Reference to Charge document
  name: string; // Snapshot at time of selection
  description?: string; // Snapshot (optional)
  amount: number; // Snapshot (important for historical accuracy)
  category?: string; // Snapshot (optional)
  type: 'fixed' | 'custom'; // Whether this was a fixed or custom charge
  date: Timestamp; // Snapshot
  createdBy?: EmployeeRef; // Snapshot of who created the charge (optional for backward compatibility)
}

/**
 * Production - Main production model
 */
export interface Production extends BaseModel {
  // Basic Info
  name: string;
  reference: string;
  description?: string;
  images?: string[]; // Firebase Storage URLs
  imagePaths?: string[]; // Storage paths for deletion
  categoryId?: string; // Reference to ProductionCategory

  // Flow & State Management
  flowId?: string; // Reference to ProductionFlow (optional - defines available steps if provided)
  currentStepId?: string; // Current step ID (optional - only if flowId exists)
  status: 'draft' | 'in_progress' | 'ready' | 'published' | 'cancelled' | 'closed';

  // State History (tracks all state changes - user can move freely)
  stateHistory: ProductionStateChange[];

  // Materials (from magasin) - @deprecated - Materials are now per-article
  // Kept for backward compatibility, but should be empty for new productions
  materials: ProductionMaterial[];

  // Articles - Multiple articles can be produced from one production
  articles: ProductionArticle[]; // Array of articles to produce

  // Total articles quantity (sum of all articles[].quantity)
  totalArticlesQuantity: number; // Auto-calculated from articles[].quantity

  // Cost Calculation
  calculatedCostPrice: number; // Auto-calculated from materials + charges
  validatedCostPrice?: number; // User-validated/modified cost price
  isCostValidated: boolean;

  // Charges
  chargeIds?: string[]; // @deprecated - References to ProductionCharge documents (kept for migration)
  charges: ProductionChargeRef[]; // Array of charge snapshots (for cost calculation)

  // Publishing & Closure
  publishedProductId?: string; // @deprecated - Use articles[].publishedProductId instead (kept for backward compatibility)
  isPublished: boolean; // True when ALL articles are published
  isPublishing?: boolean; // Temporary lock during publication process (prevents double publication)
  isClosed: boolean; // True when published - no more interactions
  closedAt?: Timestamp;
  closedBy?: string;

  // Publishing tracking
  publishedArticlesCount?: number; // Count of published articles
  selectedArticlesForBulkPublish?: string[]; // Article IDs selected for bulk publish

  // Catalog Info (stored but only used when publishing)
  catalogData?: {
    category?: string;
    sellingPrice?: number;
    cataloguePrice?: number;
    isVisible?: boolean;
    tags?: ProductTag[];
    barCode?: string;
  };
}

/**
 * Site Analytics - Daily aggregation of catalogue views and traffic
 */
export interface SiteAnalytics extends BaseModel {
  companyId: string;
  date: Timestamp;
  views: number;
  uniqueVisitors: number;
  popularProducts: Array<{
    productId: string;
    productName: string;
    views: number;
  }>;
  referrers: Array<{
    source: string;
    count: number;
  }>;
  deviceTypes: Array<{
    type: 'desktop' | 'mobile' | 'tablet';
    count: number;
  }>;
}

// ============================================================================
// HUMAN RESOURCES MODELS
// ============================================================================

/**
 * HR Actor Types - Types of human resources personnel
 */
export type HRActorType =
  | 'gardien'
  | 'caissier'
  | 'magasinier'
  | 'livreur'
  | 'comptable'
  | 'manager'
  | 'secretaire'
  | 'technicien'
  | 'commercial'
  | 'custom';

/**
 * Contract Types for HR Actors
 */
export type ContractType = 'CDI' | 'CDD' | 'stage' | 'freelance' | 'interim';

/**
 * Salary Frequency for HR Actors
 */
export type SalaryFrequency = 'hourly' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

/**
 * HR Actor Status
 */
export type HRActorStatus = 'active' | 'inactive' | 'archived';

/**
 * Emergency Contact for HR Actor
 */
export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

/**
 * HR Actor - Represents a human resources personnel (gardien, caissier, etc.)
 *
 * This is different from app users/employees:
 * - HR Actors are real-world personnel who may or may not have app access
 * - They represent the company's human resources for payroll, scheduling, etc.
 * - Can optionally be linked to a Firebase user via linkedUserId
 */
export interface HRActor {
  id: string;
  companyId: string;

  // Basic Info
  firstName: string;
  lastName: string;
  displayName?: string; // Computed: firstName + lastName
  email?: string;
  phone: string; // Required
  photo?: string; // Firebase Storage URL

  // HR-specific
  actorType: HRActorType;
  customActorType?: string; // If actorType === 'custom'
  department?: string;
  position?: string; // Job title

  // Employment Info
  hireDate: Timestamp;
  endDate?: Timestamp; // If terminated/archived
  salary?: number;
  salaryFrequency?: SalaryFrequency;
  contractType?: ContractType;

  // Address
  address?: string;
  city?: string;
  country?: string;

  // Emergency Contact
  emergencyContact?: EmergencyContact;

  // System fields
  status: HRActorStatus;
  linkedUserId?: string; // Optional: link to Firebase user if they have app access

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string; // Firebase UID who created
  archivedAt?: Timestamp;
  archivedBy?: string; // Firebase UID who archived
}

// ============================================================================
// ACTION REQUEST MODELS
// ============================================================================

/**
 * Action Request Status
 */
export type ActionRequestStatus = 'pending' | 'approved' | 'rejected';

/**
 * Grant Type - Whether access is one-time or permanent
 */
export type GrantType = 'one_time' | 'permanent';

/**
 * Action Request - Request from employee to perform a restricted action
 *
 * When an employee tries to perform an action they don't have permission for,
 * they can request access. The owner/admin can then approve or reject.
 */
export interface ActionRequest {
  id: string;
  companyId: string;

  // Request Info
  requesterId: string; // Employee Firebase UID
  requesterName: string; // Denormalized for display
  requesterEmail?: string; // Denormalized for display

  // Action Details
  requestedAction: string; // e.g., 'delete_sale', 'edit_product', 'view_finance'
  resource: string; // RESOURCES constant value (e.g., 'sales', 'products', 'finance')
  resourceId?: string; // Specific item ID if applicable
  resourceName?: string; // Denormalized name of the resource item
  reason?: string; // Why they need this action

  // Status
  status: ActionRequestStatus;

  // Review
  reviewedBy?: string; // Boss/owner Firebase UID
  reviewedByName?: string; // Denormalized for display
  reviewedAt?: Timestamp;
  reviewNote?: string; // Note from reviewer

  // Access Grant (if approved)
  grantType?: GrantType; // 'one_time' or 'permanent'
  expiresAt?: Timestamp; // If one_time, when does the access expire

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// WAREHOUSE & SHOP MODELS
// ============================================================================

/**
 * Shop - Retail location where products are sold
 */
export interface Shop extends BaseModel {
  name: string;
  location?: string; // General location description
  address?: string; // Full address
  phone?: string; // Shop phone number
  email?: string; // Shop email
  isDefault: boolean; // True for default shop (auto-created, non-deletable if only shop)
  isActive: boolean; // True if shop is active (can be used for sales, transfers, etc.)
  assignedUsers?: string[]; // Array of user IDs with full access (read + write)
  readOnlyUsers?: string[]; // Array of user IDs with read-only access
  managerId?: string; // Primary shop manager user ID
  // Catalogue settings for shop-specific catalogue
  catalogueSettings?: {
    isPublic: boolean; // Whether shop catalogue is publicly accessible
    customDomain?: string; // Custom domain for shop catalogue
    seoSettings?: {
      metaTitle?: string;
      metaDescription?: string;
      metaKeywords?: string[];
      ogImage?: string;
    };
  };
}

/**
 * Warehouse - Central warehouse for finished products
 */
export interface Warehouse extends BaseModel {
  name: string;
  location?: string; // General location description
  address?: string; // Full address
  isDefault: boolean; // True for default warehouse (auto-created, non-deletable if only warehouse)
  isActive: boolean; // True if warehouse is active (can be used for transfers, etc.)
  assignedUsers?: string[]; // Array of user IDs with full access (read + write)
  readOnlyUsers?: string[]; // Array of user IDs with read-only access
}

/**
 * Stock Transfer - Tracks product transfers between locations
 */
export interface StockTransfer extends BaseModel {
  transferType: 'warehouse_to_shop' | 'warehouse_to_warehouse' | 'shop_to_shop' | 'shop_to_warehouse';
  // Source location (one of these will be set based on transferType)
  fromWarehouseId?: string; // If transferring from warehouse
  fromShopId?: string; // If transferring from shop
  fromProductionId?: string; // If transferring from production
  // Destination location (one of these will be set based on transferType)
  toWarehouseId?: string; // If transferring to warehouse
  toShopId?: string; // If transferring to shop
  // Products and quantities
  productId: string; // Product being transferred
  quantity: number; // Quantity being transferred
  batchIds: string[]; // Array of stock batch IDs being transferred
  // Status
  status: 'pending' | 'completed' | 'cancelled';
  // Date
  date?: any; // The business date of the transfer (Timestamp or Date)
  // Notes
  notes?: string; // Optional notes about the transfer
}

/**
 * Stock Replenishment Request - Request from a shop to replenish stock from a warehouse
 */
export interface StockReplenishmentRequest extends BaseModel {
  companyId: string;
  shopId: string; // Shop requesting replenishment
  productId: string; // Product to replenish
  quantity: number; // Quantity requested
  requestedBy: string; // User ID who created the request
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  transferId?: string; // If fulfilled, link to the created transfer
  fulfilledAt?: Timestamp; // When the request was fulfilled
  notes?: string; // Optional notes about the request
  rejectedReason?: string; // Reason for rejection if rejected
}

/**
 * Notification - User notifications for various events
 */
export interface Notification extends BaseModel {
  userId: string; // User who should receive this notification
  companyId: string; // Company context for the notification
  type: 'replenishment_request_created' | 'replenishment_request_fulfilled' |
  'replenishment_request_rejected' | 'transfer_created' | 'stock_low';
  title: string; // Notification title
  message: string; // Notification message
  data?: {
    requestId?: string; // For replenishment request notifications
    transferId?: string; // For transfer notifications
    shopId?: string; // For shop-related notifications
    warehouseId?: string; // For warehouse-related notifications
    productId?: string; // For product-related notifications
  };
  read: boolean; // Whether the notification has been read
  readAt?: Timestamp; // When the notification was read
}