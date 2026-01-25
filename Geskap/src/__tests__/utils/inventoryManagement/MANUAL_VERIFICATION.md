# Manual Verification Guide
## Inventory Management - src/utils/inventoryManagement.ts

**Test File**: `inventoryManagement.test.ts`  
**Source File**: `src/utils/inventoryManagement.ts`  
**Last Updated**: 2024-11-17

---

## Overview

Inventory management utilities for FIFO/LIFO stock batch handling. Used in sales creation, product restocking, and stock adjustments.

---

## Functions Tested

1. `getAvailableStockBatches()` - Filters and sorts batches (FIFO/LIFO)
2. `consumeStockFromBatches()` - Consumes stock with cost calculations
3. `createStockBatch()` - Creates new stock batches
4. `validateStockBatch()` - Validates batch data
5. `formatCostPrice()` - Formats XAF currency
6. `formatStockQuantity()` - Formats numbers
7. `getBatchStatusText()` - Status text mapping
8. `getBatchStatusColor()` - Status color mapping

---

## Quick Test Steps

### 1. Create Stock Batch (Restock Product)
1. Go to **Products** → Select product → **Restock**
2. Enter quantity: `100`, cost price: `5000 XAF`
3. Click **Add Stock**
4. **Check**: Toast "Stock batch created"
5. **Check**: Console log batch creation
6. **Check**: Firestore `stockBatches` collection has new batch

### 2. Create Sale (Consumes Stock)
1. Go to **Sales** → Create new sale
2. Add product with quantity: `50`
3. Complete sale
4. **Check**: Toast "Sale created successfully"
5. **Check**: Console log shows batch consumption (FIFO/LIFO)
6. **Check**: Firestore `stockBatches` → `remainingQuantity` decreased
7. **Check**: Sale document has `consumedBatches` array

### 3. View Stock Batches
1. Go to **Products** → Select product → **Stock Batches** tab
2. **Check**: Batches listed with formatted prices (`formatCostPrice`)
3. **Check**: Quantities formatted (`formatStockQuantity`)
4. **Check**: Status colors/text (`getBatchStatusText`, `getBatchStatusColor`)

### 4. Stock Adjustment
1. Go to **Products** → Select product → **Adjust Stock**
2. Enter adjustment (damage/correction)
3. **Check**: Toast notification
4. **Check**: Batch status updated in Firestore

---

## Console Logs

```javascript
// Batch creation
console.log('Creating stock batch:', { productId, quantity, costPrice })

// Stock consumption
console.log('Consuming stock:', { quantity, method: 'FIFO' })
console.log('Consumed batches:', consumedBatches)
console.log('Total cost:', totalCost)
```

---

## Toast Notifications

- ✅ **Success**: "Stock batch created"
- ✅ **Success**: "Sale created successfully"
- ✅ **Success**: "Stock adjusted"
- ❌ **Error**: "Insufficient stock available"
- ❌ **Error**: "Validation failed: [errors]"

---

## Database Checks

**Firestore Path**: `stockBatches/{batchId}`
- `remainingQuantity` decreases after sale
- `status` changes: `active` → `depleted` when empty
- `consumedBatches` array in sale documents

---

## Quick Checklist

- [ ] Batch created in Firestore
- [ ] Sale consumes stock correctly (FIFO/LIFO)
- [ ] Prices formatted correctly (XAF)
- [ ] Quantities formatted correctly
- [ ] Status colors/text display correctly
- [ ] Toast notifications appear
- [ ] Console logs show batch operations

---

**Last Verified**: 2024-11-17  
**Status**: ✅ All functions tested

