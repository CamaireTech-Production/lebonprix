import Modal, { ModalFooter } from '../common/Modal';
import Invoice from './Invoice';
import Card from '../common/Card';
import Badge from '../common/Badge';
import Button from '../common/Button';
import type { Sale, Product } from '../../types/models';
import { Download, Share, Printer } from 'lucide-react';
import { generatePDF, generatePDFBlob } from '../../utils/pdf';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { showErrorToast } from '../../utils/toast';

interface SaleDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  products: Product[];
  title?: string;
}

const SaleDetailsModal: React.FC<SaleDetailsModalProps> = ({ isOpen, onClose, sale, products, title }) => {
  const { t } = useTranslation();
  const [isSharing, setIsSharing] = useState(false);
  const { company } = useAuth();

  if (!sale) return null;

  const handleDownloadPDF = () => {
    if (!company) return;
    generatePDF(sale, products, company, `facture-${sale.id}`);
  };

  const handleShareInvoice = async () => {
    setIsSharing(true);
    try {
      if (!company) throw new Error('No company info');
      // Generate PDF as Blob
      const pdfBlob = await generatePDFBlob(sale, products, company, `facture-${sale.id}`);
      const pdfFile = new File([pdfBlob], `facture-${sale.id}.pdf`, { type: 'application/pdf' });
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
      console.error('Failed to share PDF:', error);
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
      setTimeout(() => {
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
                        <p className="font-medium text-gray-900">{product.basePrice.toLocaleString()} XAF</p>
                        {product.negotiatedPrice && (
                          <>
                            <p className="text-sm text-gray-500 mt-1">{t('sales.modals.view.products.negotiatedPrice')}</p>
                            <p className="font-medium text-emerald-600">{product.negotiatedPrice.toLocaleString()} XAF</p>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-sm text-gray-500">{t('sales.modals.view.products.productTotal')}</p>
                      <p className="font-medium text-emerald-600">
                        {((product.negotiatedPrice || product.basePrice) * product.quantity).toLocaleString()} XAF
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
                <p className="text-sm text-gray-900">{sale.totalAmount.toLocaleString()} XAF</p>
              </div>
              {(sale.deliveryFee ?? 0) > 0 && (
                <div className="flex justify-between">
                  <p className="text-sm text-gray-500">{t('sales.modals.view.orderSummary.deliveryFee')}</p>
                  <p className="text-sm text-gray-900">{sale.deliveryFee?.toLocaleString()} XAF</p>
                </div>
              )}
              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between">
                  <p className="font-medium text-gray-900">{t('sales.modals.view.orderSummary.totalAmount')}</p>
                  <p className="font-medium text-emerald-600">
                    {(sale.totalAmount + (sale.deliveryFee ?? 0)).toLocaleString()} XAF
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
        {/* Status Information */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-medium text-gray-500">{t('sales.modals.view.status.orderStatus')}</p>
            <Badge variant={
              sale.status === 'paid' ? 'success' :
              sale.status === 'under_delivery' ? 'info' : 'warning'
            }>
              {t(`sales.filters.status.${sale.status}`)}
            </Badge>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SaleDetailsModal; 