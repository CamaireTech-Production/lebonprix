# Manual Verification Guide
## Expense Sync - Finance Entry Synchronization

**Test File**: `expenseSync.test.ts`  
**Source File**: `src/services/firestore.ts` (syncFinanceEntryWithExpense)  
**Last Updated**: 2024-11-17

---

## Overview

Tests for `syncFinanceEntryWithExpense()` which synchronizes expenses with finance entries in the finances collection.

---

## Functions to Verify

1. `syncFinanceEntryWithExpense()` - Sync expense with finance entry

---

## UI Testing Steps

### 1. Create Expense → Finance Entry Created

1. Create new expense
2. Check finances collection in Firestore
3. Verify finance entry created with:
   - `sourceType: 'expense'`
   - `sourceId: expense.id`
   - `amount: -expense.amount` (negative)
   - `type: 'expense'`

**Expected**: Finance entry created automatically

---

### 2. Update Expense → Finance Entry Updated

1. Update existing expense
2. Check finances collection
3. Verify finance entry updated with new amount/description

**Expected**: Finance entry updated automatically

---

### 3. Delete Expense → Finance Entry Soft Deleted

1. Soft delete expense
2. Check finances collection
3. Verify finance entry has `isDeleted: true`

**Expected**: Finance entry soft deleted

---

## Database Verification

**Firestore Path**: `finances/{financeId}`

Verify:
- `sourceType: 'expense'`
- `sourceId` matches expense ID
- `amount` is negative (expense)
- `isDeleted` matches expense `isAvailable`

---

## Edge Cases

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Invalid expense | Missing id/userId/companyId | Skip sync, log warning |
| No finance entry | First create | Create new entry |
| Existing entry | Update expense | Update existing entry |

---

**Last Verified**: [Date]  
**Status**: ✅ All tests passing

