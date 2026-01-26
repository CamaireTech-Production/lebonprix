// POSPaymentModal - Payment modal for POS
import React, { useState, useEffect } from 'react';
import { X, CreditCard, Banknote, Smartphone, User, Phone, MapPin, Printer } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import type { POSPaymentData, POSPaymentMethod, POSOrderType, POSCartTotals } from '../../types/pos';

interface POSPaymentModalProps {
  isOpen: boolean;
  cartTotals: POSCartTotals;
  orderType: POSOrderType;
  tableNumber?: number;
  initialCustomer?: { name: string; phone: string; location?: string } | null;
  initialTip: number;
  onConfirm: (paymentData: POSPaymentData) => void;
  onClose: () => void;
  isSubmitting: boolean;
}

const POSPaymentModal: React.FC<POSPaymentModalProps> = ({
  isOpen,
  cartTotals,
  orderType,
  tableNumber,
  initialCustomer,
  initialTip,
  onConfirm,
  onClose,
  isSubmitting,
}) => {
  const { language } = useLanguage();

  // Form state
  const [paymentMethod, setPaymentMethod] = useState<POSPaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerLocation, setCustomerLocation] = useState('');
  const [mobileMoneyPhone, setMobileMoneyPhone] = useState('');
  const [printReceipt, setPrintReceipt] = useState(true);
  const [printKitchenTicket, setPrintKitchenTicket] = useState(true);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('cash');
      setAmountReceived('');
      setCustomerName(initialCustomer?.name || '');
      setCustomerPhone(initialCustomer?.phone || '');
      setCustomerLocation(initialCustomer?.location || '');
      setMobileMoneyPhone('');
      setPrintReceipt(true);
      setPrintKitchenTicket(true);
    }
  }, [isOpen, initialCustomer]);

  // Calculate change
  const amountReceivedNum = parseFloat(amountReceived) || 0;
  const change = paymentMethod === 'cash' && amountReceivedNum > cartTotals.total
    ? amountReceivedNum - cartTotals.total
    : 0;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price) + ' XAF';
  };

  const handleSubmit = () => {
    // Validation
    if (paymentMethod === 'cash' && amountReceivedNum < cartTotals.total) {
      return; // Amount insufficient
    }
    if (paymentMethod === 'mobile_money' && !mobileMoneyPhone) {
      return; // Phone required for mobile money
    }
    if (orderType === 'delivery' && !customerPhone) {
      return; // Phone required for delivery
    }

    const paymentData: POSPaymentData = {
      paymentMethod,
      amountReceived: paymentMethod === 'cash' ? amountReceivedNum : undefined,
      change: paymentMethod === 'cash' ? change : undefined,
      tip: initialTip,
      mobileMoneyPhone: paymentMethod === 'mobile_money' ? mobileMoneyPhone : undefined,
      customerName,
      customerPhone,
      customerLocation,
      tableId: undefined, // Set by parent
      tableNumber,
      orderType,
      printReceipt,
      printKitchenTicket,
    };

    onConfirm(paymentData);
  };

  // Quick amount buttons for cash
  const quickAmounts = [
    cartTotals.total,
    Math.ceil(cartTotals.total / 1000) * 1000,
    Math.ceil(cartTotals.total / 5000) * 5000,
    Math.ceil(cartTotals.total / 10000) * 10000,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= cartTotals.total);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {t('pos_payment', language) || 'Payment'}
            </h2>
            <p className="text-sm text-gray-500">
              {t('total', language) || 'Total'}: <span className="font-semibold text-primary">{formatPrice(cartTotals.total)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Payment Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('payment_method', language) || 'Payment Method'}
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                  paymentMethod === 'cash'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Banknote size={24} className="mb-2" />
                <span className="text-sm font-medium">{t('cash', language) || 'Cash'}</span>
              </button>
              <button
                onClick={() => setPaymentMethod('card')}
                className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                  paymentMethod === 'card'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <CreditCard size={24} className="mb-2" />
                <span className="text-sm font-medium">{t('card', language) || 'Card'}</span>
              </button>
              <button
                onClick={() => setPaymentMethod('mobile_money')}
                className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                  paymentMethod === 'mobile_money'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Smartphone size={24} className="mb-2" />
                <span className="text-sm font-medium">{t('mobile_money', language) || 'Mobile'}</span>
              </button>
            </div>
          </div>

          {/* Cash Payment Details */}
          {paymentMethod === 'cash' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('amount_received', language) || 'Amount Received'}
              </label>
              <input
                type="number"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                placeholder={formatPrice(cartTotals.total)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-lg"
                min={cartTotals.total}
              />

              {/* Quick Amount Buttons */}
              <div className="flex flex-wrap gap-2 mt-2">
                {quickAmounts.map(amount => (
                  <button
                    key={amount}
                    onClick={() => setAmountReceived(amount.toString())}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      amountReceivedNum === amount
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {formatPrice(amount)}
                  </button>
                ))}
              </div>

              {/* Change Display */}
              {change > 0 && (
                <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex justify-between items-center">
                    <span className="text-green-700 font-medium">
                      {t('change', language) || 'Change'}
                    </span>
                    <span className="text-green-700 font-bold text-lg">
                      {formatPrice(change)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mobile Money Phone */}
          {paymentMethod === 'mobile_money' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone size={16} className="inline mr-1" />
                {t('mobile_money_phone', language) || 'Mobile Money Phone'} *
              </label>
              <input
                type="tel"
                value={mobileMoneyPhone}
                onChange={(e) => setMobileMoneyPhone(e.target.value)}
                placeholder="6XXXXXXXX"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          )}

          {/* Customer Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">
              {t('customer_info', language) || 'Customer Info'} {orderType === 'delivery' && '*'}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  <User size={12} className="inline mr-1" />
                  {t('name', language) || 'Name'}
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t('customer_name', language) || 'Customer name'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  <Phone size={12} className="inline mr-1" />
                  {t('phone', language) || 'Phone'} {orderType === 'delivery' && '*'}
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="6XXXXXXXX"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  required={orderType === 'delivery'}
                />
              </div>
            </div>

            {orderType === 'delivery' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  <MapPin size={12} className="inline mr-1" />
                  {t('delivery_address', language) || 'Delivery Address'} *
                </label>
                <input
                  type="text"
                  value={customerLocation}
                  onChange={(e) => setCustomerLocation(e.target.value)}
                  placeholder={t('delivery_address_placeholder', language) || 'Enter delivery address'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  required
                />
              </div>
            )}
          </div>

          {/* Print Options */}
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={printReceipt}
                onChange={(e) => setPrintReceipt(e.target.checked)}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <Printer size={16} className="text-gray-500" />
              <span className="text-sm text-gray-700">
                {t('print_receipt', language) || 'Print Receipt'}
              </span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={printKitchenTicket}
                onChange={(e) => setPrintKitchenTicket(e.target.checked)}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <span className="text-sm text-gray-700">
                {t('print_kitchen_ticket', language) || 'Kitchen Ticket'}
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          {/* Order Summary */}
          <div className="mb-4 text-sm space-y-1">
            <div className="flex justify-between text-gray-600">
              <span>{t('subtotal', language) || 'Subtotal'}</span>
              <span>{formatPrice(cartTotals.subtotal)}</span>
            </div>
            {cartTotals.tip > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>{t('pos_tip', language) || 'Tip'}</span>
                <span>{formatPrice(cartTotals.tip)}</span>
              </div>
            )}
            {cartTotals.deliveryFee > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>{t('delivery_fee', language) || 'Delivery'}</span>
                <span>{formatPrice(cartTotals.deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-lg pt-1 border-t">
              <span>{t('total', language) || 'Total'}</span>
              <span className="text-primary">{formatPrice(cartTotals.total)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              {t('cancel', language) || 'Cancel'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                (paymentMethod === 'cash' && amountReceivedNum < cartTotals.total) ||
                (paymentMethod === 'mobile_money' && !mobileMoneyPhone) ||
                (orderType === 'delivery' && (!customerPhone || !customerLocation))
              }
              className="flex-1 px-4 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin mr-2">⏳</span>
                  {t('processing', language) || 'Processing...'}
                </span>
              ) : (
                t('pos_confirm_payment', language) || 'Confirm Payment'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSPaymentModal;
