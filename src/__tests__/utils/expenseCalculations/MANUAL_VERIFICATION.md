# Manual Verification Guide
## Expense Calculations - Pure Functions

**Test File**: `expenseCalculations.test.ts`  
**Source File**: `src/utils/expenseCalculations.ts`  
**Last Updated**: 2024-11-17

---

## Overview

These are pure calculation functions used by the Expenses page for filtering and statistics. They are tested in isolation, but can be verified through the Expenses UI.

---

## Functions to Verify

1. `filterExpenses()` - Filters expenses by category, search, date range, amount
2. `calculateExpenseStats()` - Calculates totals, averages, and category breakdown
3. `calculateCategoryBreakdown()` - Calculates category percentages

---

## UI Testing Steps

### 1. Filter Expenses

**Location**: Expenses page → Filters section

1. Navigate to Expenses page
2. Apply category filter → Verify only matching expenses shown
3. Use search box → Verify description filtering (case-insensitive)
4. Set date range → Verify only expenses in range shown
5. Set amount range → Verify min/max filtering works
6. Combine all filters → Verify all filters work together

**Expected**: Filtered list matches filter criteria

---

### 2. Statistics Display

**Location**: Expenses page → Statistics/Summary section

1. View total amount → Should sum all visible expenses
2. View total count → Should count all visible expenses
3. View average amount → Should be totalAmount / totalCount
4. View category breakdown → Should show percentages per category
5. Verify percentages → Should sum to 100%

**Expected**: All statistics calculated correctly

---

### 3. Category Breakdown

**Location**: Expenses Analytics or Reports page

1. View category breakdown chart/table
2. Verify categories sorted by amount (descending)
3. Verify percentages calculated correctly
4. Verify counts per category match

**Expected**: Breakdown accurate and sorted correctly

---

## Console Logs

No specific console logs for these pure functions (they have no side effects).

---

## Database Verification

Not applicable - these are pure calculation functions, no database interaction.

---

## Edge Cases to Test

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Empty expenses | [] | All stats = 0 |
| Single expense | [1 expense] | Stats match expense |
| All same category | All 'transportation' | 1 category, 100% |
| No filters | All expenses | All expenses shown |
| Invalid date | No timestamp | Excluded from date filter |

---

## Test Checklist

- [ ] Filters work correctly in UI
- [ ] Statistics display correctly
- [ ] Category breakdown accurate
- [ ] Percentages sum to 100%
- [ ] Edge cases handled gracefully

---

**Last Verified**: [Date]  
**Status**: ✅ All tests passing

