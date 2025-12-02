# Manual Verification Guide
## Expenses Service - CRUD Operations

**Test File**: `expenses.test.ts`  
**Source File**: `src/services/firestore.ts`  
**Last Updated**: 2024-11-17

---

## Overview

Tests for expense CRUD operations: create, update, and soft delete. These functions interact with Firestore and handle authorization, date conversion, and finance entry synchronization.

---

## Functions to Verify

1. `createExpense()` - Create expense with date handling
2. `updateExpense()` - Update with authorization checks
3. `softDeleteExpense()` - Soft delete expense and finance entry

---

## UI Testing Steps

### 1. Create Expense

**Location**: Expenses page → Add Expense button

1. Click "Add Expense"
2. Fill form: description, amount, category, date
3. Submit → Verify expense created
4. Check toast: "Expense added successfully"
5. Verify expense appears in list

**Expected**: Expense created with correct data

---

### 2. Update Expense

**Location**: Expenses page → Edit button

1. Click edit on an expense
2. Modify description/amount/date
3. Submit → Verify expense updated
4. Check toast: "Expense updated successfully"
5. Verify changes reflected in list

**Expected**: Expense updated, createdAt unchanged

---

### 3. Delete Expense

**Location**: Expenses page → Delete button

1. Click delete on an expense
2. Confirm deletion
3. Check toast: "Expense deleted successfully"
4. Verify expense removed from list
5. Verify finance entry also soft deleted

**Expected**: Expense and finance entry soft deleted

---

## Console Logs

- No specific console logs for these functions (errors logged via toast)

---

## Database Verification

### Firestore Collections

1. **expenses/{expenseId}**
   - Verify `isAvailable: false` after soft delete
   - Verify `createdAt` never changes on update
   - Verify `date` field (transaction date)

2. **finances/{financeId}**
   - Verify `isDeleted: true` after expense soft delete
   - Verify `sourceType: 'expense'` and `sourceId` match

---

## Edge Cases to Test

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Create without date | No date field | Uses current date |
| Update with Date object | new Date() | Converts to Timestamp |
| Update with Timestamp | Timestamp | Uses as-is |
| Update different company | Wrong companyId | Rejected or migrated |
| Delete non-existent | Invalid ID | Error toast |

---

## Test Checklist

- [ ] Create expense works
- [ ] Update expense works
- [ ] Delete expense works
- [ ] createdAt never changes
- [ ] Finance entry synced
- [ ] Authorization checks work
- [ ] Date conversion works

---

**Last Verified**: [Date]  
**Status**: ✅ All tests passing

