import { Modal, ModalFooter, Card, Badge, Button } from '@components/common';
import Invoice from './Invoice';
import type { Sale, Product, Customer, SaleProduct } from '../../types/models';
import { Download, Share, Printer, Clock, X, RotateCcw, ChevronDown, ChevronUp, FileText, User, Package, DollarSign, Calendar, CreditCard } from 'lucide-react';
import { generatePDF, generatePDFBlob } from '@utils/core/pdf';
import { generateInvoiceFileName } from '@utils/core/fileUtils';
import { useTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { showErrorToast } from '@utils/core/toast';
import { formatPrice } from '@utils/formatting/formatPrice';
import CustomerAdditionalInfo from '../customers/CustomerAdditionalInfo';
import { useCustomers } from '@hooks/data/useFirestore';
import { normalizePhoneForComparison } from '@utils/core/phoneUtils';
import { useCustomerSources } from '@hooks/business/useCustomerSources';
import { formatCreatorName } from '@utils/business/employeeUtils';
import type { CustomerSource } from '../../types/models';

interface SaleDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  products: Product[];
  title?: string;
  onSettleCredit?: (saleId: string) => void;
  onCancelCredit?: (saleId: string) => void;
  onRefundCredit?: (saleId: string) => void;
}

const SaleDetailsModal: React.FC<SaleDetailsModalProps> = ({ isOpen, onClose, sale, products, title, onSettleCredit, onCancelCredit, onRefundCredit }) => {
  const { t } = useTranslation();
  const [isSharing, setIsSharing] = useState(false);
  const { company } = useAuth();
  const { customers } = useCustomers();
  const { sources } = useCustomerSources();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerSource, setCustomerSource] = useState<CustomerSource | null>(null);

  // Collapsible sections state
  const [isCustomerExpanded, setIsCustomerExpanded] = useState(false);
  const [isInvoiceExpanded, setIsInvoiceExpanded] = useState(false);
  const [isStatusHistoryExpanded, setIsStatusHistoryExpanded] = useState(false);
  const [isRefundHistoryExpanded, setIsRefundHistoryExpanded] = useState(false);

  // Récupérer le client complet depuis la collection customers
  useEffect(() => {
    if (sale && customers) {
      // Normaliser les numéros de téléphone pour la comparaison
      const salePhone = normalizePhoneForComparison(sale.customerInfo.phone);

      const foundCustomer = customers.find(c => {
        const customerPhone = normalizePhoneForComparison(c.phone);
        return customerPhone === salePhone;
      });


      setCustomer(foundCustomer || null);
    } else {
      setCustomer(null);
    }
  }, [sale, customers]);

  // Récupérer la source clientelle
  useEffect(() => {
    if (sale?.customerSourceId && company?.id) {
      const source = sources.find(s => s.id === sale.customerSourceId);
      setCustomerSource(source || null);
    } else {
      setCustomerSource(null);
    }
  }, [sale?.customerSourceId, sources, company?.id]);

  if (!sale) return null;

  const handleDownloadPDF = () => {
    if (!company) return;
    const filename = generateInvoiceFileName(
      sale.customerInfo.name,
      company.name
    );
    generatePDF(sale, products, company, filename.replace('.pdf', ''));
  };

  const handleShareInvoice = async () => {
    setIsSharing(true);
    try {
      if (!company) throw new Error('No company info');
      const filename = generateInvoiceFileName(
        sale.customerInfo.name,
        company.name
      );
      // Generate PDF as Blob
      const pdfBlob = await generatePDFBlob(sale, products, company, filename.replace('.pdf', ''));
      const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `Invoice ${sale.id}`,
          text: 'Here is your invoice.'
        });
      } else {
        alert('Sharing is not supported on this device/browser. Please download the PDF and share it manually.');
      }
    } catch (error) {
      console.error('Failed to share PDF', error);
      alert('Failed to share PDF.');
    } finally {
      setIsSharing(false);
    }
  };

  const handlePrint = () => {
    // Get the invoice content element (the Invoice component's root div)
    const invoiceElement = document.querySelector('#invoice-wrapper #invoice-content') as HTMLElement;
    if (!invoiceElement) {
      showErrorToast(t('sales.messages.errors.invoiceNotFound') || 'Invoice content not found');
      return;
    }

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showErrorToast(t('sales.messages.errors.popupBlocked') || 'Please allow pop-ups to print the invoice');
      return;
    }

    // Get the HTML content of the invoice
    const invoiceHTML = invoiceElement.innerHTML;

    // Create print-friendly HTML with styles
    const printHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${sale.id}</title>
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
              .no-print {
                display: none !important;
              }
            }
            table {
              width: 100%;
              border-collapse: collapse;
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
            .font-bold {
              font-weight: 700;
            }
            .font-semibold {
              font-weight: 600;
            }
            .text-sm {
              font-size: 12px;
            }
            .text-base {
              font-size: 14px;
            }
            .mb-2 {
              margin-bottom: 8px;
            }
            .mb-4 {
              margin-bottom: 16px;
            }
            .mb-8 {
              margin-bottom: 32px;
            }
            .mt-8 {
              margin-top: 32px;
            }
            .p-3 {
              padding: 12px;
            }
            .p-4 {
              padding: 16px;
            }
            .bg-gray-50 {
              background-color: #f9fafb;
            }
            .border-t {
              border-top: 1px solid #e5e7eb;
            }
            .rounded-lg {
              border-radius: 8px;
            }
            .text-center {
              text-align: center;
            }
            .text-gray-900 {
              color: #111827;
            }
            .text-gray-600 {
              color: #4b5563;
            }
            .text-gray-500 {
              color: #6b7280;
            }
            /* Flexbox utilities to match Invoice layout */
            .flex {
              display: flex;
            }
            .flex-col {
              flex-direction: column;
            }
            .items-start {
              align-items: flex-start;
            }
            .space-x-4 > * + * {
              margin-left: 1rem;
            }
            .mb-4 {
              margin-bottom: 1rem;
            }
            .mb-0 {
              margin-bottom: 0;
            }
            /* Image and logo constraints */
            img {
              max-width: 100%;
              height: auto;
              display: block;
            }
            /* Logo specific sizing - maintain original size from Invoice component (w-16 h-16 = 64px) */
            /* Target logo by alt attribute and also by position in header */
            img[alt*="logo"],
            img[alt*="Logo"],
            div.flex img,
            div.flex.items-start img {
              width: 64px !important;
              height: 64px !important;
              max-width: 64px !important;
              max-height: 64px !important;
              min-width: 64px;
              min-height: 64px;
              object-fit: contain !important;
              flex-shrink: 0;
            }
            /* Ensure all images don't exceed container width */
            @media print {
              img {
                max-width: 100%;
                height: auto;
                page-break-inside: avoid;
              }
              /* Force logo to stay at 64px during print */
              img[alt*="logo"],
              img[alt*="Logo"],
              div.flex img,
              div.flex.items-start img {
                width: 64px !important;
                height: 64px !important;
                max-width: 64px !important;
                max-height: 64px !important;
                min-width: 64px !important;
                min-height: 64px !important;
                object-fit: contain !important;
              }
            }
          </style>
        </head>
        <body>
          ${invoiceHTML}
        </body>
      </html>
    `;

    // Write the HTML to the new window
    printWindow.document.write(printHTML);
    printWindow.document.close();

    // Wait for images to load, then print
    printWindow.onload = () => {
      // Additional JavaScript to ensure logo size is maintained
      const setLogoSize = () => {
        const images = printWindow.document.querySelectorAll('img');
        images.forEach((img: HTMLImageElement) => {
          const alt = img.getAttribute('alt') || '';
          // If it's a logo image, force the size
          if (alt.toLowerCase().includes('logo')) {
            img.style.width = '64px';
            img.style.height = '64px';
            img.style.maxWidth = '64px';
            img.style.maxHeight = '64px';
            img.style.objectFit = 'contain';
            img.style.flexShrink = '0';
          }
        });
      };

      // Set logo size immediately
      setLogoSize();

      // Wait for images to fully load
      setTimeout(() => {
        setLogoSize(); // Set again after images load
        printWindow.print();
        // Close the window after printing (optional - user may want to keep it open)
        // printWindow.close();
      }, 250);
    };
  };

  // Helper function to get sale number
  const getSaleNumber = (timestamp: { seconds: number } | null | undefined) => {
    if (!timestamp?.seconds) return 'N/A';
    const date = new Date(timestamp.seconds * 1000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return (
      date.getFullYear().toString() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds())
    );
  };

  // Build complete status history
  const statusHistory = sale.statusHistory || [];
  const currentStatusInHistory = statusHistory.some(entry => entry.status === sale.status);
  const completeHistory = currentStatusInHistory
    ? statusHistory
    : [
      ...statusHistory,
      {
        status: sale.status,
        timestamp: sale.createdAt?.seconds
          ? new Date(sale.createdAt.seconds * 1000).toISOString()
          : new Date().toISOString(),
        userId: sale.userId || sale.companyId
      }
    ];

  // Helper to calculate profit for a product with fallback logic
  const getProductProfit = (saleProduct: SaleProduct, catalogProduct: Product | undefined) => {
    const unitPrice = saleProduct.negotiatedPrice || saleProduct.basePrice;

    // 1. If we have explicit batch consumption data (accurate)
    if (saleProduct.batchLevelProfits && saleProduct.batchLevelProfits.length > 0) {
      return saleProduct.batchLevelProfits.reduce(
        (batchSum: number, batch) => batchSum + (unitPrice - batch.costPrice) * batch.consumedQuantity,
        0
      );
    }

    // 2. Fallback: Use stored costPrice if valid (> 0), otherwise use current catalog costPrice (Estimation)
    const cost = (saleProduct.costPrice && saleProduct.costPrice > 0)
      ? saleProduct.costPrice
      : (catalogProduct?.costPrice || 0);

    return (unitPrice - cost) * saleProduct.quantity;
  };

  const calculateSubtotal = () => {
    return sale.products.reduce((total, product) => {
      const price = product.negotiatedPrice || product.basePrice;
      return total + (price * product.quantity);
    }, 0);
  };

  const subtotal = calculateSubtotal();
  const totalAmount = subtotal + (sale.deliveryFee ?? 0);

  const totalProfit = sale.products.reduce((total, product) => {
    const productData = products?.find(p => p.id === product.productId);
    return total + getProductProfit(product, productData);
  }, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || t('sales.modals.view.title')}
      size="xl"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={onClose}
          confirmText={t('navigation.close')}
          cancelText={t('common.cancel')}
        />
      }
    >
      <div className="space-y-4">
        {/* Header Section - Sale ID, Status, Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-xs text-gray-500">{t('sales.modals.view.saleId') || 'Sale ID'}</p>
              <p className="text-lg font-semibold text-gray-900">#{getSaleNumber(sale.createdAt)}</p>
            </div>
            <Badge variant={
              sale.status === 'paid' ? 'success' :
                sale.status === 'credit' ? 'warning' :
                  sale.status === 'under_delivery' ? 'info' : 'default'
            }>
              {t(`sales.filters.status.${sale.status}`)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              icon={<Printer size={16} />}
              onClick={handlePrint}
              className="text-sm"
            >
              <span className="hidden sm:inline">{t('sales.modals.view.actions.printInvoice')}</span>
            </Button>
            <Button
              variant="outline"
              icon={<Download size={16} />}
              onClick={handleDownloadPDF}
              className="text-sm"
            >
              <span className="hidden sm:inline">{t('sales.modals.view.actions.downloadPDF')}</span>
            </Button>
            <Button
              variant="outline"
              icon={<Share size={16} />}
              onClick={handleShareInvoice}
              isLoading={isSharing}
              className="text-sm"
            >
              <span className="hidden sm:inline">{t('sales.modals.view.actions.shareInvoice')}</span>
            </Button>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column - Main Content (2/3 width) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Quick Summary Card */}
            <Card contentClassName="p-3 sm:p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t('sales.modals.view.summary.date') || 'Date'}</p>
                  <p className="text-sm font-medium text-gray-900">
                    {sale.createdAt?.seconds
                      ? new Date(sale.createdAt.seconds * 1000).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t('sales.modals.view.summary.customer') || 'Customer'}</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{sale.customerInfo.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t('sales.modals.view.summary.totalAmount') || 'Total Amount'}</p>
                  <p className="text-lg font-bold text-emerald-600">{formatPrice(totalAmount)} XAF</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t('sales.modals.view.summary.items') || 'Items'}</p>
                  <p className="text-sm font-medium text-gray-900">{sale.products.length} {t('sales.modals.view.summary.productCount') || 'product(s)'}</p>
                </div>
              </div>
            </Card>

            {/* Products Table */}
            <Card contentClassName="p-0 sm:p-0">
              <div className="p-3 sm:p-4">
                <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Package size={18} />
                  {t('sales.modals.view.products.title')}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-2 font-medium text-gray-700">{t('sales.modals.view.products.table.product') || 'Product'}</th>
                        <th className="text-right py-2 px-2 font-medium text-gray-700">{t('sales.modals.view.products.table.qty') || 'Qty'}</th>
                        <th className="text-right py-2 px-2 font-medium text-gray-700">{t('sales.modals.view.products.table.unitPrice') || 'Unit Price'}</th>
                        <th className="text-right py-2 px-2 font-medium text-gray-700">{t('sales.modals.view.products.table.profit') || 'Profit'}</th>
                        <th className="text-right py-2 px-2 font-medium text-gray-700">{t('sales.modals.view.products.table.total') || 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sale.products.map((product, index) => {
                        const productData = products?.find(p => p.id === product.productId);
                        const unitPrice = product.negotiatedPrice || product.basePrice;
                        const productTotal = unitPrice * product.quantity;
                        const profit = getProductProfit(product, productData);
                        return (
                          <tr key={index} className="border-b border-gray-100">
                            <td className="py-2 px-2">
                              <p className="font-medium text-gray-900">{productData?.name || 'Unknown'}</p>
                              {product.negotiatedPrice && product.negotiatedPrice !== product.basePrice && (
                                <p className="text-xs text-gray-500">
                                  Base: {formatPrice(product.basePrice)} XAF
                                </p>
                              )}
                            </td>
                            <td className="text-right py-2 px-2 text-gray-900">{product.quantity}</td>
                            <td className="text-right py-2 px-2 text-gray-900">{formatPrice(unitPrice)} XAF</td>
                            <td className="text-right py-2 px-2 text-emerald-600">{formatPrice(profit)} XAF</td>
                            <td className="text-right py-2 px-2 font-medium text-emerald-600">{formatPrice(productTotal)} XAF</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>

            {/* Customer Details - Collapsible */}
            <Card contentClassName="p-3 sm:p-4">
              <button
                onClick={() => setIsCustomerExpanded(!isCustomerExpanded)}
                className="w-full flex items-center justify-between text-left"
              >
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <User size={18} />
                  {t('sales.modals.view.customerInfo.title')}
                </h3>
                {isCustomerExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              {isCustomerExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">{t('sales.modals.view.customerInfo.name')}</p>
                      <p className="text-sm text-gray-900">{sale.customerInfo.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">{t('sales.modals.view.customerInfo.phone')}</p>
                      <a
                        href={`tel:${sale.customerInfo.phone}`}
                        className="text-sm text-blue-600 hover:text-blue-900"
                      >
                        {sale.customerInfo.phone}
                      </a>
                    </div>
                  </div>
                  {customerSource && (
                    <div className="pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-2">Source Clientelle</p>
                      <div className="flex items-center gap-2">
                        {customerSource.color && (
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: customerSource.color }}
                          />
                        )}
                        <p className="text-sm text-gray-900">{customerSource.name}</p>
                      </div>
                      {customerSource.description && (
                        <p className="text-xs text-gray-500 mt-1">{customerSource.description}</p>
                      )}
                    </div>
                  )}
                  {customer ? (
                    <div className="pt-3 border-t border-gray-200">
                      <CustomerAdditionalInfo customer={customer} />
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500 italic">
                        Le client n'a pas été sauvegardé dans la collection avec des informations supplémentaires.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Financial Summary */}
            <Card contentClassName="p-3 sm:p-4">
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <DollarSign size={18} />
                {t('sales.modals.view.orderSummary.title')}
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('sales.modals.view.orderSummary.subtotal')}</span>
                  <span className="text-gray-900">{formatPrice(subtotal)} XAF</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-medium">{t('sales.modals.view.orderSummary.totalProfit') || 'Total Profit'}</span>
                  <span className="text-emerald-600 font-medium">{formatPrice(totalProfit)} XAF</span>
                </div>
                {(sale.deliveryFee ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('sales.modals.view.orderSummary.deliveryFee')}</span>
                    <span className="text-gray-900">{formatPrice(sale.deliveryFee ?? 0)} XAF</span>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-200 flex justify-between">
                  <span className="font-semibold text-gray-900">{t('sales.modals.view.orderSummary.totalAmount')}</span>
                  <span className="text-lg font-bold text-emerald-600">{formatPrice(totalAmount)} XAF</span>
                </div>
              </div>
              {/* Credit Sale Info */}
              {sale.status === 'credit' && (
                <div className="mt-4 pt-4 border-t border-orange-200 bg-orange-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="text-orange-600" size={18} />
                    <h4 className="text-sm font-semibold text-orange-900">{t('sales.modals.view.creditInformation.title') || 'Credit Information'}</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-orange-700">{t('sales.modals.view.creditInformation.remaining') || 'Remaining'}</p>
                      <p className="font-semibold text-red-600">{formatPrice(sale.remainingAmount ?? sale.totalAmount)} XAF</p>
                    </div>
                    {sale.paidAmount && sale.paidAmount > 0 && (
                      <div>
                        <p className="text-xs text-orange-700">{t('sales.modals.view.creditInformation.paid') || 'Paid'}</p>
                        <p className="font-semibold text-green-600">{formatPrice(sale.paidAmount)} XAF</p>
                      </div>
                    )}
                    {sale.creditDueDate && (
                      <div className="col-span-2">
                        <p className="text-xs text-orange-700">{t('sales.modals.view.creditSale.dueDate') || 'Due Date'}</p>
                        <p className="text-sm text-orange-900">
                          {sale.creditDueDate.seconds
                            ? new Date(sale.creditDueDate.seconds * 1000).toLocaleDateString()
                            : '-'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>

            {/* Status Timeline */}
            <Card contentClassName="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Clock size={18} />
                  {t('sales.modals.view.statusTimeline.title') || 'Status & Timeline'}
                </h3>
                {completeHistory.length > 0 && (
                  <button
                    onClick={() => setIsStatusHistoryExpanded(!isStatusHistoryExpanded)}
                    className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                  >
                    {isStatusHistoryExpanded
                      ? (t('sales.modals.view.statusTimeline.hideHistory') || 'Hide History')
                      : (t('sales.modals.view.statusTimeline.showHistory') || 'Show History')}
                    {isStatusHistoryExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                )}
              </div>
              {completeHistory.length > 0 && isStatusHistoryExpanded && (
                <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                  {completeHistory
                    .slice()
                    .reverse()
                    .map((historyEntry, index) => {
                      const date = historyEntry.timestamp
                        ? new Date(historyEntry.timestamp)
                        : null;
                      return (
                        <div key={index} className="flex items-start gap-3 p-2 bg-gray-50 rounded">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={
                                historyEntry.status === 'paid' ? 'success' :
                                  historyEntry.status === 'credit' ? 'warning' :
                                    historyEntry.status === 'under_delivery' ? 'info' : 'default'
                              }>
                                {t(`sales.filters.status.${historyEntry.status}`) || historyEntry.status}
                              </Badge>
                              {historyEntry.paymentMethod && (
                                <span className="text-xs text-gray-500">
                                  ({t(`pos.payment.methods.${historyEntry.paymentMethod}`) || historyEntry.paymentMethod})
                                </span>
                              )}
                            </div>
                            {date && (
                              <p className="text-xs text-gray-500 mt-1">{date.toLocaleString()}</p>
                            )}
                            {historyEntry.amountPaid && (
                              <p className="text-xs text-gray-600 mt-1">
                                {t('sales.modals.view.statusHistory.amountPaid') || 'Amount Paid'}: {formatPrice(historyEntry.amountPaid)} XAF
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
              {/* Refund History */}
              {sale.refunds && sale.refunds.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-700">
                      {t('sales.refund.history') || 'Refund History'}
                    </h4>
                    <button
                      onClick={() => setIsRefundHistoryExpanded(!isRefundHistoryExpanded)}
                      className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
                    >
                      {isRefundHistoryExpanded
                        ? (t('sales.modals.view.refundHistory.hide') || 'Hide')
                        : (t('sales.modals.view.refundHistory.show') || 'Show')}
                      {isRefundHistoryExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                  {isRefundHistoryExpanded && (
                    <div className="space-y-2">
                      {sale.refunds
                        .slice()
                        .reverse()
                        .map((refund, index) => {
                          const date = refund.timestamp
                            ? new Date(refund.timestamp)
                            : null;
                          return (
                            <div key={refund.id || index} className="flex items-start gap-3 p-2 bg-red-50 rounded">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="error">
                                    {t('sales.refund.refund') || 'Refund'}
                                  </Badge>
                                  <span className="text-sm font-semibold text-red-600">
                                    {formatPrice(refund.amount)} XAF
                                  </span>
                                  {refund.paymentMethod && (
                                    <span className="text-xs text-gray-500">
                                      ({t(`pos.payment.methods.${refund.paymentMethod}`) || refund.paymentMethod})
                                    </span>
                                  )}
                                </div>
                                {date && (
                                  <p className="text-xs text-gray-500 mt-1">{date.toLocaleString()}</p>
                                )}
                                {refund.reason && (
                                  <p className="text-xs text-gray-600 mt-1">
                                    {t('sales.refund.reason') || 'Reason'}: {refund.reason}
                                  </p>
                                )}
                                {refund.transactionReference && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {t('pos.payment.transactionReference') || 'Reference'}: {refund.transactionReference}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      {sale.totalRefunded && sale.totalRefunded > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700">
                              {t('sales.refund.totalRefunded') || 'Total Refunded'}:
                            </span>
                            <span className="text-lg font-bold text-red-600">
                              {formatPrice(sale.totalRefunded)} XAF
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Invoice Preview - Collapsible */}
            <Card contentClassName="p-3 sm:p-4">
              <button
                onClick={() => setIsInvoiceExpanded(!isInvoiceExpanded)}
                className="w-full flex items-center justify-between text-left"
              >
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <FileText size={18} />
                  {t('sales.modals.view.invoicePreview') || 'Invoice Preview'}
                </h3>
                {isInvoiceExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              {/* Always render invoice for printing, but hide when collapsed */}
              <div className={isInvoiceExpanded ? "mt-4 pt-4 border-t border-gray-200" : "hidden"}>
                <div className="border rounded-lg overflow-hidden">
                  <div className={isInvoiceExpanded ? "max-h-[600px] overflow-y-auto" : ""} id="invoice-wrapper">
                    <Invoice sale={sale} products={products || []} />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column - Sidebar (1/3 width) */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-4 space-y-4">
              {/* Order Information Card */}
              <Card contentClassName="p-3 sm:p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Calendar size={16} />
                  {t('sales.modals.view.orderInformation.title') || 'Order Information'}
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t('sales.modals.view.orderInformation.orderNumber') || 'Order Number'}</p>
                    <p className="text-sm font-medium text-gray-900">#{getSaleNumber(sale.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t('sales.modals.view.orderInformation.createdDate') || 'Created Date'}</p>
                    <p className="text-sm text-gray-900">
                      {sale.createdAt?.seconds
                        ? new Date(sale.createdAt.seconds * 1000).toLocaleString()
                        : 'N/A'}
                    </p>
                  </div>
                  {sale.createdBy && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">{t('sales.modals.view.orderInformation.createdBy') || 'Created By'}</p>
                      <p className="text-sm text-gray-900">{formatCreatorName(sale.createdBy)}</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Payment Information Card */}
              <Card contentClassName="p-3 sm:p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <CreditCard size={16} />
                  {t('sales.modals.view.paymentInformation.title') || 'Payment Information'}
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t('sales.modals.view.paymentInformation.paymentStatus') || 'Payment Status'}</p>
                    <Badge variant={
                      sale.status === 'paid' ? 'success' :
                        sale.status === 'credit' ? 'warning' :
                          sale.status === 'under_delivery' ? 'info' : 'default'
                    }>
                      {t(`sales.filters.status.${sale.status}`)}
                    </Badge>
                  </div>
                  {sale.status === 'credit' && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">{t('sales.modals.view.paymentInformation.creditAmount') || 'Credit Amount'}</p>
                      <p className="text-sm font-semibold text-orange-600">
                        {formatPrice(sale.remainingAmount ?? sale.totalAmount)} XAF
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Actions Card */}
              {sale.status === 'credit' && Boolean(onSettleCredit || onRefundCredit || onCancelCredit) && (
                <Card contentClassName="p-3 sm:p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('sales.modals.view.actions.title') || 'Actions'}</h3>
                  <div className="space-y-2">
                    {onSettleCredit && (sale.remainingAmount ?? sale.totalAmount) > 0 && (
                      <Button
                        variant="default"
                        onClick={() => {
                          onSettleCredit?.(sale.id);
                        }}
                        className="w-full"
                      >
                        {t('sales.actions.settleCredit') || 'Settle Credit'}
                      </Button>
                    )}
                    {onRefundCredit && (sale.remainingAmount ?? sale.totalAmount) > 0 && (
                      <Button
                        variant="outline"
                        icon={<RotateCcw size={16} />}
                        onClick={() => {
                          onRefundCredit?.(sale.id);
                        }}
                        className="w-full"
                      >
                        {t('sales.actions.refundCredit') || 'Refund Credit'}
                      </Button>
                    )}
                    {onCancelCredit && (
                      <Button
                        variant="outline"
                        icon={<X size={16} />}
                        onClick={() => {
                          if (window.confirm(t('sales.modals.view.confirmCancelCredit') || 'Are you sure you want to cancel this credit sale? Stock will be restored.')) {
                            onCancelCredit?.(sale.id);
                            onClose();
                          }
                        }}
                        className="w-full border-red-300 text-red-600 hover:bg-red-50"
                      >
                        {t('sales.actions.cancelCredit') || 'Cancel Credit'}
                      </Button>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SaleDetailsModal; 