/**
 * Sales Report Service
 * Handles data fetching, filtering, and transformation for sales reports
 */

import {
  Sale,
  Product
} from '../../types/models';
import {
  SalesReportConfig,
  SalesReportData,
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
 * Available fields for sales report
 */
export const SALES_REPORT_FIELDS: ReportField[] = [
  { key: 'customerName', label: 'Client', type: 'text', defaultSelected: true },
  { key: 'products', label: 'Produits', type: 'text', defaultSelected: true },
  { key: 'totalAmount', label: 'Montant Total', type: 'currency', defaultSelected: true },
  { key: 'totalCost', label: 'Coût Total', type: 'currency', defaultSelected: false },
  { key: 'totalProfit', label: 'Bénéfice Total', type: 'currency', defaultSelected: true },
  { key: 'profitMargin', label: 'Marge (%)', type: 'number', defaultSelected: true },
  { key: 'status', label: 'Statut', type: 'text', defaultSelected: true },
  { key: 'paymentStatus', label: 'Paiement', type: 'text', defaultSelected: true },
  { key: 'deliveryFee', label: 'Frais de livraison', type: 'currency', defaultSelected: false },
  { key: 'sourceLocation', label: 'Source', type: 'text', defaultSelected: false },
  { key: 'date', label: 'Date', type: 'date', defaultSelected: true }
];

/**
 * Transform sales to report data format
 */
export const transformSalesToReportData = (
  sales: Sale[],
  products: Product[],
  shops?: Array<{ id: string; name: string }>,
  warehouses?: Array<{ id: string; name: string }>
): SalesReportData[] => {
  return sales
    .filter(sale => sale.isAvailable !== false)
    .map(sale => {
      // Get product names
      const productNames = sale.products.map(sp => {
        const product = products.find(p => p.id === sp.productId);
        return product ? `${product.name} (x${sp.quantity})` : `Produit ${sp.productId} (x${sp.quantity})`;
      });

      // Get date
      const date = sale.createdAt ? new Date(sale.createdAt.seconds * 1000) : new Date();

      // Calculate profit margin
      const profitMargin = sale.averageProfitMargin ||
        (sale.totalCost && sale.totalAmount ? ((sale.totalAmount - sale.totalCost) / sale.totalAmount * 100) : 0);

      // Get status labels
      const statusLabels: Record<string, string> = {
        'commande': 'Commande',
        'under_delivery': 'En livraison',
        'paid': 'Payée',
        'draft': 'Brouillon'
      };

      const paymentStatusLabels: Record<string, string> = {
        'pending': 'En attente',
        'paid': 'Payé',
        'cancelled': 'Annulé'
      };

      // Get source location name
      let sourceLocation: string | undefined;
      if (sale.sourceType === 'shop' && sale.shopId && shops) {
        const shop = shops.find(s => s.id === sale.shopId);
        sourceLocation = shop ? shop.name : `Boutique ${sale.shopId}`;
      } else if (sale.sourceType === 'warehouse' && sale.warehouseId && warehouses) {
        const warehouse = warehouses.find(w => w.id === sale.warehouseId);
        sourceLocation = warehouse ? warehouse.name : `Entrepôt ${sale.warehouseId}`;
      }

      return {
        id: sale.id,
        customerName: sale.customerInfo?.name || 'Client non spécifié',
        products: productNames,
        totalAmount: sale.totalAmount,
        totalCost: sale.totalCost,
        totalProfit: sale.totalProfit,
        profitMargin,
        status: statusLabels[sale.status] || sale.status,
        paymentStatus: paymentStatusLabels[sale.paymentStatus] || sale.paymentStatus,
        date,
        deliveryFee: sale.deliveryFee,
        sourceLocation,
        sourceType: sale.sourceType,
        shopId: sale.shopId,
        warehouseId: sale.warehouseId
      };
    });
};

/**
 * Apply filters to sales report data
 */
export const filterSalesReportData = (
  data: SalesReportData[],
  config: SalesReportConfig
): SalesReportData[] => {
  let filtered = [...data];

  // Filter by date range
  if (config.dateRange?.startDate || config.dateRange?.endDate) {
    filtered = filterByDateRange(
      filtered,
      config.dateRange.startDate,
      config.dateRange.endDate,
      'date'
    );
  }

  // Filter by status
  if (config.filters.status && config.filters.status.length > 0) {
    const statusLabels: Record<string, string> = {
      'commande': 'Commande',
      'under_delivery': 'En livraison',
      'paid': 'Payée',
      'draft': 'Brouillon'
    };
    const translatedStatuses = config.filters.status.map(s => statusLabels[s] || s);
    filtered = filtered.filter(item =>
      translatedStatuses.includes(item.status)
    );
  }

  // Filter by payment status
  if (config.filters.paymentStatus && config.filters.paymentStatus.length > 0) {
    const paymentLabels: Record<string, string> = {
      'pending': 'En attente',
      'paid': 'Payé',
      'cancelled': 'Annulé'
    };
    const translatedPaymentStatuses = config.filters.paymentStatus.map(s => paymentLabels[s] || s);
    filtered = filtered.filter(item =>
      translatedPaymentStatuses.includes(item.paymentStatus)
    );
  }

  // Filter by amount range
  if (config.filters.amountMin !== undefined) {
    filtered = filtered.filter(item => item.totalAmount >= config.filters.amountMin!);
  }
  if (config.filters.amountMax !== undefined) {
    filtered = filtered.filter(item => item.totalAmount <= config.filters.amountMax!);
  }

  // Filter by shop
  if (config.filters.shopId) {
    filtered = filtered.filter(item => item.shopId === config.filters.shopId);
  }

  // Filter by warehouse
  if (config.filters.warehouseId) {
    filtered = filtered.filter(item => item.warehouseId === config.filters.warehouseId);
  }

  // Filter by source type
  if (config.filters.sourceType && config.filters.sourceType !== 'all') {
    filtered = filtered.filter(item => item.sourceType === config.filters.sourceType);
  }

  return filtered;
};

/**
 * Get selected fields for export
 */
const getSelectedFields = (config: SalesReportConfig): ReportField[] => {
  return SALES_REPORT_FIELDS.filter(field =>
    config.selectedFields.includes(field.key)
  );
};

/**
 * Export sales report as CSV
 */
export const exportSalesToCSV = (
  data: SalesReportData[],
  config: SalesReportConfig,
  options: ExportOptions
): ReportResult => {
  try {
    const fields = getSelectedFields(config);

    // Transform products array to string for CSV
    const csvData = data.map(item => ({
      ...item,
      products: Array.isArray(item.products) ? item.products.join(', ') : item.products
    }));

    const csvContent = generateCSV(csvData, fields, {
      includeHeaders: config.includeHeaders
    });

    const filename = options.filename || generateFilename('rapport_ventes', 'csv');
    downloadCSV(csvContent, filename);

    return {
      success: true,
      filename,
      recordCount: data.length
    };
  } catch (error) {
    console.error('Error exporting sales to CSV:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de l\'export CSV'
    };
  }
};

/**
 * Export sales report as PDF
 */
export const exportSalesToPDF = (
  data: SalesReportData[],
  config: SalesReportConfig,
  options: ExportOptions
): ReportResult => {
  try {
    const fields = getSelectedFields(config);

    // Transform products array to string for PDF
    const pdfData = data.map(item => ({
      ...item,
      products: Array.isArray(item.products) ? item.products.join(', ') : item.products
    }));

    const doc = generateReportPDF(pdfData, fields, config.title, options);

    const filename = options.filename || generateFilename('rapport_ventes', 'pdf');
    downloadPDF(doc, filename);

    return {
      success: true,
      filename,
      recordCount: data.length
    };
  } catch (error) {
    console.error('Error exporting sales to PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de l\'export PDF'
    };
  }
};

/**
 * Generate sales report
 */
export const generateSalesReport = (
  sales: Sale[],
  products: Product[],
  config: SalesReportConfig,
  options: ExportOptions,
  shops?: Array<{ id: string; name: string }>,
  warehouses?: Array<{ id: string; name: string }>
): ReportResult => {
  try {
    // Transform data
    const reportData = transformSalesToReportData(sales, products, shops, warehouses);

    // Apply filters
    const filteredData = filterSalesReportData(reportData, config);

    if (filteredData.length === 0) {
      return {
        success: false,
        error: 'Aucune donnée à exporter avec les filtres sélectionnés'
      };
    }

    // Export based on format
    if (config.format === 'csv') {
      return exportSalesToCSV(filteredData, config, options);
    } else if (config.format === 'pdf') {
      return exportSalesToPDF(filteredData, config, options);
    } else {
      return {
        success: false,
        error: 'Format d\'export non supporté'
      };
    }
  } catch (error) {
    console.error('Error generating sales report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la génération du rapport'
    };
  }
};
