import { PaymentInfo } from '../types';
import { t } from './i18n';
import { getCurrencySymbol } from '../data/currencies';

// Cameroon mobile money USSD codes
export const CAMEROON_PAYMENT_CODES = {
  MOMO: {
    prefix: '*126#',
    transfer: '*126*1*{number}*{amount}#',
    balance: '*126*2#',
  },
  OM: {
    prefix: '*150#',
    transfer: '*150*1*{number}*{amount}#',
    balance: '*150*2#',
  },
};

// Generate USSD code for payment
export const generatePaymentCode = (
  paymentType: 'momo' | 'om',
  phoneNumber: string,
  amount: number
): string => {
  // Remove +237 prefix and clean the number
  const cleanNumber = phoneNumber.replace(/[^\d]/g, '').replace(/^237/, '');
  const code = CAMEROON_PAYMENT_CODES[paymentType.toUpperCase() as keyof typeof CAMEROON_PAYMENT_CODES];
  
  if (!code) {
    throw new Error(`Unsupported payment type: ${paymentType}`);
  }
  
  return code.transfer
    .replace('{number}', cleanNumber)
    .replace('{amount}', amount.toString());
};

// Generate payment message for WhatsApp
export const generatePaymentMessage = (
  restaurantName: string,
  orderItems: Array<{ title: string; quantity: number; price: number }>,
  totalAmount: number,
  customerPhone: string,
  customerLocation: string,
  paymentInfo?: PaymentInfo,
  language: string = 'en',
  customerName?: string,
  deliveryFee: number = 0,
  currencyCode: string = 'XAF',
  orderId?: string
): string => {
  const currencySymbol = getCurrencySymbol(currencyCode) || 'FCFA';
  const itemsList = orderItems
    .map(item => `- ${item.title} x ${item.quantity} = ${(item.price * item.quantity).toLocaleString()} ${currencySymbol}`)
    .join('\n');

  // Build message with text labels instead of emoji for iOS compatibility
  let orderNumber = orderId ? ` #${orderId.slice(-6)}` : '';
  let message = `${t('order_label', language)}${orderNumber} *${restaurantName}*\n\n`;
  message += `${t('details_label', language)}\n${itemsList}\n\n`;
  message += `${t('total_label', language)}: ${totalAmount.toLocaleString()} ${currencySymbol}\n`;
  if (deliveryFee > 0) {
    message += `${t('delivery_label', language)}: ${deliveryFee.toLocaleString()} ${currencySymbol}\n`;
  }

  // Calculate grand totals without transaction fees
  const grandTotal = totalAmount + deliveryFee;
  if (paymentInfo?.mtnMerchantCode || paymentInfo?.momo) {
    message += `\n${t('payment_method_label', language)}: MTN Mobile Money\n`;
    if (paymentInfo.momo) {
      const momoCode = generatePaymentCode('momo', paymentInfo.momo.number, grandTotal);
      message += `   ${t('number', language)}: ${paymentInfo.momo.number}\n`;
      message += `   ${t('name', language)}: ${paymentInfo.momo.name}\n`;
      message += `   ${t('ussd_code', language)}: _*${momoCode}*_\n`;
    }
    if (paymentInfo.mtnMerchantCode) {
      message += `   ${t('mtn_merchant_code', language)}: ${paymentInfo.mtnMerchantCode}\n`;
    }
    message += `   ${t('total', language)}: ${grandTotal.toLocaleString()} ${currencySymbol}\n`;
  }
  if (paymentInfo?.orangeMerchantCode || paymentInfo?.om) {
    message += `\n${t('payment_method_label', language)}: Orange Money\n`;
    if (paymentInfo.om) {
      const omCode = generatePaymentCode('om', paymentInfo.om.number, grandTotal);
      message += `   ${t('number', language)}: ${paymentInfo.om.number}\n`;
      message += `   ${t('name', language)}: ${paymentInfo.om.name}\n`;
      message += `   ${t('ussd_code', language)}: _*${omCode}*_\n`;
    }
    if (paymentInfo.orangeMerchantCode) {
      message += `   ${t('orange_merchant_code', language)}: ${paymentInfo.orangeMerchantCode}\n`;
    }
    message += `   ${t('total', language)}: ${grandTotal.toLocaleString()} ${currencySymbol}\n`;
  }
  if (paymentInfo?.paymentLink) {
    message += `\n${t('link_label', language)}: ${paymentInfo.paymentLink}\n`;
  }
  message += `\n${t('phone_label', language)}: ${customerPhone}\n`;
  if (customerName) {
    message += `${t('customer_label', language)}: ${customerName}\n`;
  }
  message += `${t('location_label', language)}: ${customerLocation}\n\n`;

  // Payment instructions
  if (paymentInfo && (paymentInfo.momo || paymentInfo.om || paymentInfo.paymentLink)) {
    message += `${t('instructions_label', language)}\n`;
    if (paymentInfo.momo || paymentInfo.om) {
      message += `1. ${t('copy_ussd_code', language)}\n`;
      message += `2. ${t('open_phone_app', language)}\n`;
      message += `3. ${t('complete_payment_and_send_screenshot', language)}\n`;
    }
    if (paymentInfo.paymentLink) {
      message += `${t('follow_payment_link', language)}: ${paymentInfo.paymentLink}\n`;
      message += `${t('pay_now', language)}\n`;
    }
  }
  return message;
};

// Open USSD code in phone app
export const openUSSDCode = (code: string): void => {
  // For mobile devices, this will open the phone app with the USSD code
  const telUrl = `tel:${code}`;
  window.location.href = telUrl;
};

// Validate Cameroon phone number format
export const validateCameroonPhone = (phone: string): boolean => {
  // Remove all non-digit characters and +237 prefix
  const cleanPhone = phone.replace(/[^\d]/g, '').replace(/^237/, '');
  
  // Cameroon phone numbers should be 9 digits (without country code)
  if (cleanPhone.length === 9) {
    // 9 digits - local format
    return /^[236789]\d{8}$/.test(cleanPhone);
  }
  
  return false;
};

// Format phone number for display
export const formatCameroonPhone = (phone: string): string => {
  // Remove all non-digit characters and +237 prefix
  const cleanPhone = phone.replace(/[^\d]/g, '').replace(/^237/, '');
  
  if (cleanPhone.length === 9) {
    return `+237 ${cleanPhone}`;
  }
  
  return phone;
};



// Format phone number for WhatsApp URL (digits only with country code)
export const formatForWhatsApp = (phone: string): string => {
  // Remove all non-digit characters
  const cleanPhone = phone.replace(/[^\d]/g, '');
  
  // If it starts with 237, return as is
  if (cleanPhone.startsWith('237') && cleanPhone.length === 12) {
    return cleanPhone;
  }
  
  // If it's 9 digits, add 237
  if (cleanPhone.length === 9) {
    return `237${cleanPhone}`;
  }
  
  // If it's already 12 digits, return as is
  if (cleanPhone.length === 12) {
    return cleanPhone;
  }
  
  // Default fallback
  return cleanPhone;
}; 