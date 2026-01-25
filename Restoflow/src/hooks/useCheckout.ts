import { useState, useCallback } from 'react';
import { OrderItem, Restaurant } from '../types';
import { validateCameroonPhone, formatForWhatsApp, generatePaymentMessage } from '../utils/paymentUtils';
import { getPaymentFee } from '../data/paymentFees';
import toast from 'react-hot-toast';
import { t } from '../utils/i18n';

interface UseCheckoutProps {
  restaurant?: Restaurant;
  cart: OrderItem[];
  totalCartAmount: number;
  clearCart: () => void;
  createOrder?: (order: any) => Promise<string>;
  language: string;
}

export const useCheckout = ({
  restaurant,
  cart,
  totalCartAmount,
  clearCart,
  createOrder,
  language,
}: UseCheckoutProps) => {
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutLocation, setCheckoutLocation] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);

  const phoneError =
    phoneTouched && !validateCameroonPhone(checkoutPhone)
      ? t('invalid_phone_number', language)
      : '';

  const handlePhoneChange = useCallback((value: string) => {
    setCheckoutPhone(value);
    setPhoneTouched(true);
  }, []);

  const handleWhatsAppOrder = useCallback(async () => {
    if (!restaurant?.whatsapp) {
      toast.error(t('whatsapp_not_configured', language));
      return;
    }

    if (!validateCameroonPhone(checkoutPhone)) {
      toast.error(t('invalid_phone_number', language));
      return;
    }

    if (!checkoutLocation.trim()) {
      toast.error(t('please_provide_location', language));
      return;
    }

    setPlacingOrder(true);

    try {
      const fee = getPaymentFee(restaurant.paymentMethod || 'cash');
      const feeAmount = (totalCartAmount * fee.percentage) / 100 + fee.fixed;
      const grandTotal = totalCartAmount + feeAmount;

      const message = generatePaymentMessage({
        items: cart,
        customerName: checkoutName || t('customer', language),
        customerPhone: formatForWhatsApp(checkoutPhone),
        deliveryLocation: checkoutLocation,
        subtotal: totalCartAmount,
        fee: feeAmount,
        total: grandTotal,
        paymentMethod: restaurant.paymentMethod || 'cash',
        restaurantName: restaurant.name,
      });

      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${restaurant.whatsapp.replace(
        /\D/g,
        ''
      )}?text=${encodedMessage}`;

      window.open(whatsappUrl, '_blank');
      toast.success(t('order_sent_successfully', language));

      // Clear cart and form
      clearCart();
      setCheckoutName('');
      setCheckoutPhone('');
      setCheckoutLocation('');
      setPhoneTouched(false);
    } catch (error) {
      console.error('Error creating WhatsApp order:', error);
      toast.error(t('error_placing_order', language));
    } finally {
      setPlacingOrder(false);
    }
  }, [
    restaurant,
    checkoutPhone,
    checkoutLocation,
    checkoutName,
    cart,
    totalCartAmount,
    clearCart,
    language,
  ]);

  const handleRestaurantOrder = useCallback(async () => {
    if (!restaurant?.id) {
      toast.error(t('restaurant_not_found', language));
      return;
    }

    if (!validateCameroonPhone(checkoutPhone)) {
      toast.error(t('invalid_phone_number', language));
      return;
    }

    setPlacingOrder(true);

    try {
      const orderData = {
        restaurantId: restaurant.id,
        customerName: checkoutName || t('customer', language),
        customerPhone: formatForWhatsApp(checkoutPhone),
        deliveryLocation: checkoutLocation || t('in_restaurant', language),
        items: cart,
        subtotal: totalCartAmount,
        total: totalCartAmount,
        status: 'pending',
        orderType: 'restaurant',
        createdAt: new Date(),
      };

      if (createOrder) {
        await createOrder(orderData);
      }

      toast.success(t('order_placed_successfully', language));

      // Clear cart and form
      clearCart();
      setCheckoutName('');
      setCheckoutPhone('');
      setCheckoutLocation('');
      setPhoneTouched(false);
    } catch (error) {
      console.error('Error creating restaurant order:', error);
      toast.error(t('error_placing_order', language));
    } finally {
      setPlacingOrder(false);
    }
  }, [
    restaurant,
    checkoutName,
    checkoutPhone,
    checkoutLocation,
    cart,
    totalCartAmount,
    createOrder,
    clearCart,
    language,
  ]);

  return {
    checkoutName,
    checkoutPhone,
    checkoutLocation,
    phoneTouched,
    phoneError,
    placingOrder,
    setCheckoutName,
    setCheckoutPhone: handlePhoneChange,
    setCheckoutLocation,
    handleWhatsAppOrder,
    handleRestaurantOrder,
  };
};


