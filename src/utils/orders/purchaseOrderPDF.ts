import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Order } from '../../types/order';
import type { Product } from '../../types/models';

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

/**
 * Generate purchase order number (BC-YYYY-NNNN)
 * @param orderNumber - The order number to base the purchase order number on
 * @param sequenceNumber - Optional sequence number (if not provided, uses last 3 digits of order number)
 */
export const generatePurchaseOrderNumber = (
  orderNumber: string,
  sequenceNumber?: number
): string => {
  const now = new Date();
  const year = now.getFullYear();
  
  if (sequenceNumber !== undefined) {
    return `BC-${year}-${String(sequenceNumber).padStart(4, '0')}`;
  }
  
  // Extract sequence from order number if it follows ORD-YYYYMMDD-NNN format
  const match = orderNumber.match(/ORD-\d{8}-(\d{3})/);
  if (match) {
    return `BC-${year}-${match[1]}${String(Math.floor(Math.random() * 10)).padStart(1, '0')}`;
  }
  
  // Fallback: generate random sequence
  const sequence = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `BC-${year}-${sequence}`;
};

/**
 * Generate purchase order PDF for an order
 * @param order - Order object
 * @param products - Products array (to get product details)
 * @param company - Company info
 * @param filename - Filename for the PDF
 */
export const generatePurchaseOrderPDF = async (
  order: Order,
  products: Product[],
  company: any,
  filename: string
): Promise<void> => {
  try {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 15;
    let y = margin;

    // Logo (left), Business info (left), Purchase Order info (right)
    let logoHeight = 0;
    let logoWidth = 0;
    if (company.logo) {
      const { base64: logoBase64, width, height } = await getImageBase64AndSize(company.logo, 120, 0.6);
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

    // Business info (left)
    const businessX = margin + (logoWidth ? logoWidth + 4 : 0);
    doc.setFontSize(16);
    doc.text(company.name || '', businessX, y + 8);
    doc.setFontSize(12);
    doc.text(company.location || '', businessX, y + 16);
    doc.text(`Phone: ${company.phone || ''}`, businessX, y + 22);
    if (company.email) doc.text(`Email: ${company.email}`, businessX, y + 28);

    // Purchase Order info (right)
    const rightX = 210 - margin;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Bon de Commande', rightX, y + 8, { align: 'right' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    // Generate purchase order number if not exists
    const purchaseOrderNumber = order.purchaseOrderNumber || generatePurchaseOrderNumber(order.orderNumber);
    doc.text(`N°: ${purchaseOrderNumber}`, rightX, y + 16, { align: 'right' });
    
    const orderDateStr = order.createdAt instanceof Date
      ? order.createdAt.toLocaleDateString('fr-FR')
      : order.createdAt && typeof order.createdAt === 'object' && 'seconds' in order.createdAt
      ? new Date((order.createdAt as any).seconds * 1000).toLocaleDateString('fr-FR')
      : new Date().toLocaleDateString('fr-FR');
    doc.text(`Date: ${orderDateStr}`, rightX, y + 22, { align: 'right' });
    
    // Order number reference
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Réf. Commande: ${order.orderNumber}`, rightX, y + 28, { align: 'right' });
    doc.setTextColor(0);

    y += Math.max(logoHeight, 32) + 6;
    doc.setLineWidth(0.1);
    doc.line(margin, y, 210 - margin, y);
    y += 8;

    // Customer info section
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Client', margin, y);
    y += 7;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(order.customerInfo.name || '', margin, y);
    y += 6;
    doc.text(`Téléphone: ${order.customerInfo.phone || ''}`, margin, y);
    y += 6;
    if (order.customerInfo.location) {
      doc.text(`Adresse: ${order.customerInfo.location}`, margin, y);
      y += 6;
    }
    if (order.customerInfo.email) {
      doc.text(`Email: ${order.customerInfo.email}`, margin, y);
      y += 6;
    }
    
    // Delivery info if available
    if (order.deliveryInfo?.scheduledDate) {
      const deliveryDate = order.deliveryInfo.scheduledDate instanceof Date
        ? order.deliveryInfo.scheduledDate.toLocaleDateString('fr-FR')
        : order.deliveryInfo.scheduledDate && typeof order.deliveryInfo.scheduledDate === 'object' && 'seconds' in order.deliveryInfo.scheduledDate
        ? new Date((order.deliveryInfo.scheduledDate as any).seconds * 1000).toLocaleDateString('fr-FR')
        : '';
      if (deliveryDate) {
        doc.text(`Date de livraison prévue: ${deliveryDate}`, margin, y);
        y += 6;
      }
    }
    
    if (order.deliveryInfo?.instructions) {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Instructions: ${order.deliveryInfo.instructions}`, margin, y, { maxWidth: 100 });
      doc.setTextColor(0);
      y += 8;
    } else {
      y += 3;
    }

    // Products table
    const tableBody = order.items.map((orderItem) => {
      const product = products.find((p) => p.id === orderItem.productId);
      const unitPrice = orderItem.price;
      const total = unitPrice * orderItem.quantity;
      return [
        product?.name || orderItem.name || 'Produit inconnu',
        orderItem.quantity.toString(),
        `${unitPrice.toLocaleString('fr-FR')} XAF`,
        `${total.toLocaleString('fr-FR')} XAF`,
      ];
    });

    let lastTableY = y;
    autoTable(doc, {
      startY: y,
      head: [['Produit', 'Quantité', 'Prix unitaire', 'Total']],
      body: tableBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 11 },
      headStyles: { 
        fillColor: [24, 53, 36], // Geskap primary green
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      bodyStyles: { textColor: 30 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      didDrawPage: (data) => {
        if (data.cursor) lastTableY = data.cursor.y;
      },
    });
    y = lastTableY + 10;

    // Totals section
    const subtotal = order.pricing.subtotal || 0;
    const deliveryFee = order.pricing.deliveryFee || 0;
    const discount = order.pricing.discount || 0;
    const tax = order.pricing.tax || 0;
    const total = order.pricing.total || 0;

    y += 8;
    const totalsHeight = (deliveryFee > 0 ? 5 : 4) * 6 + 10;
    doc.setFillColor(255, 255, 255);
    doc.rect(120, y - 6, 75, totalsHeight, 'F');

    const rightLabelX = 130;
    const rightValueX = 195;
    const lineSpacing = 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text('Sous-total:', rightLabelX, y, { align: 'left' });
    doc.setFont('courier', 'normal');
    doc.text(`${subtotal.toLocaleString('fr-FR')} XAF`, rightValueX, y, { align: 'right' });
    y += lineSpacing;

    if (discount > 0) {
      doc.setFont('helvetica', 'normal');
      doc.text('Remise:', rightLabelX, y, { align: 'left' });
      doc.setFont('courier', 'normal');
      doc.text(`-${discount.toLocaleString('fr-FR')} XAF`, rightValueX, y, { align: 'right' });
      y += lineSpacing;
    }

    if (tax > 0) {
      doc.setFont('helvetica', 'normal');
      doc.text('Taxe:', rightLabelX, y, { align: 'left' });
      doc.setFont('courier', 'normal');
      doc.text(`${tax.toLocaleString('fr-FR')} XAF`, rightValueX, y, { align: 'right' });
      y += lineSpacing;
    }

    if (deliveryFee > 0) {
      doc.setFont('helvetica', 'normal');
      doc.text('Frais de livraison:', rightLabelX, y, { align: 'left' });
      doc.setFont('courier', 'normal');
      doc.text(`${deliveryFee.toLocaleString('fr-FR')} XAF`, rightValueX, y, { align: 'right' });
      y += lineSpacing;
    }

    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Total:', rightLabelX, y, { align: 'left' });
    doc.setFont('courier', 'bold');
    doc.text(`${total.toLocaleString('fr-FR')} XAF`, rightValueX, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += lineSpacing + 8;

    // Payment status and method
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Statut du paiement:', margin, y);
    doc.setFont('helvetica', 'normal');
    const paymentStatusText = order.paymentStatus === 'paid' 
      ? 'Payé' 
      : order.paymentStatus === 'pending'
      ? 'En attente'
      : order.paymentStatus === 'awaiting_payment'
      ? 'En attente de paiement'
      : 'Non payé';
    doc.text(paymentStatusText, margin + 45, y);
    
    if (order.paymentMethod) {
      const paymentMethodText = order.paymentMethod === 'onsite'
        ? 'Sur place'
        : order.paymentMethod === 'online'
        ? 'En ligne'
        : 'WhatsApp';
      doc.text(`Méthode: ${paymentMethodText}`, margin + 100, y);
    }
    y += 10;

    // Order status
    doc.setFont('helvetica', 'bold');
    doc.text('Statut de la commande:', margin, y);
    doc.setFont('helvetica', 'normal');
    const statusText = order.status === 'commande'
      ? 'Commande'
      : order.status === 'confirmed'
      ? 'Confirmée'
      : order.status === 'preparing'
      ? 'En préparation'
      : order.status === 'ready'
      ? 'Prête'
      : order.status === 'delivered'
      ? 'Livrée'
      : order.status === 'converted'
      ? 'Convertie en vente'
      : order.status === 'cancelled'
      ? 'Annulée'
      : 'En attente';
    doc.text(statusText, margin + 45, y);
    y += 10;

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(120);
    const footerY = 287;
    doc.text(
      'Ce bon de commande est généré automatiquement. Pour toute question, veuillez nous contacter.',
      105,
      footerY,
      { align: 'center' }
    );
    doc.setTextColor(0);

    // Save PDF
    doc.save(`${filename}.pdf`);
  } catch (error) {
    console.error('Purchase order PDF generation failed:', error);
    throw new Error('Failed to generate purchase order PDF. Please try again.');
  }
};

/**
 * Generate purchase order PDF and return as Blob for sharing
 * @param order - Order object
 * @param products - Products array
 * @param company - Company info
 * @param filename - Filename for the PDF
 */
export const generatePurchaseOrderPDFBlob = async (
  order: Order,
  products: Product[],
  company: any,
  filename: string
): Promise<Blob> => {
  try {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 15;
    let y = margin;

    // Logo (left), Business info (left), Purchase Order info (right)
    let logoHeight = 0;
    let logoWidth = 0;
    if (company.logo) {
      const { base64: logoBase64, width, height } = await getImageBase64AndSize(company.logo, 120, 0.6);
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

    // Business info (left)
    const businessX = margin + (logoWidth ? logoWidth + 4 : 0);
    doc.setFontSize(16);
    doc.text(company.name || '', businessX, y + 8);
    doc.setFontSize(12);
    doc.text(company.location || '', businessX, y + 16);
    doc.text(`Phone: ${company.phone || ''}`, businessX, y + 22);
    if (company.email) doc.text(`Email: ${company.email}`, businessX, y + 28);

    // Purchase Order info (right)
    const rightX = 210 - margin;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Bon de Commande', rightX, y + 8, { align: 'right' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    const purchaseOrderNumber = order.purchaseOrderNumber || generatePurchaseOrderNumber(order.orderNumber);
    doc.text(`N°: ${purchaseOrderNumber}`, rightX, y + 16, { align: 'right' });
    
    const orderDateStr = order.createdAt instanceof Date
      ? order.createdAt.toLocaleDateString('fr-FR')
      : order.createdAt && typeof order.createdAt === 'object' && 'seconds' in order.createdAt
      ? new Date((order.createdAt as any).seconds * 1000).toLocaleDateString('fr-FR')
      : new Date().toLocaleDateString('fr-FR');
    doc.text(`Date: ${orderDateStr}`, rightX, y + 22, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Réf. Commande: ${order.orderNumber}`, rightX, y + 28, { align: 'right' });
    doc.setTextColor(0);

    y += Math.max(logoHeight, 32) + 6;
    doc.setLineWidth(0.1);
    doc.line(margin, y, 210 - margin, y);
    y += 8;

    // Customer info
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Client', margin, y);
    y += 7;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(order.customerInfo.name || '', margin, y);
    y += 6;
    doc.text(`Téléphone: ${order.customerInfo.phone || ''}`, margin, y);
    y += 6;
    if (order.customerInfo.location) {
      doc.text(`Adresse: ${order.customerInfo.location}`, margin, y);
      y += 6;
    }
    if (order.customerInfo.email) {
      doc.text(`Email: ${order.customerInfo.email}`, margin, y);
      y += 6;
    }
    
    if (order.deliveryInfo?.scheduledDate) {
      const deliveryDate = order.deliveryInfo.scheduledDate instanceof Date
        ? order.deliveryInfo.scheduledDate.toLocaleDateString('fr-FR')
        : order.deliveryInfo.scheduledDate && typeof order.deliveryInfo.scheduledDate === 'object' && 'seconds' in order.deliveryInfo.scheduledDate
        ? new Date((order.deliveryInfo.scheduledDate as any).seconds * 1000).toLocaleDateString('fr-FR')
        : '';
      if (deliveryDate) {
        doc.text(`Date de livraison prévue: ${deliveryDate}`, margin, y);
        y += 6;
      }
    }
    
    if (order.deliveryInfo?.instructions) {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Instructions: ${order.deliveryInfo.instructions}`, margin, y, { maxWidth: 100 });
      doc.setTextColor(0);
      y += 8;
    } else {
      y += 3;
    }

    // Products table
    const tableBody = order.items.map((orderItem) => {
      const product = products.find((p) => p.id === orderItem.productId);
      const unitPrice = orderItem.price;
      const total = unitPrice * orderItem.quantity;
      return [
        product?.name || orderItem.name || 'Produit inconnu',
        orderItem.quantity.toString(),
        `${unitPrice.toLocaleString('fr-FR')} XAF`,
        `${total.toLocaleString('fr-FR')} XAF`,
      ];
    });

    let lastTableY = y;
    autoTable(doc, {
      startY: y,
      head: [['Produit', 'Quantité', 'Prix unitaire', 'Total']],
      body: tableBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 11 },
      headStyles: { 
        fillColor: [24, 53, 36],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      bodyStyles: { textColor: 30 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      didDrawPage: (data) => {
        if (data.cursor) lastTableY = data.cursor.y;
      },
    });
    y = lastTableY + 10;

    // Totals
    const subtotal = order.pricing.subtotal || 0;
    const deliveryFee = order.pricing.deliveryFee || 0;
    const discount = order.pricing.discount || 0;
    const tax = order.pricing.tax || 0;
    const total = order.pricing.total || 0;

    y += 8;
    const totalsHeight = (deliveryFee > 0 ? 5 : 4) * 6 + 10;
    doc.setFillColor(255, 255, 255);
    doc.rect(120, y - 6, 75, totalsHeight, 'F');

    const rightLabelX = 130;
    const rightValueX = 195;
    const lineSpacing = 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text('Sous-total:', rightLabelX, y, { align: 'left' });
    doc.setFont('courier', 'normal');
    doc.text(`${subtotal.toLocaleString('fr-FR')} XAF`, rightValueX, y, { align: 'right' });
    y += lineSpacing;

    if (discount > 0) {
      doc.setFont('helvetica', 'normal');
      doc.text('Remise:', rightLabelX, y, { align: 'left' });
      doc.setFont('courier', 'normal');
      doc.text(`-${discount.toLocaleString('fr-FR')} XAF`, rightValueX, y, { align: 'right' });
      y += lineSpacing;
    }

    if (tax > 0) {
      doc.setFont('helvetica', 'normal');
      doc.text('Taxe:', rightLabelX, y, { align: 'left' });
      doc.setFont('courier', 'normal');
      doc.text(`${tax.toLocaleString('fr-FR')} XAF`, rightValueX, y, { align: 'right' });
      y += lineSpacing;
    }

    if (deliveryFee > 0) {
      doc.setFont('helvetica', 'normal');
      doc.text('Frais de livraison:', rightLabelX, y, { align: 'left' });
      doc.setFont('courier', 'normal');
      doc.text(`${deliveryFee.toLocaleString('fr-FR')} XAF`, rightValueX, y, { align: 'right' });
      y += lineSpacing;
    }

    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Total:', rightLabelX, y, { align: 'left' });
    doc.setFont('courier', 'bold');
    doc.text(`${total.toLocaleString('fr-FR')} XAF`, rightValueX, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += lineSpacing + 8;

    // Payment status
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Statut du paiement:', margin, y);
    doc.setFont('helvetica', 'normal');
    const paymentStatusText = order.paymentStatus === 'paid' 
      ? 'Payé' 
      : order.paymentStatus === 'pending'
      ? 'En attente'
      : order.paymentStatus === 'awaiting_payment'
      ? 'En attente de paiement'
      : 'Non payé';
    doc.text(paymentStatusText, margin + 45, y);
    
    if (order.paymentMethod) {
      const paymentMethodText = order.paymentMethod === 'onsite'
        ? 'Sur place'
        : order.paymentMethod === 'online'
        ? 'En ligne'
        : 'WhatsApp';
      doc.text(`Méthode: ${paymentMethodText}`, margin + 100, y);
    }
    y += 10;

    // Order status
    doc.setFont('helvetica', 'bold');
    doc.text('Statut de la commande:', margin, y);
    doc.setFont('helvetica', 'normal');
    const statusText = order.status === 'commande'
      ? 'Commande'
      : order.status === 'confirmed'
      ? 'Confirmée'
      : order.status === 'preparing'
      ? 'En préparation'
      : order.status === 'ready'
      ? 'Prête'
      : order.status === 'delivered'
      ? 'Livrée'
      : order.status === 'converted'
      ? 'Convertie en vente'
      : order.status === 'cancelled'
      ? 'Annulée'
      : 'En attente';
    doc.text(statusText, margin + 45, y);

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(
      'Ce bon de commande est généré automatiquement. Pour toute question, veuillez nous contacter.',
      105,
      287,
      { align: 'center' }
    );
    doc.setTextColor(0);

    // Return as Blob
    return doc.output('blob');
  } catch (error) {
    console.error('Purchase order PDF generation failed:', error);
    throw new Error('Failed to generate purchase order PDF. Please try again.');
  }
};

