import { BaseModel } from './models';

// CinetPay Configuration interface
export interface CinetPayConfig extends BaseModel {
  userId: string;
  siteId: string;
  apiKey: string; // encrypted
  isActive: boolean;
  testMode: boolean;
  currency: 'XAF';
  enabledChannels: {
    mobileMoney: boolean;
    creditCard: boolean;
    wallet: boolean;
  };
  minAmount: number;
  maxAmount: number;
  supportedMethods: string[];
}

// CinetPay Configuration Update interface
export interface CinetPayConfigUpdate {
  siteId?: string;
  apiKey?: string;
  isActive?: boolean;
  testMode?: boolean;
  enabledChannels?: {
    mobileMoney?: boolean;
    creditCard?: boolean;
    wallet?: boolean;
  };
  minAmount?: number;
  maxAmount?: number;
  supportedMethods?: string[];
}

// CinetPay Transaction interface
export interface CinetPayTransaction {
  id: string;
  orderId: string;
  userId: string;
  transactionId: string;
  amount: number;
  currency: string;
  status: CinetPayTransactionStatus;
  channel: CinetPayChannel;
  operator?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
  paymentUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

// CinetPay Transaction Status
export type CinetPayTransactionStatus = 
  | 'PENDING'
  | 'ACCEPTED'
  | 'REFUSED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED';

// CinetPay Payment Channels
export type CinetPayChannel = 
  | 'MOBILE_MONEY'
  | 'CREDIT_CARD'
  | 'WALLET';

// CinetPay Webhook Payload
export interface CinetPayWebhookPayload {
  cpm_trans_id: string;
  cpm_site_id: string;
  cpm_trans_date: string;
  cpm_amount: string;
  cpm_currency: string;
  cpm_payid: string;
  cpm_payment_date: string;
  cpm_payment_time: string;
  cpm_error_message: string;
  cpm_phone_prefixe: string;
  cpm_phone: string;
  cpm_ipn_ack: string;
  cpm_result: string;
  cpm_trans_status: string;
  cpm_designation: string;
  cpm_custom: string;
  cpm_signature: string;
}

// CinetPay Validation Result
export interface CinetPayValidationResult {
  isValid: boolean;
  message: string;
  details?: {
    siteId?: string;
    apiKey?: string;
    testMode?: boolean;
  };
}

// CinetPay Payment Request
export interface CinetPayPaymentRequest {
  siteId: string;
  apiKey: string;
  amount: number;
  currency: string;
  transactionId: string;
  description: string;
  customerName: string;
  customerSurname: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  customerCity: string;
  customerCountry: string;
  customerZipCode: string;
  returnUrl: string;
  notifyUrl: string;
  channels: string;
  metadata?: Record<string, unknown>;
}

// CinetPay Payment Response
export interface CinetPayPaymentResponse {
  code: string;
  message: string;
  data?: {
    payment_url: string;
    transaction_id: string;
    status: string;
  };
}

// CinetPay SDK Options
export interface CinetPaySDKOptions {
  apikey: string;
  site_id: string;
  notify_url: string;
  return_url: string;
  transaction_id: string;
  amount: number;
  currency: string;
  channels: string;
  description: string;
  customer_name: string;
  customer_surname: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  customer_city: string;
  customer_country: string;
  customer_zip_code: string;
  metadata?: Record<string, unknown>;
}

// CinetPay SDK Callbacks
export interface CinetPayCallbacks {
  onSuccess?: (transaction: CinetPayTransaction) => void;
  onError?: (error: CinetPayError) => void;
  onClose?: () => void;
}

// CinetPay Error
export interface CinetPayError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Default CinetPay Configuration
export const DEFAULT_CINETPAY_CONFIG: Omit<CinetPayConfig, 'id' | 'userId' | 'companyId' | 'createdAt' | 'updatedAt'> = {
  siteId: '',
  apiKey: '',
  isActive: false,
  testMode: true,
  currency: 'XAF',
  enabledChannels: {
    mobileMoney: true,
    creditCard: true,
    wallet: true
  },
  minAmount: 100, // 100 XAF minimum
  maxAmount: 1000000, // 1,000,000 XAF maximum
  supportedMethods: ['MTN_MOBILE_MONEY', 'ORANGE_MONEY', 'VISA_CARD', 'MASTERCARD', 'WALLET']
};

// CinetPay Channel Display Names
export const CINETPAY_CHANNEL_NAMES: Record<CinetPayChannel, string> = {
  MOBILE_MONEY: 'Mobile Money',
  CREDIT_CARD: 'Credit Card',
  WALLET: 'Wallet'
};

// CinetPay Status Display Names
export const CINETPAY_STATUS_NAMES: Record<CinetPayTransactionStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REFUSED: 'Refused',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  FAILED: 'Failed'
};

// CinetPay Status Colors
export const CINETPAY_STATUS_COLORS: Record<CinetPayTransactionStatus, string> = {
  PENDING: 'yellow',
  ACCEPTED: 'green',
  REFUSED: 'red',
  CANCELLED: 'gray',
  EXPIRED: 'orange',
  FAILED: 'red'
};