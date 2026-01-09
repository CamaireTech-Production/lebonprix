import { BaseModel } from './models';

// Campay Configuration interface
export interface CampayConfig extends BaseModel {
  userId: string;
  companyId: string;
  appId: string; // encrypted
  isActive: boolean;
  environment: 'demo' | 'production';
  currency: 'XAF';
  minAmount: number;
  maxAmount: number;
  supportedMethods: string[]; // e.g., ['MTN', 'Orange']
}

// Campay Configuration Update interface
export interface CampayConfigUpdate {
  appId?: string;
  isActive?: boolean;
  environment?: 'demo' | 'production';
  minAmount?: number;
  maxAmount?: number;
  supportedMethods?: string[];
}

// Campay Transaction interface
export interface CampayTransaction {
  id: string;
  orderId: string;
  userId: string;
  reference: string;
  transactionId?: string;
  amount: number;
  currency: string;
  status: CampayTransactionStatus;
  paymentMethod?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

// Campay Transaction Status
export type CampayTransactionStatus = 
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

// Campay Options (for SDK)
export interface CampayOptions {
  payButtonId: string;        // Required - ID of button element
  description: string;         // Required - Payment description
  amount: string | number;     // Required - Amount (converted to string)
  currency: string;            // Required - Currency code (e.g., 'XAF')
  externalReference?: string;  // Optional - Your order ID
  redirectUrl?: string;        // Optional - Redirect after payment
}

// Campay Response (from SDK callbacks)
export interface CampayResponse {
  status: string;              // Payment status
  reference: string;           // Campay transaction reference
  amount?: number;             // Payment amount
  currency?: string;           // Currency code
  transactionId?: string;      // Transaction ID
  paymentMethod?: string;     // Payment method used (MTN, Orange, etc.)
  message?: string;            // Error message (if failed)
}

// Campay Transaction (simplified for internal use)
export interface CampayTransactionData {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  transactionId?: string;
  paymentMethod?: string;
  timestamp: string;
}

// Campay Validation Result
export interface CampayValidationResult {
  isValid: boolean;
  message: string;
  details?: {
    appId?: string;
    environment?: 'demo' | 'production';
    isActive?: boolean;
  };
}

// Campay SDK Callbacks
export interface CampayCallbacks {
  onSuccess?: (data: CampayResponse) => void;
  onFail?: (data: CampayResponse) => void;
  onModalClose?: (data?: CampayResponse) => void;
}

// Campay Error
export interface CampayError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Default Campay Configuration
export const DEFAULT_CAMPAY_CONFIG: Omit<CampayConfig, 'id' | 'userId' | 'companyId' | 'createdAt' | 'updatedAt'> = {
  appId: '',
  isActive: false,
  environment: 'demo',
  currency: 'XAF',
  minAmount: 10, // 10 XAF minimum (demo limit)
  maxAmount: 1000000, // 1,000,000 XAF maximum
  supportedMethods: ['MTN', 'Orange']
};

// Campay Status Display Names
export const CAMPAY_STATUS_NAMES: Record<CampayTransactionStatus, string> = {
  PENDING: 'Pending',
  SUCCESS: 'Success',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired'
};

// Campay Status Colors
export const CAMPAY_STATUS_COLORS: Record<CampayTransactionStatus, string> = {
  PENDING: 'yellow',
  SUCCESS: 'green',
  FAILED: 'red',
  CANCELLED: 'gray',
  EXPIRED: 'orange'
};

// Campay Payment Method Display Names
export const CAMPAY_PAYMENT_METHOD_NAMES: Record<string, string> = {
  MTN: 'MTN Mobile Money',
  Orange: 'Orange Money',
  'MTN_MOBILE_MONEY': 'MTN Mobile Money',
  'ORANGE_MONEY': 'Orange Money'
};

