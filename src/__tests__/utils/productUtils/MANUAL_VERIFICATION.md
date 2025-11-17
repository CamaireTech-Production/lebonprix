# Manual Verification Guide
## Product Utilities - src/utils/productUtils.ts

**Test File**: `productUtils.test.ts`  
**Source File**: `src/utils/productUtils.ts`  
**Last Updated**: 2024-11-17

---

## Overview

Product utility function for getting latest cost price from stock changes. Used extensively in profit calculations across the application.

---

## Functions Tested

1. `getLatestCostPrice()` - Gets latest cost price from stock changes

---

## Quick Test Steps

### 1. View Product Cost Price (Products Page)
1. Go to **Products** → Select a product
2. **Check**: "Latest Cost Price" displays in product details
3. **Check**: Value matches most recent stock change cost price
4. **Check**: Updates when new stock is added with different cost

### 2. Profit Calculation (Products Edit)
1. Go to **Products** → Edit product → Price tab
2. Enter selling price
3. **Check**: "Profit per unit" displays: `sellingPrice - latestCostPrice`
4. **Check**: Warning appears if selling price < cost price
5. **Check**: Console log shows cost price calculation

### 3. Dashboard Profit Display
1. Go to **Dashboard**
2. **Check**: Total profit calculated using latest cost prices
3. **Check**: Profit updates when stock changes occur
4. **Check**: Console log shows cost price lookups

### 4. Finance Page Calculations
1. Go to **Finance**
2. **Check**: Profit calculations use latest cost prices
3. **Check**: Purchase price calculations use latest cost prices
4. **Check**: Values update when stock changes

---

## Console Logs

```javascript
// Cost price lookup (in various pages)
console.log('Getting latest cost price for product:', productId)
console.log('Latest cost price:', costPrice)
```

---

## Toast Notifications

- ℹ️ **Info**: "Cost price updated" (when stock added)
- ⚠️ **Warning**: "Selling price is below cost price" (in product edit)

---

## Database Checks

**Firestore Path**: `stockChanges/{changeId}`
- `costPrice` field contains cost price
- `createdAt.seconds` determines "latest"
- `productId` matches product

**Verification**:
1. Check most recent stock change for product
2. Verify `costPrice` matches displayed value
3. Verify sorting by `createdAt.seconds` (newest first)

---

## Quick Checklist

- [ ] Latest cost price displays correctly in Products
- [ ] Profit calculations use latest cost price
- [ ] Dashboard profit uses latest cost prices
- [ ] Finance page uses latest cost prices
- [ ] Values update when new stock added
- [ ] Console logs show cost price lookups

---

**Last Verified**: 2024-11-17  
**Status**: ✅ All functions tested

