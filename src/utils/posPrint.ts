import { generatePDF, generatePDFBlob } from './pdf';
import { showSuccessToast, showErrorToast } from './toast';
import type { Sale, Product, Company } from '../types/models';

/**
 * Print POS bill as PDF
 * @param sale - Sale object (can be temporary if not yet saved)
 * @param products - Array of products
 * @param company - Company information
 * @param filename - Filename for the PDF
 */
export const printPOSBill = async (
  sale: Sale | Partial<Sale>,
  products: Product[],
  company: Company,
  filename: string = `bill-${Date.now()}`
): Promise<void> => {
  try {
    await generatePDF(sale as any, products, company, filename);
    showSuccessToast('Bill printed successfully');
  } catch (error) {
    console.error('Error printing bill:', error);
    showErrorToast('Failed to print bill. Please try again.');
    throw error;
  }
};

/**
 * Share POS bill as PDF blob
 * @param sale - Sale object (can be temporary if not yet saved)
 * @param products - Array of products
 * @param company - Company information
 * @param filename - Filename for the PDF
 * @returns Blob of the PDF
 */
export const sharePOSBill = async (
  sale: Sale | Partial<Sale>,
  products: Product[],
  company: Company,
  filename: string = `bill-${Date.now()}`
): Promise<Blob> => {
  try {
    const blob = await generatePDFBlob(sale as any, products, company, filename);
    return blob;
  } catch (error) {
    console.error('Error sharing bill:', error);
    showErrorToast('Failed to generate bill. Please try again.');
    throw error;
  }
};

/**
 * Print bill using browser's print dialog
 * Creates a temporary print-friendly HTML page
 * @param sale - Sale object (can be temporary if not yet saved)
 * @param products - Array of products
 * @param company - Company information
 */
export const printPOSBillDirect = (
  sale: Sale | Partial<Sale>,
  products: Product[],
  company: Company
): void => {
  try {
    // Calculate totals
    const subtotal = sale.products?.reduce((total, p) => {
      const price = (p as any).negotiatedPrice || (p as any).basePrice;
      return total + price * (p as any).quantity;
    }, 0) || 0;
    
    // Get discount amount (can be from discountValue field or calculated)
    const discountAmount = (sale as any).discountValue || 0;
    
    // Get tax amount
    const taxAmount = (sale as any).tax || 0;
    
    // Calculate total: subtotal + deliveryFee - discount + tax
    // If totalAmount is already set, use it (it should already include discount and tax)
    const total = sale.totalAmount || (subtotal + (sale.deliveryFee || 0) - discountAmount + taxAmount);

    // Format date
    const saleDate = sale.createdAt?.seconds
      ? new Date(sale.createdAt.seconds * 1000).toLocaleDateString()
      : new Date().toLocaleDateString();

    // Create print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showErrorToast('Please allow pop-ups to print the bill');
      return;
    }

    // Build products table HTML
    const productsTable = sale.products?.map((saleProduct: any) => {
      const product = products.find((p: Product) => p.id === saleProduct.productId);
      const unitPrice = saleProduct.negotiatedPrice || saleProduct.basePrice;
      const totalPrice = unitPrice * saleProduct.quantity;
      return `
        <tr>
          <td>${product?.name || 'Unknown'}</td>
          <td style="text-align: center;">${saleProduct.quantity}</td>
          <td style="text-align: right;">${unitPrice.toLocaleString()} XAF</td>
          <td style="text-align: right;">${totalPrice.toLocaleString()} XAF</td>
        </tr>
      `;
    }).join('') || '';

    // Create print-friendly HTML
    const printHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bill - ${sale.id || 'Temporary'}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              font-size: 12px;
              line-height: 1.5;
              color: #000;
              padding: 20px;
              background: white;
            }
            @media print {
              body {
                padding: 0;
              }
              @page {
                margin: 1cm;
              }
            }
            .header {
              display: flex;
              justify-content: space-between;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 2px solid #000;
            }
            .company-info {
              flex: 1;
            }
            .company-name {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .bill-info {
              text-align: right;
            }
            .bill-title {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .customer-info {
              margin: 20px 0;
            }
            .customer-title {
              font-weight: bold;
              margin-bottom: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              padding: 8px;
              text-align: left;
              border-bottom: 1px solid #e5e7eb;
            }
            th {
              font-weight: 600;
              background-color: #f9fafb;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .totals {
              margin-top: 20px;
              padding-top: 10px;
              border-top: 2px solid #000;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
            }
            .total-final {
              font-size: 16px;
              font-weight: bold;
              margin-top: 10px;
              padding-top: 10px;
              border-top: 1px solid #000;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 10px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              <div class="company-name">${company.name || ''}</div>
              <div>${company.location || ''}</div>
              <div>Phone: ${company.phone || ''}</div>
              ${company.email ? `<div>Email: ${company.email}</div>` : ''}
            </div>
            <div class="bill-info">
              <div class="bill-title">Bill</div>
              <div>No. ${sale.id || 'Temporary'}</div>
              <div>Date: ${saleDate}</div>
            </div>
          </div>

          <div class="customer-info">
            <div class="customer-title">Customer</div>
            <div>${sale.customerInfo?.name || 'Walk-in Customer'}</div>
            ${sale.customerInfo?.phone ? `<div>Phone: ${sale.customerInfo.phone}</div>` : ''}
            ${sale.customerInfo?.quarter ? `<div>Quarter: ${sale.customerInfo.quarter}</div>` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th class="text-center">Quantity</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${productsTable}
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>${subtotal.toLocaleString()} XAF</span>
            </div>
            ${sale.deliveryFee && sale.deliveryFee > 0 ? `
            <div class="total-row">
              <span>Delivery Fee:</span>
              <span>${sale.deliveryFee.toLocaleString()} XAF</span>
            </div>
            ` : ''}
            ${discountAmount > 0 ? `
            <div class="total-row" style="color: #dc2626;">
              <span>Remise:</span>
              <span>-${discountAmount.toLocaleString()} XAF</span>
            </div>
            ` : ''}
            ${taxAmount > 0 ? `
            <div class="total-row">
              <span>Tax:</span>
              <span>${taxAmount.toLocaleString()} XAF</span>
            </div>
            ` : ''}
            <div class="total-row total-final">
              <span>Total:</span>
              <span>${total.toLocaleString()} XAF</span>
            </div>
          </div>

          <div class="footer">
            Thank you for your trust! For any questions, please don't hesitate to contact us.
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printHTML);
    printWindow.document.close();
    
    // Wait for content to load, then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.onafterprint = () => {
          printWindow.close();
        };
      }, 250);
    };
  } catch (error) {
    console.error('Error printing bill directly:', error);
    showErrorToast('Failed to print bill. Please try again.');
  }
};

