# CinetPay Integration Testing Guide

## 🧪 **Complete Testing Steps for CinetPay Mobile Money Integration**

### **Phase 1: Configuration Testing**

#### **Step 1: Access Payment Settings**
1. **Login to Admin Dashboard**
   - Navigate to your admin panel
   - Go to **Settings** page
   - Click on **"Payment Integration"** tab

#### **Step 2: Configure CinetPay Credentials**
1. **Enable Payment Integration**
   - Toggle **"Enable Online Payments"** to ON
   - You should see the configuration form appear

2. **Set Test Mode**
   - Toggle **"Test Mode"** to ON (for testing)
   - You should see a yellow banner: "Test Mode Active"

3. **Enter Test Credentials**
   - **Site ID**: Enter your CinetPay test Site ID
   - **API Key**: Enter your CinetPay test API Key
   - Click **"Test Connection"** button
   - Should show: "Connection successful! Credentials are valid."

4. **Enable Payment Channels**
   - Toggle **"Mobile Money"** to ON
   - Toggle **"Credit Card"** to ON  
   - Toggle **"Wallet"** to ON
   - Click **"Save Settings"**

#### **Step 3: Verify Configuration**
1. **Check Preview Panel**
   - Payment Integration: **Enabled**
   - Environment: **Test Mode**
   - Site ID: Should show first 8 characters
   - API Key: Should show masked (••••••••)
   - Enabled Payment Methods: Should list all selected channels

---

### **Phase 2: Checkout Flow Testing**

#### **Step 4: Test Checkout Page**
1. **Navigate to Catalogue**
   - Go to your public catalogue page
   - Add some products to cart
   - Click **"Checkout"** button

2. **Verify Payment Options**
   - You should see **"Online Payment"** section
   - Should display:
     - **Mobile Money (CinetPay)** - MTN Money, Orange Money
     - **Credit Card (CinetPay)** - Visa, Mastercard
     - **Digital Wallet (CinetPay)** - Electronic wallets
   - **Pay Onsite** option should still be available

#### **Step 5: Test Mobile Money Payment**
1. **Select Mobile Money**
   - Choose **"Mobile Money (CinetPay)"**
   - Fill in customer information:
     - First Name, Last Name
     - Phone Number (Cameroon format: +237XXXXXXXXX)
     - Email, Address, City

2. **Initiate Payment**
   - Click **"Proceed to Order"**
   - Should open CinetPay popup window
   - Enter test phone number (CinetPay test numbers)
   - Complete payment flow

3. **Verify Order Creation**
   - After successful payment, should redirect to catalogue
   - Check **Orders** page in admin dashboard
   - Order should show:
     - Payment Status: **Paid**
     - Payment Method: **Mobile Money (CinetPay)**
     - Transaction ID should be present

#### **Step 6: Test Credit Card Payment**
1. **Select Credit Card**
   - Choose **"Credit Card (CinetPay)"**
   - Fill in customer information
   - Additional fields should appear:
     - Postal Code (if required)

2. **Complete Payment**
   - Click **"Proceed to Order"**
   - CinetPay popup should open
   - Use test credit card numbers
   - Complete payment flow

3. **Verify Order**
   - Check order in admin dashboard
   - Should show Credit Card payment details

#### **Step 7: Test Wallet Payment**
1. **Select Digital Wallet**
   - Choose **"Digital Wallet (CinetPay)"**
   - Fill in customer information
   - Click **"Proceed to Order"**

2. **Complete Payment**
   - CinetPay popup should open
   - Select wallet option
   - Complete payment flow

---

### **Phase 3: Admin Dashboard Testing**

#### **Step 8: Test Orders Page**
1. **Navigate to Orders**
   - Go to **Orders** page in admin dashboard
   - Should see all created orders

2. **Check Order Details**
   - Click on any CinetPay order
   - Should display:
     - Customer information
     - Payment method: **Mobile Money/Credit Card/Wallet (CinetPay)**
     - Transaction ID
     - Payment status
     - Order timeline

3. **Test Order Management**
   - Update order status
   - Add order notes
   - Verify real-time updates

#### **Step 9: Test Payment Status Updates**
1. **Check Payment Status**
   - Orders should show correct payment status
   - CinetPay transactions should be marked as **Paid**
   - Transaction IDs should be stored

2. **Test Order Filtering**
   - Filter by payment method
   - Filter by payment status
   - Search by customer name

---

### **Phase 4: Error Handling Testing**

#### **Step 10: Test Invalid Credentials**
1. **Enter Wrong Credentials**
   - Go to Payment Integration settings
   - Enter invalid Site ID or API Key
   - Click **"Test Connection"**
   - Should show error message

2. **Test Payment Failures**
   - Try payment with invalid phone number
   - Try payment with insufficient funds
   - Verify error handling

#### **Step 11: Test Disabled Channels**
1. **Disable Payment Channels**
   - Go to Payment Integration settings
   - Disable **"Mobile Money"**
   - Save settings

2. **Check Checkout Page**
   - Go to checkout
   - Mobile Money option should be hidden
   - Other options should still be available

---

### **Phase 5: Mobile Testing**

#### **Step 12: Test Mobile Responsiveness**
1. **Mobile Device Testing**
   - Open catalogue on mobile device
   - Test checkout flow on mobile
   - Verify CinetPay popup works on mobile
   - Test touch interactions

2. **Mobile Payment Flow**
   - Test mobile money on actual mobile device
   - Test with real phone numbers
   - Verify mobile-optimized interface

---

### **Phase 6: Production Testing**

#### **Step 13: Test Live Mode**
1. **Switch to Live Mode**
   - Go to Payment Integration settings
   - Toggle **"Test Mode"** to OFF
   - Enter live credentials
   - Test with real payment methods

2. **Real Payment Testing**
   - Use real phone numbers for mobile money
   - Use real credit cards (small amounts)
   - Verify live transaction processing

---

## 🔍 **What to Look For**

### **✅ Success Indicators**
- [ ] Payment Integration settings save successfully
- [ ] Test connection works with valid credentials
- [ ] CinetPay popup opens correctly
- [ ] Payment processing completes without errors
- [ ] Orders are created with correct payment details
- [ ] Transaction IDs are stored in orders
- [ ] Payment status updates correctly
- [ ] Mobile experience works smoothly
- [ ] Error messages are user-friendly

### **❌ Common Issues to Check**
- [ ] CinetPay popup doesn't open (check SDK loading)
- [ ] Payment fails silently (check credentials)
- [ ] Orders not created (check order service)
- [ ] Payment status not updating (check webhook)
- [ ] Mobile interface issues (check responsive design)
- [ ] Error messages not showing (check error handling)

---

## 🛠️ **Troubleshooting**

### **If CinetPay Popup Doesn't Open**
1. Check browser console for JavaScript errors
2. Verify CinetPay SDK is loaded in Network tab
3. Check if popup is blocked by browser
4. Verify credentials are correct

### **If Payment Fails**
1. Check CinetPay test credentials
2. Verify phone number format (+237XXXXXXXXX)
3. Check CinetPay dashboard for transaction logs
4. Verify test mode is enabled

### **If Orders Don't Update**
1. Check Firebase console for order documents
2. Verify order service is working
3. Check for JavaScript errors in console
4. Verify real-time subscriptions are active

---

## 📱 **Test Phone Numbers (CinetPay Test Mode)**

### **MTN Money Test Numbers**
- +237 6XX XXX XXX (any number starting with 6)
- Use any 9-digit number after +237 6

### **Orange Money Test Numbers**  
- +237 6XX XXX XXX (any number starting with 6)
- Use any 9-digit number after +237 6

### **Test Credit Cards**
- Use CinetPay test credit card numbers
- Check CinetPay documentation for test card numbers

---

## 🎯 **Testing Checklist**

- [ ] **Configuration**: Settings save and load correctly
- [ ] **Credentials**: Test connection works
- [ ] **Channels**: Payment methods appear/disappear based on settings
- [ ] **Mobile Money**: Payment flow works end-to-end
- [ ] **Credit Card**: Payment flow works end-to-end  
- [ ] **Wallet**: Payment flow works end-to-end
- [ ] **Orders**: Orders created with correct details
- [ ] **Admin**: Order management works correctly
- [ ] **Mobile**: Responsive design works
- [ ] **Errors**: Error handling works properly
- [ ] **Security**: API keys are secure
- [ ] **Real-time**: Updates work in real-time

---

## 🚀 **Ready for Production**

Once all tests pass:
1. **Switch to Live Mode** in settings
2. **Enter Live Credentials** from CinetPay dashboard
3. **Test with Real Payments** (small amounts)
4. **Monitor Transaction Logs** in CinetPay dashboard
5. **Verify Webhook Notifications** (if implemented)

---

## 📞 **Support**

If you encounter issues:
1. Check browser console for errors
2. Verify CinetPay credentials
3. Check Firebase console for data
4. Review CinetPay documentation
5. Test with different browsers/devices

**Happy Testing! 🎉**
