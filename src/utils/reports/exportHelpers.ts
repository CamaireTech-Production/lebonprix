/**
 * Shared utilities for report export (CSV, PDF, Excel)
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReportField, ExportOptions } from '../../types/reports';

/**
 * Format number with spaces for thousands separator (PDF-safe, no special characters)
 */
const formatNumberForPDF = (value: number): string => {
  // Convert to integer string
  const numStr = Math.round(value).toString();

  // Add space every 3 digits from the right
  const parts = [];
  for (let i = numStr.length; i > 0; i -= 3) {
    const start = Math.max(0, i - 3);
    parts.unshift(numStr.substring(start, i));
  }

  return parts.join(' ');
};

/**
 * Format a value based on its field type
 */
export const formatFieldValue = (value: any, field: ReportField, forPDF: boolean = false): string => {
  if (value === null || value === undefined) return '-';

  // Use custom formatter if provided
  if (field.format) {
    return field.format(value);
  }

  switch (field.type) {
    case 'currency':
      if (forPDF) {
        // For PDF: use ASCII spaces only to avoid encoding issues
        return formatNumberForPDF(Number(value)) + ' FCFA';
      }
      // For CSV/display: use proper French locale with non-breaking spaces
      return `${Number(value).toLocaleString('fr-FR')} FCFA`;

    case 'number':
      if (forPDF) {
        return formatNumberForPDF(Number(value));
      }
      return Number(value).toLocaleString('fr-FR');

    case 'date':
      if (value instanceof Date) {
        return value.toLocaleDateString('fr-FR');
      }
      if (typeof value === 'string' || typeof value === 'number') {
        return new Date(value).toLocaleDateString('fr-FR');
      }
      return '-';

    case 'boolean':
      return value ? 'Oui' : 'Non';

    case 'text':
    default:
      return String(value);
  }
};

/**
 * Escape special characters for CSV format
 */
export const escapeCSV = (value: any): string => {
  if (value === null || value === undefined) return '';

  const stringValue = String(value);

  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

/**
 * Generate CSV content from data
 */
export const generateCSV = <T extends Record<string, any>>(
  data: T[],
  fields: ReportField[],
  options?: { includeHeaders?: boolean }
): string => {
  const includeHeaders = options?.includeHeaders !== false;
  const lines: string[] = [];

  // Add UTF-8 BOM for proper Excel encoding
  const BOM = '\uFEFF';

  // Add headers
  if (includeHeaders) {
    const headers = fields.map(field => escapeCSV(field.label));
    lines.push(headers.join(','));
  }

  // Add data rows
  data.forEach(row => {
    const values = fields.map(field => {
      const value = row[field.key];
      const formatted = formatFieldValue(value, field);
      return escapeCSV(formatted);
    });
    lines.push(values.join(','));
  });

  return BOM + lines.join('\n');
};

/**
 * Download CSV file
 */
export const downloadCSV = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

/**
 * Generate PDF document with company branding
 */
export const generateReportPDF = <T extends Record<string, any>>(
  data: T[],
  fields: ReportField[],
  title: string,
  options: ExportOptions
): jsPDF => {
  const doc = new jsPDF({
    orientation: options.orientation || 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Add company logo if provided
  if (options.companyLogo) {
    try {
      doc.addImage(options.companyLogo, 'PNG', 15, yPos, 30, 30);
      yPos += 35;
    } catch (error) {
      console.warn('Failed to add logo to PDF:', error);
      yPos += 10;
    }
  }

  // Add company name
  if (options.companyName) {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(options.companyName, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;
  }

  // Add title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Add timestamp if requested
  if (options.includeTimestamp) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const timestamp = new Date().toLocaleString('fr-FR');
    doc.text(`Généré le: ${timestamp}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;
  }

  // Prepare table data with PDF-safe formatting
  const headers = fields.map(field => field.label);
  const rows = data.map(row =>
    fields.map(field => formatFieldValue(row[field.key], field, true))
  );

  // Add table
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: yPos,
    theme: 'striped',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [59, 130, 246], // Blue
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { top: 10, left: 15, right: 15 },
  });

  // Add footer if requested
  if (options.includeFooter) {
    const pageCount = doc.getNumberOfPages();
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const footerText = `Page ${i} sur ${pageCount}`;
      doc.text(
        footerText,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
  }

  return doc;
};

/**
 * Download PDF file
 */
export const downloadPDF = (doc: jsPDF, filename: string): void => {
  doc.save(filename);
};

/**
 * Generate filename with timestamp
 */
export const generateFilename = (
  reportType: string,
  format: string,
  includeTimestamp: boolean = true
): string => {
  const timestamp = includeTimestamp
    ? `_${new Date().toISOString().split('T')[0].replace(/-/g, '')}`
    : '';

  return `${reportType}${timestamp}.${format}`;
};

/**
 * Format date range for display
 */
export const formatDateRange = (startDate: Date | null, endDate: Date | null): string => {
  if (!startDate && !endDate) return 'Toutes les dates';

  const format = (date: Date) => date.toLocaleDateString('fr-FR');

  if (startDate && endDate) {
    return `Du ${format(startDate)} au ${format(endDate)}`;
  }

  if (startDate) {
    return `À partir du ${format(startDate)}`;
  }

  if (endDate) {
    return `Jusqu'au ${format(endDate)}`;
  }

  return '';
};

/**
 * Filter data by date range
 */
export const filterByDateRange = <T extends { createdAt?: Date | string | any }>(
  data: T[],
  startDate: Date | null,
  endDate: Date | null,
  dateField: keyof T = 'createdAt'
): T[] => {
  return data.filter(item => {
    const itemDate = item[dateField];

    if (!itemDate) return true; // Include items without date

    const date = itemDate instanceof Date
      ? itemDate
      : new Date(itemDate.seconds ? itemDate.seconds * 1000 : itemDate);

    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;

    return true;
  });
};

/**
 * Calculate summary statistics for numeric fields
 */
export const calculateSummary = <T extends Record<string, any>>(
  data: T[],
  field: string
): { total: number; average: number; min: number; max: number; count: number } => {
  const values = data
    .map(item => Number(item[field]))
    .filter(val => !isNaN(val));

  if (values.length === 0) {
    return { total: 0, average: 0, min: 0, max: 0, count: 0 };
  }

  const total = values.reduce((sum, val) => sum + val, 0);
  const average = total / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  return { total, average, min, max, count: values.length };
};
