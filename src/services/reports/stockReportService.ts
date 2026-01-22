/**
 * Stock Report Service
 * Handles data fetching, filtering, and transformation for stock reports by location
 */

import {
  StockBatch,
  Product
} from '../../types/models';
import {
  StockReportConfig,
  StockReportData,
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
 * Available fields for stock report
 */
export const STOCK_REPORT_FIELDS: ReportField[] = [
  { key: 'productName', label: 'Produit', type: 'text', defaultSelected: true },
  { key: 'batchNumber', label: 'Numéro de lot', type: 'text', defaultSelected: false },
  { key: 'location', label: 'Emplacement', type: 'text', defaultSelected: true },
  { key: 'quantity', label: 'Quantité initiale', type: 'number', defaultSelected: true },
  { key: 'remainingQuantity', label: 'Quantité restante', type: 'number', defaultSelected: true },
  { key: 'damagedQuantity', label: 'Quantité endommagée', type: 'number', defaultSelected: false },
  { key: 'costPrice', label: 'Prix de revient', type: 'currency', defaultSelected: true },
  { key: 'totalValue', label: 'Valeur totale', type: 'currency', defaultSelected: true },
  { key: 'remainingValue', label: 'Valeur restante', type: 'currency', defaultSelected: true },
  { key: 'status', label: 'Statut', type: 'text', defaultSelected: true },
  { key: 'createdAt', label: 'Date de création', type: 'date', defaultSelected: true }
];

/**
 * Transform stock batches to report data format
 */
export const transformStockBatchesToReportData = (
  batches: StockBatch[],
  products: Product[],
  shops?: Array<{ id: string; name: string }>,
  warehouses?: Array<{ id: string; name: string }>
): StockReportData[] => {
  return batches
    .filter(batch => batch.isDeleted !== true && batch.type === 'product')
    .map(batch => {
      const product = products.find(p => p.id === batch.productId);
      const productName = product?.name || `Produit ${batch.productId}`;

      // Get location name
      let location = 'Non spécifié';
      if (batch.locationType === 'shop' && batch.shopId && shops) {
        const shop = shops.find(s => s.id === batch.shopId);
        location = shop ? shop.name : `Boutique ${batch.shopId}`;
      } else if (batch.locationType === 'warehouse' && batch.warehouseId && warehouses) {
        const warehouse = warehouses.find(w => w.id === batch.warehouseId);
        location = warehouse ? warehouse.name : `Entrepôt ${batch.warehouseId}`;
      } else if (batch.locationType === 'production') {
        location = 'Production';
      } else if (batch.locationType === 'global') {
        location = 'Global';
      }

      const totalValue = batch.quantity * batch.costPrice;
      const remainingValue = batch.remainingQuantity * batch.costPrice;

      // Get status label
      const statusLabels: Record<string, string> = {
        'active': 'Actif',
        'depleted': 'Épuisé',
        'corrected': 'Corrigé',
        'deleted': 'Supprimé'
      };

      return {
        id: batch.id,
        productName,
        batchNumber: batch.id.substring(0, 8),
        location,
        quantity: batch.quantity,
        remainingQuantity: batch.remainingQuantity,
        damagedQuantity: batch.damagedQuantity || 0,
        costPrice: batch.costPrice,
        totalValue,
        remainingValue,
        status: statusLabels[batch.status] || batch.status,
        createdAt: batch.createdAt ? new Date(batch.createdAt.seconds * 1000) : new Date(),
        locationType: batch.locationType,
        shopId: batch.shopId,
        warehouseId: batch.warehouseId
      };
    });
};

/**
 * Apply filters to stock report data
 */
export const filterStockReportData = (
  data: StockReportData[],
  config: StockReportConfig
): StockReportData[] => {
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

  // Filter by products
  if (config.filters.products && config.filters.products.length > 0) {
    filtered = filtered.filter(item => 
      config.filters.products!.includes(item.productName)
    );
  }

  // Filter by status
  if (config.filters.status && config.filters.status.length > 0) {
    const statusLabels: Record<string, string> = {
      'active': 'Actif',
      'depleted': 'Épuisé',
      'corrected': 'Corrigé',
      'deleted': 'Supprimé'
    };
    const translatedStatuses = config.filters.status.map(s => statusLabels[s] || s);
    filtered = filtered.filter(item =>
      translatedStatuses.includes(item.status)
    );
  }

  // Filter by shop
  if (config.filters.shopId) {
    filtered = filtered.filter(item => item.shopId === config.filters.shopId);
  }

  // Filter by warehouse
  if (config.filters.warehouseId) {
    filtered = filtered.filter(item => item.warehouseId === config.filters.warehouseId);
  }

  // Filter by location type
  if (config.filters.locationType && config.filters.locationType !== 'all') {
    filtered = filtered.filter(item => item.locationType === config.filters.locationType);
  }

  return filtered;
};

/**
 * Get selected fields for export
 */
const getSelectedFields = (config: StockReportConfig): ReportField[] => {
  return STOCK_REPORT_FIELDS.filter(field =>
    config.selectedFields.includes(field.key)
  );
};

/**
 * Export stock report as CSV
 */
export const exportStockToCSV = (
  data: StockReportData[],
  config: StockReportConfig,
  options: ExportOptions
): ReportResult => {
  try {
    const fields = getSelectedFields(config);

    const csvContent = generateCSV(data, fields, {
      includeHeaders: config.includeHeaders
    });

    const filename = options.filename || generateFilename('rapport_stock', 'csv');
    downloadCSV(csvContent, filename);

    return {
      success: true,
      filename,
      recordCount: data.length
    };
  } catch (error) {
    console.error('Error exporting stock to CSV:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de l\'export CSV'
    };
  }
};

/**
 * Export stock report as PDF
 */
export const exportStockToPDF = (
  data: StockReportData[],
  config: StockReportConfig,
  options: ExportOptions
): ReportResult => {
  try {
    const fields = getSelectedFields(config);

    const doc = generateReportPDF(data, fields, config.title, options);

    const filename = options.filename || generateFilename('rapport_stock', 'pdf');
    downloadPDF(doc, filename);

    return {
      success: true,
      filename,
      recordCount: data.length
    };
  } catch (error) {
    console.error('Error exporting stock to PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de l\'export PDF'
    };
  }
};

/**
 * Generate stock report
 */
export const generateStockReport = (
  batches: StockBatch[],
  products: Product[],
  config: StockReportConfig,
  options: ExportOptions,
  shops?: Array<{ id: string; name: string }>,
  warehouses?: Array<{ id: string; name: string }>
): ReportResult => {
  try {
    // Transform data
    const reportData = transformStockBatchesToReportData(batches, products, shops, warehouses);

    // Apply filters
    const filteredData = filterStockReportData(reportData, config);

    if (filteredData.length === 0) {
      return {
        success: false,
        error: 'Aucune donnée à exporter avec les filtres sélectionnés'
      };
    }

    // Export based on format
    if (config.format === 'csv') {
      return exportStockToCSV(filteredData, config, options);
    } else if (config.format === 'pdf') {
      return exportStockToPDF(filteredData, config, options);
    } else {
      return {
        success: false,
        error: 'Format d\'export non supporté'
      };
    }
  } catch (error) {
    console.error('Error generating stock report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la génération du rapport'
    };
  }
};

