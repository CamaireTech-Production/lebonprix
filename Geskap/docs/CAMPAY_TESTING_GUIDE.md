# Campay Payment Integration - Testing Guide

This document provides comprehensive testing procedures for the Campay payment integration, including manual testing, integration testing, and troubleshooting.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Manual Testing](#manual-testing)
3. [Integration Testing](#integration-testing)
4. [Error Scenario Testing](#error-scenario-testing)
5. [Test Checklist](#test-checklist)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before testing, ensure you have:

- ✅ Campay account with App ID credentials
- ✅ Access to both Demo and Production environments
- ✅ Test mobile money accounts (MTN and Orange Money)
- ✅ Admin access to the application
- ✅ Browser developer tools access
- ✅ Firestore database access

---

## Manual Testing

### 1. Configuration Testing

#### Test 1.1: Initial Configuration Setup

**Steps:**
1. Navigate to Settings → Payment Integration → Campay section
2. Verify Campay section is visible
3. Check that default values are loaded:
   - Environment: Demo
   - Currency: XAF
   - Min Amount: 1 XAF
   - Max Amount: 1000000 XAF
   - Is Active: false

**Expected Results:**
- ✅ Campay configuration section displays
- ✅ Default values are pre-filled
- ✅ All fields are editable
- ✅ Save button is enabled

**Console Logs:**
```javascript
// Should see initialization logs
console.log('Initializing Campay config for company:', companyId)
```

---

#### Test 1.2: App ID Configuration

**Steps:**
1. Enter a valid Campay App ID (at least 10 characters)
2. Click "Save Configuration"
3. Verify App ID is encrypted and stored

**Expected Results:**
- ✅ Success toast: "Campay configuration saved successfully"
- ✅ App ID field shows masked value (first 4 chars + "...")
- ✅ Configuration persists after page refresh

**Database Verification:**
```javascript
// Firestore path: campay_configs/{companyId}
{
  appId: "[encrypted string]", // Should be encrypted
  isActive: false,
  environment: "demo",
  // ... other fields
}
```

**Error Cases to Test:**
- ❌ Empty App ID → Error: "App ID is required"
- ❌ App ID < 10 characters → Error: "App ID must be at least 10 characters long"
- ❌ Invalid characters → Error: "App ID contains invalid characters"

---

#### Test 1.3: Environment Selection

**Steps:**
1. Select "Demo" environment
2. Save configuration
3. Switch to "Production" environment
4. Save configuration

**Expected Results:**
- ✅ Environment selection works for both options
- ✅ Configuration saves correctly for each environment
- ✅ SDK URL changes based on environment:
  - Demo: `https://demo.campay.net/sdk/js`
  - Production: `https://www.campay.net/sdk/js`

**Console Logs:**
```javascript
// Demo environment
console.log('Loading Campay SDK from:', 'https://demo.campay.net/sdk/js?app-id=...')

// Production environment
console.log('Loading Campay SDK from:', 'https://www.campay.net/sdk/js?app-id=...')
```

---

#### Test 1.4: Amount Limits Configuration

**Steps:**
1. Set Minimum Amount: 100 XAF
2. Set Maximum Amount: 50000 XAF
3. Save configuration
4. Verify limits are saved

**Expected Results:**
- ✅ Min/Max amounts save correctly
- ✅ Validation prevents min > max
- ✅ Values persist after refresh

**Error Cases:**
- ❌ Min Amount < 0 → Error: "Minimum amount cannot be negative"
- ❌ Max Amount <= 0 → Error: "Maximum amount must be greater than 0"
- ❌ Min Amount > Max Amount → Error: "Minimum amount cannot be greater than maximum amount"

---

#### Test 1.5: Test Connection

**Steps:**
1. Enter valid App ID
2. Select environment (Demo or Production)
3. Click "Test Connection"
4. Wait for result

**Expected Results:**
- ✅ Loading state shows during test
- ✅ Success: "Connection test successful" (if credentials valid)
- ✅ Error: "Connection test failed" (if credentials invalid)

**Console Logs:**
```javascript
// Testing connection
console.log('Testing Campay connection...')
console.log('App ID:', appId.substring(0, 4) + '...')
console.log('Environment:', environment)
```

---

### 2. Payment Flow Testing

#### Test 2.1: Checkout - Campay Payment Option Display

**Steps:**
1. Add items to cart
2. Navigate to checkout page
3. Check payment options section

**Expected Results:**
- ✅ Campay payment option appears (if configured and active)
- ✅ Shows "Campay" label with "MTN • Orange Money" subtitle
- ✅ Radio button is selectable
- ✅ Payment option is hidden if Campay is not configured or inactive

**UI Elements:**
- Green "CP" icon
- "Campay" text
- "MTN • Orange Money" subtitle
- Info box with payment description

---

#### Test 2.2: Demo Environment Payment (Amount ≤ 10 XAF)

**Prerequisites:**
- Campay configured with Demo environment
- Cart total ≤ 10 XAF

**Steps:**
1. Select Campay payment option
2. Fill customer information
3. Click "Place Order"
4. Complete payment in Campay modal

**Expected Results:**
- ✅ Payment modal opens
- ✅ Payment processes successfully
- ✅ Success toast: "Payment successful! Order created."
- ✅ Order created with payment status: "paid"
- ✅ Order status: "confirmed"
- ✅ Cart cleared

**Console Logs:**
```javascript
// Payment initiation
console.log('Campay payment initiated:', {
  amount: 10,
  currency: 'XAF',
  description: 'Order from [Company Name]'
})

// Payment success
console.log('Campay payment successful:', {
  reference: '...',
  transactionId: '...',
  status: 'SUCCESS'
})
```

**Database Verification:**
```javascript
// Order document
{
  paymentMethod: 'campay',
  paymentStatus: 'paid',
  status: 'confirmed',
  campayPaymentDetails: {
    reference: '...',
    transactionId: '...',
    campayStatus: 'SUCCESS',
    status: 'SUCCESS',
    paidAt: Timestamp,
    paymentMethod: 'mobile_money',
    amount: 10,
    currency: 'XAF',
    metadata: {
      externalReference: 'ORDER_...',
      environment: 'demo',
      timestamp: '...'
    }
  }
}
```

---

#### Test 2.3: Demo Environment Payment (Amount > 10 XAF)

**Prerequisites:**
- Campay configured with Demo environment
- Cart total > 10 XAF

**Steps:**
1. Select Campay payment option
2. Fill customer information
3. Click "Place Order"

**Expected Results:**
- ❌ Error toast: "Demo environment limit: Maximum amount is 10 XAF. Your order total is [amount] XAF. Please use production environment for larger amounts."
- ✅ Order is NOT created
- ✅ User remains on checkout page

**Console Logs:**
```javascript
// Validation error
console.error('Campay payment validation failed:', {
  error: 'Demo environment limit exceeded',
  amount: 50,
  maxAllowed: 10
})
```

---

#### Test 2.4: Production Environment Payment

**Prerequisites:**
- Campay configured with Production environment
- Valid production App ID
- Cart total within min/max limits

**Steps:**
1. Select Campay payment option
2. Fill customer information
3. Click "Place Order"
4. Complete payment in Campay modal

**Expected Results:**
- ✅ Payment modal opens
- ✅ Payment processes successfully
- ✅ Success toast: "Payment successful! Order created."
- ✅ Order created with complete payment details

**Note:** Production payments require real mobile money accounts with sufficient balance.

---

#### Test 2.5: Payment Cancellation

**Steps:**
1. Select Campay payment option
2. Fill customer information
3. Click "Place Order"
4. Close payment modal without completing payment

**Expected Results:**
- ✅ Info toast: "Payment was cancelled"
- ✅ Order is NOT created
- ✅ User remains on checkout page
- ✅ Cart is NOT cleared

**Console Logs:**
```javascript
// Payment cancelled
console.log('Campay payment modal closed')
console.log('Campay payment cancelled:', {
  orderId: 'ORDER_...',
  amount: 10,
  status: 'cancelled'
})
```

---

### 3. Amount Validation Testing

#### Test 3.1: Minimum Amount Validation

**Steps:**
1. Configure Campay with Min Amount: 100 XAF
2. Add items to cart (total < 100 XAF)
3. Select Campay payment
4. Click "Place Order"

**Expected Results:**
- ❌ Error: "Minimum payment amount is 100 XAF"
- ✅ Order NOT created

---

#### Test 3.2: Maximum Amount Validation

**Steps:**
1. Configure Campay with Max Amount: 50000 XAF
2. Add items to cart (total > 50000 XAF)
3. Select Campay payment
4. Click "Place Order"

**Expected Results:**
- ❌ Error: "Maximum payment amount is 50000 XAF"
- ✅ Order NOT created

---

### 4. Network Error Testing

#### Test 4.1: Offline Payment Attempt

**Steps:**
1. Disable internet connection
2. Select Campay payment
3. Click "Place Order"

**Expected Results:**
- ❌ Error: "No internet connection. Please check your network and try again."
- ✅ Order NOT created

**Console Logs:**
```javascript
// Network check failed
console.error('Network connectivity check failed')
```

---

#### Test 4.2: Network Disconnection During Payment

**Steps:**
1. Start payment process
2. Disconnect internet during payment
3. Attempt to complete payment

**Expected Results:**
- ❌ Payment fails with network error
- ✅ Error message displayed
- ✅ Order NOT created (if payment not completed)

---

## Integration Testing

### Test 5.1: End-to-End Payment Flow

**Test Scenario:** Complete payment flow from cart to order creation

**Steps:**
1. Configure Campay (Demo environment)
2. Add products to cart (total ≤ 10 XAF)
3. Navigate to checkout
4. Fill customer information
5. Select Campay payment
6. Complete payment
7. Verify order creation
8. Verify order in admin panel

**Expected Results:**
- ✅ All steps complete successfully
- ✅ Order created with correct payment details
- ✅ Order visible in admin panel
- ✅ Payment details stored correctly
- ✅ Finance entry created (if applicable)

---

### Test 5.2: Order Retrieval and Display

**Steps:**
1. Create order with Campay payment
2. Navigate to Orders page
3. Find the created order
4. View order details

**Expected Results:**
- ✅ Order appears in orders list
- ✅ Payment method shows "Campay"
- ✅ Payment status shows "Paid"
- ✅ Order details show Campay transaction information

---

### Test 5.3: Multiple Payment Attempts

**Steps:**
1. Attempt payment (cancel it)
2. Attempt payment again (cancel it)
3. Complete third payment attempt

**Expected Results:**
- ✅ Each attempt is independent
- ✅ No duplicate orders created
- ✅ Final successful payment creates order
- ✅ All attempts logged in audit trail

---

## Error Scenario Testing

### Test 6.1: Invalid App ID

**Steps:**
1. Enter invalid App ID (< 10 characters)
2. Try to save configuration

**Expected Results:**
- ❌ Validation error displayed
- ✅ Configuration NOT saved

---

### Test 6.2: SDK Loading Failure

**Steps:**
1. Block Campay SDK script (using browser extension)
2. Attempt payment

**Expected Results:**
- ❌ Error: "Campay SDK not loaded. Please refresh the page and try again."
- ✅ Timeout after 10 seconds
- ✅ Order NOT created

---

### Test 6.3: Payment Timeout

**Steps:**
1. Start payment
2. Wait without completing (simulate timeout)

**Expected Results:**
- ❌ Payment times out
- ✅ Error message displayed
- ✅ Order NOT created

---

## Test Checklist

### Configuration Tests
- [ ] Initial configuration loads correctly
- [ ] App ID saves and encrypts correctly
- [ ] Environment selection works
- [ ] Amount limits save correctly
- [ ] Test connection works
- [ ] Configuration persists after refresh

### Payment Flow Tests
- [ ] Campay option appears when configured
- [ ] Demo payment (≤ 10 XAF) succeeds
- [ ] Demo payment (> 10 XAF) fails with error
- [ ] Production payment succeeds
- [ ] Payment cancellation works
- [ ] Order created after successful payment
- [ ] Cart cleared after successful payment

### Validation Tests
- [ ] Minimum amount validation works
- [ ] Maximum amount validation works
- [ ] Demo limit validation works
- [ ] Network connectivity check works

### Error Handling Tests
- [ ] Invalid App ID shows error
- [ ] SDK loading failure handled
- [ ] Network errors handled
- [ ] Payment timeout handled
- [ ] User-friendly error messages displayed

### Integration Tests
- [ ] End-to-end payment flow works
- [ ] Order retrieval works
- [ ] Multiple payment attempts handled
- [ ] Payment details stored correctly
- [ ] Audit logging works

---

## Troubleshooting

### Issue: Campay payment option not appearing

**Possible Causes:**
1. Campay not configured
2. Campay is inactive
3. Configuration not loaded

**Solutions:**
1. Check Settings → Payment Integration → Campay
2. Verify "Is Active" toggle is ON
3. Check browser console for errors
4. Verify company ID is correct

---

### Issue: "Campay SDK not loaded" error

**Possible Causes:**
1. Network connectivity issues
2. Script blocked by browser/ad blocker
3. Invalid App ID
4. SDK URL incorrect

**Solutions:**
1. Check internet connection
2. Disable ad blockers
3. Verify App ID is correct
4. Check browser console for script loading errors
5. Verify environment setting (demo/production)

---

### Issue: Payment fails with "Demo environment limit" error

**Possible Causes:**
1. Amount exceeds 10 XAF in demo mode
2. Environment not set correctly

**Solutions:**
1. Reduce order amount to ≤ 10 XAF
2. Switch to Production environment
3. Verify environment setting in configuration

---

### Issue: Payment succeeds but order not created

**Possible Causes:**
1. Order creation callback failed
2. Network error during order creation
3. Firestore permissions issue

**Solutions:**
1. Check browser console for errors
2. Verify Firestore rules allow order creation
3. Check network connectivity
4. Verify user permissions

---

### Issue: App ID not saving

**Possible Causes:**
1. Validation error
2. Firestore permissions
3. Encryption error

**Solutions:**
1. Check App ID format (min 10 characters)
2. Verify Firestore write permissions
3. Check browser console for errors
4. Verify encryption key is set

---

## Test Data

### Demo Environment Test Credentials
- **App ID**: Use your Campay demo App ID
- **Test Amounts**: 1-10 XAF
- **Test Phone Numbers**: Use Campay test numbers

### Production Environment Test Credentials
- **App ID**: Use your Campay production App ID
- **Test Amounts**: Any amount within min/max limits
- **Test Phone Numbers**: Real mobile money accounts

---

## Reporting Issues

When reporting issues, include:

1. **Environment**: Demo or Production
2. **Steps to Reproduce**: Detailed steps
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happened
5. **Console Logs**: Relevant console output
6. **Browser**: Browser and version
7. **Network**: Network conditions
8. **Screenshots**: If applicable

---

**Last Updated**: [Current Date]  
**Version**: 1.0  
**Status**: ✅ Ready for Testing

