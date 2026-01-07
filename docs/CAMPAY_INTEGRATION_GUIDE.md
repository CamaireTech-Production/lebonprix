# Campay Payment Integration Guide

This document provides a comprehensive guide on how Campay payment integration was implemented in this application. Use this guide to integrate Campay payments into any other application.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Setup and Configuration](#setup-and-configuration)
5. [Implementation Details](#implementation-details)
6. [Payment Flow](#payment-flow)
7. [Error Handling](#error-handling)
8. [Security Considerations](#security-considerations)
9. [Code Examples](#code-examples)
10. [Troubleshooting](#troubleshooting)

---

## Overview

Campay is a mobile money payment gateway that allows customers to pay using MTN Mobile Money, Orange Money, and other mobile money services. This integration uses Campay's JavaScript SDK to process payments directly in the browser.

### Key Features

- **SDK-based Integration**: Uses Campay's JavaScript SDK loaded dynamically
- **Environment Support**: Supports both Demo and Production environments
- **Secure Storage**: App ID is encrypted before storage
- **Audit Logging**: All payment events are logged for tracking
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Amount Validation**: Supports minimum and maximum amount limits

---

## Architecture

The integration consists of the following components:

### 1. **CampayService** (`src/services/campayService.ts`)
   - Core service class that handles SDK loading and payment processing
   - Manages script loading, initialization, and payment execution
   - Handles environment-specific configurations (demo/production)

### 2. **useCampay Hook** (`src/hooks/useCampay.ts`)
   - React hook that wraps CampayService for React components
   - Manages initialization state and loading states
   - Provides a clean API for components to process payments

### 3. **CampaySettings Component** (`src/components/settings/CampaySettings.tsx`)
   - Admin UI for configuring Campay credentials
   - Handles App ID encryption and storage
   - Provides connection testing functionality

### 4. **Type Definitions** (`src/types/campay.ts`)
   - TypeScript interfaces for Campay options, responses, and transactions

### 5. **Audit Logger** (`src/services/campayAuditLogger.ts`)
   - Logs all payment-related events for audit purposes

---

## Prerequisites

1. **Campay Account**: You need a Campay merchant account
2. **App ID**: Obtain your Campay App ID from the Campay dashboard
3. **Dependencies**:
   - `crypto-js`: For encrypting sensitive data
   - `react-hot-toast`: For user notifications (optional)
   - React 16.8+ (for hooks)

---

## Setup and Configuration

### Step 1: Install Dependencies

```bash
npm install crypto-js
# or
yarn add crypto-js
```

### Step 2: Environment Variables

Set up an encryption key for securing the App ID:

```env
VITE_ENCRYPTION_KEY=your-secure-encryption-key-here
```

**Important**: Use a strong, unique encryption key in production. Never commit this key to version control.

### Step 3: Database Schema

Add the Campay configuration to your restaurant/user entity:

```typescript
interface Restaurant {
  // ... other fields
  campayConfig?: {
    appId: string;              // Encrypted App ID
    isActive: boolean;           // Enable/disable Campay
    environment: 'demo' | 'production';
    supportedMethods: string[];  // e.g., ['MTN', 'Orange']
    minAmount: number;           // Minimum payment amount
    maxAmount: number;           // Maximum payment amount
  };
}
```

### Step 4: Content Security Policy

Update your CSP headers to allow Campay scripts:

```
Content-Security-Policy: script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.campay.net; connect-src 'self' https://*.campay.net; frame-src 'self' https://*.campay.net;
```

---

## Implementation Details

### 1. Encryption Service

The App ID is encrypted before storage using AES encryption:

```typescript
// src/services/encryptionService.ts
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.VITE_ENCRYPTION_KEY || 'default-key';

export class EncryptionService {
  static encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
  }

  static decrypt(encryptedText: string): string {
    const decrypted = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
    return decrypted.toString(CryptoJS.enc.Utf8);
  }
}
```

### 2. CampayService Implementation

#### Script Loading

The service dynamically loads the Campay SDK based on the environment:

```typescript
private getScriptUrl(): string {
  const baseUrl = this.environment === 'demo' 
    ? 'https://demo.campay.net/sdk/js'
    : 'https://www.campay.net/sdk/js';
  
  return `${baseUrl}?app-id=${encodeURIComponent(this.appId)}`;
}
```

#### Initialization Flow

1. Fetch restaurant configuration from database
2. Decrypt the App ID
3. Load the Campay SDK script dynamically
4. Wait for `window.campay` to be available
5. Return initialization status

#### Payment Processing

The payment process follows these steps:

1. **Validate Options**: Check that all required fields are present
2. **Set Up Callbacks**: Configure `onSuccess`, `onFail`, and `onModalClose` handlers
3. **Configure SDK**: Call `window.campay.options()` with payment details
4. **Trigger Payment**: Click the hidden button to open the payment modal
5. **Handle Response**: Process the response in the appropriate callback

**Critical Note**: Campay SDK expects the `amount` as a **STRING**, not a number. This is a common source of errors.

```typescript
const campayOptions: CampayOptions = {
  payButtonId: options.payButtonId,
  description: options.description || 'Order payment',
  amount: String(paymentAmount), // Convert to STRING - critical!
  currency: options.currency || 'XAF',
  externalReference: options.externalReference,
  redirectUrl: options.redirectUrl
};

window.campay.options(campayOptions);
```

### 3. React Hook Implementation

The `useCampay` hook provides a React-friendly interface:

```typescript
export const useCampay = (restaurantId: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const campayService = useState(() => new CampayService())[0];
  const hiddenButtonIdRef = useRef<string>(`campay-pay-button-${Date.now()}`);

  // Initialize on mount
  useEffect(() => {
    const initializeCampay = async () => {
      const config = await campayService.initializeConfig(restaurantId);
      setIsInitialized(!!config);
      if (config) {
        ensureHiddenButton();
      }
    };
    
    if (restaurantId) {
      initializeCampay();
    }
  }, [restaurantId]);

  // Create hidden button for SDK
  const ensureHiddenButton = () => {
    const buttonId = hiddenButtonIdRef.current;
    let button = document.getElementById(buttonId);
    
    if (!button) {
      button = document.createElement('button');
      button.id = buttonId;
      button.style.display = 'none';
      button.setAttribute('type', 'button');
      document.body.appendChild(button);
    }
  };

  const processPayment = async (
    options: CampayOptions,
    onSuccessCallback?: (data: CampayResponse) => void,
    onFailCallback?: (data: CampayResponse) => void,
    onModalCloseCallback?: (data: CampayResponse) => void
  ): Promise<CampayTransaction | null> => {
    // Implementation...
  };

  return {
    processPayment,
    isLoading,
    isInitialized,
    hiddenButtonId: hiddenButtonIdRef.current
  };
};
```

### 4. Hidden Button Pattern

Campay SDK requires a button element to trigger payments. The integration uses a hidden button that is programmatically clicked:

```typescript
// Create hidden button
const button = document.createElement('button');
button.id = 'campay-pay-button-1234567890';
button.style.display = 'none';
button.setAttribute('type', 'button');
document.body.appendChild(button);

// Set payment options
window.campay.options({
  payButtonId: button.id,
  amount: "1000",
  currency: "XAF",
  description: "Order payment"
});

// Trigger payment
button.click();
```

---

## Payment Flow

### Complete Payment Flow Diagram

```
1. User clicks "Pay with Campay"
   ↓
2. Validate customer information
   ↓
3. Check if Campay is configured and active
   ↓
4. Validate amount (min/max limits, demo limits)
   ↓
5. Generate external reference (order ID)
   ↓
6. Call processPayment() from useCampay hook
   ↓
7. CampayService.processPayment()
   ├─ Validate options
   ├─ Set up callbacks (onSuccess, onFail, onModalClose)
   ├─ Call window.campay.options()
   └─ Trigger payment (click hidden button)
   ↓
8. Campay SDK opens payment modal
   ↓
9. User completes payment in modal
   ↓
10. SDK calls callback:
    ├─ onSuccess → Create order, send notification
    ├─ onFail → Show error message
    └─ onModalClose → User cancelled
```

### Example: Processing a Payment

```typescript
const { processPayment, isInitialized } = useCampay(restaurantId);

const handleCampayOrder = async () => {
  // 1. Validate inputs
  if (!customerName.trim() || !customerPhone || !customerLocation) {
    toast.error('Please fill in all required fields');
    return;
  }

  // 2. Check if Campay is available
  if (!isInitialized) {
    toast.error('Campay payment is not available');
    return;
  }

  // 3. Prepare payment options
  const paymentOptions = {
    payButtonId: hiddenButtonId,
    description: `Order from ${restaurant.name}`,
    amount: grandTotal,
    currency: 'XAF',
    externalReference: `ORDER_${Date.now()}`
  };

  // 4. Process payment
  const result = await processPayment(
    paymentOptions,
    // onSuccess callback
    async (data) => {
      // Create order
      const order = await createOrder({
        items: cart,
        totalAmount: grandTotal,
        paymentMethod: 'campay',
        paymentStatus: 'completed',
        campayReference: data.reference,
        campayMetadata: {
          reference: data.reference,
          transactionId: data.transactionId,
          paymentMethod: data.paymentMethod,
          timestamp: new Date().toISOString()
        }
      });

      toast.success('Payment successful! Order created.');
    },
    // onFail callback
    (data) => {
      toast.error(data.message || 'Payment failed');
    },
    // onModalClose callback
    () => {
      // User cancelled - no action needed
    }
  );
};
```

---

## Error Handling

### Common Errors and Solutions

#### 1. **Demo Environment Amount Limit**

Campay's demo environment has a maximum limit of 10 XAF. If the order exceeds this:

```typescript
const DEMO_MAX_AMOUNT = 10;

if (isDemo && paymentAmount > DEMO_MAX_AMOUNT) {
  toast.error(
    `Demo environment limit: Maximum amount is ${DEMO_MAX_AMOUNT} XAF. ` +
    `Your order total is ${grandTotal} XAF. ` +
    `Please use production environment for larger amounts.`
  );
  return;
}
```

#### 2. **SDK Not Loaded**

If the SDK fails to load:

```typescript
if (!this.scriptLoaded || !window.campay) {
  reject(new Error('Campay SDK not loaded. Please refresh the page and try again.'));
  return;
}
```

**Solution**: Check network connectivity, verify App ID, and ensure CSP headers allow Campay scripts.

#### 3. **Network Errors**

Always check network connectivity before processing payments:

```typescript
if (!navigator.onLine) {
  toast.error('No internet connection. Please check your network and try again.');
  return;
}
```

#### 4. **Invalid Amount**

Campay requires amounts to be positive numbers:

```typescript
const amountValue = typeof options.amount === 'string' 
  ? Number(options.amount) 
  : options.amount;

if (!amountValue || amountValue <= 0) {
  reject(new Error('Invalid payment amount'));
  return;
}
```

### Error Callback Handling

```typescript
window.campay.onFail = (data: CampayResponse) => {
  // Check for specific error types
  const errorMessage = data.message || '';
  
  if (this.environment === 'demo' && 
      (errorMessage.includes('Maximum amount') || errorMessage.includes('ER201'))) {
    // Demo limit exceeded
    reject(new Error('Demo environment limit exceeded'));
  } else {
    // Generic payment failure
    reject(new Error(data.message || 'Payment failed'));
  }
};
```

---

## Security Considerations

### 1. **App ID Encryption**

The App ID is encrypted before storage using AES encryption:

```typescript
// When saving
const encryptedAppId = EncryptionService.encrypt(appId);
await saveToDatabase({ campayConfig: { appId: encryptedAppId } });

// When using
const decryptedAppId = EncryptionService.decrypt(restaurant.campayConfig.appId);
```

### 2. **Environment Variables**

Never hardcode sensitive keys. Always use environment variables:

```typescript
const ENCRYPTION_KEY = process.env.VITE_ENCRYPTION_KEY || 
  (() => { throw new Error('ENCRYPTION_KEY not set'); })();
```

### 3. **Content Security Policy**

Implement strict CSP headers to prevent XSS attacks:

```
Content-Security-Policy: 
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.campay.net;
  connect-src 'self' https://*.campay.net;
  frame-src 'self' https://*.campay.net;
```

### 4. **Input Validation**

Always validate payment amounts and user inputs:

```typescript
// Validate amount limits
if (amount < minAmount || amount > maxAmount) {
  throw new Error('Amount out of allowed range');
}

// Validate currency
if (!['XAF', 'XOF'].includes(currency)) {
  throw new Error('Unsupported currency');
}
```

### 5. **Audit Logging**

Log all payment events for security and compliance:

```typescript
CampayAuditLogger.log({
  userId: restaurantId,
  action: 'campay_payment_initiated',
  details: {
    restaurantId,
    reference: externalReference,
    amount: paymentAmount,
    environment: 'demo' | 'production'
  }
});
```

---

## Code Examples

### Example 1: Basic Payment Integration

```typescript
import { useCampay } from './hooks/useCampay';

function CheckoutComponent() {
  const restaurantId = 'restaurant-123';
  const { processPayment, isInitialized, isLoading } = useCampay(restaurantId);

  const handlePayment = async () => {
    if (!isInitialized) {
      alert('Payment system not ready');
      return;
    }

    const result = await processPayment(
      {
        payButtonId: 'campay-button',
        description: 'Order #12345',
        amount: 5000,
        currency: 'XAF',
        externalReference: 'ORDER-12345'
      },
      (data) => {
        console.log('Payment successful:', data);
        // Handle success
      },
      (data) => {
        console.error('Payment failed:', data);
        // Handle failure
      }
    );
  };

  return (
    <button onClick={handlePayment} disabled={!isInitialized || isLoading}>
      Pay with Campay
    </button>
  );
}
```

### Example 2: Configuration Component

```typescript
import { useState } from 'react';
import { EncryptionService } from './services/encryptionService';
import { CampayService } from './services/campayService';

function CampayConfig() {
  const [appId, setAppId] = useState('');
  const [environment, setEnvironment] = useState<'demo' | 'production'>('demo');
  const [isActive, setIsActive] = useState(false);

  const handleSave = async () => {
    // Encrypt App ID
    const encryptedAppId = EncryptionService.encrypt(appId);
    
    // Save to database
    await saveConfig({
      campayConfig: {
        appId: encryptedAppId,
        environment,
        isActive
      }
    });
  };

  const handleTest = async () => {
    const service = new CampayService();
    const result = await service.testConnection(appId, environment);
    if (result) {
      alert('Connection test successful!');
    } else {
      alert('Connection test failed');
    }
  };

  return (
    <div>
      <input
        type="text"
        value={appId}
        onChange={(e) => setAppId(e.target.value)}
        placeholder="Enter Campay App ID"
      />
      <select
        value={environment}
        onChange={(e) => setEnvironment(e.target.value as 'demo' | 'production')}
      >
        <option value="demo">Demo</option>
        <option value="production">Production</option>
      </select>
      <button onClick={handleSave}>Save</button>
      <button onClick={handleTest}>Test Connection</button>
    </div>
  );
}
```

### Example 3: Order Creation After Payment

```typescript
const handleCampayOrder = async () => {
  const paymentOptions = {
    payButtonId: hiddenButtonId,
    description: `Order from ${restaurant.name}`,
    amount: grandTotal,
    currency: 'XAF',
    externalReference: `ORDER_${Date.now()}`
  };

  await processPayment(
    paymentOptions,
    // onSuccess
    async (data) => {
      // Create order with payment details
      const order = {
        items: cartItems,
        totalAmount: grandTotal,
        customerName,
        customerPhone,
        paymentMethod: 'campay',
        paymentStatus: 'completed',
        campayReference: data.reference,
        campayStatus: 'completed',
        campayMetadata: {
          reference: data.reference,
          transactionId: data.transactionId,
          paymentMethod: data.paymentMethod || 'mobile_money',
          timestamp: new Date().toISOString()
        }
      };

      const orderId = await createOrder(order);
      
      // Send notification
      await sendNotification({
        orderId,
        customerPhone,
        message: `Your order #${orderId} has been confirmed. Payment reference: ${data.reference}`
      });

      // Clear cart
      clearCart();
    },
    // onFail
    (data) => {
      console.error('Payment failed:', data);
      toast.error(data.message || 'Payment failed. Please try again.');
    }
  );
};
```

---

## Testing

### Manual Testing

See the [Testing Guide](./CAMPAY_TESTING_GUIDE.md) for comprehensive testing procedures including:
- Configuration testing
- Payment flow testing
- Error scenario testing
- Integration testing

### Testing Checklist

- [ ] Configuration setup and validation
- [ ] Demo environment payments (≤ 10 XAF)
- [ ] Production environment payments
- [ ] Payment cancellation handling
- [ ] Amount validation (min/max limits)
- [ ] Network error handling
- [ ] SDK loading and initialization
- [ ] Order creation and storage
- [ ] Error message display

## Troubleshooting

See the [Troubleshooting Guide](./CAMPAY_TROUBLESHOOTING.md) for common issues and solutions.

### Quick Reference

**Common Issues:**
1. **Campay payment option not appearing** - Check if Campay is configured and active
2. **SDK not loading** - Check network connectivity and disable ad blockers
3. **Demo limit error** - Reduce amount to ≤ 10 XAF or switch to Production
4. **Order not created** - Check Firestore permissions and browser console

### Issue 1: SDK Not Loading

**Symptoms**: `window.campay` is undefined after script loads

**Solutions**:
1. Check browser console for script loading errors
2. Verify CSP headers allow Campay scripts
3. Check network connectivity
4. Verify App ID is correct
5. Wait longer for SDK initialization (increase timeout)

```typescript
// Increase timeout in loadScript()
const maxAttempts = 100; // Increase from 50
```

### Issue 2: Payment Modal Not Opening

**Symptoms**: Button click doesn't open payment modal

**Solutions**:
1. Ensure `window.campay.options()` is called before clicking button
2. Verify button ID matches the `payButtonId` in options
3. Check that button exists in DOM
4. Ensure amount is passed as STRING, not number

```typescript
// Correct
amount: String(1000)

// Incorrect
amount: 1000
```

### Issue 3: Callbacks Not Firing

**Symptoms**: Payment completes but callbacks don't execute

**Solutions**:
1. Ensure callbacks are set before calling `window.campay.options()`
2. Check browser console for JavaScript errors
3. Verify callback functions are not being overwritten
4. Check that payment actually completed (not cancelled)

### Issue 4: Demo Environment Errors

**Symptoms**: "Maximum amount" error in demo mode

**Solutions**:
1. Demo environment has a 10 XAF limit
2. Either reduce order amount or switch to production
3. Show user-friendly error message

```typescript
if (environment === 'demo' && amount > 10) {
  toast.error('Demo limit: Maximum 10 XAF. Switch to production for larger amounts.');
}
```

### Issue 5: Encryption/Decryption Errors

**Symptoms**: App ID decryption fails

**Solutions**:
1. Verify `VITE_ENCRYPTION_KEY` is set correctly
2. Ensure same key is used for encryption and decryption
3. Check for migration issues (old unencrypted data)

```typescript
// Add migration support
static decrypt(encryptedText: string): string {
  // Check if already plain text
  if (!encryptedText.includes('U2FsdGVkX1')) {
    return encryptedText; // Legacy unencrypted data
  }
  // Decrypt normally
  return CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY)
    .toString(CryptoJS.enc.Utf8);
}
```

---

## Type Definitions

### CampayOptions

```typescript
interface CampayOptions {
  payButtonId: string;        // Required - ID of button element
  description: string;         // Required - Payment description
  amount: string | number;     // Required - Amount (converted to string)
  currency: string;            // Required - Currency code (e.g., 'XAF')
  externalReference?: string;  // Optional - Your order ID
  redirectUrl?: string;        // Optional - Redirect after payment
}
```

### CampayResponse

```typescript
interface CampayResponse {
  status: string;              // Payment status
  reference: string;           // Campay transaction reference
  amount?: number;             // Payment amount
  currency?: string;           // Currency code
  transactionId?: string;      // Transaction ID
  paymentMethod?: string;     // Payment method used
  message?: string;            // Error message (if failed)
}
```

### CampayTransaction

```typescript
interface CampayTransaction {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  transactionId?: string;
  paymentMethod?: string;
  timestamp: string;
}
```

---

## Best Practices

1. **Always validate amounts** before processing payments
2. **Use environment variables** for sensitive configuration
3. **Encrypt sensitive data** before storage
4. **Implement audit logging** for all payment events
5. **Handle all three callbacks** (onSuccess, onFail, onModalClose)
6. **Check network connectivity** before initiating payments
7. **Provide user-friendly error messages**
8. **Test in demo environment** before going to production
9. **Monitor payment logs** for issues
10. **Keep SDK script loading logic robust** with proper error handling

---

## Additional Resources

- [Campay Official Documentation](https://campay.net/documentation)
- [Campay Dashboard](https://dashboard.campay.net)
- [Campay Support](https://campay.net/support)

---

## Summary

This integration provides a complete, production-ready Campay payment solution with:

- ✅ Secure credential storage (encryption)
- ✅ Environment support (demo/production)
- ✅ Comprehensive error handling
- ✅ Audit logging
- ✅ React hooks for easy component integration
- ✅ TypeScript type safety
- ✅ User-friendly error messages
- ✅ Network connectivity checks
- ✅ Amount validation

Follow this guide step-by-step to integrate Campay payments into any application.

