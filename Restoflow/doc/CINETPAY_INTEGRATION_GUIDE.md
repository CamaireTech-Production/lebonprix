# CinetPay Integration Guide

## Overview

This comprehensive guide documents everything needed to integrate CinetPay payment gateway into any project. It covers all aspects from initial setup to production deployment, including security considerations, error handling, and user experience optimization.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Setup](#project-setup)
3. [CinetPay SDK Integration](#cinetpay-sdk-integration)
4. [Backend Configuration](#backend-configuration)
5. [Frontend Implementation](#frontend-implementation)
6. [Settings Configuration](#settings-configuration)
7. [Security Implementation](#security-implementation)
8. [Error Handling](#error-handling)
9. [Testing](#testing)
10. [Production Deployment](#production-deployment)
11. [Troubleshooting](#troubleshooting)

## Prerequisites

### 1. CinetPay Account Setup
- Create account at [CinetPay](https://cinetpay.com)
- Get your Site ID and API Key from dashboard
- Configure your domain in CinetPay dashboard
- Set up webhook endpoints

### 2. Technical Requirements
- Node.js 16+ or equivalent runtime
- HTTPS enabled (required for production)
- Firebase project (if using Firebase backend)
- SSL certificate for production

### 3. Supported Payment Methods
- **Mobile Money**: MTN, Orange Money
- **Bank Cards**: Visa, Mastercard
- **Bank Transfers**: Local bank integration
- **Currency**: XAF (Cameroon Franc) - primary

## Project Setup

### 1. Install Dependencies

```bash
# Core dependencies
npm install crypto-js
npm install react-hot-toast

# For TypeScript projects
npm install @types/crypto-js
```

### 2. Environment Variables

Create `.env` file:

```env
# CinetPay Configuration
VITE_CINETPAY_SITE_ID=your_site_id
VITE_CINETPAY_API_KEY=your_api_key
VITE_CINETPAY_CURRENCY=XAF
VITE_CINETPAY_ENVIRONMENT=sandbox # or production

# Firebase Configuration (if using Firebase)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## CinetPay SDK Integration

### 1. Add CinetPay SDK to HTML

In your `index.html` or main HTML file:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your App</title>
    
    <!-- CinetPay SDK -->
    <script src="https://cdn.cinetpay.com/seamless/main.js"></script>
</head>
<body>
    <div id="root"></div>
</body>
</html>
```

### 2. TypeScript Declarations

Create `src/types/cinetpay.d.ts`:

```typescript
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
  metadata?: string; // Must be JSON string
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

export {};
```

## Backend Configuration

### 1. CinetPay Configuration Model

Create `src/types/cinetpayConfig.ts`:

```typescript
export interface CinetPayConfig extends BaseModel {
  siteId: string;
  apiKey: string; // encrypted
  currency: 'XAF';
  isActive: boolean;
  supportedMethods: string[];
  minAmount: number;
  maxAmount: number;
  notifyUrl?: string;
  returnUrl?: string;
  environment: 'sandbox' | 'production';
}
```

### 2. Encryption Service

Create `src/services/encryptionService.ts`:

```typescript
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.VITE_ENCRYPTION_KEY || 'your-secret-key';

export class SecureEncryption {
  static encrypt(text: string): string {
    try {
      const encrypted = CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
      return encrypted;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  static decrypt(encryptedText: string): string {
    try {
      // Check if it's already plain text (for migration)
      if (!encryptedText.includes('U2FsdGVkX1')) {
        return encryptedText;
      }
      
      const decrypted = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
      const result = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!result) {
        throw new Error('Decryption failed');
      }
      
      return result;
    } catch (error) {
      console.error('Decryption failed:', error);
      // Return original data as fallback
      return encryptedText;
    }
  }
}
```

### 3. CinetPay Service

Create `src/services/cinetpayService.ts`:

```typescript
import { CinetPayConfig, CinetPayOptions, CinetPayTransaction } from '../types/cinetpay';
import { SecureEncryption } from './encryptionService';

export class CinetPayService {
  private config: CinetPayConfig | null = null;

  async initializeConfig(userId: string): Promise<CinetPayConfig | null> {
    try {
      // Load config from your database
      const config = await this.loadConfigFromDatabase(userId);
      
      if (config) {
        // Decrypt API key
        config.apiKey = SecureEncryption.decrypt(config.apiKey);
        this.config = config;
        
        // Initialize CinetPay SDK
        this.initializeSDK();
      }
      
      return config;
    } catch (error) {
      console.error('Failed to initialize CinetPay config:', error);
      return null;
    }
  }

  private initializeSDK(): void {
    if (!this.config || !window.CinetPay) {
      throw new Error('CinetPay SDK not loaded or config missing');
    }

    window.CinetPay.setConfig({
      apikey: this.config.apiKey,
      site_id: this.config.siteId,
      notify_url: this.config.notifyUrl,
      return_url: this.config.returnUrl,
      lang: 'fr'
    });
  }

  async processPayment(options: CinetPayOptions): Promise<CinetPayTransaction> {
    return new Promise((resolve, reject) => {
      if (!this.config || !window.CinetPay) {
        reject(new Error('CinetPay not initialized'));
        return;
      }

      // Convert metadata to JSON string if it's an object
      const paymentOptions = {
        ...options,
        metadata: options.metadata ? JSON.stringify(options.metadata) : ''
      };

      window.CinetPay.getCheckout({
        ...paymentOptions,
        onSuccess: (data: Record<string, unknown>) => {
          const transaction: CinetPayTransaction = {
            transaction_id: data.transaction_id as string,
            amount: data.amount as number,
            currency: data.currency as string,
            status: data.status as string,
            payment_method: data.payment_method as string,
            customer_info: {
              name: data.customer_name as string,
              email: data.customer_email as string,
              phone: data.customer_phone as string
            }
          };
          resolve(transaction);
        },
        onError: (error: Record<string, unknown>) => {
          reject(new Error(`Payment failed: ${error.message}`));
        }
      });
    });
  }

  private async loadConfigFromDatabase(userId: string): Promise<CinetPayConfig | null> {
    // Implement your database loading logic here
    // This should load from Firestore, MongoDB, PostgreSQL, etc.
    throw new Error('Implement database loading logic');
  }
}
```

## Frontend Implementation

### 1. Payment Handler Hook

Create `src/hooks/useCinetPay.ts`:

```typescript
import { useState, useEffect } from 'react';
import { CinetPayService } from '../services/cinetpayService';
import { CinetPayOptions, CinetPayTransaction } from '../types/cinetpay';
import { showSuccessToast, showErrorToast } from '../utils/toast';

export const useCinetPay = (userId: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [cinetpayService, setCinetpayService] = useState<CinetPayService | null>(null);

  useEffect(() => {
    const initializeCinetPay = async () => {
      try {
        const service = new CinetPayService();
        const config = await service.initializeConfig(userId);
        
        if (config) {
          setCinetpayService(service);
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Failed to initialize CinetPay:', error);
      }
    };

    if (userId) {
      initializeCinetPay();
    }
  }, [userId]);

  const processPayment = async (options: CinetPayOptions): Promise<CinetPayTransaction | null> => {
    if (!cinetpayService || !isInitialized) {
      showErrorToast('CinetPay not initialized');
      return null;
    }

    setIsLoading(true);
    
    try {
      const result = await cinetpayService.processPayment(options);
      showSuccessToast('Payment successful!');
      return result;
    } catch (error) {
      console.error('Payment error:', error);
      showErrorToast(`Payment failed: ${error.message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    processPayment,
    isLoading,
    isInitialized
  };
};
```

### 2. Payment Component

Create `src/components/PaymentButton.tsx`:

```typescript
import React from 'react';
import { useCinetPay } from '../hooks/useCinetPay';
import { CinetPayOptions } from '../types/cinetpay';
import Button from './common/Button';

interface PaymentButtonProps {
  userId: string;
  amount: number;
  description: string;
  customerInfo: {
    name: string;
    email: string;
    phone: string;
    address?: string;
    city?: string;
  };
  onSuccess: (transaction: any) => void;
  onError: (error: string) => void;
}

export const PaymentButton: React.FC<PaymentButtonProps> = ({
  userId,
  amount,
  description,
  customerInfo,
  onSuccess,
  onError
}) => {
  const { processPayment, isLoading, isInitialized } = useCinetPay(userId);

  const handlePayment = async () => {
    if (!isInitialized) {
      onError('CinetPay not configured');
      return;
    }

    const options: CinetPayOptions = {
      transaction_id: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: amount,
      currency: 'XAF',
      description: description,
      customer_name: customerInfo.name,
      customer_surname: customerInfo.name.split(' ')[0] || '',
      customer_email: customerInfo.email,
      customer_phone: customerInfo.phone,
      customer_address: customerInfo.address || '',
      customer_city: customerInfo.city || '',
      customer_country: 'CM',
      customer_state: '',
      customer_zip_code: '',
      metadata: JSON.stringify({
        orderId: `ORDER_${Date.now()}`,
        userId: userId
      })
    };

    const result = await processPayment(options);
    
    if (result) {
      onSuccess(result);
    } else {
      onError('Payment failed');
    }
  };

  return (
    <Button
      onClick={handlePayment}
      disabled={!isInitialized || isLoading}
      className="w-full"
    >
      {isLoading ? 'Processing...' : `Pay ${amount} XAF`}
    </Button>
  );
};
```

## Settings Configuration

### 1. Settings Page Component

Create `src/pages/Settings.tsx` (or add to existing settings):

```typescript
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CinetPayConfig } from '../types/cinetpayConfig';
import { SecureEncryption } from '../services/encryptionService';
import { showSuccessToast, showErrorToast } from '../utils/toast';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import { Trash2, TestTube } from 'lucide-react';

export const CinetPaySettings: React.FC = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState<Partial<CinetPayConfig>>({
    siteId: '',
    apiKey: '',
    currency: 'XAF',
    isActive: false,
    supportedMethods: ['MTN', 'Orange', 'Visa', 'Mastercard'],
    minAmount: 100,
    maxAmount: 1000000,
    environment: 'sandbox'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [user?.uid]);

  const loadConfig = async () => {
    if (!user?.uid) return;
    
    try {
      // Load from your database
      const savedConfig = await loadCinetPayConfig(user.uid);
      if (savedConfig) {
        setConfig(savedConfig);
      }
    } catch (error) {
      console.error('Failed to load CinetPay config:', error);
    }
  };

  const handleSave = async () => {
    if (!user?.uid) return;
    
    setIsLoading(true);
    
    try {
      const configToSave = {
        ...config,
        apiKey: SecureEncryption.encrypt(config.apiKey || ''),
        userId: user.uid,
        updatedAt: new Date()
      };
      
      await saveCinetPayConfig(configToSave);
      showSuccessToast('CinetPay configuration saved successfully');
    } catch (error) {
      console.error('Failed to save CinetPay config:', error);
      showErrorToast('Failed to save configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config.siteId || !config.apiKey) {
      showErrorToast('Please enter Site ID and API Key');
      return;
    }

    setIsTesting(true);
    
    try {
      // Test CinetPay connection
      const testResult = await testCinetPayConnection({
        siteId: config.siteId,
        apiKey: config.apiKey,
        environment: config.environment
      });
      
      if (testResult.success) {
        showSuccessToast('CinetPay connection successful!');
      } else {
        showErrorToast(`Connection failed: ${testResult.error}`);
      }
    } catch (error) {
      console.error('CinetPay test failed:', error);
      showErrorToast('Connection test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearCredentials = () => {
    if (window.confirm('Are you sure you want to clear all CinetPay credentials? This action cannot be undone.')) {
      setConfig({
        siteId: '',
        apiKey: '',
        currency: 'XAF',
        isActive: false,
        supportedMethods: ['MTN', 'Orange', 'Visa', 'Mastercard'],
        minAmount: 100,
        maxAmount: 1000000,
        environment: 'sandbox'
      });
      showSuccessToast('Credentials cleared');
    }
  };

  return (
    <Card title="CinetPay Configuration" className="mb-6">
      <div className="space-y-4">
        {/* Environment Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Environment
          </label>
          <select
            value={config.environment}
            onChange={(e) => setConfig(prev => ({ ...prev, environment: e.target.value as 'sandbox' | 'production' }))}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="sandbox">Sandbox (Testing)</option>
            <option value="production">Production</option>
          </select>
        </div>

        {/* Site ID */}
        <Input
          label="Site ID"
          value={config.siteId || ''}
          onChange={(e) => setConfig(prev => ({ ...prev, siteId: e.target.value }))}
          placeholder="Enter your CinetPay Site ID"
          required
        />

        {/* API Key */}
        <Input
          label="API Key"
          type="password"
          value={config.apiKey || ''}
          onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
          placeholder="Enter your CinetPay API Key"
          required
        />

        {/* Currency */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Currency
          </label>
          <select
            value={config.currency}
            onChange={(e) => setConfig(prev => ({ ...prev, currency: e.target.value as 'XAF' }))}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="XAF">XAF (Cameroon Franc)</option>
          </select>
        </div>

        {/* Supported Methods */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Supported Payment Methods
          </label>
          <div className="grid grid-cols-2 gap-2">
            {['MTN', 'Orange', 'Visa', 'Mastercard', 'Bank Transfer'].map(method => (
              <label key={method} className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.supportedMethods?.includes(method) || false}
                  onChange={(e) => {
                    const methods = config.supportedMethods || [];
                    if (e.target.checked) {
                      setConfig(prev => ({ ...prev, supportedMethods: [...methods, method] }));
                    } else {
                      setConfig(prev => ({ ...prev, supportedMethods: methods.filter(m => m !== method) }));
                    }
                  }}
                  className="mr-2"
                />
                {method}
              </label>
            ))}
          </div>
        </div>

        {/* Amount Limits */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Minimum Amount (XAF)"
            type="number"
            value={config.minAmount || ''}
            onChange={(e) => setConfig(prev => ({ ...prev, minAmount: parseInt(e.target.value) }))}
            placeholder="100"
          />
          <Input
            label="Maximum Amount (XAF)"
            type="number"
            value={config.maxAmount || ''}
            onChange={(e) => setConfig(prev => ({ ...prev, maxAmount: parseInt(e.target.value) }))}
            placeholder="1000000"
          />
        </div>

        {/* Active Toggle */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="isActive"
            checked={config.isActive || false}
            onChange={(e) => setConfig(prev => ({ ...prev, isActive: e.target.checked }))}
            className="mr-2"
          />
          <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
            Enable CinetPay payments
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? 'Saving...' : 'Save Configuration'}
          </Button>
          
          <Button
            onClick={handleTestConnection}
            disabled={isTesting || !config.siteId || !config.apiKey}
            variant="outline"
            className="flex items-center"
          >
            <TestTube size={16} className="mr-2" />
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>
          
          <Button
            onClick={handleClearCredentials}
            variant="outline"
            className="flex items-center text-red-600 hover:text-red-800"
          >
            <Trash2 size={16} className="mr-2" />
            Clear Credentials
          </Button>
        </div>
      </div>
    </Card>
  );
};

// Helper functions (implement these based on your database)
async function loadCinetPayConfig(userId: string): Promise<CinetPayConfig | null> {
  // Implement your database loading logic
  throw new Error('Implement database loading');
}

async function saveCinetPayConfig(config: CinetPayConfig): Promise<void> {
  // Implement your database saving logic
  throw new Error('Implement database saving');
}

async function testCinetPayConnection(config: any): Promise<{ success: boolean; error?: string }> {
  // Implement CinetPay connection test
  throw new Error('Implement connection test');
}
```

## Security Implementation

### 1. Audit Logging

Create `src/services/auditLogger.ts`:

```typescript
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details: Record<string, unknown>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditLogger {
  static async log(action: string, resource: string, details: Record<string, unknown>, userId: string): Promise<void> {
    const log: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      action,
      resource,
      details,
      timestamp: new Date(),
      ipAddress: this.getClientIP(),
      userAgent: navigator.userAgent
    };

    // Save to your database
    await this.saveAuditLog(log);
  }

  private static getClientIP(): string {
    // Implement IP detection logic
    return 'unknown';
  }

  private static async saveAuditLog(log: AuditLog): Promise<void> {
    // Implement database saving
    console.log('Audit log:', log);
  }
}
```

### 2. Webhook Verification

Create `src/services/webhookService.ts`:

```typescript
import crypto from 'crypto';

export class WebhookService {
  static verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  static async handleCinetPayWebhook(payload: any, signature: string): Promise<void> {
    // Verify webhook signature
    const isValid = this.verifySignature(JSON.stringify(payload), signature, process.env.CINETPAY_WEBHOOK_SECRET!);
    
    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    // Process webhook payload
    await this.processWebhookPayload(payload);
  }

  private static async processWebhookPayload(payload: any): Promise<void> {
    // Implement webhook processing logic
    console.log('Processing webhook:', payload);
  }
}
```

## Error Handling

### 1. Error Types

Create `src/types/errors.ts`:

```typescript
export enum CinetPayErrorCode {
  INVALID_CONFIG = 'INVALID_CONFIG',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  CUSTOMER_REQUIRED = 'CUSTOMER_REQUIRED',
  SDK_NOT_LOADED = 'SDK_NOT_LOADED'
}

export class CinetPayError extends Error {
  constructor(
    public code: CinetPayErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CinetPayError';
  }
}
```

### 2. Error Handler

Create `src/utils/errorHandler.ts`:

```typescript
import { CinetPayError, CinetPayErrorCode } from '../types/errors';
import { showErrorToast } from './toast';

export class ErrorHandler {
  static handleCinetPayError(error: any): void {
    let errorMessage = 'An unexpected error occurred';
    
    if (error instanceof CinetPayError) {
      switch (error.code) {
        case CinetPayErrorCode.INVALID_CONFIG:
          errorMessage = 'CinetPay configuration is invalid. Please check your settings.';
          break;
        case CinetPayErrorCode.PAYMENT_FAILED:
          errorMessage = 'Payment failed. Please try again.';
          break;
        case CinetPayErrorCode.NETWORK_ERROR:
          errorMessage = 'Network error. Please check your connection.';
          break;
        case CinetPayErrorCode.INVALID_AMOUNT:
          errorMessage = 'Invalid payment amount.';
          break;
        case CinetPayErrorCode.CUSTOMER_REQUIRED:
          errorMessage = 'Customer information is required.';
          break;
        case CinetPayErrorCode.SDK_NOT_LOADED:
          errorMessage = 'CinetPay SDK not loaded. Please refresh the page.';
          break;
        default:
          errorMessage = error.message;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    console.error('CinetPay Error:', error);
    showErrorToast(errorMessage);
  }
}
```

## Testing

### 1. Sandbox Testing

```typescript
// Test configuration
const testConfig = {
  siteId: 'your_sandbox_site_id',
  apiKey: 'your_sandbox_api_key',
  environment: 'sandbox'
};

// Test payment
const testPayment = {
  amount: 100, // 100 XAF
  currency: 'XAF',
  description: 'Test Payment',
  customer_name: 'Test User',
  customer_email: 'test@example.com',
  customer_phone: '+237690160047'
};
```

### 2. Test Cases

```typescript
describe('CinetPay Integration', () => {
  test('should initialize CinetPay SDK', async () => {
    const service = new CinetPayService();
    const config = await service.initializeConfig('test-user-id');
    expect(config).toBeDefined();
  });

  test('should process payment successfully', async () => {
    const service = new CinetPayService();
    await service.initializeConfig('test-user-id');
    
    const result = await service.processPayment({
      transaction_id: 'test-txn-123',
      amount: 100,
      currency: 'XAF',
      description: 'Test Payment',
      customer_name: 'Test User',
      customer_surname: 'User',
      customer_email: 'test@example.com',
      customer_phone: '+237690160047',
      customer_address: 'Test Address',
      customer_city: 'Douala',
      customer_country: 'CM',
      customer_state: '',
      customer_zip_code: '',
      metadata: JSON.stringify({ test: true })
    });
    
    expect(result).toBeDefined();
    expect(result.transaction_id).toBe('test-txn-123');
  });
});
```

## Production Deployment

### 1. Environment Setup

```env
# Production environment variables
VITE_CINETPAY_ENVIRONMENT=production
VITE_CINETPAY_SITE_ID=your_production_site_id
VITE_CINETPAY_API_KEY=your_production_api_key
VITE_ENCRYPTION_KEY=your_production_encryption_key
CINETPAY_WEBHOOK_SECRET=your_webhook_secret
```

### 2. Security Checklist

- [ ] HTTPS enabled
- [ ] API keys encrypted
- [ ] Webhook signature verification
- [ ] Audit logging enabled
- [ ] Error handling implemented
- [ ] Input validation
- [ ] Rate limiting
- [ ] CORS configured

### 3. Monitoring

```typescript
// Add monitoring to your payment processing
const monitorPayment = async (paymentData: any) => {
  try {
    // Track payment attempt
    await analytics.track('payment_attempted', {
      amount: paymentData.amount,
      currency: paymentData.currency,
      userId: paymentData.userId
    });
    
    const result = await processPayment(paymentData);
    
    // Track successful payment
    await analytics.track('payment_successful', {
      transactionId: result.transaction_id,
      amount: result.amount
    });
    
    return result;
  } catch (error) {
    // Track failed payment
    await analytics.track('payment_failed', {
      error: error.message,
      amount: paymentData.amount
    });
    
    throw error;
  }
};
```

## Troubleshooting

### Common Issues

1. **SDK Not Loading**
   - Check if CinetPay script is loaded in HTML
   - Verify network connectivity
   - Check browser console for errors

2. **Payment Failures**
   - Verify Site ID and API Key
   - Check amount limits
   - Validate customer information
   - Check CinetPay dashboard for transaction logs

3. **Webhook Issues**
   - Verify webhook URL is accessible
   - Check signature verification
   - Monitor webhook delivery in CinetPay dashboard

4. **iOS Safari Issues**
   - Implement fallback for popup blockers
   - Use redirect-based flow as fallback
   - Test on actual iOS devices

### Debug Mode

```typescript
// Enable debug logging
const DEBUG_CINETPAY = process.env.NODE_ENV === 'development';

if (DEBUG_CINETPAY) {
  console.log('CinetPay Debug:', {
    config: this.config,
    sdkLoaded: !!window.CinetPay,
    environment: this.config?.environment
  });
}
```

## Additional Considerations

### 1. Multi-language Support

```typescript
// Language configuration
const getCinetPayLanguage = (userLanguage: string): string => {
  const supportedLanguages = ['fr', 'en'];
  return supportedLanguages.includes(userLanguage) ? userLanguage : 'fr';
};
```

### 2. Currency Handling

```typescript
// Currency validation
const validateAmount = (amount: number, currency: string): boolean => {
  if (currency === 'XAF') {
    return amount >= 100 && amount <= 1000000; // 100 XAF to 1M XAF
  }
  return false;
};
```

### 3. Mobile Optimization

```typescript
// Mobile-specific handling
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (isMobile) {
  // Use mobile-optimized payment flow
  window.CinetPay.open();
} else {
  // Use desktop payment flow
  window.CinetPay.getCheckout(options);
}
```

This comprehensive guide covers all aspects of CinetPay integration. The AI working on your other project should follow this guide step by step, implementing each section according to their specific project requirements and technology stack.
