import { PDFReceiptGenerator } from '@utils/pdf/PDFReceiptGenerator';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import type { Sale, Product, Company } from '../../types/models';
import { CURRENCIES } from '@constants/currencies';

/**
 * Print POS bill as PDF (80mm thermal format)
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
    const generator = new PDFReceiptGenerator();
    await generator.generatePOSReceipt(sale, products, company, {
      download: true,
      filename,
    });
    showSuccessToast('Bill printed successfully');
  } catch (error) {
    console.error('Error printing bill:', error);
    showErrorToast('Failed to print bill. Please try again.');
    throw error;
  }
};

/**
 * Share POS bill as PDF blob (80mm thermal format)
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
    const generator = new PDFReceiptGenerator();
    const blob = await generator.generatePOSReceipt(sale, products, company, {
      download: false,
      filename,
    });
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
  company: Company,
  paymentMethod?: 'cash' | 'mobile_money' | 'card'
): void => {
  const currencyCode = company?.currency || 'XAF';
  const currencySymbol = CURRENCIES.find(c => c.code === currencyCode)?.symbol || 'XAF';

  try {
    // Calculate totals
    const subtotal = sale.products?.reduce((total: number, p: any) => {
      const price = p.negotiatedPrice || p.basePrice;
      return total + price * p.quantity;
    }, 0) || 0;

    // Get discount amount (can be from discountValue field or calculated)
    const discountAmount = (sale as any).discountValue || 0;

    // Get TVA amount
    const tvaAmount = (sale as any).tvaApplied ? (sale as any).tax || 0 : 0;

    // Get other tax amount
    const taxAmount = (sale as any).tvaApplied ? 0 : ((sale as any).tax || 0);

    // Calculate total: subtotal + deliveryFee - discount + TVA + other tax
    // If totalAmount is already set, use it (it should already include discount and taxes)
    const total = sale.totalAmount || (subtotal + (sale.deliveryFee || 0) - discountAmount + tvaAmount + taxAmount);

    // Get payment method and amount received for change calculation
    const salePaymentMethod = paymentMethod || (sale as any).paymentMethod || 'cash';
    const amountReceived = (sale as any).amountReceived || total;

    // Calculate change for cash payments
    const change = salePaymentMethod === 'cash' && amountReceived > total
      ? Math.max(0, amountReceived - total)
      : 0;

    // Format date
    const saleDate = sale.createdAt?.seconds
      ? new Date(sale.createdAt.seconds * 1000).toLocaleDateString()
      : new Date().toLocaleDateString();

    // Helper function to convert image to base64 for print compatibility
    const getImageAsBase64 = (url: string): Promise<string> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve('');
        img.src = url;
      });
    };

    // Load logo as base64 if available
    const loadLogo = async (): Promise<string> => {
      if (!company.logo) return '';
      try {
        const base64 = await getImageAsBase64(company.logo);
        return base64;
      } catch (error) {
        console.warn('Failed to load logo for printing:', error);
        return '';
      }
    };

    // Load logo and create print window
    loadLogo().then((logoBase64) => {
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
          <td style="text-align: right;">${unitPrice.toLocaleString()} ${currencySymbol}</td>
          <td style="text-align: right;">${totalPrice.toLocaleString()} ${currencySymbol}</td>
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
            .company-info img {
              display: block;
              object-fit: contain;
              max-width: 80px;
              max-height: 60px;
              margin-bottom: 10px;
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
              ${logoBase64 ? `<img src="${logoBase64}" alt="${company.name || 'Company Logo'}" />` : ''}
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
              <span>${subtotal.toLocaleString()} ${currencySymbol}</span>
            </div>
            ${(sale as any).tvaApplied && tvaAmount > 0 ? `
            <div class="total-row">
              <span>TVA (${((sale as any).tvaRate || 19.24)}%):</span>
              <span>${tvaAmount.toLocaleString()} ${currencySymbol}</span>
            </div>
            ` : ''}
            ${sale.deliveryFee && sale.deliveryFee > 0 ? `
            <div class="total-row">
              <span>Delivery Fee:</span>
              <span>${sale.deliveryFee.toLocaleString()} ${currencySymbol}</span>
            </div>
            ` : ''}
            ${discountAmount > 0 ? `
            <div class="total-row" style="color: #dc2626;">
              <span>Remise ${(sale as any).discountType === 'percentage' ? `(${(sale as any).discountOriginalValue || (sale as any).discountValue}%)` : ''}:</span>
              <span>-${discountAmount.toLocaleString()} ${currencySymbol}</span>
            </div>
            ` : ''}
            ${taxAmount > 0 ? `
            <div class="total-row">
              <span>Tax:</span>
              <span>${taxAmount.toLocaleString()} ${currencySymbol}</span>
            </div>
            ` : ''}
            <div class="total-row total-final">
              <span>Total:</span>
              <span>${total.toLocaleString()} ${currencySymbol}</span>
            </div>
            ${salePaymentMethod === 'cash' && amountReceived !== total ? `
            <div class="total-row">
              <span>Montant reçu:</span>
              <span>${amountReceived.toLocaleString()} ${currencySymbol}</span>
            </div>
            ` : ''}
            ${change > 0 ? `
            <div class="total-row" style="color: #16a34a; font-weight: bold;">
              <span>Monnaie:</span>
              <span>${change.toLocaleString()} ${currencySymbol}</span>
            </div>
            ` : ''}
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
    }).catch((error) => {
      console.error('Error loading logo for printing:', error);
      showErrorToast('Failed to print bill. Please try again.');
    });
  } catch (error) {
    console.error('Error printing bill directly:', error);
    showErrorToast('Failed to print bill. Please try again.');
  }
};

