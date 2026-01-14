/**
 * Expenses Report Service
 * Handles data fetching, filtering, and transformation for expense reports
 */

import {
  Expense,
  Category
} from '../../types/models';
import {
  ExpenseReportConfig,
  ExpenseReportData,
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
 * Available fields for expense report
 */
export const EXPENSE_REPORT_FIELDS: ReportField[] = [
  { key: 'description', label: 'Description', type: 'text', defaultSelected: true },
  { key: 'amount', label: 'Montant', type: 'currency', defaultSelected: true },
  { key: 'category', label: 'Catégorie', type: 'text', defaultSelected: true },
  { key: 'date', label: 'Date', type: 'date', defaultSelected: true },
  { key: 'createdAt', label: 'Date de création', type: 'date', defaultSelected: false },
  { key: 'createdBy', label: 'Créé par', type: 'text', defaultSelected: false }
];

/**
 * Transform expenses to report data format
 */
export const transformExpensesToReportData = (
  expenses: Expense[],
  categories: Category[]
): ExpenseReportData[] => {
  return expenses
    .filter(expense => expense.isAvailable !== false)
    .map(expense => {
    // Get category name
    const category = categories.find(c => c.name === expense.category)?.name || expense.category || '-';

    // Get date (prefer expense.date over createdAt)
    const dateTimestamp = expense.date || expense.createdAt;
    const date = dateTimestamp ? new Date(dateTimestamp.seconds * 1000) : new Date();

    // Get created at date
    const createdAt = expense.createdAt ? new Date(expense.createdAt.seconds * 1000) : undefined;

    // Get created by user (employee name if available)
    const createdBy = expense.createdBy?.username || '-';

    return {
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      category,
      date,
      createdAt,
      createdBy
    };
  });
};

/**
 * Apply filters to expense report data
 */
export const filterExpenseReportData = (
  data: ExpenseReportData[],
  config: ExpenseReportConfig
): ExpenseReportData[] => {
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

  // Filter by categories
  if (config.filters.categories && config.filters.categories.length > 0) {
    filtered = filtered.filter(item =>
      config.filters.categories?.includes(item.category || '')
    );
  }

  // Filter by amount range
  if (config.filters.amountMin !== undefined) {
    filtered = filtered.filter(item => item.amount >= config.filters.amountMin!);
  }
  if (config.filters.amountMax !== undefined) {
    filtered = filtered.filter(item => item.amount <= config.filters.amountMax!);
  }

  return filtered;
};

/**
 * Get selected fields for export
 */
const getSelectedFields = (config: ExpenseReportConfig): ReportField[] => {
  return EXPENSE_REPORT_FIELDS.filter(field =>
    config.selectedFields.includes(field.key)
  );
};

/**
 * Export expenses report as CSV
 */
export const exportExpensesToCSV = (
  data: ExpenseReportData[],
  config: ExpenseReportConfig,
  options: ExportOptions
): ReportResult => {
  try {
    const fields = getSelectedFields(config);
    const csvContent = generateCSV(data, fields, {
      includeHeaders: config.includeHeaders
    });

    const filename = options.filename || generateFilename('rapport_depenses', 'csv');
    downloadCSV(csvContent, filename);

    return {
      success: true,
      filename,
      recordCount: data.length
    };
  } catch (error) {
    console.error('Error exporting expenses to CSV:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de l\'export CSV'
    };
  }
};

/**
 * Export expenses report as PDF
 */
export const exportExpensesToPDF = (
  data: ExpenseReportData[],
  config: ExpenseReportConfig,
  options: ExportOptions
): ReportResult => {
  try {
    const fields = getSelectedFields(config);
    const doc = generateReportPDF(data, fields, config.title, options);

    const filename = options.filename || generateFilename('rapport_depenses', 'pdf');
    downloadPDF(doc, filename);

    return {
      success: true,
      filename,
      recordCount: data.length
    };
  } catch (error) {
    console.error('Error exporting expenses to PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de l\'export PDF'
    };
  }
};

/**
 * Generate expenses report
 */
export const generateExpenseReport = (
  expenses: Expense[],
  categories: Category[],
  config: ExpenseReportConfig,
  options: ExportOptions
): ReportResult => {
  try {
    // Transform data
    const reportData = transformExpensesToReportData(expenses, categories);

    // Apply filters
    const filteredData = filterExpenseReportData(reportData, config);

    if (filteredData.length === 0) {
      return {
        success: false,
        error: 'Aucune donnée à exporter avec les filtres sélectionnés'
      };
    }

    // Export based on format
    if (config.format === 'csv') {
      return exportExpensesToCSV(filteredData, config, options);
    } else if (config.format === 'pdf') {
      return exportExpensesToPDF(filteredData, config, options);
    } else {
      return {
        success: false,
        error: 'Format d\'export non supporté'
      };
    }
  } catch (error) {
    console.error('Error generating expense report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la génération du rapport'
    };
  }
};
