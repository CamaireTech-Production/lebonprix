export interface CheckoutSettings {
  id: string;
  userId: string;
  
  // Section visibility
  showContactSection: boolean;
  showDeliverySection: boolean;
  showPaymentSection: boolean;
  
  // Contact section fields
  showEmail: boolean;
  showPhone: boolean;
  showNewsletter: boolean;
  
  // Delivery section fields
  showCountry: boolean;
  showFirstName: boolean;
  showLastName: boolean;
  showAddress: boolean;
  showApartment: boolean;
  showCity: boolean;
  showDeliveryInstructions: boolean;
  
  // Payment method availability
  enabledPaymentMethods: {
    mtnMoney: boolean;
    orangeMoney: boolean;
    visaCard: boolean;
    payOnsite: boolean;
  };
  
  // Shipping method
  showShippingMethod: boolean;
  defaultShippingFee: number;
  
  // Order summary
  showOrderSummary: boolean;
  showDiscountCode: boolean;
  
  // Trust badges
  showTrustBadges: boolean;
  
  // Catalogue display settings
  showCheckoutInCatalogue: boolean;
  checkoutButtonText: string;
  checkoutButtonColor: string;
  
  // POS Settings
  posCalculatorEnabled: boolean;
  defaultInventoryMethod: 'FIFO' | 'LIFO' | 'CMUP';
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface CheckoutSettingsUpdate {
  showContactSection?: boolean;
  showDeliverySection?: boolean;
  showPaymentSection?: boolean;
  showEmail?: boolean;
  showPhone?: boolean;
  showNewsletter?: boolean;
  showCountry?: boolean;
  showFirstName?: boolean;
  showLastName?: boolean;
  showAddress?: boolean;
  showApartment?: boolean;
  showCity?: boolean;
  showDeliveryInstructions?: boolean;
  enabledPaymentMethods?: {
    mtnMoney?: boolean;
    orangeMoney?: boolean;
    visaCard?: boolean;
    payOnsite?: boolean;
  };
  showShippingMethod?: boolean;
  defaultShippingFee?: number;
  showOrderSummary?: boolean;
  showDiscountCode?: boolean;
  showTrustBadges?: boolean;
  showCheckoutInCatalogue?: boolean;
  checkoutButtonText?: string;
  checkoutButtonColor?: string;
  posCalculatorEnabled?: boolean;
  defaultInventoryMethod?: 'FIFO' | 'LIFO' | 'CMUP';
}

// Default settings for new companies
export const DEFAULT_CHECKOUT_SETTINGS: Omit<CheckoutSettings, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
  // All sections enabled by default
  showContactSection: true,
  showDeliverySection: true,
  showPaymentSection: true,
  
  // Contact fields
  showEmail: true,
  showPhone: true,
  showNewsletter: true,
  
  // Delivery fields
  showCountry: true,
  showFirstName: true,
  showLastName: true,
  showAddress: true,
  showApartment: true,
  showCity: true,
  showDeliveryInstructions: true,
  
  // All payment methods enabled
  enabledPaymentMethods: {
    mtnMoney: true,
    orangeMoney: true,
    visaCard: true,
    payOnsite: true,
  },
  
  // Other settings
  showShippingMethod: true,
  defaultShippingFee: 0,
  showOrderSummary: true,
  showDiscountCode: true,
  showTrustBadges: true,
  
  // Catalogue display settings
  showCheckoutInCatalogue: true,
  checkoutButtonText: 'Checkout Now',
  checkoutButtonColor: '#10b981', // emerald-500
  
  // POS Settings
  posCalculatorEnabled: true,
  defaultInventoryMethod: 'FIFO',
};
