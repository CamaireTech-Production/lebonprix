import { Modal, ModalFooter, Card, Badge, Button } from '@components/common';
import Invoice from './Invoice';
import type { Sale, Product, Customer } from '../../types/models';
import { Download, Share, Printer, Clock, X, RotateCcw } from 'lucide-react';
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || t('sales.modals.view.title')}
      size="lg"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={onClose}
          confirmText={t('navigation.close')}
          cancelText={t('common.cancel')}
        />
      }
    >
      <div className="space-y-6">
        {/* Invoice Actions */}
        <div className="flex justify-end space-x-2 mb-4 sticky top-0 bg-white z-10 py-2">
          <Button
            variant="outline"
            icon={<Printer size={16} />}
            onClick={handlePrint}
          >
            {t('sales.modals.view.actions.printInvoice')}
          </Button>
          <Button
            variant="outline"
            icon={<Download size={16} />}
            onClick={handleDownloadPDF}
          >
            {t('sales.modals.view.actions.downloadPDF')}
          </Button>
          <Button
            variant="outline"
            icon={<Share size={16} />}
            onClick={handleShareInvoice}
            isLoading={isSharing}
          >
            {t('sales.modals.view.actions.shareInvoice')}
          </Button>
        </div>
        {/* Invoice Preview */}
        <div className="border rounded-lg overflow-hidden">
          <div className="max-h-[calc(100vh-200px)] overflow-y-auto" id="invoice-wrapper">
            <Invoice sale={sale} products={products || []} />
          </div>
        </div>
        {/* Credit Sale Information - Prominent for Credit Sales */}
        {sale.status === 'credit' && (
          <Card className="bg-orange-50 border-orange-200">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Clock className="text-orange-600" size={20} />
                  <h3 className="text-lg font-semibold text-orange-900">
                    {t('sales.modals.view.creditSale.title') || 'Credit Sale'}
                  </h3>
                </div>
                <Badge variant="warning">
                  {t('sales.filters.status.credit') || 'Credit'}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-orange-700">
                    {t('sales.modals.view.creditSale.totalAmount') || 'Total Amount'}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-orange-900">
                    {formatPrice(sale.totalAmount)} XAF
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-orange-700">
                    {t('sales.modals.view.creditSale.remainingAmount') || 'Remaining Amount'}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-red-600">
                    {formatPrice(sale.remainingAmount ?? sale.totalAmount)} XAF
                  </p>
                </div>
                {sale.creditDueDate && (
                  <div>
                    <p className="text-sm font-medium text-orange-700">
                      {t('sales.modals.view.creditSale.dueDate') || 'Due Date'}
                    </p>
                    <p className="mt-1 text-sm text-orange-900">
                      {sale.creditDueDate.seconds 
                        ? new Date(sale.creditDueDate.seconds * 1000).toLocaleDateString()
                        : '-'}
                    </p>
                  </div>
                )}
                {sale.paidAmount && sale.paidAmount > 0 && (
                  <div>
                    <p className="text-sm font-medium text-orange-700">
                      {t('sales.modals.view.creditSale.paidAmount') || 'Paid Amount'}
                    </p>
                    <p className="mt-1 text-sm text-green-600">
                      {formatPrice(sale.paidAmount)} XAF
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Customer Information Card */}
        <Card>
          <div className="p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('sales.modals.view.customerInfo.title')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">{t('sales.modals.view.customerInfo.name')}</p>
                <p className="mt-1 text-sm text-gray-900">{sale.customerInfo.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{t('sales.modals.view.customerInfo.phone')}</p>
                <a
                  href={`tel:${sale.customerInfo.phone}`}
                  className="mt-1 text-sm text-blue-600 hover:text-blue-900"
                >
                  {sale.customerInfo.phone}
                </a>
              </div>
            </div>
            {customerSource && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-500 mb-1">Source Clientelle</p>
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
            
            {/* Informations supplémentaires du client */}
            {customer ? (
              <CustomerAdditionalInfo customer={customer} />
            ) : (
              // Si le client n'est pas trouvé dans la collection, créer un Customer à partir de sale.customerInfo
              // pour permettre l'affichage des informations de base
              <div className="mt-4 border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-500 italic">
                  Le client n'a pas été sauvegardé dans la collection avec des informations supplémentaires. 
                  Les informations supplémentaires sont disponibles uniquement pour les clients sauvegardés.
                </p>
              </div>
            )}
          </div>
        </Card>
        {/* Products Card */}
        <Card>
          <div className="p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('sales.modals.view.products.title')}</h3>
            <div className="space-y-4">
              {sale.products.map((product, index) => {
                const productData = products?.find(p => p.id === product.productId);
                return (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{productData?.name}</p>
                        <p className="text-sm text-gray-500">{t('sales.modals.view.products.quantity')}: {product.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">{t('sales.modals.view.products.basePrice')}</p>
                        <p className="font-medium text-gray-900">{formatPrice(product.basePrice)} XAF</p>
                        {product.negotiatedPrice && (
                          <>
                            <p className="text-sm text-gray-500 mt-1">{t('sales.modals.view.products.negotiatedPrice')}</p>
                            <p className="font-medium text-emerald-600">{formatPrice(product.negotiatedPrice)} XAF</p>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-sm text-gray-500">{t('sales.modals.view.products.productTotal')}</p>
                      <p className="font-medium text-emerald-600">
                        {formatPrice((product.negotiatedPrice || product.basePrice) * product.quantity)} XAF
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
        {/* Order Summary Card */}
        <Card>
          <div className="p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('sales.modals.view.orderSummary.title')}</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <p className="text-sm text-gray-500">{t('sales.modals.view.orderSummary.subtotal')}</p>
                <p className="text-sm text-gray-900">{formatPrice(sale.totalAmount)} XAF</p>
              </div>
              {(sale.deliveryFee ?? 0) > 0 && (
                <div className="flex justify-between">
                  <p className="text-sm text-gray-500">{t('sales.modals.view.orderSummary.deliveryFee')}</p>
                  <p className="text-sm text-gray-900">{formatPrice(sale.deliveryFee ?? 0)} XAF</p>
                </div>
              )}
              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between">
                  <p className="font-medium text-gray-900">{t('sales.modals.view.orderSummary.totalAmount')}</p>
                  <p className="font-medium text-emerald-600">
                    {formatPrice(sale.totalAmount + (sale.deliveryFee ?? 0))} XAF
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
        {/* Status Information */}
        <Card>
          <div className="p-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">
                  {t('sales.modals.view.status.orderStatus')}
                </p>
                <Badge variant={
                  sale.status === 'paid' ? 'success' :
                  sale.status === 'credit' ? 'warning' :
                  sale.status === 'under_delivery' ? 'info' : 'default'
                }>
                  {t(`sales.filters.status.${sale.status}`)}
                </Badge>
              </div>
              {sale.status === 'credit' && onRefundCredit && (sale.remainingAmount ?? sale.totalAmount) > 0 && (
                <div className="flex space-x-2 flex-wrap gap-2">
                  <button
                    onClick={() => {
                      onRefundCredit(sale.id);
                    }}
                    className="text-orange-600 hover:text-orange-900"
                    title={t('sales.actions.refundCredit') || 'Remboursement'}
                  >
                    <RotateCcw size={16} />
                  </button>
                  {onCancelCredit && (
                    <Button
                      variant="outline"
                      icon={<X size={16} />}
                      onClick={() => {
                        if (window.confirm(t('sales.modals.view.confirmCancelCredit') || 'Are you sure you want to cancel this credit sale? Stock will be restored.')) {
                          onCancelCredit(sale.id);
                          onClose();
                        }
                      }}
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      {t('sales.actions.cancelCredit') || 'Cancel Credit'}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Status History */}
            {(() => {
              // Build complete status history including current status if not in history
              const statusHistory = sale.statusHistory || [];
              const currentStatusInHistory = statusHistory.some(entry => entry.status === sale.status);
              
              // If current status is not in history, add it (for existing sales created before statusHistory was implemented)
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
              
              if (completeHistory.length > 0) {
                return (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      {t('sales.modals.view.statusHistory.title') || 'Status History'}
                    </h4>
                    <div className="space-y-2">
                      {completeHistory
                        .slice()
                        .reverse()
                        .map((historyEntry, index) => {
                          const date = historyEntry.timestamp 
                            ? new Date(historyEntry.timestamp)
                            : null;
                          return (
                            <div key={index} className="flex items-start space-x-3 p-2 bg-gray-50 rounded">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
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
                                  <p className="text-xs text-gray-500 mt-1">
                                    {date.toLocaleString()}
                                  </p>
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
                  </div>
                );
              }
              return null;
            })()}

            {/* Refund History */}
            {sale.refunds && sale.refunds.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  {t('sales.refund.history') || 'Refund History'}
                </h4>
                <div className="space-y-2">
                  {sale.refunds
                    .slice()
                    .reverse()
                    .map((refund, index) => {
                      const date = refund.timestamp 
                        ? new Date(refund.timestamp)
                        : null;
                      return (
                        <div key={refund.id || index} className="flex items-start space-x-3 p-2 bg-red-50 rounded">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <Badge variant="danger">
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
                              <p className="text-xs text-gray-500 mt-1">
                                {date.toLocaleString()}
                              </p>
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
                </div>
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
        </Card>
      </div>
    </Modal>
  );
};

export default SaleDetailsModal; 