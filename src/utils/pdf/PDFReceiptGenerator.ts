import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Sale, Product, Company } from '../../types/models';

interface LogoData {
    base64: string;
    width: number;
    height: number;
}

interface PDFOptions {
    download?: boolean;
    filename?: string;
}

/**
 * Centralized PDF Receipt Generator
 * Handles all PDF generation for sales receipts, POS bills, and reports
 * with proper currency formatting and company logo support
 */
export class PDFReceiptGenerator {
    private logoCache: Map<string, LogoData> = new Map();

    /**
     * Load and compress image to base64 with proper error handling
     */
    private async getImageBase64AndSize(
        url: string,
        maxDim = 120,
        quality = 0.7
    ): Promise<LogoData | null> {
        return new Promise((resolve) => {
            if (!url) {
                resolve(null);
                return;
            }

            const img = new window.Image();
            img.crossOrigin = 'Anonymous';

            img.onload = () => {
                try {
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

                    if (!ctx) {
                        resolve(null);
                        return;
                    }

                    ctx.drawImage(img, 0, 0, width, height);
                    const base64 = canvas.toDataURL('image/jpeg', quality);

                    resolve({ base64, width, height });
                } catch (error) {
                    console.warn('Image processing failed:', error);
                    resolve(null);
                }
            };

            img.onerror = (error) => {
                console.warn('Image loading failed:', error);
                resolve(null);
            };

            img.src = url;
        });
    }

    /**
     * Load company logo with caching
     */
    private async loadCompanyLogo(logoUrl: string): Promise<LogoData | null> {
        if (!logoUrl) return null;

        // Check cache first
        if (this.logoCache.has(logoUrl)) {
            return this.logoCache.get(logoUrl)!;
        }

        try {
            const logoData = await this.getImageBase64AndSize(logoUrl, 120, 0.7);

            if (logoData) {
                this.logoCache.set(logoUrl, logoData);
                return logoData;
            }

            return null;
        } catch (error) {
            console.warn('Logo loading failed:', error);
            return null;
        }
    }

    /**
     * Format currency amount with currency code
     * Uses currency code instead of symbol for PDF compatibility
     * Replaces non-breaking spaces with regular spaces for jsPDF compatibility
     */
    private formatCurrency(amount: number, currencyCode: string): string {
        // toLocaleString uses non-breaking spaces (U+00A0) which jsPDF can't render
        // Replace them with regular spaces
        const formatted = amount.toLocaleString('fr-FR').replace(/\u00A0/g, ' ');
        return `${formatted} ${currencyCode}`;
    }

    /**
     * Render company header with logo and business info
     */
    private async renderHeader(
        doc: jsPDF,
        company: Company,
        sale: Sale | Partial<Sale>,
        margin: number,
        startY: number
    ): Promise<number> {
        let y = startY;
        let logoHeight = 0;
        let logoWidth = 0;

        // Load and render logo
        if (company.logo) {
            const logoData = await this.loadCompanyLogo(company.logo);

            if (logoData) {
                const maxDim = 24; // mm
                let drawWidth = logoData.width;
                let drawHeight = logoData.height;

                // Scale to fit max dimension
                if (logoData.width > logoData.height) {
                    if (logoData.width > maxDim) {
                        drawWidth = maxDim;
                        drawHeight = (logoData.height / logoData.width) * maxDim;
                    }
                } else {
                    if (logoData.height > maxDim) {
                        drawHeight = maxDim;
                        drawWidth = (logoData.width / logoData.height) * maxDim;
                    }
                }

                doc.addImage(logoData.base64, 'JPEG', margin, y, drawWidth, drawHeight);
                logoHeight = drawHeight;
                logoWidth = drawWidth;
            }
        }

        // Business info (left side, next to logo)
        const businessX = margin + (logoWidth ? logoWidth + 4 : 0);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(company.name || '', businessX, y + 8);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(company.location || '', businessX, y + 15);
        doc.text(`Phone: ${company.phone || ''}`, businessX, y + 21);
        if (company.email) {
            doc.text(`Email: ${company.email}`, businessX, y + 27);
        }

        // Invoice info (right side)
        const rightX = 210 - margin;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Invoice', rightX, y + 8, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(`No. ${sale.id || 'DRAFT'}`, rightX, y + 15, { align: 'right' });

        const dateStr = sale.createdAt?.seconds
            ? new Date(sale.createdAt.seconds * 1000).toLocaleDateString('fr-FR')
            : new Date().toLocaleDateString('fr-FR');
        doc.text(`Date: ${dateStr}`, rightX, y + 21, { align: 'right' });

        // Move y position past header
        y += Math.max(logoHeight, 30) + 6;

        // Separator line
        doc.setLineWidth(0.5);
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, 210 - margin, y);
        y += 8;

        return y;
    }

    /**
     * Render customer information section
     */
    private renderCustomerInfo(
        doc: jsPDF,
        sale: Sale | Partial<Sale>,
        margin: number,
        startY: number
    ): number {
        let y = startY;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Customer', margin, y);
        y += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(sale.customerInfo?.name || 'Walk-in Customer', margin, y);
        y += 5;

        if (sale.customerInfo?.phone) {
            doc.text(`Phone: ${sale.customerInfo.phone}`, margin, y);
            y += 5;
        }

        if (sale.customerInfo?.quarter) {
            doc.text(`Quarter: ${sale.customerInfo.quarter}`, margin, y);
            y += 5;
        }

        y += 3;
        return y;
    }

    /**
     * Render product table
     */
    private renderProductTable(
        doc: jsPDF,
        sale: Sale | Partial<Sale>,
        products: Product[],
        currencyCode: string,
        margin: number,
        startY: number
    ): number {
        const tableBody = sale.products?.map((saleProduct: any) => {
            const product = products.find((p: Product) => p.id === saleProduct.productId);
            const unitPrice = saleProduct.negotiatedPrice || saleProduct.basePrice;
            const total = unitPrice * saleProduct.quantity;

            return [
                product?.name || 'Unknown Product',
                saleProduct.quantity.toString(),
                this.formatCurrency(unitPrice, currencyCode),
                this.formatCurrency(total, currencyCode),
            ];
        }) || [];

        let lastTableY = startY;

        autoTable(doc, {
            startY,
            head: [['Product', 'Qty', 'Unit Price', 'Total']],
            body: tableBody,
            margin: { left: margin, right: margin },
            styles: {
                fontSize: 10,
                cellPadding: 3,
            },
            headStyles: {
                fillColor: [41, 128, 185], // Professional blue
                textColor: 255,
                fontStyle: 'bold',
                halign: 'left',
            },
            bodyStyles: {
                textColor: 50,
            },
            columnStyles: {
                0: { cellWidth: 'auto' }, // Product name
                1: { cellWidth: 20, halign: 'center' }, // Quantity
                2: { cellWidth: 40, halign: 'right' }, // Unit Price
                3: { cellWidth: 40, halign: 'right' }, // Total
            },
            didDrawPage: (data) => {
                if (data.cursor) lastTableY = data.cursor.y;
            },
        });

        return lastTableY + 10;
    }

    /**
     * Render totals section with proper alignment
     */
    private renderTotals(
        doc: jsPDF,
        sale: Sale | Partial<Sale>,
        currencyCode: string,
        startY: number
    ): number {
        let y = startY + 5;

        // Calculate subtotal
        const subtotal = sale.products?.reduce((total: number, p: any) => {
            const price = p.negotiatedPrice || p.basePrice;
            return total + price * p.quantity;
        }, 0) || 0;

        const rightLabelX = 130;
        const rightValueX = 195;
        const lineSpacing = 8;

        // Subtotal
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text('Subtotal:', rightLabelX, y, { align: 'left' });
        doc.setFont('helvetica', 'bold');
        doc.text(this.formatCurrency(subtotal, currencyCode), rightValueX, y, { align: 'right' });
        y += lineSpacing;

        // Delivery fee (if applicable)
        if (sale.deliveryFee && sale.deliveryFee > 0) {
            doc.setFont('helvetica', 'normal');
            doc.text('Delivery Fee:', rightLabelX, y, { align: 'left' });
            doc.setFont('helvetica', 'bold');
            doc.text(this.formatCurrency(sale.deliveryFee, currencyCode), rightValueX, y, { align: 'right' });
            y += lineSpacing;
        }

        // Separator line
        y += 2;
        doc.setLineWidth(0.3);
        doc.setDrawColor(100, 100, 100);
        doc.line(rightLabelX, y, rightValueX, y);
        y += 6;

        // Total
        const total = subtotal + (sale.deliveryFee || 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('Total:', rightLabelX, y, { align: 'left' });
        doc.setFontSize(14);
        doc.text(this.formatCurrency(total, currencyCode), rightValueX, y, { align: 'right' });

        return y + 10;
    }

    /**
     * Render footer
     */
    private renderFooter(doc: jsPDF): void {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(120, 120, 120);
        doc.text(
            'Thank you for your business!',
            105,
            280,
            { align: 'center' }
        );
    }

    /**
     * Generate standard sales receipt PDF (A4 format)
     */
    async generateSalesReceipt(
        sale: Sale | Partial<Sale>,
        products: Product[],
        company: Company,
        options: PDFOptions = {}
    ): Promise<Blob> {
        try {
            const doc = new jsPDF({ unit: 'mm', format: 'a4' });
            const margin = 15;
            const currencyCode = company?.currency || 'XAF';

            let y = margin;

            // Render sections
            y = await this.renderHeader(doc, company, sale, margin, y);
            y = this.renderCustomerInfo(doc, sale, margin, y);
            y = this.renderProductTable(doc, sale, products, currencyCode, margin, y);
            y = this.renderTotals(doc, sale, currencyCode, y);
            this.renderFooter(doc);

            // Download or return blob
            if (options.download) {
                const filename = options.filename || `invoice-${sale.id || Date.now()}`;
                doc.save(`${filename}.pdf`);
            }

            return doc.output('blob');
        } catch (error) {
            console.error('PDF generation failed:', error);
            throw new Error('Failed to generate PDF receipt. Please try again.');
        }
    }

    /**
     * Generate POS receipt PDF (80mm thermal format)
     */
    async generatePOSReceipt(
        sale: Sale | Partial<Sale>,
        products: Product[],
        company: Company,
        options: PDFOptions = {}
    ): Promise<Blob> {
        try {
            // 80mm thermal paper format
            const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
            const margin = 5;
            const currencyCode = company?.currency || 'XAF';
            const centerX = 40; // Center of 80mm

            let y = margin;

            // Logo (centered, smaller for POS)
            if (company.logo) {
                const logoData = await this.loadCompanyLogo(company.logo);
                if (logoData) {
                    const maxDim = 20; // Smaller for POS
                    let drawWidth = logoData.width;
                    let drawHeight = logoData.height;

                    if (logoData.width > logoData.height) {
                        if (logoData.width > maxDim) {
                            drawWidth = maxDim;
                            drawHeight = (logoData.height / logoData.width) * maxDim;
                        }
                    } else {
                        if (logoData.height > maxDim) {
                            drawHeight = maxDim;
                            drawWidth = (logoData.width / logoData.height) * maxDim;
                        }
                    }

                    const logoX = centerX - drawWidth / 2;
                    doc.addImage(logoData.base64, 'JPEG', logoX, y, drawWidth, drawHeight);
                    y += drawHeight + 3;
                }
            }

            // Company name (centered, bold)
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(company.name || '', centerX, y, { align: 'center' });
            y += 5;

            // Company details (centered, smaller)
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            if (company.location) {
                doc.text(company.location, centerX, y, { align: 'center' });
                y += 4;
            }
            if (company.phone) {
                doc.text(`Tel: ${company.phone}`, centerX, y, { align: 'center' });
                y += 4;
            }

            // Separator
            y += 2;
            doc.setLineWidth(0.3);
            doc.line(margin, y, 80 - margin, y);
            y += 4;

            // Receipt info
            doc.setFontSize(8);
            const dateStr = sale.createdAt?.seconds
                ? new Date(sale.createdAt.seconds * 1000).toLocaleDateString('fr-FR')
                : new Date().toLocaleDateString('fr-FR');
            doc.text(`Date: ${dateStr}`, margin, y);
            y += 4;
            doc.text(`No: ${sale.id || 'DRAFT'}`, margin, y);
            y += 5;

            // Products table (compact)
            const tableBody = sale.products?.map((saleProduct: any) => {
                const product = products.find((p: Product) => p.id === saleProduct.productId);
                const unitPrice = saleProduct.negotiatedPrice || saleProduct.basePrice;
                const total = unitPrice * saleProduct.quantity;

                return [
                    product?.name || 'Unknown',
                    `${saleProduct.quantity}x`,
                    this.formatCurrency(total, currencyCode),
                ];
            }) || [];

            autoTable(doc, {
                startY: y,
                head: [['Item', 'Qty', 'Total']],
                body: tableBody,
                margin: { left: margin, right: margin },
                styles: {
                    fontSize: 8,
                    cellPadding: 1,
                },
                headStyles: {
                    fillColor: [220, 220, 220],
                    textColor: 50,
                    fontStyle: 'bold',
                },
                columnStyles: {
                    0: { cellWidth: 35 },
                    1: { cellWidth: 15, halign: 'center' },
                    2: { cellWidth: 20, halign: 'right' },
                },
                didDrawPage: (data) => {
                    if (data.cursor) y = data.cursor.y;
                },
            });

            y += 5;

            // Totals
            const subtotal = sale.products?.reduce((total: number, p: any) => {
                const price = p.negotiatedPrice || p.basePrice;
                return total + price * p.quantity;
            }, 0) || 0;

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text('Subtotal:', margin, y);
            doc.text(this.formatCurrency(subtotal, currencyCode), 80 - margin, y, { align: 'right' });
            y += 5;

            if (sale.deliveryFee && sale.deliveryFee > 0) {
                doc.text('Delivery:', margin, y);
                doc.text(this.formatCurrency(sale.deliveryFee, currencyCode), 80 - margin, y, { align: 'right' });
                y += 5;
            }

            // Total (bold, larger)
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('TOTAL:', margin, y);
            const total = subtotal + (sale.deliveryFee || 0);
            doc.text(this.formatCurrency(total, currencyCode), 80 - margin, y, { align: 'right' });
            y += 8;

            // Footer
            doc.setFontSize(7);
            doc.setFont('helvetica', 'italic');
            doc.text('Thank you!', centerX, y, { align: 'center' });

            // Download or return blob
            if (options.download) {
                const filename = options.filename || `pos-receipt-${sale.id || Date.now()}`;
                doc.save(`${filename}.pdf`);
            }

            return doc.output('blob');
        } catch (error) {
            console.error('POS PDF generation failed:', error);
            throw new Error('Failed to generate POS receipt. Please try again.');
        }
    }
}

export default PDFReceiptGenerator;
