import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@contexts/AuthContext';
import { convertOrderToSale } from '@services/firestore/orders/orderService';
import { getCurrentEmployeeRef } from '@utils/business/employeeUtils';
import { getUserById } from '@services/utilities/userService';
import { formatPrice } from '@utils/formatting/formatPrice';
import { Modal, Button } from '@components/common';
import { Order } from '../../types/order';
import { toast } from 'react-hot-toast';
import { logError } from '@utils/core/logger';
import { Package, User, Phone, MapPin, DollarSign, Calendar, AlertCircle, CheckCircle } from 'lucide-react';

interface ConvertOrderToSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSuccess?: () => void;
}

type SaleStatus = 'paid' | 'credit' | 'commande' | 'under_delivery';
type PaymentMethod = 'cash' | 'mobile_money' | 'card';

const ConvertOrderToSaleModal: React.FC<ConvertOrderToSaleModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccess
}) => {
  const { t } = useTranslation();
  const { user, company, currentEmployee, isOwner } = useAuth();
  const [saleStatus, setSaleStatus] = useState<SaleStatus>('paid');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [creditDueDate, setCreditDueDate] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);
  const [stockCheckError, setStockCheckError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && order) {
      // Reset form when modal opens
      setSaleStatus('paid');
      setPaymentMethod('cash');
      setCreditDueDate('');
      setStockCheckError(null);
    }
  }, [isOpen, order]);

  const handleConvert = async () => {
    if (!order || !user || !company) {
      toast.error('Missing required information');
      return;
    }

    try {
      setIsConverting(true);
      setStockCheckError(null);

      // Get createdBy employee reference
      let createdBy = null;
      if (user && company) {
        let userData = null;
        if (isOwner && !currentEmployee) {
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            logError('Error fetching user data for createdBy', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }

      // Convert order to sale
      const sale = await convertOrderToSale(
        order.id,
        saleStatus,
        company.id,
        user.uid,
        createdBy,
        saleStatus === 'paid' ? paymentMethod : undefined,
        saleStatus === 'credit' && creditDueDate ? new Date(creditDueDate) : undefined
      );

      toast.success(t('orders.messages.convertedToSale') || `Order converted to sale successfully`);
      
      if (onSuccess) {
        onSuccess();
      }
      
      onClose();
    } catch (error: any) {
      logError('Error converting order to sale', error);
      
      // Check if error is about stock
      if (error.message && error.message.toLowerCase().includes('insufficient stock')) {
        setStockCheckError(error.message);
      } else {
        toast.error(error.message || t('orders.messages.conversionFailed') || 'Failed to convert order to sale');
      }
    } finally {
      setIsConverting(false);
    }
  };

  if (!order) return null;

  const totalAmount = order.pricing.total;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('orders.actions.convertToSale') || 'Convert Order to Sale'}
      size="lg"
    >
      <div className="space-y-6">
        {/* Order Preview */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 mb-3">{t('orders.convert.orderPreview') || 'Order Preview'}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">{t('orders.orderDetails.name')}:</span>
              <span className="font-medium">{order.customerInfo.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">{t('orders.orderDetails.phone')}:</span>
              <span className="font-medium">{order.customerInfo.phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">{t('orders.orderDetails.location')}:</span>
              <span className="font-medium">{order.customerInfo.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">{t('orders.orderDetails.total')}:</span>
              <span className="font-medium">{formatPrice(totalAmount)} XAF</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">{t('orders.orderDetails.orderItems')}:</span>
            </div>
            <div className="space-y-1">
              {order.items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm text-gray-600">
                  <span>{item.name} x {item.quantity}</span>
                  <span>{formatPrice(item.price * item.quantity)} XAF</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stock Check Error */}
        {stockCheckError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">{t('orders.convert.stockError') || 'Stock Error'}</p>
              <p className="text-sm text-red-700 mt-1">{stockCheckError}</p>
            </div>
          </div>
        )}

        {/* Sale Status Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('orders.convert.saleStatus') || 'Sale Status'} *
          </label>
          <select
            value={saleStatus}
            onChange={(e) => setSaleStatus(e.target.value as SaleStatus)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="paid">{t('orders.convert.status.paid') || 'Paid'}</option>
            <option value="credit">{t('orders.convert.status.credit') || 'Credit'}</option>
            <option value="commande">{t('orders.convert.status.commande') || 'Order (Reservation)'}</option>
            <option value="under_delivery">{t('orders.convert.status.under_delivery') || 'Under Delivery'}</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {saleStatus === 'paid' && (t('orders.convert.statusHelp.paid') || 'Stock will be debited and finance entry created')}
            {saleStatus === 'credit' && (t('orders.convert.statusHelp.credit') || 'Stock will be debited but no finance entry')}
            {saleStatus === 'commande' && (t('orders.convert.statusHelp.commande') || 'Stock will NOT be debited, no finance entry')}
            {saleStatus === 'under_delivery' && (t('orders.convert.statusHelp.under_delivery') || 'Stock will be debited but no finance entry')}
          </p>
        </div>

        {/* Payment Method (if paid) */}
        {saleStatus === 'paid' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('orders.convert.paymentMethod') || 'Payment Method'} *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="cash">{t('orders.convert.paymentMethods.cash') || 'Cash'}</option>
              <option value="mobile_money">{t('orders.convert.paymentMethods.mobile_money') || 'Mobile Money'}</option>
              <option value="card">{t('orders.convert.paymentMethods.card') || 'Card'}</option>
            </select>
          </div>
        )}

        {/* Credit Due Date (if credit) */}
        {saleStatus === 'credit' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('orders.convert.creditDueDate') || 'Credit Due Date'} *
            </label>
            <input
              type="date"
              value={creditDueDate}
              onChange={(e) => setCreditDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
        )}

        {/* Warning for commande status */}
        {saleStatus === 'commande' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800">{t('orders.convert.warning.commande') || 'Warning'}</p>
              <p className="text-sm text-yellow-700 mt-1">
                {t('orders.convert.warning.commandeMessage') || 'Stock will not be debited. This is a reservation only.'}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            onClick={onClose}
            variant="outline"
            disabled={isConverting}
          >
            {t('orders.actions.cancel') || 'Cancel'}
          </Button>
          <Button
            onClick={handleConvert}
            disabled={isConverting || (saleStatus === 'credit' && !creditDueDate)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isConverting 
              ? (t('orders.convert.converting') || 'Converting...') 
              : (t('orders.convert.convert') || 'Convert to Sale')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConvertOrderToSaleModal;

