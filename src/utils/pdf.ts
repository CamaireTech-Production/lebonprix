import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to load image as base64 and get dimensions, with compression
const getImageBase64AndSize = (
  url: string,
  maxDim = 24, // max dimension in px
  quality = 0.7 // JPEG quality (0-1)
): Promise<{ base64?: string; width?: number; height?: number }> => {
  return new Promise((resolve) => {
    if (!url) return resolve({});
    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.onload = function () {
      let { width, height } = img;
      // Resize if needed
      if (width > height && width > maxDim) {
        height = (height / width) * maxDim;
        width = maxDim;
      } else if (height > width && height > maxDim) {
        width = (width / height) * maxDim;
        height = maxDim;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve({});
      ctx.drawImage(img, 0, 0, width, height);
      // Use JPEG for better compression
      resolve({
        base64: canvas.toDataURL('image/jpeg', quality),
        width,
        height,
      });
    };
    img.onerror = () => resolve({});
    img.src = url;
  });
};

export const generatePDF = async (
  sale: any, // Sale object
  products: any[], // Products array
  company: any, // Company info
  filename: string
): Promise<void> => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 15;
  let y = margin;

  // Logo (left), Business info (left), Invoice info (right)
  let logoHeight = 0;
  let logoWidth = 0;
  if (company.logo) {
    const { base64: logoBase64, width, height } = await getImageBase64AndSize(company.logo, 120, 0.6); // 120px max, 60% quality
    if (logoBase64 && width && height) {
      // Max size in mm
      const maxDim = 24;
      let drawWidth = width;
      let drawHeight = height;
      if (width > height) {
        if (width > maxDim) {
          drawWidth = maxDim;
          drawHeight = (height / width) * maxDim;
        }
    } else {
        if (height > maxDim) {
          drawHeight = maxDim;
          drawWidth = (width / height) * maxDim;
        }
      }
      doc.addImage(logoBase64, 'JPEG', margin, y, drawWidth, drawHeight);
      logoHeight = drawHeight;
      logoWidth = drawWidth;
    }
  }
  // Business info (left)
  const businessX = margin + (logoWidth ? logoWidth + 4 : 0);
  doc.setFontSize(16); // Increased font size
  doc.text(company.name || '', businessX, y + 8);
  doc.setFontSize(12);
  doc.text(company.location || '', businessX, y + 16);
  doc.text(`Phone: ${company.phone || ''}`, businessX, y + 22);
  if (company.email) doc.text(`Email: ${company.email}`, businessX, y + 28);

  // Invoice info (right)
  const rightX = 210 - margin;
  doc.setFontSize(14);
  doc.text('Invoice', rightX, y + 8, { align: 'right' });
  doc.setFontSize(12);
  doc.text(`No. ${sale.id}`, rightX, y + 16, { align: 'right' });
  const dateStr = sale.createdAt?.seconds
    ? new Date(sale.createdAt.seconds * 1000).toLocaleDateString()
    : '';
  doc.text(`Date: ${dateStr}`, rightX, y + 22, { align: 'right' });

  y += Math.max(logoHeight, 32) + 6;
  doc.setLineWidth(0.1);
  doc.line(margin, y, 210 - margin, y);
  y += 8;

  // Customer info
  doc.setFontSize(13);
  doc.text('Customer', margin, y);
  y += 7;
  doc.setFontSize(12);
  doc.text(sale.customerInfo.name || '', margin, y);
  y += 6;
  doc.text(`Phone: ${sale.customerInfo.phone || ''}`, margin, y);
  y += 6;
  if (sale.customerInfo.quarter) {
    doc.text(`Quarter: ${sale.customerInfo.quarter}`, margin, y);
    y += 6;
  }
  y += 3;

  // Products table
  const tableBody = sale.products.map((saleProduct: any) => {
    const product = products.find((p: any) => p.id === saleProduct.productId);
    const unitPrice = saleProduct.negotiatedPrice || saleProduct.basePrice;
    const total = unitPrice * saleProduct.quantity;
    return [
      product?.name || 'Unknown',
      saleProduct.quantity,
      `${unitPrice.toLocaleString()} XAF`,
      `${total.toLocaleString()} XAF`,
    ];
  });
  let lastTableY = y;
  autoTable(doc, {
    startY: y,
    head: [['Product', 'Quantity', 'Unit Price', 'Total']],
    body: tableBody,
    margin: { left: margin, right: margin },
    styles: { fontSize: 12 },
    headStyles: { fillColor: [240, 240, 240], textColor: 60 },
    bodyStyles: { textColor: 30 },
    didDrawPage: (data) => {
      if (data.cursor) lastTableY = data.cursor.y;
    },
  });
  y = lastTableY + 10;

  // Totals
  const subtotal = sale.products.reduce((total: number, p: any) => {
    const price = p.negotiatedPrice || p.basePrice;
    return total + price * p.quantity;
  }, 0);

  // --- Totals Section ---
  // Add a visible gap after the table
  y += 8;
  // Draw a white rectangle as background for totals area
  const totalsHeight = (sale.deliveryFee && sale.deliveryFee > 0) ? 3 * 12 + 10 : 2 * 12 + 10;
  doc.setFillColor(255, 255, 255);
  doc.rect(120, y - 6, 75, totalsHeight, 'F');

  // Use monospace font for values for better alignment
  const rightLabelX = 130;
  const rightValueX = 195;
  const lineSpacing = 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text('Subtotal:', rightLabelX, y, { align: 'left' });
  doc.setFont('courier', 'bold');
  doc.text(`${subtotal.toLocaleString()} XAF`, rightValueX, y, { align: 'right' });
  y += lineSpacing;
  if (sale.deliveryFee && sale.deliveryFee > 0) {
    doc.setFont('helvetica', 'normal');
    doc.text('Delivery Fee:', rightLabelX, y, { align: 'left' });
    doc.setFont('courier', 'bold');
    doc.text(`${sale.deliveryFee.toLocaleString()} XAF`, rightValueX, y, { align: 'right' });
    y += lineSpacing;
  }
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Total:', rightLabelX, y, { align: 'left' });
  doc.setFont('courier', 'bold');
  doc.text(`${(subtotal + (sale.deliveryFee || 0)).toLocaleString()} XAF`, rightValueX, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  y += lineSpacing + 2;

  // Footer
  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text('Thank you for your trust! For any questions, please don\'t hesitate to contact us.', 105, 287, { align: 'center' });

  doc.save(`${filename}.pdf`);
};

// Generate PDF and return as Blob for sharing
export const generatePDFBlob = async (
  sale: any,
  products: any[],
  company: any,
  filename: string
): Promise<Blob> => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 15;
  let y = margin;

  // Logo (left), Business info (left), Invoice info (right)
  let logoHeight = 0;
  let logoWidth = 0;
  if (company.logo) {
    const { base64: logoBase64, width, height } = await getImageBase64AndSize(company.logo, 120, 0.6); // 120px max, 60% quality
    if (logoBase64 && width && height) {
      const maxDim = 24;
      let drawWidth = width;
      let drawHeight = height;
      if (width > height) {
        if (width > maxDim) {
          drawWidth = maxDim;
          drawHeight = (height / width) * maxDim;
        }
      } else {
        if (height > maxDim) {
          drawHeight = maxDim;
          drawWidth = (width / height) * maxDim;
        }
      }
      doc.addImage(logoBase64, 'JPEG', margin, y, drawWidth, drawHeight);
      logoHeight = drawHeight;
      logoWidth = drawWidth;
    }
  }
  const businessX = margin + (logoWidth ? logoWidth + 4 : 0);
  doc.setFontSize(16);
  doc.text(company.name || '', businessX, y + 8);
  doc.setFontSize(12);
  doc.text(company.location || '', businessX, y + 16);
  doc.text(`Phone: ${company.phone || ''}`, businessX, y + 22);
  if (company.email) doc.text(`Email: ${company.email}`, businessX, y + 28);

  const rightX = 210 - margin;
  doc.setFontSize(14);
  doc.text('Invoice', rightX, y + 8, { align: 'right' });
  doc.setFontSize(12);
  doc.text(`No. ${sale.id}`, rightX, y + 16, { align: 'right' });
  const dateStr = sale.createdAt?.seconds
    ? new Date(sale.createdAt.seconds * 1000).toLocaleDateString()
    : '';
  doc.text(`Date: ${dateStr}`, rightX, y + 22, { align: 'right' });

  y += Math.max(logoHeight, 32) + 6;
  doc.setLineWidth(0.1);
  doc.line(margin, y, 210 - margin, y);
  y += 8;

  doc.setFontSize(13);
  doc.text('Customer', margin, y);
  y += 7;
  doc.setFontSize(12);
  doc.text(sale.customerInfo.name || '', margin, y);
  y += 6;
  doc.text(`Phone: ${sale.customerInfo.phone || ''}`, margin, y);
  y += 6;
  if (sale.customerInfo.quarter) {
    doc.text(`Quarter: ${sale.customerInfo.quarter}`, margin, y);
    y += 6;
  }
  y += 3;

  const tableBody = sale.products.map((saleProduct: any) => {
    const product = products.find((p: any) => p.id === saleProduct.productId);
    const unitPrice = saleProduct.negotiatedPrice || saleProduct.basePrice;
    const total = unitPrice * saleProduct.quantity;
    return [
      product?.name || 'Unknown',
      saleProduct.quantity,
      `${unitPrice.toLocaleString()} XAF`,
      `${total.toLocaleString()} XAF`,
    ];
  });
  let lastTableY = y;
  autoTable(doc, {
    startY: y,
    head: [['Product', 'Quantity', 'Unit Price', 'Total']],
    body: tableBody,
    margin: { left: margin, right: margin },
    styles: { fontSize: 12 },
    headStyles: { fillColor: [240, 240, 240], textColor: 60 },
    bodyStyles: { textColor: 30 },
    didDrawPage: (data) => {
      if (data.cursor) lastTableY = data.cursor.y;
    },
  });
  y = lastTableY + 10;

  const subtotal = sale.products.reduce((total: number, p: any) => {
    const price = p.negotiatedPrice || p.basePrice;
    return total + price * p.quantity;
  }, 0);

  // --- Totals Section ---
  y += 8;
  const totalsHeight = (sale.deliveryFee && sale.deliveryFee > 0) ? 3 * 12 + 10 : 2 * 12 + 10;
  doc.setFillColor(255, 255, 255);
  doc.rect(120, y - 6, 75, totalsHeight, 'F');

  const rightLabelX = 130;
  const rightValueX = 195;
  const lineSpacing = 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text('Subtotal:', rightLabelX, y, { align: 'left' });
  doc.setFont('courier', 'bold');
  doc.text(`${subtotal.toLocaleString()} XAF`, rightValueX, y, { align: 'right' });
  y += lineSpacing;
  if (sale.deliveryFee && sale.deliveryFee > 0) {
    doc.setFont('helvetica', 'normal');
    doc.text('Delivery Fee:', rightLabelX, y, { align: 'left' });
    doc.setFont('courier', 'bold');
    doc.text(`${sale.deliveryFee.toLocaleString()} XAF`, rightValueX, y, { align: 'right' });
    y += lineSpacing;
  }
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Total:', rightLabelX, y, { align: 'left' });
  doc.setFont('courier', 'bold');
  doc.text(`${(subtotal + (sale.deliveryFee || 0)).toLocaleString()} XAF`, rightValueX, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  y += lineSpacing + 2;

  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text('Thank you for your trust! For any questions, please don\'t hesitate to contact us.', 105, 287, { align: 'center' });

  // Return as Blob
  return doc.output('blob');
}; 