# Manual Verification Guide
## Phone Number Normalization - phoneUtils

**Test File**: `phoneUtils.test.ts`  
**Source File**: `src/utils/phoneUtils.ts`  
**Last Updated**: 2024-12-19

---

## 📋 Overview

This guide provides manual verification steps for phone number normalization functionality across the application. The phone normalization system ensures all phone numbers are consistently formatted with country code (+237) for WhatsApp integration and database storage.

---

## 🎯 Functions to Verify

1. `normalizePhoneNumber()` - Main normalization function
2. `formatPhoneForWhatsApp()` - Format for WhatsApp URLs
3. `validateCameroonPhone()` - Validation for Cameroon numbers
4. `getPhoneDisplayValue()` - Format for display
5. `normalizePhoneForComparison()` - Normalize for comparison/search

---

## 1️⃣ Phone Number Normalization in Forms

### Function Purpose
Normalize phone numbers when users enter them in forms (registration, settings, contacts, checkout)

### Where It's Used
- Settings → Account → Phone Number
- Registration page → Phone Number
- Contacts → Add/Edit Contact → Phone
- Checkout → Customer Phone
- Sales → Add Sale → Customer Phone

### Manual Verification Steps

#### Step 1: Test Registration Form
1. Navigate to Registration page (`/register`)
2. Enter phone number: `678904568` (without +237)
3. Submit the form
4. Check browser console for normalized value
5. Verify in Firestore: `users/{userId}` → `phone` field should be `+237678904568`

#### Step 2: Test Settings Form
1. Navigate to Settings → Account
2. Enter phone number: `0678904568` (with leading zero)
3. Save changes
4. Verify phone is saved as `+237678904568` in Firestore: `companies/{companyId}` → `phone` field

#### Step 3: Test Contacts Form
1. Navigate to Contacts page
2. Click "Add Contact"
3. Enter phone number: `678 90 45 68` (with spaces)
4. Save contact
5. Verify phone is saved as `+237678904568` in Firestore: `customers/{customerId}` → `phone` field

#### Step 4: Test Checkout Form
1. Navigate to any product page
2. Add product to cart
3. Go to checkout
4. Enter phone number: `(678) 904-568` (with parentheses and dashes)
5. Complete order
6. Verify phone is saved as `+237678904568` in order: `orders/{orderId}` → `customerInfo.phone` field

#### Expected Results
- ✅ All phone numbers normalized to `+237XXXXXXXXX` format
- ✅ Leading zeros removed
- ✅ Spaces, dashes, parentheses removed
- ✅ 9-digit numbers automatically get +237 prefix

---

## 2️⃣ WhatsApp Integration

### Function Purpose
Format phone numbers for WhatsApp URL generation

### Where It's Used
- Product Detail Page → "Commander via WhatsApp" button
- Checkout → WhatsApp confirmation
- Order confirmation → WhatsApp message

### Manual Verification Steps

#### Step 1: Test WhatsApp Order Button
1. Navigate to any product detail page
2. Click "Commander via WhatsApp" button
3. WhatsApp should open with correct phone number
4. Verify URL format: `https://wa.me/237678904568?text=...`
5. Check that phone number in URL is digits only (no +)

#### Step 2: Test WhatsApp from Settings
1. Go to Settings → Ordering
2. Set WhatsApp Number: `678904568` (without +237)
3. Save settings
4. Go to product page
5. Click "Commander via WhatsApp"
6. Verify WhatsApp opens with correct number: `237678904568`

#### Step 3: Test WhatsApp with Company Phone
1. Go to Settings → Account
2. Set Company Phone: `0678904568` (with leading zero)
3. Save changes
4. Go to product page (without ordering settings WhatsApp number)
5. Click "Commander via WhatsApp"
6. Verify WhatsApp opens with normalized number: `237678904568`

#### Expected Results
- ✅ WhatsApp URLs use digits only (no +)
- ✅ Phone numbers always have country code (237)
- ✅ Leading zeros removed
- ✅ WhatsApp opens correctly with pre-filled message

---

## 3️⃣ Phone Number Validation

### Function Purpose
Validate Cameroon phone numbers before saving

### Where It's Used
- Form validation in checkout
- Form validation in registration
- Customer phone validation

### Manual Verification Steps

#### Step 1: Test Valid Phone Numbers
1. Try entering valid Cameroon numbers:
   - `678904568` ✅
   - `778904568` ✅
   - `878904568` ✅
   - `978904568` ✅
2. All should be accepted and normalized

#### Step 2: Test Invalid Phone Numbers
1. Try entering invalid numbers:
   - `578904568` ❌ (starts with 5)
   - `67890456` ❌ (8 digits)
   - `6789045689` ❌ (10 digits)
2. Check if validation errors appear (if validation is implemented)

#### Expected Results
- ✅ Valid numbers (9 digits, starting with 6, 7, 8, or 9) are accepted
- ✅ Invalid numbers show validation errors (if implemented)
- ✅ All valid numbers normalized to `+237XXXXXXXXX`

---

## 4️⃣ Phone Number Display

### Function Purpose
Format phone numbers for display in UI

### Where It's Used
- Customer list display
- Order details display
- Contact list display

### Manual Verification Steps

#### Step 1: Check Customer List
1. Navigate to Contacts page
2. Verify phone numbers display as: `+237 XX XX XX XX` format
3. Check that formatting is consistent

#### Step 2: Check Order Details
1. Navigate to Orders page
2. Open any order
3. Verify customer phone displays correctly formatted

#### Expected Results
- ✅ Phone numbers display in readable format
- ✅ Consistent formatting across all pages
- ✅ Country code (+237) always visible

---

## 5️⃣ Phone Number Search/Comparison

### Function Purpose
Normalize phone numbers for search and comparison

### Where It's Used
- Customer search in Sales
- Customer search in POS
- Customer lookup in forms

### Manual Verification Steps

#### Step 1: Test Customer Search in Sales
1. Navigate to Sales page
2. In "Add Sale" form, start typing phone number: `678904568`
3. Verify customer with phone `+237678904568` is found
4. Try searching with: `+237678904568`
5. Verify same customer is found

#### Step 2: Test Customer Search in POS
1. Navigate to POS
2. In customer search, type: `0678904568` (with leading zero)
3. Verify customer with phone `+237678904568` is found

#### Expected Results
- ✅ Search works regardless of input format
- ✅ Phone numbers normalized for comparison
- ✅ Customers found even with different input formats

---

## 🔍 Common Issues & Troubleshooting

### Issue 1: Phone Number Not Normalized in Database
**Symptom**: Phone number saved without +237 prefix

**Check**:
1. Verify `addCustomer()` or `createUser()` calls `normalizePhoneNumber()`
2. Check browser console for errors
3. Verify import statement: `import { normalizePhoneNumber } from '../utils/phoneUtils'`

**Solution**: Ensure all save operations use `normalizePhoneNumber()` before saving

### Issue 2: WhatsApp Link Not Working
**Symptom**: WhatsApp opens but number not found

**Check**:
1. Verify phone number format in URL (should be digits only)
2. Check if country code (237) is present
3. Verify no leading zeros in URL

**Solution**: Use `formatPhoneForWhatsApp()` for all WhatsApp URLs

### Issue 3: Phone Number Search Not Finding Customers
**Symptom**: Customer exists but search doesn't find them

**Check**:
1. Verify search uses `normalizePhoneForComparison()`
2. Check if phone numbers in database are normalized
3. Verify comparison uses normalized values

**Solution**: Use `normalizePhoneForComparison()` for all phone comparisons

---

## 📊 Test Checklist

- [ ] Registration form normalizes phone numbers
- [ ] Settings form normalizes company phone
- [ ] Contacts form normalizes customer phone
- [ ] Checkout form normalizes customer phone
- [ ] WhatsApp order button works correctly
- [ ] WhatsApp URLs use correct format (digits only)
- [ ] Phone numbers display correctly in lists
- [ ] Customer search finds numbers in any format
- [ ] All phone numbers in database have +237 prefix
- [ ] No duplicate normalization logic in codebase

---

## 🧪 Edge Cases to Test Manually

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Normal | `678904568` | `+237678904568` |
| With leading zero | `0678904568` | `+237678904568` |
| With spaces | `678 90 45 68` | `+237678904568` |
| With dashes | `678-90-45-68` | `+237678904568` |
| With parentheses | `(678) 904-568` | `+237678904568` |
| Already normalized | `+237678904568` | `+237678904568` |
| With country code (no +) | `237678904568` | `+237678904568` |
| Empty string | `` | `` |
| Null | `null` | `` |
| Invalid prefix | `578904568` | `+237578904568` (normalized but invalid) |

---

**Last Verified**: [Date]  
**Verified By**: [Name/Team]  
**Status**: ✅ All tests passing

