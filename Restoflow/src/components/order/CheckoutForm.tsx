import React from 'react';
import { OrderItem } from '../../types';
import { X, Phone, ShoppingCart } from 'lucide-react';
import { t } from '../../utils/i18n';

interface CheckoutFormProps {
  cart: OrderItem[];
  currencySymbol: string;
  language: string;
  checkoutName: string;
  checkoutPhone: string;
  checkoutLocation: string;
  phoneError: string;
  placingOrder: boolean;
  onClose: () => void;
  onBack: () => void;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onWhatsAppOrder: () => void;
  onRestaurantOrder: () => void;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({
  cart,
  currencySymbol,
  language,
  checkoutName,
  checkoutPhone,
  checkoutLocation,
  phoneError,
  placingOrder,
  onClose,
  onBack,
  onNameChange,
  onPhoneChange,
  onLocationChange,
  onWhatsAppOrder,
  onRestaurantOrder,
}) => {
  const totalCartAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="p-6">
      {/* Modal Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">{t('customer_info', language)}</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <div className="space-y-4">
        {/* Order Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h3 className="font-semibold mb-2">{t('order_summary', language)}</h3>
          <div className="space-y-1 text-sm">
            {cart.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>
                  {item.title} x{item.quantity}
                </span>
                <span>
                  {(item.price * item.quantity).toLocaleString()} {currencySymbol}
                </span>
              </div>
            ))}
            <div className="border-t pt-1 mt-2 flex justify-between font-semibold">
              <span>{t('total', language)}:</span>
              <span>{totalCartAmount.toLocaleString()} {currencySymbol}</span>
            </div>
          </div>
        </div>

        {/* Delivery Form */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('name', language)} ({t('optional', language)})
          </label>
          <input
            type="text"
            value={checkoutName}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            placeholder={t('name', language)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('phone_number', language)} *
          </label>
          <input
            type="tel"
            value={checkoutPhone}
            onChange={(e) => onPhoneChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary/40 ${
              phoneError ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="+237 6XX XXX XXX"
            required
          />
          {phoneError && <p className="text-red-500 text-sm mt-1">{phoneError}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('location_address', language)}{' '}
            <span className="text-gray-500">(Required for WhatsApp delivery)</span>
          </label>
          <input
            type="text"
            value={checkoutLocation}
            onChange={(e) => onLocationChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            placeholder={t('location_address', language)}
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          <button
            type="button"
            onClick={onBack}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-medium transition-colors"
          >
            {t('back_to_cart', language)}
          </button>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onWhatsAppOrder}
              disabled={placingOrder || !checkoutPhone || !checkoutLocation}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Phone size={16} />
              {placingOrder ? t('placing_order', language) : 'Commande via WhatsApp'}
            </button>

            <button
              type="button"
              onClick={onRestaurantOrder}
              disabled={placingOrder}
              className="flex-1 bg-primary hover:bg-primary-dark disabled:bg-gray-400 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <ShoppingCart size={16} />
              {placingOrder ? t('placing_order', language) : 'Commande in Restaurant'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutForm;


