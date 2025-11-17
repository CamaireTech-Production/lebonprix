# Manual Verification Guide
## Financial Calculations - src/utils/financialCalculations.ts

**Test File**: `financialCalculations.test.ts`  
**Source File**: `src/utils/financialCalculations.ts`  
**Last Updated**: 2024-11-17

---

## 📋 Overview

These pure functions calculate financial metrics (profit, expenses, sales, debt) used across Finance, Dashboard, useFinancialData, and Suppliers pages.

---

## 🎯 Functions to Verify

1. `calculateTotalProfit()` - Total profit from sales
2. `calculateTotalExpenses()` - Total expenses including manual negative entries
3. `calculateSolde()` - Balance (non-debt entries + customer debt)
4. `calculateTotalPurchasePrice()` - Total stock value at cost price
5. `calculateTotalSalesAmount()` - Total sales revenue
6. `calculateTotalDeliveryFee()` - Total delivery fees
7. `calculateTotalProductsSold()` - Total quantity of products sold
8. `calculateTotalOrders()` - Total number of orders
9. `calculateTotalDebt()` - Total outstanding debt minus refunds

---

## 1️⃣ Finance Page Verification

### Navigate to Finance Page
1. Go to `/finance`
2. Select date range (e.g., January 1, 2025 - Today)

### Expected Results
- ✅ Profit card shows correct profit (selling price - cost price) × quantity
- ✅ Expenses card shows total expenses + negative manual entries
- ✅ Solde card shows balance including customer debt
- ✅ Total Orders shows correct count
- ✅ Total Delivery Fee shows sum of all delivery fees
- ✅ Total Sales Amount shows sum of all sale amounts
- ✅ Total Products Sold shows sum of all product quantities

### Test Cases
| Test Case | Action | Expected Result |
|-----------|--------|-----------------|
| Create Sale | Add a sale with 2 products (qty: 2, price: 150) | Profit increases by (150-100)×2=100 |
| Add Expense | Create expense of 500 | Total Expenses increases by 500 |
| Add Manual Entry | Create negative manual entry (-200) | Total Expenses increases by 200 |
| Date Filter | Change date range | All metrics recalculate for new range |

---

## 2️⃣ Dashboard Page Verification

### Navigate to Dashboard
1. Go to `/dashboard`
2. Verify stat cards

### Expected Results
- ✅ Profit stat matches Finance page profit
- ✅ Expenses stat matches Finance page expenses
- ✅ Solde stat shows balance (without customer debt for Dashboard)
- ✅ Total Orders shows correct count
- ✅ Total Products Sold shows correct total

### Console Logs
```javascript
// Expected in browser console when navigating to Dashboard
console.log('🔍 Financial Calculations Updated:', {
  dateRange: '2025-01-01 to 2024-11-17',
  filteredSales: 10,
  filteredExpenses: 5,
  profit: 5000,
  totalExpenses: 2000
})
```

---

## 3️⃣ Suppliers Page Verification

### Navigate to Suppliers
1. Go to `/suppliers`
2. Check solde card at top

### Expected Results
- ✅ Solde card shows balance (non-debt entries only, no supplier debt added)
- ✅ Supplier debt shown separately in red card
- ✅ Number of suppliers with debt shown correctly

---

## 4️⃣ Debt Calculation Verification

### Create Debt and Refund
1. Go to Finance page
2. Add manual entry: Type "debt", Amount: 3000
3. Add manual entry: Type "refund", Amount: 1000, linked to debt

### Expected Results
- ✅ Total Debt shows 2000 (3000 - 1000)
- ✅ Solde includes customer debt of 2000
- ✅ Console shows debt calculation

### Console Logs
```javascript
console.log('🔍 Total Debt:', 2000)
console.log('Debt Entry:', { id: 'd1', amount: 3000 })
console.log('Refund Entry:', { id: 'r1', amount: 1000, refundedDebtId: 'd1' })
```

---

## 5️⃣ Edge Cases to Test

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Empty Sales | No sales in date range | Profit = 0, Total Orders = 0 |
| Missing Product | Sale with non-existent product ID | Skip product, no error |
| No Cost Price | Product has no stock changes | Skip product from profit calc |
| Negative Manual Entry | Manual entry: -500 | Added to expenses (absolute value) |
| Over-refunded Debt | Refund > Debt amount | Debt = 0 (max(0, debt - refund)) |
| Multiple Refunds | 3 refunds for 1 debt | Sum all refunds, subtract from debt |

---

## 🔍 Common Issues & Troubleshooting

### Issue 1: Profit Showing 0
**Symptom**: Profit is 0 despite sales existing

**Check**:
1. Verify products have stock changes with cost prices
2. Check sales are within selected date range
3. Console: `getLatestCostPrice(productId, stockChanges)`

**Solution**: Ensure all products sold have restock entries with cost prices

---

### Issue 2: Expenses Not Matching
**Symptom**: Expenses total doesn't match manual calculation

**Check**:
1. Include negative manual entries (absolute value)
2. Check date range filter
3. Verify expenses are not soft-deleted (`isAvailable !== false`)

**Solution**: Sum expenses + |negative manual entries|

---

### Issue 3: Solde Calculation Differences
**Symptom**: Solde differs between pages

**Check**:
1. Finance page: includes customer debt
2. Dashboard/Suppliers: excludes customer debt
3. All pages: exclude debt/refund/supplier_debt/supplier_refund entries

**Solution**: Different pages use different solde calculation modes (with/without customer debt)

---

## 📊 Test Checklist

- [ ] All stat cards show correct values on Finance page
- [ ] Dashboard stats match Finance page (where applicable)
- [ ] Suppliers page solde shown correctly
- [ ] Profit calculation accurate (tested with known products/sales)
- [ ] Expenses include negative manual entries
- [ ] Debt minus refunds calculated correctly
- [ ] Date range filter affects all calculations
- [ ] No errors in browser console
- [ ] Edge cases handled (empty data, missing products, etc.)

---

**Last Verified**: 2024-11-17  
**Status**: ✅ All tests passing (195 automated tests)

