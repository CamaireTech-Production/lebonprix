// src/hooks/useFinancialData.ts
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFinanceEntries, useSales, useExpenses, useProducts, useStockChanges } from './useFirestore';
import FinanceEntryTypesManager from '../services/storage/FinanceEntryTypesManager';
import BackgroundSyncService from '../services/backgroundSync';
import type { FinanceEntryType } from '../types/models';

interface UseFinancialDataReturn {
  // Real-time financial calculations (always fresh from Firebase)
  financialCalculations: {
    loading: boolean;
    profit: number;
    totalExpenses: number;
    totalSalesAmount: number;
    totalOrders: number;
    totalDeliveryFee: number;
    totalProductsSold: number;
    totalPurchasePrice: number;
    solde: number;
    totalDebt: number;
  };
  
  // Static reference data (cached in localStorage)
  referenceData: {
    loading: boolean;
    syncing: boolean;
    entryTypes: FinanceEntryType[];
    categories: any[];
  };
  
  // Force refresh functions
  refreshCalculations: () => void;
  refreshReferenceData: () => void;
}

export const useFinancialData = (): UseFinancialDataReturn => {
  const { user } = useAuth();
  
  // Real-time data hooks (always fresh)
  const { entries: financeEntries, loading: financeLoading } = useFinanceEntries();
  const { sales, loading: salesLoading } = useSales();
  const { expenses, loading: expensesLoading } = useExpenses();
  const { products, loading: productsLoading } = useProducts();
  const { stockChanges, loading: stockChangesLoading } = useStockChanges();
  
  // Reference data state
  const [entryTypes, setEntryTypes] = useState<FinanceEntryType[]>([]);
  const [referenceDataLoading, setReferenceDataLoading] = useState(false);
  const [referenceDataSyncing, setReferenceDataSyncing] = useState(false);
  
  // Calculate loading state for financial calculations
  const calculationsLoading = financeLoading || salesLoading || expensesLoading || productsLoading || stockChangesLoading;
  
  // Real-time financial calculations
  const financialCalculations = {
    loading: calculationsLoading,
    profit: 0,
    totalExpenses: 0,
    totalSalesAmount: 0,
    totalOrders: 0,
    totalDeliveryFee: 0,
    totalProductsSold: 0,
    totalPurchasePrice: 0,
    solde: 0,
    totalDebt: 0
  };
  
  // Calculate financial metrics when data is available
  useEffect(() => {
    if (calculationsLoading) return;
    
    // Calculate profit (gross profit: selling price - purchase price) * quantity for all sales
    const profit = sales.reduce((sum, sale) => {
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
    
    // Calculate total expenses
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0) + 
      financeEntries.filter(e => e.amount < 0).reduce((sum, e) => sum + Math.abs(e.amount), 0);
    
    // Total orders
    const totalOrders = sales.length;
    
    // Total delivery fee (from sales)
    const totalDeliveryFee = sales.reduce((sum, sale) => sum + (sale.deliveryFee || 0), 0);
    
    // Total sales amount
    const totalSalesAmount = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    
    // Total products sold (sum of all product quantities in sales)
    const totalProductsSold = sales.reduce((sum, sale) => sum + sale.products.reduce((pSum, p) => pSum + p.quantity, 0), 0);
    
    // Calculate total purchase price for all products in stock
    const totalPurchasePrice = products.reduce((sum, product) => {
      const safeStockChanges = Array.isArray(stockChanges) ? stockChanges : [];
      const costPrice = getLatestCostPrice(product.id, safeStockChanges);
      if (costPrice === undefined) return sum;
      return sum + (costPrice * product.stock);
    }, 0);
    
    // Calculate solde: sum of all non-debt/refund entries
    const nonDebtEntries = financeEntries.filter(
      (entry) => entry.type !== 'debt' && entry.type !== 'refund' && entry.type !== 'supplier_debt' && entry.type !== 'supplier_refund'
    );
    const solde = nonDebtEntries.reduce((sum, entry) => sum + entry.amount, 0);
    
    // Calculate total debt
    const debtEntries = financeEntries.filter(entry => entry.type === 'debt' || entry.type === 'supplier_debt');
    const refundEntries = financeEntries.filter(entry => entry.type === 'refund' || entry.type === 'supplier_refund');
    const totalDebt = debtEntries.reduce((sum, debt) => {
      const linkedRefunds = refundEntries.filter(refund => 
        refund.refundedDebtId && String(refund.refundedDebtId) === String(debt.id)
      );
      const refundedAmount = linkedRefunds.reduce((s, r) => s + r.amount, 0);
      return sum + Math.max(0, debt.amount - refundedAmount);
    }, 0);
    
    // Update calculations
    Object.assign(financialCalculations, {
      loading: false,
      profit,
      totalExpenses,
      totalSalesAmount,
      totalOrders,
      totalDeliveryFee,
      totalProductsSold,
      totalPurchasePrice,
      solde,
      totalDebt
    });
  }, [sales, expenses, products, stockChanges, financeEntries, calculationsLoading]);
  
  // Load reference data from localStorage with background sync
  useEffect(() => {
    if (!user?.uid) return;
    
    // 1. Check localStorage FIRST - instant display if data exists
    const localEntryTypes = FinanceEntryTypesManager.load(user.uid);
    if (localEntryTypes && localEntryTypes.length > 0) {
      setEntryTypes(localEntryTypes);
      setReferenceDataLoading(false);
      setReferenceDataSyncing(true);
      console.log('🚀 Finance entry types loaded instantly from localStorage');
      
      // Start background sync
      BackgroundSyncService.syncFinanceEntryTypes(user.uid, (freshEntryTypes) => {
        setEntryTypes(freshEntryTypes);
        setReferenceDataSyncing(false);
        console.log('🔄 Finance entry types updated from background sync');
      });
    } else {
      setReferenceDataLoading(true);
      console.log('📡 No cached finance entry types, loading from Firebase...');
      
      // Start background sync
      BackgroundSyncService.syncFinanceEntryTypes(user.uid, (freshEntryTypes) => {
        setEntryTypes(freshEntryTypes);
        setReferenceDataLoading(false);
        setReferenceDataSyncing(false);
        console.log('🔄 Finance entry types loaded from background sync');
      });
    }
  }, [user?.uid]);
  
  // Force refresh functions
  const refreshCalculations = () => {
    // Financial calculations are always real-time, no refresh needed
    console.log('🔄 Financial calculations are always real-time');
  };
  
  const refreshReferenceData = () => {
    if (!user?.uid) return;
    BackgroundSyncService.forceSyncFinanceEntryTypes(user.uid, (freshEntryTypes) => {
      setEntryTypes(freshEntryTypes);
    });
  };
  
  return {
    financialCalculations,
    referenceData: {
      loading: referenceDataLoading,
      syncing: referenceDataSyncing,
      entryTypes,
      categories: [] // TODO: Implement categories if needed
    },
    refreshCalculations,
    refreshReferenceData
  };
};

// Helper function to get latest cost price (imported from utils)
const getLatestCostPrice = (productId: string, stockChanges: any[]): number | undefined => {
  const productStockChanges = stockChanges
    .filter(change => change.productId === productId && change.costPrice !== undefined)
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  
  return productStockChanges.length > 0 ? productStockChanges[0].costPrice : undefined;
};

export default useFinancialData;
