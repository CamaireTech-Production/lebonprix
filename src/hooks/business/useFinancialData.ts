// src/hooks/useFinancialData.ts
import { useState, useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { useFinanceEntries, useSales, useExpenses, useProducts, useStockChanges } from '@hooks/data/useFirestore';
import FinanceEntryTypesManager from '@services/storage/FinanceEntryTypesManager';
import BackgroundSyncService from '@services/utilities/backgroundSync';
import {
  calculateTotalProfit,
  calculateTotalExpenses,
  calculateSolde,
  calculateTotalPurchasePrice,
  calculateTotalSalesAmount,
  calculateTotalDeliveryFee,
  calculateTotalProductsSold,
  calculateTotalOrders,
  calculateTotalDebt
} from '@utils/calculations/financialCalculations';
import type { FinanceEntryType } from '../../types/models';

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

export const useFinancialData = (dateRange: { from: Date; to: Date } = { from: new Date(2025, 0, 1), to: new Date() }): UseFinancialDataReturn => {
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
    
    // Filter data by date range
    const filteredSales = sales.filter(sale => {
      if (!sale.createdAt?.seconds) return false;
      const saleDate = new Date(sale.createdAt.seconds * 1000);
      return saleDate >= dateRange.from && saleDate <= dateRange.to;
    });
    
    const filteredExpenses = expenses.filter(exp => {
      if (exp.isAvailable === false) return false;
      if (!exp.createdAt?.seconds) return false;
      const expDate = new Date(exp.createdAt.seconds * 1000);
      return expDate >= dateRange.from && expDate <= dateRange.to;
    });
    
    const filteredFinanceEntries = financeEntries.filter(entry => 
      !entry.isDeleted && entry.createdAt?.seconds && 
      new Date(entry.createdAt.seconds * 1000) >= dateRange.from && 
      new Date(entry.createdAt.seconds * 1000) <= dateRange.to
    );
    
    // Calculate financial metrics using extracted functions
    const profit = calculateTotalProfit(filteredSales, products, stockChanges);
    
    // Calculate total expenses (filtered expenses + manual negative entries)
    const filteredManualEntries = filteredFinanceEntries.filter(entry => entry.sourceType === 'manual');
    const totalExpenses = calculateTotalExpenses(filteredExpenses, filteredManualEntries);
    
    // Total orders (filtered)
    const totalOrders = calculateTotalOrders(filteredSales);
    
    // Total delivery fee (from filtered sales)
    const totalDeliveryFee = calculateTotalDeliveryFee(filteredSales);
    
    // Total sales amount (filtered)
    const totalSalesAmount = calculateTotalSalesAmount(filteredSales);
    
    // Total products sold (sum of all product quantities in filtered sales)
    const totalProductsSold = calculateTotalProductsSold(filteredSales);
    
    // Calculate total purchase price for all products in stock (this is not date-filtered as it's current stock)
    const totalPurchasePrice = calculateTotalPurchasePrice(products, stockChanges);
    
    // Calculate solde: sum of all non-debt/refund entries (filtered by date)
    // Note: This hook only calculates solde without customer debt, so we pass empty arrays
    const solde = calculateSolde(filteredFinanceEntries, [], []);
    
    // Calculate total debt (all debt entries, not date-filtered as debt is ongoing)
    const debtEntries = financeEntries.filter(entry => entry.type === 'debt' || entry.type === 'supplier_debt');
    const refundEntries = financeEntries.filter(entry => entry.type === 'refund' || entry.type === 'supplier_refund');
    const totalDebt = calculateTotalDebt(debtEntries, refundEntries);
    
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
    
    // Debug logging
    console.log('🔍 Financial Calculations Updated:', {
      dateRange: `${dateRange.from.toISOString().split('T')[0]} to ${dateRange.to.toISOString().split('T')[0]}`,
      filteredSales: filteredSales.length,
      filteredExpenses: filteredExpenses.length,
      filteredFinanceEntries: filteredFinanceEntries.length,
      profit,
      totalExpenses,
      totalSalesAmount,
      totalOrders,
      solde,
      totalDebt
    });
  }, [sales, expenses, products, stockChanges, financeEntries, calculationsLoading, dateRange]);
  
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

export default useFinancialData;
