/**
 * Shared types for report generation across all modules
 */

// Report formats
export type ReportFormat = 'csv' | 'pdf' | 'excel';

// Date range filter
export interface DateRangeFilter {
  startDate: Date | null;
  endDate: Date | null;
}

// Base report configuration
export interface BaseReportConfig {
  title: string;
  format: ReportFormat;
  dateRange?: DateRangeFilter;
  selectedFields: string[];
  includeHeaders: boolean;
}

// Field definition for report configuration
export interface ReportField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'boolean';
  defaultSelected?: boolean;
  format?: (value: any) => string;
}

// Product report specific types
export interface ProductReportConfig extends BaseReportConfig {
  filters: {
    categories?: string[];
    stockLevelMin?: number;
    stockLevelMax?: number;
    availability?: 'all' | 'available' | 'unavailable';
    suppliers?: string[];
  };
}

export interface ProductReportData {
  id: string;
  name: string;
  reference: string;
  costPrice: number;
  sellingPrice: number;
  cataloguePrice?: number;
  category?: string;
  supplier?: string;
  stockQuantity: number;
  status: string;
  isAvailable: boolean;
  profitMargin?: number;
  createdAt?: Date;
}

// Expense report types
export interface ExpenseReportConfig extends BaseReportConfig {
  filters: {
    categories?: string[];
    amountMin?: number;
    amountMax?: number;
    paymentMethod?: string[];
  };
}

export interface ExpenseReportData {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: Date;
  paymentMethod?: string;
  reference?: string;
}

// Production report types
export interface ProductionReportConfig extends BaseReportConfig {
  filters: {
    status?: string[];
    productionCategories?: string[];
  };
}

export interface ProductionReportData {
  id: string;
  productName: string;
  quantity: number;
  status: string;
  category?: string;
  startDate?: Date;
  endDate?: Date;
  totalCost?: number;
  articles: any[];
  materials: any[];
  charges: any[];
}

// Matiere report types
export interface MatiereReportConfig extends BaseReportConfig {
  filters: {
    categories?: string[];
    stockLevelMin?: number;
    stockLevelMax?: number;
  };
}

export interface MatiereReportData {
  id: string;
  name: string;
  reference?: string;
  category?: string;
  unit: string;
  quantity: number;
  costPrice?: number;
  supplier?: string;
}

// Stock report types
export interface StockReportConfig extends BaseReportConfig {
  filters: {
    products?: string[];
    status?: ('active' | 'depleted' | 'corrected' | 'deleted')[];
    suppliers?: string[];
  };
}

export interface StockReportData {
  id: string;
  productName: string;
  batchNumber?: string;
  quantity: number;
  remainingQuantity: number;
  damagedQuantity?: number;
  costPrice: number;
  supplier?: string;
  status: string;
  createdAt?: Date;
}

// Sales report types
export interface SalesReportConfig extends BaseReportConfig {
  filters: {
    status?: string[];
    paymentStatus?: string[];
    customers?: string[];
    amountMin?: number;
    amountMax?: number;
  };
}

export interface SalesReportData {
  id: string;
  customerName?: string;
  products: string[];
  totalAmount: number;
  totalCost?: number;
  totalProfit?: number;
  profitMargin?: number;
  status: string;
  paymentStatus: string;
  date: Date;
  deliveryFee?: number;
}

// Report generation result
export interface ReportResult {
  success: boolean;
  filename?: string;
  blob?: Blob;
  error?: string;
  recordCount?: number;
}

// Export options
export interface ExportOptions {
  filename: string;
  companyName?: string;
  companyLogo?: string;
  includeTimestamp?: boolean;
  includeFooter?: boolean;
  orientation?: 'portrait' | 'landscape';
}
