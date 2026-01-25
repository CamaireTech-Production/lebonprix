import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Restaurant, OrderItem, Order } from '../../types';
import { useCinetPay } from '../../hooks/useCinetPay';
import { useCampay } from '../../hooks/useCampay';
import { validateCameroonPhone, formatForWhatsApp, formatCameroonPhone } from '../../utils/paymentUtils';
import { generateOrderWhatsAppMessage } from '../../utils/orderUtils';
import { getCurrencySymbol } from '../../data/currencies';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import toast from 'react-hot-toast';
import { ArrowLeft, CreditCard, Store, Smartphone } from 'lucide-react';

interface CheckoutContentProps {
  restaurant: Restaurant | null;
  cart: OrderItem[];
  createOrder: (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
}

const CheckoutContent: React.FC<CheckoutContentProps> = ({
  restaurant,
  cart,
  createOrder
}) => {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { processPayment: processCinetPay, isLoading: isCinetPayLoading, isInitialized: isCinetPayInitialized } = useCinetPay(restaurantId || '');
  const { processPayment: processCampay, isLoading: isCampayLoading, isInitialized: isCampayInitialized, hiddenButtonId } = useCampay(restaurantId || '');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerLocation, setCustomerLocation] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cinetpay' | 'campay' | 'restaurant'>('restaurant');

  const currencySymbol = restaurant?.currency ? getCurrencySymbol(restaurant.currency) : 'FCFA';
  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = restaurant?.deliveryFee || 0;
  const grandTotal = totalAmount + deliveryFee;

  const phoneError = phoneTouched && !validateCameroonPhone(customerPhone);
  const isLoading = isCinetPayLoading || isCampayLoading;
  const hasOnlinePayment = isCinetPayInitialized || isCampayInitialized;

  const handleCinetPayOrder = async () => {
    // Validation
    if (!customerName.trim()) {
      toast.error(t('please_enter_name', language));
      return;
    }
    if (!validateCameroonPhone(customerPhone)) {
      toast.error(t('please_enter_valid_phone', language));
      setPhoneTouched(true);
      return;
    }
    if (!customerLocation.trim()) {
      toast.error(t('please_enter_delivery_location', language));
      return;
    }

    try {
      // Process CinetPay payment
      const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const paymentResult = await processCinetPay({
        transaction_id: transactionId,
        amount: grandTotal,
        currency: restaurant?.currency || 'XAF',
        description: `Order from ${restaurant?.name}`,
        customer_name: customerName,
        customer_surname: customerName.split(' ')[0] || '',
        customer_email: customerEmail || `${customerPhone}@placeholder.com`,
        customer_phone: formatCameroonPhone(customerPhone),
        customer_address: customerLocation,
        customer_city: customerLocation.split(',')[0] || '',
        customer_country: 'CM',
        customer_state: '',
        customer_zip_code: '',
        metadata: JSON.stringify({
          restaurantId: restaurant?.id,
          orderType: 'online'
        })
      });

      if (!paymentResult) {
        return;
      }

      // Create order after successful payment
      const orderPayload: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> = {
        items: cart,
        restaurantId: restaurant!.id,
        status: 'pending',
        totalAmount: totalAmount,
        customerViewStatus: 'active',
        tableNumber: 0,
        customerName,
        customerPhone: formatCameroonPhone(customerPhone),
        customerLocation,
        deliveryFee,
        orderType: 'online',
        paymentMethod: 'cinetpay',
        paymentStatus: 'completed',
        cinetpayTransactionId: paymentResult.transaction_id,
        paymentVerified: true,
        cinetpayMetadata: {
          transactionId: paymentResult.transaction_id,
          paymentMethod: paymentResult.payment_method,
          timestamp: new Date().toISOString()
        }
      };

      const orderId = await createOrder(orderPayload);

      // Send WhatsApp notification
      const message = generateOrderWhatsAppMessage(
        restaurant!.name,
        cart,
        totalAmount,
        customerPhone,
        customerLocation,
        orderId,
        'online',
        deliveryFee,
        restaurant?.currency || 'XAF',
        customerName,
        paymentResult.transaction_id
      );

      const waUrl = `https://wa.me/${formatForWhatsApp(restaurant!.phone || '237000000000')}?text=${encodeURIComponent(message)}`;
      window.location.href = waUrl;

      // Clear cart
      localStorage.removeItem(`cart_${restaurantId}`);
      toast.success(t('order_placed_successfully', language));
    } catch (error) {
      console.error('Order error:', error);
      toast.error(t('failed_place_order', language));
    }
  };

  const handleCampayOrder = async () => {
    // Validation
    if (!customerName.trim()) {
      toast.error(t('please_enter_name', language));
      return;
    }
    if (!validateCameroonPhone(customerPhone)) {
      toast.error(t('please_enter_valid_phone', language));
      setPhoneTouched(true);
      return;
    }
    if (!customerLocation.trim()) {
      toast.error(t('please_enter_delivery_location', language));
      return;
    }

    // Check if Campay is configured and active
    if (!restaurant?.campayConfig?.isActive) {
      toast.error(t('campay_payment_not_available', language));
      return;
    }

    // CRITICAL: Demo environment has a maximum of 10 XAF
    const isDemo = restaurant.campayConfig.environment === 'demo';
    const DEMO_MAX_AMOUNT = 10;
    
    // Check network connectivity
    if (!navigator.onLine) {
      toast.error(t('no_internet_connection_checkout', language));
      return;
    }

    try {
      // Generate external reference (order ID)
      const externalReference = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Process Campay payment
      // Ensure amount is a proper number (round to avoid decimal issues)
      let paymentAmount = Math.round(grandTotal);
      
      // If in demo mode and amount exceeds limit, cap it at 10 XAF and show warning
      if (isDemo && paymentAmount > DEMO_MAX_AMOUNT) {
        const errorMsg = t('campay_demo_amount_limit_exceeded', language)
          .replace('{{maxAmount}}', String(DEMO_MAX_AMOUNT))
          .replace('{{currentAmount}}', grandTotal.toLocaleString())
          .replace('{{currency}}', currencySymbol);
        toast.error(errorMsg, { duration: 6000 });
        // Cap the amount at demo limit - modal will open with 10 XAF
        paymentAmount = DEMO_MAX_AMOUNT;
      }

      // Validate amount limits (only if not already capped for demo)
      if (restaurant.campayConfig && paymentAmount === grandTotal) {
        if (grandTotal < restaurant.campayConfig.minAmount) {
          toast.error(t('minimum_payment_amount', language).replace('{{amount}}', restaurant.campayConfig.minAmount.toLocaleString()).replace('{{currency}}', currencySymbol));
          return;
        }
        if (grandTotal > restaurant.campayConfig.maxAmount) {
          toast.error(t('maximum_payment_amount', language).replace('{{amount}}', restaurant.campayConfig.maxAmount.toLocaleString()).replace('{{currency}}', currencySymbol));
          return;
        }
      }
      
      // Create description - use simple string interpolation since t() doesn't support params
      const orderDescription = `Order from ${restaurant?.name || 'Restaurant'}`;
      
      const paymentOptions = {
        payButtonId: hiddenButtonId,
        description: orderDescription,
        amount: paymentAmount,
        currency: restaurant?.currency || 'XAF',
        externalReference: externalReference
      };
      
      const paymentResult = await processCampay(
        paymentOptions,
        // onSuccess callback
        async (data) => {
          try {
            // Create order after successful payment
            const orderPayload: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> = {
              items: cart,
              restaurantId: restaurant!.id,
              status: 'pending',
              totalAmount: totalAmount,
              customerViewStatus: 'active',
              tableNumber: 0,
              customerName,
              customerPhone: formatCameroonPhone(customerPhone),
              customerLocation,
              deliveryFee,
              orderType: 'online',
              paymentMethod: 'campay',
              paymentStatus: 'completed',
              campayReference: data.reference,
              campayStatus: 'completed',
              paymentVerified: true,
              campayMetadata: {
                reference: data.reference,
                transactionId: data.transactionId,
                paymentMethod: data.paymentMethod || 'mobile_money',
                timestamp: new Date().toISOString()
              }
            };

            const orderId = await createOrder(orderPayload);

            // Send WhatsApp notification
            const message = generateOrderWhatsAppMessage(
              restaurant!.name,
              cart,
              totalAmount,
              customerPhone,
              customerLocation,
              orderId,
              'online',
              deliveryFee,
              restaurant?.currency || 'XAF',
              customerName,
              undefined, // No CinetPay transaction ID
              data.reference // Campay reference
            );

            const waUrl = `https://wa.me/${formatForWhatsApp(restaurant!.phone || '237000000000')}?text=${encodeURIComponent(message)}`;
            window.location.href = waUrl;

            // Clear cart
            localStorage.removeItem(`cart_${restaurantId}`);
            toast.success(t('order_placed_successfully', language));
          } catch (error) {
            console.error('Order creation error:', error);
            toast.error(t('payment_successful_order_failed', language));
          }
        },
            // onFail callback
            (data) => {
              // Check for demo amount limit error (ER201)
              const errorMessage = data.message || '';
              if (errorMessage.includes('Maximum amount') || errorMessage.includes('ER201') || errorMessage.includes('demo system')) {
                const demoError = t('campay_demo_amount_limit_error', language)
                  .replace('{{currentAmount}}', paymentAmount.toLocaleString());
                toast.error(demoError, { duration: 6000 });
                console.error('Campay Demo Limit Error from API:', errorMessage);
              } else {
                toast.error(data.message || t('payment_failed_try_again', language));
              }
            },
        // onModalClose callback
        () => {
          // User cancelled - no error message needed
        }
      );

      // Note: The actual order creation happens in the onSuccess callback
      // This promise resolves when payment is processed
      if (!paymentResult) {
        return;
      }
    } catch (error) {
      // Error handling is done in callbacks
    }
  };

  const handleRestaurantOrder = async () => {
    // Validation
    if (!customerName.trim()) {
      toast.error(t('please_enter_name', language));
      return;
    }
    if (!validateCameroonPhone(customerPhone)) {
      toast.error(t('please_enter_valid_phone', language));
      setPhoneTouched(true);
      return;
    }

    try {
      const orderPayload: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> = {
        items: cart,
        restaurantId: restaurant!.id,
        status: 'pending',
        totalAmount: totalAmount,
        customerViewStatus: 'active',
        tableNumber: 0,
        customerName,
        customerPhone: formatCameroonPhone(customerPhone),
        customerLocation: customerLocation || 'In Restaurant',
        deliveryFee: 0,
        orderType: 'restaurant',
        paymentMethod: 'cash',
        paymentStatus: 'pending'
      };

      const orderId = await createOrder(orderPayload);

      // Send WhatsApp notification
      const message = generateOrderWhatsAppMessage(
        restaurant!.name,
        cart,
        totalAmount,
        customerPhone,
        customerLocation || 'In Restaurant',
        orderId,
        'restaurant',
        0,
        restaurant?.currency || 'XAF',
        customerName
      );

      const waUrl = `https://wa.me/${formatForWhatsApp(restaurant!.phone || '237000000000')}?text=${encodeURIComponent(message)}`;
      window.location.href = waUrl;

      localStorage.removeItem(`cart_${restaurantId}`);
      toast.success(t('order_placed_successfully', language));
    } catch (error) {
      console.error('Order error:', error);
      toast.error(t('failed_place_order', language));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate(`/public-order/${restaurantId}`)}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={20} className="mr-2" />
            {t('back_to_menu', language)}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">{t('checkout', language)}</h1>

        {/* Order Summary */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">{t('order_summary', language)}</h2>
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center py-3 border-b border-gray-100">
                {/* Dish Image */}
                <div className="flex-shrink-0 w-16 h-16 mr-4">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                      <span className="text-gray-400 text-xs">No Image</span>
                    </div>
                  )}
                </div>
                
                {/* Dish Details */}
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{item.title}</div>
                  <div className="text-sm text-gray-500">
                    {item.price.toLocaleString()} {currencySymbol} × {item.quantity}
                  </div>
                  {item.notes && (
                    <div className="text-xs text-gray-400 mt-1">
                      Note: {item.notes}
                    </div>
                  )}
                </div>
                
                {/* Price */}
                <div className="text-right">
                  <div className="font-semibold text-gray-900">
                    {(item.price * item.quantity).toLocaleString()} {currencySymbol}
                  </div>
                </div>
              </div>
            ))}
            <div className="border-t pt-3 mt-3">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">{totalAmount.toLocaleString()} {currencySymbol}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Delivery Fee:</span>
                  <span className="font-medium">{deliveryFee.toLocaleString()} {currencySymbol}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total:</span>
                <span className="text-primary">{grandTotal.toLocaleString()} {currencySymbol}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Information */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">{t('customer_information', language)}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('name_required', language)}
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('enter_your_name_placeholder', language)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('phone_number_required', language)}
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-sm">
                  +237
                </span>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    setPhoneTouched(true);
                  }}
                  className={`flex-1 px-3 py-2 border ${phoneError ? 'border-red-500' : 'border-gray-300'} rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder="690160047"
                />
              </div>
              {phoneError && (
                <p className="text-red-500 text-xs mt-1">{t('please_enter_valid_phone', language)}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('email_optional', language)}
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('your_email_placeholder', language)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('delivery_location_required', language)}
              </label>
              <textarea
                value={customerLocation}
                onChange={(e) => setCustomerLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder={t('enter_delivery_address_placeholder', language)}
              />
            </div>
          </div>
        </div>

        {/* Payment Options */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">{t('choose_payment_method', language)}</h2>
          
          <div className="space-y-3">
            {/* Payment Method Selection */}
            {hasOnlinePayment && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('select_payment_method', language)}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {isCinetPayInitialized && restaurant?.cinetpayConfig?.isActive && (
                    <button
                      onClick={() => setPaymentMethod('cinetpay')}
                      className={`p-3 rounded-lg border-2 transition-colors ${
                        paymentMethod === 'cinetpay'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <CreditCard size={20} className="mx-auto mb-1" />
                      <div className="text-sm font-medium">CinetPay</div>
                    </button>
                  )}
                  {isCampayInitialized && restaurant?.campayConfig?.isActive && (
                    <button
                      onClick={() => setPaymentMethod('campay')}
                      className={`p-3 rounded-lg border-2 transition-colors ${
                        paymentMethod === 'campay'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Smartphone size={20} className="mx-auto mb-1" />
                      <div className="text-sm font-medium">OM or MOMO</div>
                    </button>
                  )}
                  <button
                    onClick={() => setPaymentMethod('restaurant')}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      paymentMethod === 'restaurant'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Store size={20} className="mx-auto mb-1" />
                    <div className="text-sm font-medium">{t('at_restaurant', language)}</div>
                  </button>
                </div>
              </div>
            )}

            {/* Online Order Buttons */}
            {hasOnlinePayment && paymentMethod !== 'restaurant' && (
              <button
                onClick={paymentMethod === 'cinetpay' ? handleCinetPayOrder : handleCampayOrder}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-3"
              >
                {paymentMethod === 'cinetpay' ? (
                  <>
                <CreditCard size={20} />
                    {isLoading ? t('processing', language) : t('pay_with_cinetpay', language)}
                  </>
                ) : (
                  <>
                    <Smartphone size={20} />
                    {isLoading ? t('processing', language) : 'Pay with OM or MOMO'}
                  </>
                )}
              </button>
            )}

            {/* Restaurant Order Button - Only show when restaurant payment is selected or no online payment available */}
            {(paymentMethod === 'restaurant' || !hasOnlinePayment) && (
            <button
              onClick={handleRestaurantOrder}
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-3"
            >
              <Store size={20} />
                {isLoading ? t('processing', language) : t('pay_at_restaurant', language)}
            </button>
            )}
          </div>

          {!hasOnlinePayment && (
            <p className="text-sm text-gray-500 mt-3 text-center">
              {t('online_payment_not_available', language)}
            </p>
          )}

          {/* Hidden button for Campay SDK */}
          {isCampayInitialized && (
            <button
              id={hiddenButtonId}
              type="button"
              style={{ display: 'none' }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckoutContent;
