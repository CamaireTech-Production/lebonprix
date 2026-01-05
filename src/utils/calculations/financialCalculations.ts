/**
 * Financial Calculations Utilities
 * 
 * Pure functions for calculating financial metrics.
 * Extracted from Finance.tsx, Dashboard.tsx, useFinancialData.ts, and Suppliers.tsx
 * to improve testability and reusability.
 */

import type { Sale, Product, Expense, FinanceEntry, StockChange } from '../../types/models';
import { getLatestCostPrice } from '@utils/business/productUtils';

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
    return sum + sale.products.reduce((productSum: number, product) => {
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
 * NOTE: supplier_debt and supplier_refund are excluded because they are now tracked
 * separately in the supplier_debts collection and do not affect the financial balance.
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
  // Sum of all non-debt entries (excludes supplier_debt and supplier_refund)
  const nonDebtEntries = financeEntries.filter(
    (entry) => 
      entry.type !== 'debt' && 
      entry.type !== 'refund' && 
      entry.type !== 'supplier_debt' &&  // Excluded: tracked in supplier_debts collection
      entry.type !== 'supplier_refund'   // Excluded: tracked in supplier_debts collection
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
 * Total = sum of (costPrice * remainingQuantity) for each batch
 * Uses batches as source of truth (product.stock is deprecated)
 * 
 * @param batches - Array of all stock batches (products and matieres)
 * @returns Total purchase price of stock
 */
export const calculateTotalPurchasePrice = (
  batches: import('../types/models').StockBatch[]
): number => {
  return batches.reduce((sum, batch) => {
    if (batch.type === 'product' && batch.remainingQuantity > 0) {
      return sum + (batch.costPrice * batch.remainingQuantity);
    }
    return sum;
  }, 0);
};

/**
 * @deprecated Use calculateTotalPurchasePrice(batches) instead
 * Legacy function that uses product.stock (deprecated)
 */
export const calculateTotalPurchasePriceLegacy = (
  products: Product[],
  stockChanges: StockChange[]
): number => {
  return products.reduce((sum, product) => {
    const safeStockChanges = Array.isArray(stockChanges) ? stockChanges : [];
    const costPrice = getLatestCostPrice(product.id, safeStockChanges);
    
    if (costPrice === undefined) return sum;
    
    // Use 0 as stock since product.stock is deprecated
    return sum;
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
    (sum, sale) => sum + sale.products.reduce((pSum: number, p) => pSum + p.quantity, 0),
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
 * Total debt = sum of (debt amount - linked refund amounts) for all customer debts
 * 
 * NOTE: supplier_debt and supplier_refund are excluded because they are now tracked
 * separately in the supplier_debts collection.
 * 
 * @param debtEntries - Array of customer debt entries (excludes supplier_debt)
 * @param refundEntries - Array of customer refund entries (excludes supplier_refund)
 * @returns Total outstanding customer debt
 */
export const calculateTotalDebt = (
  debtEntries: FinanceEntry[],
  refundEntries: FinanceEntry[]
): number => {
  // Filter out supplier debts/refunds if any are passed in
  const customerDebts = debtEntries.filter(d => d.type === 'debt');
  const customerRefunds = refundEntries.filter(r => r.type === 'refund');
  
  return customerDebts.reduce((sum, debt) => {
    const linkedRefunds = customerRefunds.filter(
      refund => refund.refundedDebtId && String(refund.refundedDebtId) === String(debt.id)
    );
    const refundedAmount = linkedRefunds.reduce((s, r) => s + r.amount, 0);
    return sum + Math.max(0, debt.amount - refundedAmount);
  }, 0);
};

/**
 * Calculate dashboard profit with optional period start date
 * 
 * This function is used exclusively by the Dashboard to calculate profit
 * starting from a specific period start date. It respects both the period
 * start date and the user's selected date range filter.
 * 
 * @param sales - Array of sales (already filtered by date range)
 * @param products - Array of products
 * @param stockChanges - Array of stock changes
 * @param periodStartDate - Optional start date for period calculation (null = all-time)
 * @param dateRangeFrom - Start of user's selected date range
 * @returns Total profit for the effective period
 */
export const calculateDashboardProfit = (
  sales: Sale[],
  products: Product[],
  stockChanges: StockChange[],
  periodStartDate: Date | null,
  dateRangeFrom: Date
): number => {
  // Determine effective start date (latest of periodStartDate or dateRangeFrom)
  const effectiveStartDate = periodStartDate 
    ? new Date(Math.max(periodStartDate.getTime(), dateRangeFrom.getTime()))
    : dateRangeFrom;
  
  // Filter sales by effective start date
  const periodSales = sales.filter(sale => {
    if (!sale.createdAt?.seconds) return false;
    const saleDate = new Date(sale.createdAt.seconds * 1000);
    return saleDate >= effectiveStartDate;
  });
  
  // Use existing calculateTotalProfit function for consistency
  return calculateTotalProfit(periodSales, products, stockChanges);
};

/**
 * Calculate new orders count and trend
 * 
 * @param currentPeriodSales - Sales in current period
 * @param previousPeriodSales - Sales in previous period
 * @returns Object with count and percentage change
 */
export const calculateNewOrders = (
  currentPeriodSales: Sale[],
  previousPeriodSales: Sale[]
): { count: number; trend: number } => {
  const currentCount = currentPeriodSales.length;
  const previousCount = previousPeriodSales.length;
  const trend = previousCount > 0 
    ? ((currentCount - previousCount) / previousCount) * 100 
    : currentCount > 0 ? 100 : 0;
  
  return { count: currentCount, trend };
};

/**
 * Calculate new clients count and trend
 * 
 * @param currentPeriodSales - Sales in current period
 * @param previousPeriodSales - Sales in previous period
 * @returns Object with count and percentage change
 */
export const calculateNewClients = (
  currentPeriodSales: Sale[],
  previousPeriodSales: Sale[]
): { count: number; trend: number } => {
  // Get unique customers by phone number
  const currentClients = new Set(
    currentPeriodSales
      .map(sale => sale.customerInfo?.phone)
      .filter(Boolean) as string[]
  );
  const previousClients = new Set(
    previousPeriodSales
      .map(sale => sale.customerInfo?.phone)
      .filter(Boolean) as string[]
  );
  
  // New clients are those in current period but not in previous
  const newClientsSet = new Set(
    Array.from(currentClients).filter(phone => !previousClients.has(phone))
  );
  
  const currentCount = newClientsSet.size;
  const previousCount = previousClients.size;
  const trend = previousCount > 0 
    ? ((currentCount - previousCount) / previousCount) * 100 
    : currentCount > 0 ? 100 : 0;
  
  return { count: currentCount, trend };
};

/**
 * Calculate sales by store/location
 * 
 * @param sales - Array of sales
 * @returns Array of { store: string; amount: number; count: number }
 */
export const calculateSalesByStore = (
  sales: Sale[]
): Array<{ store: string; amount: number; count: number }> => {
  const storeMap: Record<string, { amount: number; count: number }> = {};
  
  sales.forEach(sale => {
    // Use location from customerInfo or default to "Boutique Principale"
    const store = sale.customerInfo?.quarter || 'Boutique Principale';
    
    if (!storeMap[store]) {
      storeMap[store] = { amount: 0, count: 0 };
    }
    
    storeMap[store].amount += sale.totalAmount;
    storeMap[store].count += 1;
  });
  
  return Object.entries(storeMap)
    .map(([store, data]) => ({ store, ...data }))
    .sort((a, b) => b.amount - a.amount);
};

/**
 * Calculate sales by customer source
 * 
 * @param sales - Array of sales
 * @param sources - Array of customer sources (for mapping IDs to names)
 * @returns Array of { source: string; amount: number; count: number }
 */
export const calculateSalesBySource = (
  sales: Sale[],
  sources: Array<{ id: string; name: string }> = []
): Array<{ source: string; amount: number; count: number }> => {
  const sourceMap: Record<string, { amount: number; count: number }> = {};
  
  sales.forEach(sale => {
    const sourceId = sale.customerSourceId || 'OTHER';
    const sourceName = sources.find(s => s.id === sourceId)?.name || sourceId;
    
    if (!sourceMap[sourceName]) {
      sourceMap[sourceName] = { amount: 0, count: 0 };
    }
    
    sourceMap[sourceName].amount += sale.totalAmount;
    sourceMap[sourceName].count += 1;
  });
  
  return Object.entries(sourceMap)
    .map(([source, data]) => ({ source, ...data }))
    .sort((a, b) => b.amount - a.amount);
};

/**
 * Calculate trend data for mini line graph
 * 
 * @param sales - Array of sales
 * @param periodDays - Number of days to show in trend
 * @returns Array of daily values for the trend line
 */
export const calculateTrendData = (
  sales: Sale[],
  periodDays: number = 7
): number[] => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - periodDays);
  startDate.setHours(0, 0, 0, 0);
  
  const dailyData: number[] = [];
  
  for (let i = 0; i < periodDays; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    const daySales = sales.filter(sale => {
      if (!sale.createdAt?.seconds) return false;
      const saleDate = new Date(sale.createdAt.seconds * 1000);
      return saleDate >= date && saleDate < new Date(date.getTime() + 24 * 60 * 60 * 1000);
    });
    
    const dayTotal = daySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    dailyData.push(dayTotal);
  }
  
  return dailyData;
};

/**
 * Calculate sales by product category
 * 
 * @param sales - Array of sales
 * @param products - Array of products (to get category information)
 * @returns Array of { category: string; amount: number; count: number }
 */
export const calculateSalesByCategory = (
  sales: Sale[],
  products: Product[]
): Array<{ category: string; amount: number; count: number }> => {
  const categoryMap: Record<string, { amount: number; count: number }> = {};
  
  sales.forEach(sale => {
    sale.products.forEach(product => {
      const productData = products.find(p => p.id === product.productId);
      const category = productData?.category || 'Non catégorisé';
      
      if (!categoryMap[category]) {
        categoryMap[category] = { amount: 0, count: 0 };
      }
      
      const productAmount = (product.negotiatedPrice || product.basePrice) * product.quantity;
      categoryMap[category].amount += productAmount;
      categoryMap[category].count += product.quantity;
    });
  });
  
  return Object.entries(categoryMap)
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.amount - a.amount);
};

/**
 * Calculate expenses by category
 * 
 * @param expenses - Array of expenses
 * @returns Array of { category: string; amount: number; count: number }
 */
export const calculateExpensesByCategory = (
  expenses: Expense[]
): Array<{ category: string; amount: number; count: number }> => {
  const categoryMap: Record<string, { amount: number; count: number }> = {};
  
  expenses.forEach(expense => {
    const category = expense.category || 'Non catégorisé';
    
    if (!categoryMap[category]) {
      categoryMap[category] = { amount: 0, count: 0 };
    }
    
    categoryMap[category].amount += expense.amount;
    categoryMap[category].count += 1;
  });
  
  return Object.entries(categoryMap)
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.amount - a.amount);
};

/**
 * Calculate sales by payment status
 * 
 * @param sales - Array of sales
 * @returns Array of { status: string; amount: number; count: number }
 */
export const calculateSalesByPaymentStatus = (
  sales: Sale[]
): Array<{ status: string; amount: number; count: number }> => {
  const statusMap: Record<string, { amount: number; count: number }> = {};
  
  sales.forEach(sale => {
    const status = sale.paymentStatus || 'pending';
    const statusLabel = status === 'paid' ? 'Payé' : status === 'pending' ? 'En attente' : 'Annulé';
    
    if (!statusMap[statusLabel]) {
      statusMap[statusLabel] = { amount: 0, count: 0 };
    }
    
    statusMap[statusLabel].amount += sale.totalAmount;
    statusMap[statusLabel].count += 1;
  });
  
  return Object.entries(statusMap)
    .map(([status, data]) => ({ status, ...data }))
    .sort((a, b) => b.amount - a.amount);
};

