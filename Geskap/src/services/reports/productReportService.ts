/**
 * Products Report Service
 * Handles data fetching, filtering, and transformation for product reports
 */

import {
  Product,
  StockBatch,
  Category,
  Supplier,
  Stock
} from '../../types/models';
import {
  ProductReportConfig,
  ProductReportData,
  ReportField,
  ReportResult,
  ExportOptions
} from '../../types/reports';
import {
  generateCSV,
  downloadCSV,
  generateReportPDF,
  downloadPDF,
  generateFilename,
  filterByDateRange
} from '../../utils/reports/exportHelpers';

/**
 * Available fields for product report
 */
export const PRODUCT_REPORT_FIELDS: ReportField[] = [
  { key: 'name', label: 'Nom du produit', type: 'text', defaultSelected: true },
  { key: 'reference', label: 'Référence', type: 'text', defaultSelected: true },
  { key: 'costPrice', label: 'Prix de revient', type: 'currency', defaultSelected: true },
  { key: 'sellingPrice', label: 'Prix de vente', type: 'currency', defaultSelected: true },
  { key: 'cataloguePrice', label: 'Prix catalogue', type: 'currency', defaultSelected: false },
  { key: 'profitMargin', label: 'Marge (%)', type: 'number', defaultSelected: true },
  { key: 'category', label: 'Catégorie', type: 'text', defaultSelected: true },
  { key: 'supplier', label: 'Fournisseur', type: 'text', defaultSelected: true },
  { key: 'stockQuantity', label: 'Stock disponible', type: 'number', defaultSelected: true },
  { key: 'status', label: 'Statut', type: 'text', defaultSelected: true },
  { key: 'isAvailable', label: 'Disponible', type: 'boolean', defaultSelected: false },
  { key: 'barCode', label: 'Code-barre', type: 'text', defaultSelected: false },
  { key: 'createdAt', label: 'Date de création', type: 'date', defaultSelected: false }
];

/**
 * Calculate total stock quantity for a product from stock batches
 */
const calculateStockQuantity = (
  productId: string,
  stockBatches: StockBatch[],
  stocks: Stock[]
): number => {
  // First try to get from stockBatches (more accurate)
  const productBatches = stockBatches.filter(
    batch => batch.productId === productId &&
             batch.status === 'active' &&
             !batch.isDeleted
  );

  if (productBatches.length > 0) {
    return productBatches.reduce((sum, batch) => sum + (batch.remainingQuantity || 0), 0);
  }

  // Fallback to stocks collection
  const stock = stocks.find(s => s.productId === productId);
  return stock?.quantity || 0;
};

/**
 * Get primary supplier for a product (most recent batch)
 */
const getPrimarySupplier = (
  productId: string,
  stockBatches: StockBatch[],
  suppliers: Supplier[]
): string => {
  const productBatches = stockBatches
    .filter(batch => batch.productId === productId && batch.supplierId && !batch.isDeleted)
    .sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime; // Most recent first
    });

  if (productBatches.length === 0) return '-';

  const supplierId = productBatches[0].supplierId;
  const supplier = suppliers.find(s => s.id === supplierId);
  return supplier?.name || '-';
};

/**
 * Calculate profit margin percentage
 */
const calculateProfitMargin = (costPrice: number, sellingPrice: number): number => {
  if (costPrice === 0) return 0;
  return ((sellingPrice - costPrice) / sellingPrice) * 100;
};

/**
 * Transform products to report data format
 */
export const transformProductsToReportData = (
  products: Product[],
  stockBatches: StockBatch[],
  stocks: Stock[],
  categories: Category[],
  suppliers: Supplier[]
): ProductReportData[] => {
  return products.map(product => {
    const stockQuantity = calculateStockQuantity(product.id, stockBatches, stocks);
    const supplier = getPrimarySupplier(product.id, stockBatches, suppliers);
    const category = categories.find(c => c.name === product.category)?.name || product.category || '-';
    const profitMargin = calculateProfitMargin(product.costPrice, product.sellingPrice);

    // Determine status
    let status = 'Actif';
    if (product.isDeleted) {
      status = 'Supprimé';
    } else if (!product.isAvailable) {
      status = 'Indisponible';
    } else if (stockQuantity === 0) {
      status = 'Rupture de stock';
    }

    return {
      id: product.id,
      name: product.name,
      reference: product.reference,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      cataloguePrice: product.cataloguePrice,
      category,
      supplier,
      stockQuantity,
      status,
      isAvailable: product.isAvailable,
      profitMargin,
      createdAt: product.createdAt ? new Date(product.createdAt.seconds * 1000) : undefined
    };
  });
};

/**
 * Apply filters to product report data
 */
export const filterProductReportData = (
  data: ProductReportData[],
  config: ProductReportConfig
): ProductReportData[] => {
  let filtered = [...data];

  // Filter by date range
  if (config.dateRange?.startDate || config.dateRange?.endDate) {
    filtered = filterByDateRange(
      filtered,
      config.dateRange.startDate,
      config.dateRange.endDate,
      'createdAt'
    );
  }

  // Filter by categories
  if (config.filters.categories && config.filters.categories.length > 0) {
    filtered = filtered.filter(item =>
      config.filters.categories?.includes(item.category || '')
    );
  }

  // Filter by stock level
  if (config.filters.stockLevelMin !== undefined) {
    filtered = filtered.filter(item => item.stockQuantity >= config.filters.stockLevelMin!);
  }
  if (config.filters.stockLevelMax !== undefined) {
    filtered = filtered.filter(item => item.stockQuantity <= config.filters.stockLevelMax!);
  }

  // Filter by availability
  if (config.filters.availability === 'available') {
    filtered = filtered.filter(item => item.isAvailable);
  } else if (config.filters.availability === 'unavailable') {
    filtered = filtered.filter(item => !item.isAvailable);
  }

  // Filter by suppliers
  if (config.filters.suppliers && config.filters.suppliers.length > 0) {
    filtered = filtered.filter(item =>
      config.filters.suppliers?.includes(item.supplier || '')
    );
  }

  return filtered;
};

/**
 * Get selected fields for export
 */
const getSelectedFields = (config: ProductReportConfig): ReportField[] => {
  return PRODUCT_REPORT_FIELDS.filter(field =>
    config.selectedFields.includes(field.key)
  );
};

/**
 * Export products report as CSV
 */
export const exportProductsToCSV = (
  data: ProductReportData[],
  config: ProductReportConfig,
  options: ExportOptions
): ReportResult => {
  try {
    const fields = getSelectedFields(config);
    const csvContent = generateCSV(data, fields, {
      includeHeaders: config.includeHeaders
    });

    const filename = options.filename || generateFilename('rapport_produits', 'csv');
    downloadCSV(csvContent, filename);

    return {
      success: true,
      filename,
      recordCount: data.length
    };
  } catch (error) {
    console.error('Error exporting products to CSV:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de l\'export CSV'
    };
  }
};

/**
 * Export products report as PDF
 */
export const exportProductsToPDF = (
  data: ProductReportData[],
  config: ProductReportConfig,
  options: ExportOptions
): ReportResult => {
  try {
    const fields = getSelectedFields(config);
    const doc = generateReportPDF(data, fields, config.title, options);

    const filename = options.filename || generateFilename('rapport_produits', 'pdf');
    downloadPDF(doc, filename);

    return {
      success: true,
      filename,
      recordCount: data.length
    };
  } catch (error) {
    console.error('Error exporting products to PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de l\'export PDF'
    };
  }
};

/**
 * Generate products report
 */
export const generateProductReport = (
  products: Product[],
  stockBatches: StockBatch[],
  stocks: Stock[],
  categories: Category[],
  suppliers: Supplier[],
  config: ProductReportConfig,
  options: ExportOptions
): ReportResult => {
  try {
    // Transform data
    const reportData = transformProductsToReportData(
      products,
      stockBatches,
      stocks,
      categories,
      suppliers
    );

    // Apply filters
    const filteredData = filterProductReportData(reportData, config);

    if (filteredData.length === 0) {
      return {
        success: false,
        error: 'Aucune donnée à exporter avec les filtres sélectionnés'
      };
    }

    // Export based on format
    if (config.format === 'csv') {
      return exportProductsToCSV(filteredData, config, options);
    } else if (config.format === 'pdf') {
      return exportProductsToPDF(filteredData, config, options);
    } else {
      return {
        success: false,
        error: 'Format d\'export non supporté'
      };
    }
  } catch (error) {
    console.error('Error generating product report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la génération du rapport'
    };
  }
};
