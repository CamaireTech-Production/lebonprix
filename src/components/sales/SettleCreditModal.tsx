import React, { useState } from 'react';
import { Modal, ModalFooter, Input, PriceInput } from '@components/common';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '@utils/formatting/formatPrice';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import type { Sale, OrderStatus } from '../../types/models';
import { DollarSign, Smartphone, CreditCard } from 'lucide-react';

interface SettleCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  onSettle: (saleId: string, paymentMethod: 'cash' | 'mobile_money' | 'card', transactionReference?: string, mobileMoneyPhone?: string) => Promise<void>;
}

export const SettleCreditModal: React.FC<SettleCreditModalProps> = ({
  isOpen,
  onClose,
  sale,
  onSettle,
}) => {
  const { t } = useTranslation();
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'card' | null>(null);
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [mobileMoneyPhone, setMobileMoneyPhone] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!sale) return null;

  const outstandingAmount = sale.remainingAmount ?? sale.totalAmount;
  const change = paymentMethod === 'cash' && amountReceived 
    ? parseFloat(amountReceived) - outstandingAmount 
    : 0;

  const handleSettle = async () => {
    if (!paymentMethod) {
      showErrorToast(t('sales.credit.selectPaymentMethod') || 'Please select a payment method');
      return;
    }

    if (paymentMethod === 'cash' && amountReceived && parseFloat(amountReceived) < outstandingAmount) {
      showErrorToast(t('sales.credit.insufficientAmount') || 'Amount received is less than outstanding amount');
      return;
    }

    if (paymentMethod === 'mobile_money' && !mobileMoneyPhone.trim()) {
      showErrorToast(t('sales.credit.mobileMoneyPhoneRequired') || 'Mobile money phone number is required');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSettle(
        sale.id,
        paymentMethod,
        transactionReference.trim() || undefined,
        mobileMoneyPhone.trim() || undefined
      );
      showSuccessToast(t('sales.credit.settledSuccess') || 'Credit sale settled successfully');
      onClose();
      // Reset form
      setPaymentMethod(null);
      setAmountReceived('');
      setTransactionReference('');
      setMobileMoneyPhone('');
    } catch (error: any) {
      showErrorToast(error.message || t('sales.credit.settleError') || 'Failed to settle credit sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setPaymentMethod(null);
      setAmountReceived('');
      setTransactionReference('');
      setMobileMoneyPhone('');
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('sales.credit.settleCredit') || 'Settle Credit Sale'}
      size="md"
      footer={
        <ModalFooter
          onCancel={handleClose}
          onConfirm={handleSettle}
          confirmText={t('sales.credit.settle') || 'Settle Credit'}
          cancelText={t('common.cancel') || 'Cancel'}
          isLoading={isSubmitting}
          disabled={!paymentMethod || isSubmitting}
        />
      }
    >
      <div className="space-y-6">
        {/* Sale Information */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {t('sales.credit.saleInfo') || 'Sale Information'}
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{t('sales.credit.customer') || 'Customer'}:</span>
              <span className="font-medium">{sale.customerInfo.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('sales.credit.phone') || 'Phone'}:</span>
              <span className="font-medium">{sale.customerInfo.phone || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('sales.credit.totalAmount') || 'Total Amount'}:</span>
              <span className="font-medium">{formatPrice(sale.totalAmount)} XAF</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('sales.credit.outstandingAmount') || 'Outstanding Amount'}:</span>
              <span className="font-bold text-orange-600 text-lg">
                {formatPrice(outstandingAmount)} XAF
              </span>
            </div>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {t('sales.credit.selectPaymentMethod') || 'Select Payment Method'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`p-4 border-2 rounded-lg transition-colors flex items-center space-x-3 ${
                paymentMethod === 'cash'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <DollarSign size={24} className="text-emerald-600" />
              <div className="text-left">
                <div className="font-semibold">{t('pos.payment.cash') || 'Cash'}</div>
              </div>
            </button>

            <button
              onClick={() => setPaymentMethod('mobile_money')}
              className={`p-4 border-2 rounded-lg transition-colors flex items-center space-x-3 ${
                paymentMethod === 'mobile_money'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Smartphone size={24} className="text-blue-600" />
              <div className="text-left">
                <div className="font-semibold">{t('pos.payment.mobileMoney') || 'Mobile Money'}</div>
              </div>
            </button>

            <button
              onClick={() => setPaymentMethod('card')}
              className={`p-4 border-2 rounded-lg transition-colors flex items-center space-x-3 ${
                paymentMethod === 'card'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <CreditCard size={24} className="text-purple-600" />
              <div className="text-left">
                <div className="font-semibold">{t('pos.payment.card') || 'Card'}</div>
              </div>
            </button>
          </div>
        </div>

        {/* Payment Method Specific Fields */}
        {paymentMethod === 'cash' && (
          <div>
            <PriceInput
              label={t('pos.payment.amountReceived') || 'Amount Received'}
              name="amountReceived"
              value={amountReceived}
              onChange={(e) => setAmountReceived(e.target.value)}
              placeholder={formatPrice(outstandingAmount)}
            />
            {change > 0 && (
              <div className="mt-2 p-3 bg-green-50 rounded-lg">
                <div className="text-sm text-gray-600">{t('pos.payment.change') || 'Change'}:</div>
                <div className="text-xl font-bold text-green-600">{formatPrice(change)} XAF</div>
              </div>
            )}
          </div>
        )}

        {paymentMethod === 'mobile_money' && (
          <div className="space-y-3">
            <Input
              label={t('pos.payment.mobileMoneyPhone') || 'Mobile Money Phone'}
              type="tel"
              value={mobileMoneyPhone}
              onChange={(e) => setMobileMoneyPhone(e.target.value)}
              placeholder="+237 6XX XXX XXX"
              required
            />
            <Input
              label={t('pos.payment.transactionReference') || 'Transaction Reference'}
              type="text"
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
              placeholder={t('pos.payment.transactionReferencePlaceholder') || 'Optional'}
            />
          </div>
        )}

        {paymentMethod === 'card' && (
          <div>
            <Input
              label={t('pos.payment.transactionReference') || 'Transaction Reference'}
              type="text"
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
              placeholder={t('pos.payment.transactionReferencePlaceholder') || 'Optional'}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

