import Modal, { ModalFooter } from '../common/Modal';
import Invoice from './Invoice';
import Card from '../common/Card';
import Badge from '../common/Badge';
import Button from '../common/Button';
import type { Sale, Product } from '../../types/models';
import { Download, Share } from 'lucide-react';
import { generatePDF } from '../../utils/pdf';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

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

  if (!sale) return null;

  const handleDownloadPDF = () => {
    generatePDF('invoice-content', `facture-${sale.id}`);
  };

  const handleShareInvoice = async () => {
    setIsSharing(true);
    try {
      const result = await generatePDF('invoice-content', `facture-${sale.id}`, true);
      if (!result || !(result instanceof Blob)) throw new Error('Failed to generate PDF');
      const pdfFile = new File([result], `facture-${sale.id}.pdf`, { type: 'application/pdf' });
      if (navigator.share) {
        await navigator.share({
          files: [pdfFile],
          title: `Facture - ${sale.customerInfo.name}`,
          text: `Facture pour la commande de ${sale.customerInfo.name}`,
        });
      } else {
        const url = URL.createObjectURL(result);
        const a = document.createElement('a');
        a.href = url;
        a.download = `facture-${sale.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      // handle error
    } finally {
      setIsSharing(false);
    }
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
          confirmText={t('common.close')}
          cancelText={t('common.close')}
        />
      }
    >
      <div className="space-y-6">
        {/* Invoice Actions */}
        <div className="flex justify-end space-x-2 mb-4 sticky top-0 bg-white z-10 py-2">
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
          <div className="max-h-[calc(100vh-200px)] overflow-y-auto" id="invoice-content">
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