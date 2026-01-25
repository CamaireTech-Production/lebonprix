# Campay Payment Integration - Troubleshooting Guide

This document provides solutions to common issues encountered when using the Campay payment integration.

## Table of Contents

1. [Common Issues](#common-issues)
2. [Error Messages](#error-messages)
3. [Configuration Problems](#configuration-problems)
4. [Payment Flow Issues](#payment-flow-issues)
5. [SDK Loading Issues](#sdk-loading-issues)
6. [Database Issues](#database-issues)
7. [Network Issues](#network-issues)
8. [Debugging Tips](#debugging-tips)

---

## Common Issues

### Issue 1: Campay Payment Option Not Visible

**Symptoms:**
- Campay payment option does not appear in checkout
- Payment section shows only other payment methods

**Possible Causes:**
1. Campay not configured
2. Campay is inactive
3. Configuration not loaded
4. Company ID mismatch

**Solutions:**

1. **Check Configuration:**
   ```
   Navigate to: Settings → Payment Integration → Campay
   Verify:
   - "Is Active" toggle is ON
   - App ID is entered
   - Environment is selected
   ```

2. **Check Browser Console:**
   ```javascript
   // Look for errors like:
   console.error('Campay config not found')
   console.error('Campay is not active')
   ```

3. **Verify Company ID:**
   ```javascript
   // Check if company ID matches
   console.log('Company ID:', companyId)
   console.log('Campay Config:', campayConfig)
   ```

4. **Check Firestore:**
   ```
   Path: campay_configs/{companyId}
   Verify document exists and has:
   - isActive: true
   - appId: [encrypted string]
   ```

---

### Issue 2: "Campay SDK not loaded" Error

**Symptoms:**
- Error message: "Campay SDK not loaded. Please refresh the page and try again."
- Payment modal does not open
- Timeout after 10 seconds

**Possible Causes:**
1. Network connectivity issues
2. Script blocked by browser/ad blocker
3. Invalid App ID
4. SDK URL incorrect
5. Script loading timeout

**Solutions:**

1. **Check Network Connection:**
   ```javascript
   // Verify network status
   console.log('Online:', navigator.onLine)
   ```

2. **Disable Ad Blockers:**
   - Disable browser ad blockers
   - Whitelist your domain
   - Check browser extensions

3. **Verify App ID:**
   ```
   - App ID must be at least 10 characters
   - Check for typos
   - Verify App ID is correct for selected environment
   ```

4. **Check SDK URL:**
   ```javascript
   // Demo environment
   https://demo.campay.net/sdk/js?app-id=YOUR_APP_ID
   
   // Production environment
   https://www.campay.net/sdk/js?app-id=YOUR_APP_ID
   ```

5. **Check Browser Console:**
   ```javascript
   // Look for script loading errors
   console.error('Failed to load script:', scriptUrl)
   console.error('Script onerror triggered')
   ```

6. **Manual Script Test:**
   ```html
   <!-- Test in browser console -->
   <script src="https://demo.campay.net/sdk/js?app-id=YOUR_APP_ID"></script>
   <!-- Then check: -->
   console.log(window.campay)
   ```

---

### Issue 3: "Demo environment limit" Error

**Symptoms:**
- Error: "Demo environment limit: Maximum amount is 10 XAF"
- Payment fails even with valid credentials
- Order not created

**Possible Causes:**
1. Amount exceeds 10 XAF in demo mode
2. Environment not set correctly
3. Amount validation issue

**Solutions:**

1. **Reduce Order Amount:**
   ```
   - Ensure cart total ≤ 10 XAF
   - Remove items if necessary
   - Or switch to Production environment
   ```

2. **Switch to Production:**
   ```
   Settings → Payment Integration → Campay
   - Change Environment to "Production"
   - Enter Production App ID
   - Save configuration
   ```

3. **Verify Environment:**
   ```javascript
   // Check configuration
   console.log('Environment:', campayConfig.environment)
   console.log('Amount:', finalTotal)
   ```

---

### Issue 4: Payment Succeeds But Order Not Created

**Symptoms:**
- Payment completes successfully
- Success message appears
- But order is not created in database
- Order not visible in admin panel

**Possible Causes:**
1. Order creation callback failed
2. Network error during order creation
3. Firestore permissions issue
4. Validation error in order creation

**Solutions:**

1. **Check Browser Console:**
   ```javascript
   // Look for errors
   console.error('Error creating order:', error)
   console.error('Order creation failed')
   ```

2. **Verify Firestore Rules:**
   ```javascript
   // Check Firestore security rules
   // Path: orders/{orderId}
   // Should allow: create, read, update
   ```

3. **Check Network:**
   ```javascript
   // Verify network during order creation
   console.log('Network status:', navigator.onLine)
   ```

4. **Check Order Service:**
   ```javascript
   // Verify createOrder function
   // Check for validation errors
   // Check for required fields
   ```

5. **Manual Order Creation Test:**
   ```javascript
   // Test order creation manually
   const testOrder = await createOrder(companyId, {
     customerInfo: {...},
     cartItems: [...],
     pricing: {...},
     paymentMethod: 'campay',
     // ... other fields
   })
   console.log('Test order:', testOrder)
   ```

---

### Issue 5: App ID Not Saving

**Symptoms:**
- App ID input clears after save
- Error message appears
- Configuration not persisted

**Possible Causes:**
1. Validation error
2. Firestore permissions
3. Encryption error
4. Network error

**Solutions:**

1. **Check App ID Format:**
   ```
   - Must be at least 10 characters
   - Only alphanumeric, underscore, hyphen allowed
   - No special characters
   ```

2. **Verify Firestore Permissions:**
   ```javascript
   // Check write permissions
   // Path: campay_configs/{companyId}
   // Should allow: write for authenticated users
   ```

3. **Check Encryption:**
   ```javascript
   // Verify encryption key is set
   console.log('Encryption key exists:', !!process.env.REACT_APP_ENCRYPTION_KEY)
   ```

4. **Check Browser Console:**
   ```javascript
   // Look for save errors
   console.error('Error saving Campay config:', error)
   ```

---

## Error Messages

### "App ID is required"
**Cause:** App ID field is empty  
**Solution:** Enter a valid Campay App ID

### "App ID must be at least 10 characters long"
**Cause:** App ID is too short  
**Solution:** Use a valid App ID with at least 10 characters

### "App ID contains invalid characters"
**Cause:** App ID has invalid characters  
**Solution:** Use only alphanumeric, underscore, and hyphen characters

### "Minimum payment amount is X XAF"
**Cause:** Order amount below minimum limit  
**Solution:** Increase order amount or reduce minimum limit in settings

### "Maximum payment amount is X XAF"
**Cause:** Order amount exceeds maximum limit  
**Solution:** Reduce order amount or increase maximum limit in settings

### "No internet connection"
**Cause:** Network connectivity issue  
**Solution:** Check internet connection and try again

### "Campay is not properly configured"
**Cause:** Configuration missing or invalid  
**Solution:** Check Campay configuration in settings

### "Payment was cancelled by user"
**Cause:** User closed payment modal  
**Solution:** This is normal behavior, user can retry payment

---

## Configuration Problems

### Problem: Configuration Not Loading

**Check:**
1. Company ID is correct
2. Firestore document exists
3. User has read permissions
4. Network connectivity

**Debug:**
```javascript
// Check subscription
subscribeToCampayConfig(companyId, (config) => {
  console.log('Config received:', config)
})
```

---

### Problem: Configuration Not Saving

**Check:**
1. User has write permissions
2. App ID format is valid
3. Network connectivity
4. Encryption key is set

**Debug:**
```javascript
// Test save
saveCampayConfig(companyId, config, userId)
  .then(() => console.log('Saved'))
  .catch(error => console.error('Save error:', error))
```

---

## Payment Flow Issues

### Problem: Payment Modal Not Opening

**Check:**
1. SDK is loaded
2. Hidden button exists
3. Button ID is correct
4. No JavaScript errors

**Debug:**
```javascript
// Check SDK
console.log('Campay SDK:', window.campay)

// Check button
const button = document.getElementById('campay-pay-button')
console.log('Button:', button)

// Check button click
button?.click()
```

---

### Problem: Payment Callbacks Not Firing

**Check:**
1. Callbacks are set before `options()` call
2. SDK is properly initialized
3. No JavaScript errors

**Debug:**
```javascript
// Set callbacks manually
window.campay.onSuccess = (data) => {
  console.log('Success callback:', data)
}

window.campay.onFail = (data) => {
  console.log('Fail callback:', data)
}

window.campay.onModalClose = (data) => {
  console.log('Close callback:', data)
}
```

---

## SDK Loading Issues

### Problem: Script Loading Timeout

**Solutions:**
1. Check network connection
2. Verify SDK URL is correct
3. Check for CORS issues
4. Disable ad blockers

**Debug:**
```javascript
// Check script loading
const script = document.querySelector('script[src*="campay"]')
console.log('Script element:', script)

// Check if script loaded
script?.addEventListener('load', () => {
  console.log('Script loaded')
})

script?.addEventListener('error', () => {
  console.error('Script failed to load')
})
```

---

## Database Issues

### Problem: Payment Details Not Stored

**Check:**
1. Order creation includes `campayPaymentDetails`
2. Firestore rules allow updates
3. Data structure is correct

**Debug:**
```javascript
// Check order document
const order = await getOrderById(orderId)
console.log('Order payment details:', order.campayPaymentDetails)
```

---

## Network Issues

### Problem: Network Errors During Payment

**Solutions:**
1. Check internet connection
2. Verify Campay API is accessible
3. Check firewall settings
4. Try different network

**Debug:**
```javascript
// Test network
fetch('https://demo.campay.net/sdk/js')
  .then(() => console.log('Network OK'))
  .catch(error => console.error('Network error:', error))
```

---

## Debugging Tips

### 1. Enable Verbose Logging

```javascript
// In campayHandler.ts, add more console logs
console.log('Campay config:', config)
console.log('Payment data:', paymentData)
console.log('SDK status:', window.campay)
```

### 2. Check Firestore Data

```javascript
// In browser console
import { db } from './services/firebase'
import { doc, getDoc } from 'firebase/firestore'

const configRef = doc(db, 'campay_configs', companyId)
const configSnap = await getDoc(configRef)
console.log('Config data:', configSnap.data())
```

### 3. Test SDK Manually

```javascript
// Load SDK manually in console
const script = document.createElement('script')
script.src = 'https://demo.campay.net/sdk/js?app-id=YOUR_APP_ID'
document.head.appendChild(script)

script.onload = () => {
  console.log('SDK loaded:', window.campay)
}
```

### 4. Monitor Network Requests

```
Open Browser DevTools → Network tab
Filter by "campay"
Check for:
- Script loading requests
- API calls
- Error responses
```

### 5. Check Validation

```javascript
// Test validation functions
import { validateCampayConfig } from './utils/validation/campayValidation'

const validation = validateCampayConfig(campayConfig)
console.log('Validation result:', validation)
```

---

## Getting Help

If issues persist:

1. **Collect Information:**
   - Browser console logs
   - Network requests
   - Firestore data
   - Steps to reproduce

2. **Check Documentation:**
   - Integration Guide
   - Testing Guide
   - Campay API Documentation

3. **Contact Support:**
   - Include error messages
   - Include console logs
   - Include steps to reproduce
   - Include environment details

---

**Last Updated**: [Current Date]  
**Version**: 1.0

