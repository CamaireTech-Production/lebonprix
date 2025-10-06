// Customer info structure (following documentation)
export interface CustomerInfo {
  name: string;
  phone: string;
  location: string;
  deliveryInstructions?: string;
}

// Order structure for WhatsApp integration
export interface OrderData {
  customerInfo: CustomerInfo;
  cartItems: CartItem[];
  totalAmount: number;
  deliveryFee?: number;
  finalTotal: number;
  orderId: string;
  timestamp: Date;
}

// Cart item interface (from existing cart context)
export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  category: string;
  selectedColor?: string;
  selectedSize?: string;
}

// Payment method types
export type PaymentMethodType = 'phone' | 'ussd' | 'link';

export interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  value: string; // phone number, USSD code, or URL
  isActive: boolean;
  createdAt: Date;
}

// Seller settings structure (for Phase 4)
export interface SellerSettings {
  whatsappNumber: string;
  businessName: string;
  paymentMethods: {
    mobileMoney?: boolean;
    bankTransfer?: boolean;
    cashOnDelivery?: boolean;
    customMethods?: PaymentMethod[]; // Dynamic payment methods
  };
  deliveryFee?: number;
  currency: string;
}
