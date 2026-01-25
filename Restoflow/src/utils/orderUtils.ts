import { OrderItem } from '../types';
import { getCurrencySymbol } from '../data/currencies';

export const generateOrderWhatsAppMessage = (
  restaurantName: string,
  orderItems: OrderItem[],
  totalAmount: number,
  customerPhone: string,
  customerLocation: string,
  orderId: string,
  orderType: 'online' | 'restaurant',
  deliveryFee: number = 0,
  currencyCode: string = 'XAF',
  customerName?: string,
  cinetpayTransactionId?: string,
  campayReference?: string
): string => {
  const currencySymbol = getCurrencySymbol(currencyCode) || 'FCFA';
  const itemsList = orderItems
    .map(item => `- ${item.title} x ${item.quantity} = ${(item.price * item.quantity).toLocaleString()} ${currencySymbol}`)
    .join('\n');

  let message = `🍽️ NOUVELLE COMMANDE #${orderId.slice(-6)} - ${restaurantName}\n\n`;
  
  if (orderType === 'online' && cinetpayTransactionId) {
    message += `✅ PAIEMENT CONFIRMÉ (CinetPay)\n`;
    message += `💰 Transaction ID: ${cinetpayTransactionId}\n`;
    message += `💳 Type: Commande Online\n\n`;
  } else if (orderType === 'online' && campayReference) {
    message += `✅ PAIEMENT CONFIRMÉ (Campay)\n`;
    message += `💰 Reference: ${campayReference}\n`;
    message += `💳 Type: Commande Online\n\n`;
  } else {
    message += `📦 Type: Commande in Restaurant (Paiement sur place)\n\n`;
  }

  message += `📋 DÉTAILS DE LA COMMANDE:\n${itemsList}\n\n`;
  message += `💵 Sous-total: ${totalAmount.toLocaleString()} ${currencySymbol}\n`;
  
  if (deliveryFee > 0) {
    message += `🚚 Frais de livraison: ${deliveryFee.toLocaleString()} ${currencySymbol}\n`;
  }
  
  const grandTotal = totalAmount + deliveryFee;
  message += `💰 TOTAL: ${grandTotal.toLocaleString()} ${currencySymbol}\n\n`;

  message += `👤 CLIENT:\n`;
  if (customerName) {
    message += `Nom: ${customerName}\n`;
  }
  message += `📞 Téléphone: ${customerPhone}\n`;
  message += `📍 Adresse: ${customerLocation}\n\n`;

  message += `🔍 Vérifiez la commande #${orderId.slice(-6)} dans votre système pour plus de détails.`;

  return message;
};
