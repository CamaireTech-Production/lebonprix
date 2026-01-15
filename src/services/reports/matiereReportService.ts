/**
 * Matiere Report Service
 * Handles data fetching, filtering, and transformation for matiere reports
 */

import {
  Matiere,
  StockBatch,
  Category,
  Supplier
} from '../../types/models';
import {
  MatiereReportConfig,
  MatiereReportData,
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
 * Available fields for matiere report
 */
export const MATIERE_REPORT_FIELDS: ReportField[] = [
  { key: 'name', label: 'Nom de la matière', type: 'text', defaultSelected: true },
  { key: 'reference', label: 'Référence', type: 'text', defaultSelected: false },
  { key: 'category', label: 'Catégorie', type: 'text', defaultSelected: true },
  { key: 'unit', label: 'Unité', type: 'text', defaultSelected: true },
  { key: 'quantity', label: 'Quantité disponible', type: 'number', defaultSelected: true },
  { key: 'costPrice', label: 'Coût unitaire', type: 'currency', defaultSelected: true },
  { key: 'supplier', label: 'Fournisseur', type: 'text', defaultSelected: true },
  { key: 'description', label: 'Description', type: 'text', defaultSelected: false },
  { key: 'createdAt', label: 'Date de création', type: 'date', defaultSelected: false }
];

/**
 * Calculate total stock quantity for a matiere from stock batches
 */
const calculateStockQuantity = (
  matiereId: string,
  stockBatches: StockBatch[]
): number => {
  const matiereBatches = stockBatches.filter(
    batch => batch.matiereId === matiereId &&
             batch.status === 'active' &&
             !batch.isDeleted
  );

  if (matiereBatches.length > 0) {
    return matiereBatches.reduce((sum, batch) => sum + (batch.remainingQuantity || 0), 0);
  }

  return 0;
};

/**
 * Get primary supplier for a matiere (most recent batch)
 */
const getPrimarySupplier = (
  matiereId: string,
  stockBatches: StockBatch[],
  suppliers: Supplier[]
): string => {
  const matiereBatches = stockBatches
    .filter(batch => batch.matiereId === matiereId && batch.supplierId && !batch.isDeleted)
    .sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime; // Most recent first
    });

  if (matiereBatches.length === 0) return '-';

  const supplierId = matiereBatches[0].supplierId;
  const supplier = suppliers.find(s => s.id === supplierId);
  return supplier?.name || '-';
};

/**
 * Get average cost price for a matiere from stock batches
 */
const getAverageCostPrice = (
  matiereId: string,
  stockBatches: StockBatch[],
  matiereCostPrice?: number
): number => {
  const matiereBatches = stockBatches.filter(
    batch => batch.matiereId === matiereId &&
             batch.status === 'active' &&
             !batch.isDeleted &&
             batch.costPrice > 0
  );

  if (matiereBatches.length === 0) {
    return matiereCostPrice || 0;
  }

  const totalCost = matiereBatches.reduce((sum, batch) => sum + (batch.costPrice * batch.remainingQuantity), 0);
  const totalQuantity = matiereBatches.reduce((sum, batch) => sum + batch.remainingQuantity, 0);

  return totalQuantity > 0 ? totalCost / totalQuantity : matiereCostPrice || 0;
};

/**
 * Transform matieres to report data format
 */
export const transformMatieresToReportData = (
  matieres: Matiere[],
  stockBatches: StockBatch[],
  categories: Category[],
  suppliers: Supplier[]
): MatiereReportData[] => {
  return matieres.map(matiere => {
    const quantity = calculateStockQuantity(matiere.id, stockBatches);
    const supplier = getPrimarySupplier(matiere.id, stockBatches, suppliers);
    const category = categories.find(c => c.name === matiere.refCategorie)?.name || matiere.refCategorie || '-';
    const costPrice = getAverageCostPrice(matiere.id, stockBatches, matiere.costPrice);

    return {
      id: matiere.id,
      name: matiere.name,
      reference: matiere.refStock || '',
      category,
      unit: matiere.unit || 'unité',
      quantity,
      costPrice,
      supplier,
      description: matiere.description || '',
      createdAt: matiere.createdAt ? new Date(matiere.createdAt.seconds * 1000) : undefined
    };
  });
};

/**
 * Apply filters to matiere report data
 */
export const filterMatiereReportData = (
  data: MatiereReportData[],
  config: MatiereReportConfig
): MatiereReportData[] => {
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
    filtered = filtered.filter(item => item.quantity >= config.filters.stockLevelMin!);
  }
  if (config.filters.stockLevelMax !== undefined) {
    filtered = filtered.filter(item => item.quantity <= config.filters.stockLevelMax!);
  }

  return filtered;
};

/**
 * Get selected fields for export
 */
const getSelectedFields = (config: MatiereReportConfig): ReportField[] => {
  return MATIERE_REPORT_FIELDS.filter(field =>
    config.selectedFields.includes(field.key)
  );
};

/**
 * Export matieres report as CSV
 */
export const exportMatieresToCSV = (
  data: MatiereReportData[],
  config: MatiereReportConfig,
  options: ExportOptions
): ReportResult => {
  try {
    const fields = getSelectedFields(config);
    const csvContent = generateCSV(data, fields, {
      includeHeaders: config.includeHeaders
    });

    const filename = options.filename || generateFilename('rapport_matieres', 'csv');
    downloadCSV(csvContent, filename);

    return {
      success: true,
      filename,
      recordCount: data.length
    };
  } catch (error) {
    console.error('Error exporting matieres to CSV:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de l\'export CSV'
    };
  }
};

/**
 * Export matieres report as PDF
 */
export const exportMatieresToPDF = (
  data: MatiereReportData[],
  config: MatiereReportConfig,
  options: ExportOptions
): ReportResult => {
  try {
    const fields = getSelectedFields(config);
    const doc = generateReportPDF(data, fields, config.title, options);

    const filename = options.filename || generateFilename('rapport_matieres', 'pdf');
    downloadPDF(doc, filename);

    return {
      success: true,
      filename,
      recordCount: data.length
    };
  } catch (error) {
    console.error('Error exporting matieres to PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de l\'export PDF'
    };
  }
};

/**
 * Generate matieres report
 */
export const generateMatiereReport = (
  matieres: Matiere[],
  stockBatches: StockBatch[],
  categories: Category[],
  suppliers: Supplier[],
  config: MatiereReportConfig,
  options: ExportOptions
): ReportResult => {
  try {
    // Transform data
    const reportData = transformMatieresToReportData(
      matieres,
      stockBatches,
      categories,
      suppliers
    );

    // Apply filters
    const filteredData = filterMatiereReportData(reportData, config);

    if (filteredData.length === 0) {
      return {
        success: false,
        error: 'Aucune donnée à exporter avec les filtres sélectionnés'
      };
    }

    // Export based on format
    if (config.format === 'csv') {
      return exportMatieresToCSV(filteredData, config, options);
    } else if (config.format === 'pdf') {
      return exportMatieresToPDF(filteredData, config, options);
    } else {
      return {
        success: false,
        error: 'Format d\'export non supporté'
      };
    }
  } catch (error) {
    console.error('Error generating matiere report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la génération du rapport'
    };
  }
};
