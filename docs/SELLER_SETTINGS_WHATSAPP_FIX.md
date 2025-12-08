# Seller Settings WhatsApp Number Fix

## 📋 Overview

Fixed WhatsApp ordering to use the **Ordering Settings WhatsApp number** (`sellerSettings.whatsappNumber`) instead of the general company phone number, with fallback to company phone if not configured.

## ❌ The Problem

### Before
All product detail pages were using `company.phone` for WhatsApp orders:

```typescript
// ❌ OLD - Used company.phone directly
let cleanPhone = company.phone.replace(/\D/g, '');
```

**Issues:**
1. Ignored the dedicated "Ordering Settings" WhatsApp number
2. No separation between general company phone and orders WhatsApp
3. Couldn't have different numbers for general inquiries vs orders

### Why This Matters

The system has **TWO separate phone fields**:

| Field | Location | Purpose | Used For |
|-------|----------|---------|----------|
| `company.phone` | Settings → Account | General company contact | Profile display, general contact |
| `sellerSettings.whatsappNumber` | Settings → Ordering | **Orders & WhatsApp** | **Order messages, customer orders** |

**Example Use Case:**
- Company phone: `+237612345678` (Office number)
- Orders WhatsApp: `+237698765432` (Sales manager's WhatsApp)

Customer orders should go to the sales manager, not the office!

---

## ✅ The Solution

### After
All product detail pages now prioritize `sellerSettings.whatsappNumber`:

```typescript
// ✅ NEW - Use sellerSettings first, fallback to company
const whatsappNumber = sellerSettings?.whatsappNumber || company.phone;
let cleanPhone = whatsappNumber.replace(/\D/g, '');
```

**Benefits:**
1. ✅ Uses dedicated ordering WhatsApp number
2. ✅ Fallback to company phone if not configured
3. ✅ Proper separation of concerns
4. ✅ Flexibility for different phone numbers

---

## 📁 Files Modified

### 1. **ProductDetailModal** (`src/components/common/ProductDetailModal.tsx`)

**Changes:**
```typescript
// Import sellerSettings type and service
import { getSellerSettings } from '../../services/firestore';
import type { SellerSettings } from '../../types/order';

// Add state for seller settings
const [sellerSettings, setSellerSettings] = useState<SellerSettings | null>(null);

// Load seller settings when modal opens
const [companyData, productsData, settingsData] = await Promise.all([
  getCompanyByUserId(companyId),
  subscribeToProducts(companyId, ...),
  getSellerSettings(companyId) // ✅ NEW
]);

if (settingsData) {
  setSellerSettings(settingsData);
}

// Use in WhatsApp order handler
const whatsappNumber = sellerSettings?.whatsappNumber || company.phone;
```

---

### 2. **DesktopProductDetail** (`src/components/common/DesktopProductDetail.tsx`)

**Same changes as ProductDetailModal:**
```typescript
// Import
import { getSellerSettings } from '../../services/firestore';
import type { SellerSettings } from '../../types/order';

// State
const [sellerSettings, setSellerSettings] = useState<SellerSettings | null>(null);

// Load settings
const settingsData = await getSellerSettings(companyId);
if (settingsData) {
  setSellerSettings(settingsData);
}

// Use in handler
const whatsappNumber = sellerSettings?.whatsappNumber || company.phone;
```

---

### 3. **ProductDetailPage** (`src/pages/ProductDetailPage.tsx`)

**Same pattern as above:**
```typescript
// Import
import { getSellerSettings } from '../services/firestore';
import type { SellerSettings } from '../types/order';

// State
const [sellerSettings, setSellerSettings] = useState<SellerSettings | null>(null);

// Load on page load
const settingsData = await getSellerSettings(companyId);
if (settingsData) {
  setSellerSettings(settingsData);
}

// Use in handler
const whatsappNumber = sellerSettings?.whatsappNumber || company.phone;
```

---

## 🎯 How It Works Now

### Step 1: Admin Configures Ordering Settings

```
Settings → Ordering Tab
├── WhatsApp Number: +237698765432
├── Business Name: My Shop
├── Payment Methods: [Mobile Money, COD]
└── Delivery Fee: 1000 FCFA

[Save Settings] → Stored in sellerSettings/{companyId}
```

### Step 2: Customer Orders via WhatsApp

```
Product Detail Page
    ↓
Load sellerSettings
    ↓
Check sellerSettings.whatsappNumber
    ↓
If EXISTS → Use sellerSettings.whatsappNumber ✅
If NOT    → Fallback to company.phone ✅
    ↓
Format phone number
    ↓
Open WhatsApp with message
```

### Step 3: WhatsApp Message Sent

```
Message sent to: sellerSettings.whatsappNumber
(or company.phone if not configured)

Content:
Bonjour! Je voudrais commander:
*Product Name*
Quantité: 2
Prix unitaire: 15,000 FCFA
Total: 30,000 FCFA
...
```

---

## 📊 Fallback Logic

### Priority Order
```typescript
1. sellerSettings?.whatsappNumber  ← Primary (if configured)
2. company.phone                   ← Fallback (always exists)
```

### Example Scenarios

#### Scenario 1: Seller Settings Configured ✅
```typescript
sellerSettings.whatsappNumber = "+237698765432"
company.phone = "+237612345678"

Result: Uses "+237698765432" (Orders WhatsApp)
```

#### Scenario 2: Seller Settings NOT Configured ✅
```typescript
sellerSettings = null  // Not configured yet
company.phone = "+237612345678"

Result: Uses "+237612345678" (Company phone)
```

#### Scenario 3: Both Available ✅
```typescript
sellerSettings.whatsappNumber = "+237698765432"
company.phone = "+237612345678"

Result: Uses "+237698765432" (Prioritizes seller settings)
```

---

## 🔄 Migration Path

### For Existing Companies

**No action required!** The system automatically handles both scenarios:

1. **If you haven't configured Ordering Settings:**
   - WhatsApp orders continue using `company.phone`
   - Everything works as before
   - No breaking changes

2. **If you configure Ordering Settings:**
   - Go to Settings → Ordering
   - Enter WhatsApp number
   - Save
   - Future orders use new number immediately

### Recommendation

All companies should:
1. Go to **Settings → Ordering**
2. Enter dedicated **WhatsApp Number** for orders
3. Configure **Payment Methods** and **Delivery Fee**
4. Click **Save Settings**

This ensures orders go to the right person/number!

---

## 🧪 Testing

### Test Case 1: With Seller Settings
```
1. Go to Settings → Ordering
2. Enter WhatsApp: +237698765432
3. Save settings
4. Go to any product page
5. Click "Commander via WhatsApp"
6. Verify: Opens WhatsApp to +237698765432 ✅
```

### Test Case 2: Without Seller Settings
```
1. Settings → Ordering NOT configured
2. Company phone: +237612345678
3. Go to any product page
4. Click "Commander via WhatsApp"
5. Verify: Opens WhatsApp to +237612345678 ✅
```

### Test Case 3: Phone Number Formatting
```
Input: "0698765432"
Output: "237698765432" ✅

Input: "+237 698 76 54 32"
Output: "237698765432" ✅

Input: "237698765432"
Output: "237698765432" ✅
```

---

## 📝 Complete Flow Diagram

```
┌─────────────────────────────────────────┐
│     Customer Views Product              │
│     (Catalogue/Product Detail)          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Component Loads:                       │
│  - Company Data                         │
│  - Product Data                         │
│  - Seller Settings (NEW) ✅            │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Customer Clicks                        │
│  "Commander via WhatsApp"               │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Get WhatsApp Number:                   │
│                                         │
│  const whatsappNumber =                 │
│    sellerSettings?.whatsappNumber  ← 1  │
│    || company.phone               ← 2  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Format Phone Number:                   │
│  - Remove non-digits                    │
│  - Add +237 if missing                  │
│  - Format for WhatsApp                  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Generate Message:                      │
│  - Product name                         │
│  - Quantity                             │
│  - Price                                │
│  - Total                                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Open WhatsApp:                         │
│  https://wa.me/{cleanPhone}?text=...    │
└─────────────────────────────────────────┘
```

---

## 🎉 Summary

### What Changed
✅ All 3 product detail pages now load `sellerSettings`  
✅ WhatsApp uses `sellerSettings.whatsappNumber` (if configured)  
✅ Automatic fallback to `company.phone` (if not configured)  
✅ No breaking changes - backward compatible  

### Benefits
✅ **Proper separation**: Orders vs general contact  
✅ **Flexibility**: Different numbers for different purposes  
✅ **User control**: Configure in Ordering Settings  
✅ **Fallback logic**: Always works, even if not configured  
✅ **Better UX**: Orders go to the right person  

### Files Modified
- ✅ `src/components/common/ProductDetailModal.tsx`
- ✅ `src/components/common/DesktopProductDetail.tsx`
- ✅ `src/pages/ProductDetailPage.tsx`

### Zero Breaking Changes
- ✅ Existing functionality preserved
- ✅ Fallback to company phone
- ✅ No migration needed
- ✅ Backward compatible

---

**Status**: ✅ **Implemented and Tested**  
**Version**: 1.0  
**Date**: December 8, 2025  
**Backward Compatible**: Yes  
**Breaking Changes**: None

🎯 **Orders now go to the right WhatsApp number!**

