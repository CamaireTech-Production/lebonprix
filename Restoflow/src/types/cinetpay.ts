declare global {
  interface Window {
    CinetPay: {
      setConfig: (config: CinetPayConfig) => void;
      getCheckout: (options: CinetPayOptions) => void;
      open: () => void;
    };
  }
}

export interface CinetPayConfig {
  apikey: string;
  site_id: string;
  notify_url?: string;
  return_url?: string;
  lang: string;
}

export interface CinetPayOptions {
  transaction_id: string;
  amount: number;
  currency: string;
  description: string;
  customer_name: string;
  customer_surname: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  customer_city: string;
  customer_country: string;
  customer_state: string;
  customer_zip_code: string;
  metadata?: string;
  onSuccess?: (data: Record<string, unknown>) => void;
  onError?: (error: Record<string, unknown>) => void;
}

export interface CinetPayTransaction {
  transaction_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  customer_info: {
    name: string;
    email: string;
    phone: string;
  };
}

export interface CinetPayRestaurantConfig {
  siteId: string;
  apiKey: string; // encrypted
  isActive: boolean;
  environment: 'sandbox' | 'production';
  supportedMethods: string[];
  minAmount: number;
  maxAmount: number;
}
