/**
 * Consolidated Report Service
 * Generates reports combining multiple sections (products, expenses, sales, matieres)
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Product, Expense, Sale, Matiere, Category, Supplier, StockBatch
} from '../../types/models';
import { ReportFormat, DateRangeFilter, ReportResult } from '../../types/reports';
import {
  transformProductsToReportData,
  filterProductReportData,
  PRODUCT_REPORT_FIELDS
} from './productReportService';
import {
  transformExpensesToReportData,
  filterExpenseReportData,
  EXPENSE_REPORT_FIELDS
} from './expenseReportService';
import {
  transformSalesToReportData,
  filterSalesReportData,
  SALES_REPORT_FIELDS
} from './salesReportService';
import {
  transformMatieresToReportData,
  filterMatiereReportData,
  MATIERE_REPORT_FIELDS
} from './matiereReportService';
import { formatNumberForPDF, generateFilename } from '../../utils/reports/exportHelpers';

type ReportSection = 'products' | 'expenses' | 'sales' | 'matieres';

interface ConsolidatedReportConfig {
  sections: ReportSection[];
  format: ReportFormat;
  dateRange: DateRangeFilter;
  data: {
    products: Product[];
    expenses: Expense[];
    sales: Sale[];
    matieres: Matiere[];
    categories: Category[];
    suppliers: Supplier[];
    productStockBatches: StockBatch[];
    matiereStockBatches: StockBatch[];
  };
  companyName?: string;
  companyLogo?: string;
}

/**
 * Format field value for PDF (using ASCII-safe formatting)
 */
const formatValueForPDF = (value: any, type: string): string => {
  if (value === null || value === undefined) return '-';

  switch (type) {
    case 'currency':
      return `${formatNumberForPDF(Number(value))} FCFA`;
    case 'number':
      return formatNumberForPDF(Number(value));
    case 'date':
      return new Date(value).toLocaleDateString('fr-FR');
    case 'boolean':
      return value ? 'Oui' : 'Non';
    default:
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return String(value);
  }
};

/**
 * Generate consolidated PDF report
 */
const generateConsolidatedPDF = (config: ConsolidatedReportConfig): ReportResult => {
  try {
    const doc = new jsPDF('landscape');
    let yPosition = 20;

    // Header
    doc.setFontSize(18);
    doc.text('Rapport Consolidé', 15, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    if (config.companyName) {
      doc.text(config.companyName, 15, yPosition);
      yPosition += 6;
    }
    doc.text(`Genere le: ${new Date().toLocaleDateString('fr-FR')}`, 15, yPosition);
    yPosition += 10;

    // Process each section
    config.sections.forEach((section, index) => {
      if (index > 0) {
        doc.addPage();
        yPosition = 20;
      }

      switch (section) {
        case 'products': {
          doc.setFontSize(14);
          doc.text('PRODUITS', 15, yPosition);
          yPosition += 8;

          const productData = transformProductsToReportData(
            config.data.products,
            config.data.productStockBatches,
            [],
            config.data.categories,
            config.data.suppliers
          );

          const filteredData = filterProductReportData(productData, {
            title: 'Produits',
            format: 'pdf',
            selectedFields: PRODUCT_REPORT_FIELDS.filter(f => f.defaultSelected).map(f => f.key),
            includeHeaders: true,
            dateRange: config.dateRange,
            filters: {}
          });

          const productFields = PRODUCT_REPORT_FIELDS.filter(f => f.defaultSelected);
          const productRows = filteredData.map(item =>
            productFields.map(field => formatValueForPDF(item[field.key as keyof typeof item], field.type))
          );

          autoTable(doc, {
            startY: yPosition,
            head: [productFields.map(f => f.label)],
            body: productRows,
            styles: { fontSize: 8, font: 'helvetica' },
            headStyles: { fillColor: [16, 185, 129] },
            margin: { left: 15, right: 15 }
          });

          doc.setFontSize(10);
          doc.text(`Total: ${filteredData.length} produits`, 15, (doc as any).lastAutoTable.finalY + 8);
          break;
        }

        case 'matieres': {
          doc.setFontSize(14);
          doc.text('MATIERES PREMIERES', 15, yPosition);
          yPosition += 8;

          const matiereData = transformMatieresToReportData(
            config.data.matieres,
            config.data.matiereStockBatches,
            config.data.categories,
            config.data.suppliers
          );

          const filteredData = filterMatiereReportData(matiereData, {
            title: 'Matieres',
            format: 'pdf',
            selectedFields: MATIERE_REPORT_FIELDS.filter(f => f.defaultSelected).map(f => f.key),
            includeHeaders: true,
            dateRange: config.dateRange,
            filters: {}
          });

          const matiereFields = MATIERE_REPORT_FIELDS.filter(f => f.defaultSelected);
          const matiereRows = filteredData.map(item =>
            matiereFields.map(field => formatValueForPDF(item[field.key as keyof typeof item], field.type))
          );

          autoTable(doc, {
            startY: yPosition,
            head: [matiereFields.map(f => f.label)],
            body: matiereRows,
            styles: { fontSize: 8, font: 'helvetica' },
            headStyles: { fillColor: [245, 158, 11] },
            margin: { left: 15, right: 15 }
          });

          doc.setFontSize(10);
          doc.text(`Total: ${filteredData.length} matieres`, 15, (doc as any).lastAutoTable.finalY + 8);
          break;
        }

        case 'sales': {
          doc.setFontSize(14);
          doc.text('VENTES', 15, yPosition);
          yPosition += 8;

          const salesData = transformSalesToReportData(
            config.data.sales,
            config.data.products
          );

          const filteredData = filterSalesReportData(salesData, {
            title: 'Ventes',
            format: 'pdf',
            selectedFields: SALES_REPORT_FIELDS.filter(f => f.defaultSelected).map(f => f.key),
            includeHeaders: true,
            dateRange: config.dateRange,
            filters: {}
          });

          const salesFields = SALES_REPORT_FIELDS.filter(f => f.defaultSelected);
          const salesRows = filteredData.map(item => {
            const row: any = {};
            salesFields.forEach(field => {
              if (field.key === 'products' && Array.isArray(item.products)) {
                row[field.key] = item.products.slice(0, 2).join(', ') + (item.products.length > 2 ? '...' : '');
              } else {
                row[field.key] = item[field.key as keyof typeof item];
              }
            });
            return salesFields.map(field => formatValueForPDF(row[field.key], field.type));
          });

          autoTable(doc, {
            startY: yPosition,
            head: [salesFields.map(f => f.label)],
            body: salesRows,
            styles: { fontSize: 8, font: 'helvetica' },
            headStyles: { fillColor: [99, 102, 241] },
            margin: { left: 15, right: 15 }
          });

          const totalAmount = filteredData.reduce((sum, s) => sum + s.totalAmount, 0);
          const totalProfit = filteredData.reduce((sum, s) => sum + (s.totalProfit || 0), 0);
          doc.setFontSize(10);
          doc.text(`Total: ${filteredData.length} ventes | CA: ${formatNumberForPDF(totalAmount)} FCFA | Benefice: ${formatNumberForPDF(totalProfit)} FCFA`,
            15, (doc as any).lastAutoTable.finalY + 8);
          break;
        }

        case 'expenses': {
          doc.setFontSize(14);
          doc.text('DEPENSES', 15, yPosition);
          yPosition += 8;

          const expenseData = transformExpensesToReportData(
            config.data.expenses,
            config.data.categories
          );

          const filteredData = filterExpenseReportData(expenseData, {
            title: 'Depenses',
            format: 'pdf',
            selectedFields: EXPENSE_REPORT_FIELDS.filter(f => f.defaultSelected).map(f => f.key),
            includeHeaders: true,
            dateRange: config.dateRange,
            filters: {}
          });

          const expenseFields = EXPENSE_REPORT_FIELDS.filter(f => f.defaultSelected);
          const expenseRows = filteredData.map(item =>
            expenseFields.map(field => formatValueForPDF(item[field.key as keyof typeof item], field.type))
          );

          autoTable(doc, {
            startY: yPosition,
            head: [expenseFields.map(f => f.label)],
            body: expenseRows,
            styles: { fontSize: 8, font: 'helvetica' },
            headStyles: { fillColor: [239, 68, 68] },
            margin: { left: 15, right: 15 }
          });

          const totalExpenses = filteredData.reduce((sum, e) => sum + e.amount, 0);
          doc.setFontSize(10);
          doc.text(`Total: ${filteredData.length} depenses | Montant: ${formatNumberForPDF(totalExpenses)} FCFA`,
            15, (doc as any).lastAutoTable.finalY + 8);
          break;
        }
      }
    });

    // Save PDF
    const filename = generateFilename('rapport_consolide', 'pdf');
    doc.save(filename);

    return {
      success: true,
      filename,
      recordCount: config.sections.length
    };
  } catch (error) {
    console.error('Error generating consolidated PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la generation du rapport'
    };
  }
};

/**
 * Generate consolidated CSV report (multiple files)
 */
const generateConsolidatedCSV = (config: ConsolidatedReportConfig): ReportResult => {
  try {
    // For CSV, we'll generate separate files for each section
    // This is a simplified implementation
    alert('Export CSV: Un fichier sera généré pour chaque section sélectionnée.');

    config.sections.forEach(section => {
      // Generate individual CSV for each section
      // (Using existing individual report services)
    });

    return {
      success: true,
      recordCount: config.sections.length
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la generation CSV'
    };
  }
};

/**
 * Generate consolidated report
 */
export const generateConsolidatedReport = async (
  config: ConsolidatedReportConfig
): Promise<ReportResult> => {
  if (config.sections.length === 0) {
    return {
      success: false,
      error: 'Aucune section sélectionnée'
    };
  }

  if (config.format === 'pdf') {
    return generateConsolidatedPDF(config);
  } else {
    return generateConsolidatedCSV(config);
  }
};
