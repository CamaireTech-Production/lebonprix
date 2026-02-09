import { PDFReceiptGenerator } from '@utils/pdf/PDFReceiptGenerator';
import type { Sale, Product, Company } from '../../types/models';

/**
 * Generate sales receipt PDF and download it
 * @param sale - Sale object
 * @param products - Products array
 * @param company - Company information
 * @param filename - Filename for the PDF (without extension)
 */
export const generatePDF = async (
  sale: Sale | Partial<Sale>,
  products: Product[],
  company: Company,
  filename: string
): Promise<void> => {
  try {
    const generator = new PDFReceiptGenerator();
    await generator.generateSalesReceipt(sale, products, company, {
      download: true,
      filename,
    });
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
};

/**
 * Generate sales receipt PDF and return as Blob for sharing
 * @param sale - Sale object
 * @param products - Products array
 * @param company - Company information
 * @param filename - Filename for the PDF (without extension)
 * @returns Blob of the PDF
 */
export const generatePDFBlob = async (
  sale: Sale | Partial<Sale>,
  products: Product[],
  company: Company,
  filename: string
): Promise<Blob> => {
  try {
    const generator = new PDFReceiptGenerator();
    return await generator.generateSalesReceipt(sale, products, company, {
      download: false,
      filename,
    });
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
};