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
  report_time?: number; // Heure de réception des rapports (0-23)
  
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
  inventoryMethod?: 'FIFO' | 'LIFO';
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
  status: 'commande' | 'under_delivery' | 'paid' | 'draft';
  paymentStatus: 'pending' | 'paid' | 'cancelled';
  customerInfo: {
    name: string;
    phone: string;
    quarter?: string;
  };
  customerSourceId?: string; // Source clientelle de la vente (optionnel pour rétrocompatibilité)
  deliveryFee?: number;
  statusHistory?: Array<{ status: string; timestamp: string }>;
  isAvailable?: boolean;
  inventoryMethod?: 'FIFO' | 'LIFO';
  totalCost?: number;
  totalProfit?: number;
  averageProfitMargin?: number;
  tax?: number; // TVA amount
  tvaRate?: number; // TVA percentage rate
  tvaApplied?: boolean; // Whether TVA was applied
}

export interface Expense extends BaseModel {
  description: string;
  amount: number;
  category: string;
  isAvailable?: boolean;
  date?: Timestamp; // Date de la transaction (modifiable par l'utilisateur)
}

export interface DashboardStats extends BaseModel {
  totalSales: number;
  totalExpenses: number;
  totalProfit: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
}

export type OrderStatus = 'commande' | 'under_delivery' | 'paid' | 'draft';
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
  reason: 'sale' | 'restock' | 'adjustment' | 'creation' | 'cost_correction' | 'damage' | 'manual_adjustment' | 'production' | 'batch_deletion';
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
export interface ProductionArticle {
  id: string; // Unique ID (auto-generated)
  name: string; // User-entered OR auto-generated from production name
  quantity: number; // Number of units to produce for this article
  status: 'draft' | 'in_progress' | 'ready' | 'published' | 'cancelled';
  
  // Flow stage tracking (uses production flowId)
  currentStepId?: string; // Current step in production flow
  currentStepName?: string; // Denormalized step name
  
  // Publishing
  publishedProductId?: string; // If published, reference to Product
  publishedAt?: Timestamp;
  publishedBy?: string;
  
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

