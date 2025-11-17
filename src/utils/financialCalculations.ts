/**
 * Financial Calculations Utilities
 * 
 * Pure functions for calculating financial metrics.
 * Extracted from Finance.tsx, Dashboard.tsx, useFinancialData.ts, and Suppliers.tsx
 * to improve testability and reusability.
 */

import type { Sale, Product, Expense, FinanceEntry, StockChange } from '../types/models';
import { getLatestCostPrice } from './productUtils';

/**
 * Calculate total profit from sales
 * 
 * Profit = (sellingPrice - costPrice) * quantity for each product in each sale
 * 
 * @param sales - Array of sales to calculate profit from
 * @param products - Array of all products (to get product data)
 * @param stockChanges - Array of stock changes (to get cost prices)
 * @returns Total profit amount
 */
export const calculateTotalProfit = (
  sales: Sale[],
  products: Product[],
  stockChanges: StockChange[]
): number => {
  return sales.reduce((sum, sale) => {
    return sum + sale.products.reduce((productSum, product) => {
      const productData = products.find(p => p.id === product.productId);
      if (!productData) return productSum;
      
      const sellingPrice = product.negotiatedPrice || product.basePrice;
      const safeStockChanges = Array.isArray(stockChanges) ? stockChanges : [];
      const costPrice = getLatestCostPrice(productData.id, safeStockChanges);
      
      if (costPrice === undefined) return productSum;
      
      return productSum + (sellingPrice - costPrice) * product.quantity;
    }, 0);
  }, 0);
};

/**
 * Calculate total expenses
 * 
 * Total = sum of all expenses + absolute value of negative manual entries
 * 
 * @param expenses - Array of expense entries
 * @param manualEntries - Array of manual finance entries
 * @returns Total expenses amount
 */
export const calculateTotalExpenses = (
  expenses: Expense[],
  manualEntries: FinanceEntry[]
): number => {
  const expensesSum = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const negativeManualSum = manualEntries
    .filter(e => e.amount < 0)
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  
  return expensesSum + negativeManualSum;
};

/**
 * Calculate solde (balance)
 * 
 * Solde = sum of all non-debt/refund/supplier_debt/supplier_refund entries + customer debt only
 * 
 * @param financeEntries - Array of all finance entries
 * @param debtEntries - Array of debt entries (for customer debt calculation)
 * @param refundEntries - Array of refund entries (for customer debt calculation)
 * @returns Balance amount
 */
export const calculateSolde = (
  financeEntries: FinanceEntry[],
  debtEntries: FinanceEntry[],
  refundEntries: FinanceEntry[]
): number => {
  // Sum of all non-debt entries
  const nonDebtEntries = financeEntries.filter(
    (entry) => 
      entry.type !== 'debt' && 
      entry.type !== 'refund' && 
      entry.type !== 'supplier_debt' && 
      entry.type !== 'supplier_refund'
  );
  const nonDebtSum = nonDebtEntries.reduce((sum, entry) => sum + entry.amount, 0);
  
  // Calculate only customer debt (excluding supplier debt)
  const customerDebt = debtEntries
    .filter(debt => debt.type === 'debt') // Only customer debts, not supplier debts
    .reduce((sum, debt) => {
      const linkedRefunds = refundEntries.filter(
        (refund) => {
          const match = refund.refundedDebtId && String(refund.refundedDebtId) === String(debt.id);
          return match;
        }
      );
      const refundedAmount = linkedRefunds.reduce((s, r) => s + r.amount, 0);
      return sum + Math.max(0, debt.amount - refundedAmount);
    }, 0);
  
  return nonDebtSum + customerDebt;
};

/**
 * Calculate total purchase price of current stock
 * 
 * Total = sum of (costPrice * stock) for each product
 * 
 * @param products - Array of all products
 * @param stockChanges - Array of stock changes (to get cost prices)
 * @returns Total purchase price of stock
 */
export const calculateTotalPurchasePrice = (
  products: Product[],
  stockChanges: StockChange[]
): number => {
  return products.reduce((sum, product) => {
    const safeStockChanges = Array.isArray(stockChanges) ? stockChanges : [];
    const costPrice = getLatestCostPrice(product.id, safeStockChanges);
    
    if (costPrice === undefined) return sum;
    
    return sum + (costPrice * product.stock);
  }, 0);
};

/**
 * Calculate total sales amount
 * 
 * @param sales - Array of sales
 * @returns Total sales amount
 */
export const calculateTotalSalesAmount = (sales: Sale[]): number => {
  return sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
};

/**
 * Calculate total delivery fees
 * 
 * @param sales - Array of sales
 * @returns Total delivery fees
 */
export const calculateTotalDeliveryFee = (sales: Sale[]): number => {
  return sales.reduce((sum, sale) => sum + (sale.deliveryFee || 0), 0);
};

/**
 * Calculate total number of products sold
 * 
 * @param sales - Array of sales
 * @returns Total quantity of products sold
 */
export const calculateTotalProductsSold = (sales: Sale[]): number => {
  return sales.reduce(
    (sum, sale) => sum + sale.products.reduce((pSum, p) => pSum + p.quantity, 0),
    0
  );
};

/**
 * Calculate total number of orders
 * 
 * @param sales - Array of sales
 * @returns Total number of orders
 */
export const calculateTotalOrders = (sales: Sale[]): number => {
  return sales.length;
};

/**
 * Calculate total debt (debt minus refunds)
 * 
 * Total debt = sum of (debt amount - linked refund amounts) for all debts
 * 
 * @param debtEntries - Array of all debt entries (debt + supplier_debt)
 * @param refundEntries - Array of all refund entries (refund + supplier_refund)
 * @returns Total outstanding debt
 */
export const calculateTotalDebt = (
  debtEntries: FinanceEntry[],
  refundEntries: FinanceEntry[]
): number => {
  return debtEntries.reduce((sum, debt) => {
    const linkedRefunds = refundEntries.filter(
      refund => refund.refundedDebtId && String(refund.refundedDebtId) === String(debt.id)
    );
    const refundedAmount = linkedRefunds.reduce((s, r) => s + r.amount, 0);
    return sum + Math.max(0, debt.amount - refundedAmount);
  }, 0);
};

