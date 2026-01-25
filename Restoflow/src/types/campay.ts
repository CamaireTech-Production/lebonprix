declare global {
  interface Window {
    campay: {
      options: (config: CampayOptions) => void;
      onSuccess: (data: CampayResponse) => void;
      onFail: (data: CampayResponse) => void;
      onModalClose: (data: CampayResponse) => void;
    };
  }
}

export interface CampayOptions {
  payButtonId: string; // Required - ID of the button that triggers payment
  description: string; // Required - Order description
  amount: string | number; // Required - Payment amount (must be greater than 0) - Campay expects string
  currency: string; // Required - Currency code (e.g., 'XAF')
  externalReference?: string; // Optional - External reference/order ID
  redirectUrl?: string; // Optional - Redirect URL after payment
}

export interface CampayResponse {
  status: string;
  reference: string;
  amount?: number;
  currency?: string;
  transactionId?: string;
  paymentMethod?: string;
  message?: string;
}

export interface CampayTransaction {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  transactionId?: string;
  paymentMethod?: string;
  timestamp: string;
}

export interface CampayRestaurantConfig {
  appId: string; // encrypted
  isActive: boolean;
  environment: 'demo' | 'production';
  supportedMethods: string[];
  minAmount: number;
  maxAmount: number;
}

