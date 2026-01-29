export interface CheckoutSettings {
  id: string;
  userId: string;
  
  // Section visibility
  showContactSection: boolean;
  showDeliverySection: boolean;
  showPaymentSection: boolean;
  
  // Contact section fields
  showName: boolean;        // Nom complet (unifié)
  showPhone: boolean;       // Téléphone
  showQuarter: boolean;     // Quartier/résidence du client
  showEmail: boolean;       // Email (optionnel)
  showNewsletter: boolean;  // Newsletter (optionnel)
  
  // Delivery section fields
  showDeliveryName: boolean;           // Nom pour livraison (prérempli, modifiable)
  showDeliveryPhone: boolean;           // Téléphone pour livraison (prérempli, modifiable)
  showDeliveryAddressLine1: boolean;    // Adresse ligne 1 (Rue + Numéro) - REQUIS
  showDeliveryAddressLine2: boolean;   // Adresse ligne 2 (Complément) - optionnel
  showDeliveryQuarter: boolean;         // Quartier/Zone de livraison - REQUIS
  showDeliveryCity: boolean;            // Ville de livraison - optionnel
  showDeliveryInstructions: boolean;    // Instructions de livraison - optionnel
  showCountry: boolean;                 // Pays/Région - optionnel
  
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
  showName?: boolean;
  showPhone?: boolean;
  showQuarter?: boolean;
  showEmail?: boolean;
  showNewsletter?: boolean;
  showDeliveryName?: boolean;
  showDeliveryPhone?: boolean;
  showDeliveryAddressLine1?: boolean;
  showDeliveryAddressLine2?: boolean;
  showDeliveryQuarter?: boolean;
  showDeliveryCity?: boolean;
  showDeliveryInstructions?: boolean;
  showCountry?: boolean;
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
  
  // Contact fields - Standard structure: name, phone, quarter
  showName: true,        // Enabled - Nom complet (requis)
  showPhone: true,        // Enabled - Téléphone (requis)
  showQuarter: true,     // Enabled - Quartier/résidence du client (optionnel)
  showEmail: false,       // Disabled by default
  showNewsletter: false,  // Disabled by default
  
  // Delivery fields - Standard structure: name, phone, address lines, quarter, city
  showDeliveryName: true,           // Enabled - Nom pour livraison (prérempli, modifiable)
  showDeliveryPhone: true,          // Enabled - Téléphone pour livraison (prérempli, modifiable)
  showDeliveryAddressLine1: false, // Disabled by default - Adresse ligne 1 (requis)
  showDeliveryAddressLine2: false, // Disabled by default - Adresse ligne 2 (optionnel)
  showDeliveryQuarter: true,        // Enabled - Quartier/Zone de livraison (requis)
  showDeliveryCity: false,         // Disabled by default - Ville de livraison (optionnel)
  showDeliveryInstructions: true,   // Enabled - Instructions de livraison (optionnel, activé par défaut)
  showCountry: false,               // Disabled by default
  
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
