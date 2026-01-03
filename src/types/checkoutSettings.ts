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
  // Only Pay Onsite (cash on delivery) is kept as a basic option
  // CinetPay handles all online payment processing
  enabledPaymentMethods: {
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
  
  // Payment methods - only Pay Onsite (cash on delivery) by default
  // CinetPay must be configured separately for online payments
  enabledPaymentMethods: {
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
};
