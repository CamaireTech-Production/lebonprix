import React, { useState } from 'react';
import { Modal, ModalFooter, Input, PriceInput, Textarea } from '@components/common';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '@hooks/useCurrency';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import type { Sale } from '../../types/models';

interface RefundCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  onRefund: (saleId: string, refundAmount: number, reason?: string, paymentMethod?: 'cash' | 'mobile_money' | 'card', transactionReference?: string) => Promise<void>;
}

export const RefundCreditModal: React.FC<RefundCreditModalProps> = ({
  isOpen,
  onClose,
  sale,
  onRefund,
}) => {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'card' | null>(null);
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!sale) return null;

  const outstandingAmount = sale.remainingAmount ?? sale.totalAmount;
  const totalRefunded = sale.totalRefunded || 0;
  const refundAmountNum = refundAmount ? parseFloat(refundAmount) : 0;
  const newRemainingAmount = outstandingAmount - refundAmountNum;

  const handleRefund = async () => {
    if (!refundAmount || refundAmountNum <= 0) {
      showErrorToast(t('sales.refund.errors.amountRequired') || 'Please enter a refund amount');
      return;
    }

    if (refundAmountNum > outstandingAmount) {
      showErrorToast(t('sales.refund.errors.amountExceeds') || 'Refund amount cannot exceed remaining amount');
      return;
    }

    try {
      setIsSubmitting(true);
      await onRefund(
        sale.id,
        refundAmountNum,
        reason.trim() || undefined,
        paymentMethod || undefined,
        transactionReference.trim() || undefined
      );
      showSuccessToast(t('sales.refund.success') || 'Refund processed successfully');
      onClose();
      // Reset form
      setRefundAmount('');
      setReason('');
      setPaymentMethod(null);
      setTransactionReference('');
    } catch (error: any) {
      showErrorToast(error.message || t('sales.refund.errors.failed') || 'Failed to process refund');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setRefundAmount('');
      setReason('');
      setPaymentMethod(null);
      setTransactionReference('');
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('sales.refund.title') || 'Refund Credit Sale'}
      size="md"
      footer={
        <ModalFooter
          onCancel={handleClose}
          onConfirm={handleRefund}
          confirmText={t('sales.refund.process') || 'Process Refund'}
          cancelText={t('common.cancel') || 'Cancel'}
          isLoading={isSubmitting}
          disabled={!refundAmount || refundAmountNum <= 0 || refundAmountNum > outstandingAmount}
        />
      }
    >
      <div className="space-y-6">
        {/* Sale Information */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {t('sales.refund.saleInfo') || 'Sale Information'}
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{t('sales.credit.customer') || 'Customer'}:</span>
              <span className="font-medium">{sale.customerInfo.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('sales.credit.totalAmount') || 'Total Amount'}:</span>
              <span className="font-medium">{format(sale.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('sales.refund.totalRefunded') || 'Total Refunded'}:</span>
              <span className="font-medium text-orange-600">{format(totalRefunded)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('sales.credit.outstandingAmount') || 'Outstanding Amount'}:</span>
              <span className="font-bold text-orange-600 text-lg">
                {format(outstandingAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Refund Amount */}
        <div>
          <PriceInput
            label={t('sales.refund.refundAmount') || 'Refund Amount'}
            name="refundAmount"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            placeholder={format(outstandingAmount)}
            required
            max={outstandingAmount}
          />
          {refundAmountNum > 0 && (
            <div className="mt-2 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-600">{t('sales.refund.remainingAfter') || 'Remaining After Refund'}:</div>
              <div className="text-lg font-bold text-blue-600">
                {format(newRemainingAmount)}
              </div>
            </div>
          )}
        </div>

        {/* Reason (Optional) */}
        <div>
          <Textarea
            label={t('sales.refund.reason') || 'Reason (Optional)'}
            name="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('sales.refund.reasonPlaceholder') || 'Enter reason for refund...'}
            rows={3}
          />
        </div>

        {/* Payment Method (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('sales.refund.refundMethod') || 'Refund Method (Optional)'}
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('cash')}
              className={`p-3 border-2 rounded-lg transition-colors text-sm ${paymentMethod === 'cash'
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              {t('pos.payment.cash') || 'Cash'}
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('mobile_money')}
              className={`p-3 border-2 rounded-lg transition-colors text-sm ${paymentMethod === 'mobile_money'
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              {t('pos.payment.mobileMoney') || 'Mobile Money'}
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('card')}
              className={`p-3 border-2 rounded-lg transition-colors text-sm ${paymentMethod === 'card'
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              {t('pos.payment.card') || 'Card'}
            </button>
          </div>
        </div>

        {/* Transaction Reference (Optional, if payment method selected) */}
        {paymentMethod && paymentMethod !== 'cash' && (
          <div>
            <Input
              label={t('pos.payment.transactionReference') || 'Transaction Reference (Optional)'}
              type="text"
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
              placeholder={t('pos.payment.transactionReferencePlaceholder') || 'Enter transaction reference...'}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

