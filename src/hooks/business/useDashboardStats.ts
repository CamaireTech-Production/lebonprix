import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Sale, Expense, Product, StockChange } from '../../types/models';
import {
  calculateDashboardProfit,
  calculateTotalProfit,
  calculateTotalExpenses,
  calculateTotalSalesAmount,
  calculateTrendData
} from '@utils/calculations/financialCalculations';
import { getPeriodStartDate } from '@utils/calculations/profitPeriodUtils';
import { getPeriodLabel } from '@utils/dashboard/periodUtils';
import type { DateRange } from '@utils/dashboard/periodUtils';
import type { ProfitPeriodPreference } from '../../types/models';

interface UseDashboardStatsParams {
  filteredSales: Sale[];
  filteredExpenses: Expense[];
  previousPeriodSales: Sale[];
  products: Product[] | undefined;
  stockChanges: StockChange[] | undefined;
  expenses: Expense[] | undefined;
  dateRange: DateRange;
  profitPeriodPreference: ProfitPeriodPreference | null;
  salesLoading: boolean;
  expensesLoading: boolean;
  stockChangesLoading: boolean;
}

export interface StatCardData {
  title: string;
  value: string | number;
  iconType: 'dollar' | 'trending' | 'receipt' | 'users';
  type: 'products' | 'sales' | 'expenses' | 'profit' | 'orders' | 'delivery' | 'solde';
  loading?: boolean;
  trend?: { value: number; isPositive: boolean };
  trendData?: number[];
  periodLabel?: string;
}

/**
 * Hook to calculate dashboard statistics and stat cards
 */
export const useDashboardStats = ({
  filteredSales,
  filteredExpenses,
  previousPeriodSales,
  products,
  stockChanges,
  expenses,
  dateRange,
  profitPeriodPreference,
  salesLoading,
  expensesLoading,
  stockChangesLoading
}: UseDashboardStatsParams): { statCards: StatCardData[] } => {
  const { t } = useTranslation();

  // Calculate profit
  const customDate = profitPeriodPreference?.periodStartDate 
    ? new Date((profitPeriodPreference.periodStartDate as { seconds: number }).seconds * 1000)
    : null;
  
  const actualStartDate = profitPeriodPreference?.periodType
    ? getPeriodStartDate(profitPeriodPreference.periodType, customDate)
    : null;

  const profit = actualStartDate
    ? calculateDashboardProfit(
        filteredSales,
        products || [],
        (stockChanges || []) as StockChange[],
        actualStartDate,
        dateRange.from
      )
    : calculateTotalProfit(
        filteredSales,
        products || [],
        (stockChanges || []) as StockChange[]
      );

  // Calculate expenses
  const totalExpenses = calculateTotalExpenses(filteredExpenses, []);

  // Calculate sales amount
  const totalSalesAmount = calculateTotalSalesAmount(filteredSales);

  // Calculate unique clients count
  const uniqueClientsCount = useMemo(() => {
    const clientPhones = new Set<string>();
    filteredSales.forEach(sale => {
      const phone = sale.customerInfo?.phone;
      if (phone) {
        clientPhones.add(phone);
      }
    });
    return clientPhones.size;
  }, [filteredSales]);

  // Calculate previous period unique clients for trend
  const previousPeriodClients = useMemo(() => {
    const clientPhones = new Set<string>();
    previousPeriodSales.forEach(sale => {
      const phone = sale.customerInfo?.phone;
      if (phone) {
        clientPhones.add(phone);
      }
    });
    return clientPhones.size;
  }, [previousPeriodSales]);

  const clientsTrend = useMemo(() => {
    const trendValue = previousPeriodClients > 0 
      ? ((uniqueClientsCount - previousPeriodClients) / previousPeriodClients) * 100
      : uniqueClientsCount > 0 ? 100 : 0;
    return {
      value: parseFloat(Math.abs(trendValue).toFixed(1)),
      isPositive: trendValue >= 0
    };
  }, [uniqueClientsCount, previousPeriodClients]);

  // Calculate trend data for mini graphs (last 7 days)
  const salesTrendData = useMemo(() => 
    calculateTrendData(filteredSales, 7),
    [filteredSales]
  );

  // Calculate previous period dates
  const periodDuration = dateRange.to.getTime() - dateRange.from.getTime();
  const previousPeriodStart = new Date(dateRange.from.getTime() - periodDuration - 86400000);
  const previousPeriodEnd = new Date(dateRange.from.getTime() - 86400000);

  // Calculate period label
  const periodLabel = getPeriodLabel(dateRange, t);

  // Build stat cards
  const statCards: StatCardData[] = useMemo(() => [
    { 
      title: t('dashboard.stats.totalSalesAmount', { defaultValue: 'Ventes totales' }), 
      value: `${totalSalesAmount.toLocaleString()} FCFA`, 
      iconType: 'dollar', 
      type: 'sales',
      loading: salesLoading,
      trend: (() => {
        const previousSalesAmount = calculateTotalSalesAmount(previousPeriodSales);
        const trendValue = previousSalesAmount > 0 
          ? ((totalSalesAmount - previousSalesAmount) / previousSalesAmount) * 100
          : totalSalesAmount > 0 ? 100 : 0;
        return {
          value: parseFloat(Math.abs(trendValue).toFixed(1)),
          isPositive: trendValue >= 0
        };
      })(),
      trendData: salesTrendData,
      periodLabel
    },
    { 
      title: t('dashboard.stats.profit', { defaultValue: 'Profit' }), 
      value: `${profit.toLocaleString()} FCFA`, 
      iconType: 'trending', 
      type: 'profit',
      loading: salesLoading || stockChangesLoading,
      trend: (() => {
        const previousProfit = actualStartDate
          ? calculateDashboardProfit(
              previousPeriodSales,
              products || [],
              (stockChanges || []) as StockChange[],
              actualStartDate,
              previousPeriodStart
            )
          : calculateTotalProfit(
              previousPeriodSales,
              products || [],
              (stockChanges || []) as StockChange[]
            );
        const trendValue = previousProfit > 0 
          ? ((profit - previousProfit) / previousProfit) * 100
          : profit > 0 ? 100 : 0;
        return {
          value: parseFloat(Math.abs(trendValue).toFixed(1)),
          isPositive: trendValue >= 0
        };
      })(),
      trendData: salesTrendData,
      periodLabel
    },
    { 
      title: t('dashboard.stats.totalExpenses', { defaultValue: 'Dépenses totales' }), 
      value: `${totalExpenses.toLocaleString()} FCFA`, 
      iconType: 'receipt', 
      type: 'expenses',
      loading: expensesLoading,
      trend: (() => {
        const previousExpenses = (expenses || []).filter(expense => {
          if (expense.isAvailable === false) return false;
          if (!expense.createdAt?.seconds) return false;
          const expenseDate = new Date(expense.createdAt.seconds * 1000);
          return expenseDate >= previousPeriodStart && expenseDate <= previousPeriodEnd;
        });
        const previousExpensesAmount = calculateTotalExpenses(previousExpenses, []);
        const trendValue = previousExpensesAmount > 0 
          ? ((totalExpenses - previousExpensesAmount) / previousExpensesAmount) * 100
          : totalExpenses > 0 ? 100 : 0;
        return {
          value: parseFloat(Math.abs(trendValue).toFixed(1)),
          isPositive: trendValue <= 0 // Negative is good for expenses
        };
      })(),
      trendData: salesTrendData,
      periodLabel
    },
    { 
      title: t('dashboard.stats.clients', { defaultValue: 'Clients' }), 
      value: uniqueClientsCount, 
      iconType: 'users', 
      type: 'sales',
      loading: salesLoading,
      trend: clientsTrend,
      trendData: salesTrendData,
      periodLabel
    },
  ], [
    t,
    totalSalesAmount,
    profit,
    totalExpenses,
    uniqueClientsCount,
    salesLoading,
    expensesLoading,
    stockChangesLoading,
    previousPeriodSales,
    products,
    stockChanges,
    expenses,
    actualStartDate,
    previousPeriodStart,
    salesTrendData,
    clientsTrend,
    periodLabel
  ]);

  return { statCards };
};

