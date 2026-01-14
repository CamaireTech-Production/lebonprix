import { useMemo, useState, useEffect, useCallback } from 'react';
import { Calendar, FileDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Card, Button, Input } from '@components/common';
import { Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { useProducts, useSales, useExpenses, useCategories } from '@hooks/data/useFirestore';
import { useCustomerSources } from '@hooks/business/useCustomerSources';
import type { Timestamp, Product, Sale, Expense } from '../../types/models';
import ComparisonIndicator from '../../components/reports/ComparisonIndicator';
import KPICard from '../../components/reports/KPICard';
import QuickReportsBar from '../../components/reports/QuickReportsBar';
import SavedReportsManager, { SavedReport } from '../../components/reports/SavedReportsManager';
import AllProductsSold from '../../components/reports/AllProductsSold';
import { useAuth } from '@contexts/AuthContext';
import { logWarning } from '@utils/core/logger';
import { formatPrice } from '@utils/formatting/formatPrice';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const Reports = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  
  // Calculate default weekly range
  const getDefaultWeeklyRange = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    const day = (today.getDay() + 6) % 7; // make Monday=0
    startOfWeek.setDate(today.getDate() - day);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return {
      start: startOfWeek.toISOString().slice(0, 10),
      end: endOfWeek.toISOString().slice(0, 10)
    };
  };

  const defaultRange = getDefaultWeeklyRange();
  
  // UI filters - now directly used for computations
  const [startDate, setStartDate] = useState<string>(defaultRange.start);
  const [endDate, setEndDate] = useState<string>(defaultRange.end);
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [period, setPeriod] = useState<'none' | 'today' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
  const [showTrend, setShowTrend] = useState(() => {
    const saved = localStorage.getItem('reports_showTrend');
    return saved === 'true';
  });
  
  const { sales } = useSales();
  const { expenses } = useExpenses();
  const { products } = useProducts();
  const { categories } = useCategories();
  const { sources } = useCustomerSources();
  const { company } = useAuth();

  const toDate = (ts?: Timestamp) => (ts?.seconds ? new Date(ts.seconds * 1000) : null);
  const start = useMemo(() => {
    const [year, month, day] = startDate.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }, [startDate]);
  const end = useMemo(() => {
    const [year, month, day] = endDate.split('-').map(Number);
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }, [endDate]);
  const inRange = useCallback((d: Date | null) => !!d && d >= start && d <= end, [start, end]);

  const productOptions = useMemo(() => {
    const opts = products.map(p => ({ value: p.id, label: p.name }));
    return [{ value: 'all', label: t('reports.filters.allProducts') }, ...opts];
  }, [products, t]);

  const toYMD = (d: Date) => d.toISOString().slice(0, 10);

  // Handle query parameter for period=today
  useEffect(() => {
    const periodParam = searchParams.get('period');
    if (periodParam === 'today') {
      const today = new Date();
      const todayStr = toYMD(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
      setPeriod('today');
    }
  }, [searchParams]);

  // Period helpers
  const startOfWeek = useCallback((d: Date) => {
    const date = new Date(d);
    const day = (date.getDay() + 6) % 7; // make Monday=0
    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const startOfMonth = useCallback((d: Date) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0), []);
  const startOfYear = useCallback((d: Date) => new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0), []);

  // Auto-update date ranges when period changes
  useEffect(() => {
    const today = new Date();
    
    if (period === 'today') {
      const todayStr = toYMD(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (period === 'daily') {
      const dayStr = toYMD(today);
      setStartDate(dayStr);
      setEndDate(dayStr);
    } else if (period === 'weekly') {
      const startW = startOfWeek(today);
      const endW = new Date(startW);
      endW.setDate(endW.getDate() + 6);
      setStartDate(toYMD(startW));
      setEndDate(toYMD(endW));
    } else if (period === 'monthly') {
      const startM = startOfMonth(today);
      const endM = new Date(startM.getFullYear(), startM.getMonth() + 1, 0);
      setStartDate(toYMD(startM));
      setEndDate(toYMD(endM));
    } else if (period === 'yearly') {
      const startY = startOfYear(today);
      const endY = new Date(startY.getFullYear(), 11, 31);
      setStartDate(toYMD(startY));
      setEndDate(toYMD(endY));
    }
    // For 'none' period, keep the current date range as is
  }, [period, startOfWeek, startOfMonth, startOfYear]);

  // Quick reports handler
  const handleQuickReport = (period: string) => {
    const today = new Date();
    let start: Date, end: Date;

    switch (period) {
      case 'thisWeek': {
        const day = (today.getDay() + 6) % 7;
        start = new Date(today);
        start.setDate(today.getDate() - day);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      }
      case 'lastWeek': {
        const day = (today.getDay() + 6) % 7;
        start = new Date(today);
        start.setDate(today.getDate() - day - 7);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      }
      case 'thisMonth': {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      }
      case 'lastMonth': {
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
        break;
      }
      case 'thisQuarter': {
        const quarter = Math.floor(today.getMonth() / 3);
        start = new Date(today.getFullYear(), quarter * 3, 1);
        end = new Date(today.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
        break;
      }
      case 'lastQuarter': {
        const quarter = Math.floor(today.getMonth() / 3);
        const lastQuarter = quarter === 0 ? 3 : quarter - 1;
        const year = quarter === 0 ? today.getFullYear() - 1 : today.getFullYear();
        start = new Date(year, lastQuarter * 3, 1);
        end = new Date(year, (lastQuarter + 1) * 3, 0, 23, 59, 59, 999);
        break;
      }
      case 'thisYear': {
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      }
      case 'lastYear': {
        start = new Date(today.getFullYear() - 1, 0, 1);
        end = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        break;
      }
      default:
        return;
    }

    setStartDate(toYMD(start));
    setEndDate(toYMD(end));
    
    // Set appropriate period
    if (period.includes('Week')) setPeriod('weekly');
    else if (period.includes('Month')) setPeriod('monthly');
    else if (period.includes('Quarter')) setPeriod('monthly');
    else if (period.includes('Year')) setPeriod('yearly');
  };

  // Load saved report handler
  const handleLoadReport = (report: SavedReport) => {
    setStartDate(report.startDate);
    setEndDate(report.endDate);
    setSelectedProduct(report.selectedProduct);
    setSelectedCategory(report.selectedCategory);
    setPeriod(report.period as any);
  };


  const filteredSales: Sale[] = useMemo(() => {
    let byDate = sales.filter(s => s.isAvailable !== false && inRange(toDate(s.createdAt)));
    
    // Filter by category if selected
    if (selectedCategory !== 'all') {
      byDate = byDate.filter(sale => 
        sale.products.some((sp: { productId: string }) => {
          const product = products.find(p => p.id === sp.productId);
          return product?.category === selectedCategory;
        })
      );
    }
    
    // Filter by product if selected
    if (selectedProduct !== 'all') {
      byDate = byDate.filter(sale => sale.products.some((sp: { productId: string }) => sp.productId === selectedProduct));
    }
    
    return byDate;
  }, [sales, inRange, selectedCategory, selectedProduct, products]);

  const filteredExpenses: Expense[] = useMemo(() => {
    return expenses.filter(e => e.isAvailable !== false && inRange(toDate(e.createdAt)));
  }, [expenses, inRange]);

  const formatKey = useCallback((d: Date) => {
    if (period === 'yearly') return String(d.getFullYear());
    if (period === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (period === 'weekly') {
      const weekStart = startOfWeek(d);
      const y = weekStart.getFullYear();
      const m = String(weekStart.getMonth() + 1).padStart(2, '0');
      const day = String(weekStart.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`; // week start date as key
    }
    // daily/today
    return d.toISOString().slice(0, 10);
  }, [period, startOfWeek]);

  const nextBucket = useCallback((d: Date) => {
    const nd = new Date(d);
    if (period === 'yearly') nd.setFullYear(nd.getFullYear() + 1);
    else if (period === 'monthly') nd.setMonth(nd.getMonth() + 1);
    else if (period === 'weekly') nd.setDate(nd.getDate() + 7);
    else nd.setDate(nd.getDate() + 1);
    return nd;
  }, [period]);

  const normalizeToBucketStart = useCallback((d: Date) => {
    if (period === 'yearly') return startOfYear(d);
    if (period === 'monthly') return startOfMonth(d);
    if (period === 'weekly') return startOfWeek(d);
    const dd = new Date(d); dd.setHours(0, 0, 0, 0); return dd;
  }, [period, startOfYear, startOfMonth, startOfWeek]);

  const dateKeys = useMemo(() => {
    if (start > end) {
      logWarning('Invalid date range: start date is after end date');
      return [];
    }
    const keys: string[] = [];
    let cur = normalizeToBucketStart(start);
    const endNorm = normalizeToBucketStart(end);
    while (cur <= endNorm) {
      keys.push(formatKey(cur));
      cur = nextBucket(cur);
    }
    return keys;
  }, [start, end, formatKey, nextBucket, normalizeToBucketStart]);

  const series = useMemo(() => {
    const salesByDay: Record<string, number> = Object.fromEntries(dateKeys.map(k => [k, 0]));
    const expensesByDay: Record<string, number> = Object.fromEntries(dateKeys.map(k => [k, 0]));
    const costOfGoodsSoldByDay: Record<string, number> = Object.fromEntries(dateKeys.map(k => [k, 0]));

    for (const s of filteredSales) {
      const d = toDate(s.createdAt);
      if (!d) continue;
      const key = formatKey(normalizeToBucketStart(d));
      if (key in salesByDay) {
        salesByDay[key] += s.totalAmount || 0;
        
        // Calculate cost of goods sold for this sale
        const costOfGoodsSold = s.products.reduce((sum: number, saleProduct: { costPrice?: number; quantity: number; productId: string }) => {
          // Use costPrice from saleProduct (historical price at time of sale)
          const costPrice = saleProduct.costPrice ?? 
            products.find(p => p.id === saleProduct.productId)?.costPrice ?? 0;
          return sum + (costPrice * saleProduct.quantity);
        }, 0);
        
        costOfGoodsSoldByDay[key] += costOfGoodsSold;
      }
    }
    for (const ex of filteredExpenses) {
      const d = toDate(ex.createdAt);
      if (!d) continue;
      const key = formatKey(normalizeToBucketStart(d));
      if (key in expensesByDay) expensesByDay[key] += ex.amount || 0;
    }

    const salesData = dateKeys.map(k => salesByDay[k]);
    const expensesData = dateKeys.map(k => expensesByDay[k]);
    const costOfGoodsSoldData = dateKeys.map(k => costOfGoodsSoldByDay[k]);
    const profitData = dateKeys.map((_, i) => salesData[i] - costOfGoodsSoldData[i] - expensesData[i]);
    return { salesData, expensesData, costOfGoodsSoldData, profitData };
  }, [dateKeys, filteredSales, filteredExpenses, products, formatKey, normalizeToBucketStart]);

  // Calculate moving average for trend line
  const calculateMovingAverage = useCallback((data: number[], window: number): number[] => {
    if (data.length === 0) return [];
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - Math.floor(window / 2));
      const end = Math.min(data.length, i + Math.ceil(window / 2));
      const slice = data.slice(start, end);
      const avg = slice.reduce((sum, val) => sum + val, 0) / slice.length;
      result.push(avg);
    }
    return result;
  }, []);

  // Determine window size based on period
  const trendWindow = useMemo(() => {
    if (period === 'yearly') return 4;
    if (period === 'monthly') return 7;
    if (period === 'weekly' || period === 'daily' || period === 'today') return 3;
    return 3;
  }, [period]);

  // Calculate trend data
  const trendData = useMemo(() => {
    if (!showTrend) return null;
    return calculateMovingAverage(series.salesData, trendWindow);
  }, [showTrend, series.salesData, trendWindow, calculateMovingAverage]);

  // Save trend preference
  useEffect(() => {
    localStorage.setItem('reports_showTrend', String(showTrend));
  }, [showTrend]);

  const labels = useMemo(() => {
    return dateKeys.map(k => {
      if (period === 'yearly') return k;
      if (period === 'monthly') {
        const parts = k.split('-').map(Number);
        if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) {
          return k; // Fallback to original key
        }
        const [y, m] = parts;
        const dt = new Date(y, Math.max(0, Math.min(11, m - 1)), 1);
        return dt.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      }
      if (period === 'weekly') {
        const dt = new Date(k + 'T00:00:00');
        const endW = new Date(dt);
        endW.setDate(endW.getDate() + 6);
        return `${dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endW.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      }
      // daily/today
      const dt = new Date(k + 'T00:00:00');
      return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });
  }, [dateKeys, period]);

  const chartData = useMemo(() => {
    const datasets = [
      { label: t('reports.chart.sales'), data: series.salesData, borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: false, tension: 0.4, borderWidth: 2 },
      { label: t('reports.chart.costOfGoodsSold'), data: series.costOfGoodsSoldData, borderColor: '#F59E0B', backgroundColor: 'rgba(245, 158, 11, 0.1)', fill: false, tension: 0.4, borderWidth: 2 },
      { label: t('reports.chart.expenses'), data: series.expensesData, borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: false, tension: 0.4, borderWidth: 2 },
      { label: t('reports.chart.netProfit'), data: series.profitData, borderColor: '#4F46E5', backgroundColor: 'rgba(79, 70, 229, 0.1)', fill: false, tension: 0.4, borderWidth: 2 },
    ];

    // Add trend line if enabled
    if (showTrend && trendData) {
      datasets.push({
        label: t('reports.chart.trendLine'),
        data: trendData,
        borderColor: '#6B7280',
        backgroundColor: 'rgba(107, 114, 128, 0.1)',
        fill: false,
        tension: 0.4,
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
      } as any);
    }

    return { labels, datasets };
  }, [labels, series, showTrend, trendData, t]);
  
  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'XAF' 
              }).format(context.parsed.y);
            }
            return label;
          }
        }
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.06)',
        },
        ticks: {
          callback: function(value) {
            return new Intl.NumberFormat('en-US', { 
              style: 'currency', 
              currency: 'XAF',
              maximumSignificantDigits: 3
            }).format(Number(value));
          }
        }
      },
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
  };
  
  // Aggregates and rankings
  const totalSales = useMemo(() => filteredSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0), [filteredSales]);
  const totalExpenses = useMemo(() => filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0), [filteredExpenses]);
  
  // Calculate total cost of goods sold
  const totalCostOfGoodsSold = useMemo(() => {
    return filteredSales.reduce((sum, sale) => {
      return sum + sale.products.reduce((productSum: number, saleProduct: { costPrice?: number; quantity: number; productId: string }) => {
        // Use costPrice from saleProduct (historical price at time of sale)
        const costPrice = saleProduct.costPrice ?? 
          products.find(p => p.id === saleProduct.productId)?.costPrice ?? 0;
        return productSum + (costPrice * saleProduct.quantity);
      }, 0);
    }, 0);
  }, [filteredSales, products]);
  
  const netProfit = useMemo(() => totalSales - totalCostOfGoodsSold - totalExpenses, [totalSales, totalCostOfGoodsSold, totalExpenses]);

  // Calculate previous period range
  const getPreviousPeriodRange = useCallback((start: Date, end: Date) => {
    const duration = end.getTime() - start.getTime();
    return {
      start: new Date(start.getTime() - duration - 1),
      end: new Date(start.getTime() - 1)
    };
  }, []);

  const previousPeriodRange = useMemo(() => getPreviousPeriodRange(start, end), [start, end, getPreviousPeriodRange]);
  const previousInRange = useCallback((d: Date | null) => !!d && d >= previousPeriodRange.start && d <= previousPeriodRange.end, [previousPeriodRange]);

  // Calculate previous period data
  const previousPeriodData = useMemo(() => {
    const previousSales = sales.filter(s => s.isAvailable !== false && previousInRange(toDate(s.createdAt)));
    
    // Apply same filters as current period
    let filteredPreviousSales = previousSales;
    if (selectedCategory !== 'all') {
      filteredPreviousSales = filteredPreviousSales.filter(sale => 
        sale.products.some((sp: { productId: string }) => {
          const product = products.find(p => p.id === sp.productId);
          return product?.category === selectedCategory;
        })
      );
    }
    if (selectedProduct !== 'all') {
      filteredPreviousSales = filteredPreviousSales.filter(sale => sale.products.some((sp: { productId: string }) => sp.productId === selectedProduct));
    }

    const previousExpenses = expenses.filter(e => e.isAvailable !== false && previousInRange(toDate(e.createdAt)));

    const prevTotalSales = filteredPreviousSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const prevTotalExpenses = previousExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    
    const prevTotalCostOfGoodsSold = filteredPreviousSales.reduce((sum, sale) => {
      return sum + sale.products.reduce((productSum: number, saleProduct: { costPrice?: number; quantity: number; productId: string }) => {
        const costPrice = saleProduct.costPrice ?? 
          products.find(p => p.id === saleProduct.productId)?.costPrice ?? 0;
        return productSum + (costPrice * saleProduct.quantity);
      }, 0);
    }, 0);

    const prevNetProfit = prevTotalSales - prevTotalCostOfGoodsSold - prevTotalExpenses;

    return {
      totalSales: prevTotalSales,
      totalCostOfGoodsSold: prevTotalCostOfGoodsSold,
      totalExpenses: prevTotalExpenses,
      netProfit: prevNetProfit
    };
  }, [sales, expenses, products, previousInRange, selectedCategory, selectedProduct]);

  // Calculate KPI metrics
  const kpiMetrics = useMemo(() => {
    const grossMarginRate = totalSales > 0 
      ? ((totalSales - totalCostOfGoodsSold) / totalSales) * 100 
      : 0;
    
    const netMarginRate = totalSales > 0 
      ? (netProfit / totalSales) * 100 
      : 0;
    
    const expenseRatio = totalSales > 0 
      ? (totalExpenses / totalSales) * 100 
      : 0;
    
    const growthRate = previousPeriodData.totalSales > 0
      ? ((totalSales - previousPeriodData.totalSales) / previousPeriodData.totalSales) * 100
      : 0;
    
    const roi = totalCostOfGoodsSold > 0
      ? (netProfit / totalCostOfGoodsSold) * 100
      : 0;

    // Determine status for each KPI
    const getGrossMarginStatus = (rate: number): 'good' | 'warning' | 'bad' => {
      if (rate > 30) return 'good';
      if (rate >= 20) return 'warning';
      return 'bad';
    };

    const getNetMarginStatus = (rate: number): 'good' | 'warning' | 'bad' => {
      if (rate > 15) return 'good';
      if (rate >= 10) return 'warning';
      return 'bad';
    };

    const getExpenseRatioStatus = (ratio: number): 'good' | 'warning' | 'bad' => {
      if (ratio < 20) return 'good';
      if (ratio <= 30) return 'warning';
      return 'bad';
    };

    return {
      grossMarginRate: {
        value: grossMarginRate,
        status: getGrossMarginStatus(grossMarginRate),
        trend: previousPeriodData.totalSales > 0 ? {
          value: ((grossMarginRate - ((previousPeriodData.totalSales - previousPeriodData.totalCostOfGoodsSold) / previousPeriodData.totalSales * 100))),
          isPositive: grossMarginRate > ((previousPeriodData.totalSales - previousPeriodData.totalCostOfGoodsSold) / previousPeriodData.totalSales * 100)
        } : undefined
      },
      netMarginRate: {
        value: netMarginRate,
        status: getNetMarginStatus(netMarginRate),
        trend: previousPeriodData.totalSales > 0 ? {
          value: ((netMarginRate - (previousPeriodData.netProfit / previousPeriodData.totalSales * 100))),
          isPositive: netMarginRate > (previousPeriodData.netProfit / previousPeriodData.totalSales * 100)
        } : undefined
      },
      expenseRatio: {
        value: expenseRatio,
        status: getExpenseRatioStatus(expenseRatio),
        trend: previousPeriodData.totalSales > 0 ? {
          value: ((expenseRatio - (previousPeriodData.totalExpenses / previousPeriodData.totalSales * 100))),
          isPositive: expenseRatio < (previousPeriodData.totalExpenses / previousPeriodData.totalSales * 100) // Lower is better
        } : undefined
      },
      growthRate: {
        value: growthRate,
        status: (growthRate > 0 ? 'good' : growthRate === 0 ? 'warning' : 'bad') as 'good' | 'warning' | 'bad',
        trend: undefined
      },
      roi: {
        value: roi,
        status: (roi > 20 ? 'good' : roi >= 10 ? 'warning' : 'bad') as 'good' | 'warning' | 'bad',
        trend: previousPeriodData.totalCostOfGoodsSold > 0 ? {
          value: ((roi - (previousPeriodData.netProfit / previousPeriodData.totalCostOfGoodsSold * 100))),
          isPositive: roi > (previousPeriodData.netProfit / previousPeriodData.totalCostOfGoodsSold * 100)
        } : undefined
      }
    };
  }, [totalSales, totalCostOfGoodsSold, totalExpenses, netProfit, previousPeriodData]);

  const topProducts = useMemo(() => {
    const byId = new Map<string, { name: string; quantity: number; customers: Set<string>; totalSales: number }>();
    const productById: Record<string, Product> = Object.fromEntries(
      products
        .filter(p => p.isAvailable !== false && p.isDeleted !== true)
        .map(p => [p.id, p])
    );
    for (const s of filteredSales) {
      const customerName = s.customerInfo?.name || 'Unknown';
      for (const sp of s.products) {
        if (selectedProduct !== 'all' && sp.productId !== selectedProduct) continue;
        const entry = byId.get(sp.productId) || { name: productById[sp.productId]?.name || 'Unknown', quantity: 0, customers: new Set<string>(), totalSales: 0 };
        entry.quantity += sp.quantity || 0;
        entry.customers.add(customerName);
        // Calculate total sales for this product in this sale
        const unitPrice = sp.negotiatedPrice || sp.basePrice;
        entry.totalSales += unitPrice * (sp.quantity || 0);
        byId.set(sp.productId, entry);
      }
    }
    const sorted = Array.from(byId.values())
      .map(v => ({ name: v.name, quantity: v.quantity, customersCount: v.customers.size, totalSales: v.totalSales }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Calculate cumulative sales
    let cumulative = 0;
    return sorted.map(item => {
      cumulative += item.totalSales;
      return { ...item, cumulativeSales: cumulative };
    });
  }, [filteredSales, products, selectedProduct]);

  // All products sold (without limit, for the comprehensive view)
  const allProductsSold = useMemo(() => {
    const byId = new Map<string, {
      id: string;
      name: string;
      quantity: number;
      customers: Set<string>;
      totalSales: number;
      totalCOGS: number;
    }>();

    const productById: Record<string, Product> = Object.fromEntries(
      products
        .filter(p => p.isAvailable !== false && p.isDeleted !== true)
        .map(p => [p.id, p])
    );

    for (const s of filteredSales) {
      const customerName = s.customerInfo?.name || 'Unknown';
      for (const sp of s.products) {
        if (selectedProduct !== 'all' && sp.productId !== selectedProduct) continue;

        const product = productById[sp.productId];
        if (!product) continue;

        const entry = byId.get(sp.productId) || {
          id: sp.productId,
          name: product.name,
          quantity: 0,
          customers: new Set<string>(),
          totalSales: 0,
          totalCOGS: 0
        };

        entry.quantity += sp.quantity || 0;
        entry.customers.add(customerName);

        // Calculate total sales for this product
        const unitPrice = sp.negotiatedPrice || sp.basePrice || 0;
        const costPrice = sp.costPrice ?? product.costPrice ?? 0;
        const quantity = sp.quantity || 0;

        entry.totalSales += unitPrice * quantity;
        entry.totalCOGS += costPrice * quantity;

        byId.set(sp.productId, entry);
      }
    }

    // Convert to array and calculate profit metrics
    return Array.from(byId.values()).map(v => {
      const grossProfit = v.totalSales - v.totalCOGS;
      const profitMargin = v.totalSales > 0 ? (grossProfit / v.totalSales) * 100 : 0;

      return {
        id: v.id,
        name: v.name,
        quantity: v.quantity,
        customersCount: v.customers.size,
        totalSales: v.totalSales,
        grossProfit,
        profitMargin
      };
    });
  }, [filteredSales, products, selectedProduct]);

  // Product profitability analysis
  const productProfitability = useMemo(() => {
    const profitabilityMap = new Map<string, {
      name: string;
      quantitySold: number;
      totalSales: number;
      totalCOGS: number;
      grossProfit: number;
      profitMargin: number;
    }>();

    const productById: Record<string, Product> = Object.fromEntries(
      products
        .filter(p => p.isAvailable !== false && p.isDeleted !== true)
        .map(p => [p.id, p])
    );

    for (const sale of filteredSales) {
      for (const saleProduct of sale.products) {
        const product = productById[saleProduct.productId];
        if (!product) continue;

        const entry = profitabilityMap.get(saleProduct.productId) || {
          name: product.name,
          quantitySold: 0,
          totalSales: 0,
          totalCOGS: 0,
          grossProfit: 0,
          profitMargin: 0
        };

        const unitPrice = saleProduct.negotiatedPrice || saleProduct.basePrice || 0;
        const quantity = saleProduct.quantity || 0;
        const costPrice = saleProduct.costPrice ?? product.costPrice ?? 0;

        entry.quantitySold += quantity;
        entry.totalSales += unitPrice * quantity;
        entry.totalCOGS += costPrice * quantity;
        profitabilityMap.set(saleProduct.productId, entry);
      }
    }

    // Calculate profit and margin
    const results = Array.from(profitabilityMap.values()).map(entry => {
      entry.grossProfit = entry.totalSales - entry.totalCOGS;
      entry.profitMargin = entry.totalSales > 0 
        ? (entry.grossProfit / entry.totalSales) * 100 
        : 0;
      return entry;
    });

    // Sort by profit margin descending
    return results.sort((a, b) => b.profitMargin - a.profitMargin).slice(0, 10);
  }, [filteredSales, products]);

  // Expense category analysis
  const expenseCategoryAnalysis = useMemo(() => {
    const categoryMap = new Map<string, { amount: number; count: number }>();

    for (const expense of filteredExpenses) {
      const category = expense.category || 'Uncategorized';
      const entry = categoryMap.get(category) || { amount: 0, count: 0 };
      entry.amount += expense.amount || 0;
      entry.count += 1;
      categoryMap.set(category, entry);
    }

    const totalExpensesAmount = totalExpenses;
    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        count: data.count,
        percentage: totalExpensesAmount > 0 ? (data.amount / totalExpensesAmount) * 100 : 0,
        average: data.count > 0 ? data.amount / data.count : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses, totalExpenses]);

  // Customer metrics
  const customerMetrics = useMemo(() => {
    const customerMap = new Map<string, { orders: number; totalSales: number }>();
    let totalOrders = 0;

    for (const sale of filteredSales) {
      const customerName = sale.customerInfo?.name || 'Unknown';
      const entry = customerMap.get(customerName) || { orders: 0, totalSales: 0 };
      entry.orders += 1;
      entry.totalSales += sale.totalAmount || 0;
      customerMap.set(customerName, entry);
      totalOrders += 1;
    }

    const uniqueCustomers = customerMap.size;
    const averageBasket = totalOrders > 0 ? totalSales / totalOrders : 0;
    const repeatCustomers = Array.from(customerMap.values()).filter(c => c.orders > 1).length;
    const retentionRate = uniqueCustomers > 0 ? (repeatCustomers / uniqueCustomers) * 100 : 0;
    const newCustomers = uniqueCustomers - repeatCustomers;

    return {
      totalCustomers: uniqueCustomers,
      totalOrders,
      averageBasket,
      repeatCustomers,
      newCustomers,
      retentionRate
    };
  }, [filteredSales, totalSales]);

  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; sales: number; orders: number }>();
    for (const s of filteredSales) {
      const name = s.customerInfo?.name || 'Unknown';
      const entry = map.get(name) || { name, sales: 0, orders: 0 };
      entry.sales += s.totalAmount || 0;
      entry.orders += 1;
      map.set(name, entry);
    }
    const sorted = Array.from(map.values()).sort((a, b) => b.sales - a.sales).slice(0, 5);
    
    // Calculate cumulative sales
    let cumulative = 0;
    return sorted.map(item => {
      cumulative += item.sales;
      return { ...item, cumulativeSales: cumulative };
    });
  }, [filteredSales]);

  const handleExport = () => {
    // Enhanced CSV escaping function
    const escapeCSV = (field: string): string => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const header = ['Date', 'Sales', 'Cost of Goods Sold', 'Expenses', 'Net Profit'];
    const rows = dateKeys.map((key, i) => [
      key,
      String(series.salesData[i] || 0),
      String(series.costOfGoodsSoldData[i] || 0),
      String(series.expensesData[i] || 0),
      String(series.profitData[i] || 0),
    ]);
    rows.push(['TOTAL', String(totalSales), String(totalCostOfGoodsSold), String(totalExpenses), String(netProfit)]);
    const csv = [header, ...rows].map(r => r.map(escapeCSV).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pb-16 md:pb-0"> {/* Add padding to bottom for mobile nav */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('reports.title')}</h1>
          <p className="text-gray-600">{t('reports.subtitle')}</p>
        </div>
        
        <div className="mt-4 md:mt-0">
          <Button 
            variant="outline" 
            icon={<FileDown size={16} />}
            onClick={handleExport}
          >
            {t('reports.exportReport')}
          </Button>
        </div>
      </div>
      
      {/* Quick Reports & Saved Reports */}
      <Card className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <QuickReportsBar onSelectPeriod={handleQuickReport} />
          {company && (
            <SavedReportsManager
              companyId={company.id}
              currentConfig={{
                startDate,
                endDate,
                selectedProduct,
                selectedCategory,
                period
              }}
              onLoadReport={handleLoadReport}
            />
          )}
        </div>
      </Card>

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-gray-500">
              <Calendar size={18} />
            </span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              label={t('reports.filters.startDate')}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-gray-500">
              <Calendar size={18} />
            </span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              label={t('reports.filters.endDate')}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
              {t('reports.filters.period')}
              {period === 'today' && (
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                  {t('reports.filters.today')}
                </span>
              )}
            </label>
            <select
              className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={period}
              onChange={(e) => setPeriod(e.target.value as 'none' | 'today' | 'daily' | 'weekly' | 'monthly' | 'yearly')}
            >
              <option value="none">{t('reports.filters.none')}</option>
              <option value="today">{t('reports.filters.today')}</option>
              <option value="daily">{t('reports.filters.daily')}</option>
              <option value="weekly">{t('reports.filters.weekly')}</option>
              <option value="monthly">{t('reports.filters.monthly')}</option>
              <option value="yearly">{t('reports.filters.yearly')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('reports.filters.category')}
            </label>
            <select
              className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">{t('reports.filters.allCategories')}</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('reports.filters.product')}
            </label>
            <select
              className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
            >
              {productOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-emerald-50 border border-emerald-100">
          <div className="text-center">
            <p className="text-sm font-medium text-emerald-700">{t('reports.summary.totalSales')}</p>
            <p className="mt-1 text-3xl font-semibold text-emerald-900">{formatPrice(totalSales)} XAF</p>
            <p className="mt-1 text-sm text-emerald-600">
              <span className="font-medium">{filteredSales.length}</span> {t('reports.summary.orders')}
            </p>
            <ComparisonIndicator 
              current={totalSales} 
              previous={previousPeriodData.totalSales}
              formatValue={(v) => `${formatPrice(v)} XAF`}
            />
          </div>
        </Card>
        
        <Card className="bg-amber-50 border border-amber-100">
          <div className="text-center">
            <p className="text-sm font-medium text-amber-700">{t('reports.summary.costOfGoodsSold')}</p>
            <p className="mt-1 text-3xl font-semibold text-amber-900">{formatPrice(totalCostOfGoodsSold)} XAF</p>
            <p className="mt-1 text-sm text-amber-600">
              <span className="font-medium">{(totalSales > 0 ? Math.round(((totalCostOfGoodsSold) / totalSales) * 100) : 0)}%</span> {t('reports.summary.ofSales')}
            </p>
            <ComparisonIndicator 
              current={totalCostOfGoodsSold} 
              previous={previousPeriodData.totalCostOfGoodsSold}
              formatValue={(v) => `${formatPrice(v)} XAF`}
            />
          </div>
        </Card>
        
        <Card className="bg-red-50 border border-red-100">
          <div className="text-center">
            <p className="text-sm font-medium text-red-700">{t('reports.summary.totalExpenses')}</p>
            <p className="mt-1 text-3xl font-semibold text-red-900">{formatPrice(totalExpenses)} XAF</p>
            <p className="mt-1 text-sm text-red-600">
              <span className="font-medium">{filteredExpenses.length}</span> {t('reports.summary.entries')}
            </p>
            <ComparisonIndicator 
              current={totalExpenses} 
              previous={previousPeriodData.totalExpenses}
              formatValue={(v) => `${formatPrice(v)} XAF`}
            />
          </div>
        </Card>
        
        <Card className="bg-indigo-50 border border-indigo-100">
          <div className="text-center">
            <p className="text-sm font-medium text-indigo-700">{t('reports.summary.netProfit')}</p>
            <p className="mt-1 text-3xl font-semibold text-indigo-900">{formatPrice(netProfit)} XAF</p>
            <p className="mt-1 text-sm text-indigo-600">
              <span className="font-medium">{(totalSales > 0 ? Math.round(((netProfit) / totalSales) * 100) : 0)}%</span> {t('reports.summary.margin')}
            </p>
            <ComparisonIndicator 
              current={netProfit} 
              previous={previousPeriodData.netProfit}
              formatValue={(v) => `${formatPrice(v)} XAF`}
            />
          </div>
        </Card>
      </div>
      
      {/* KPI Dashboard */}
      <Card className="mb-6" title={t('reports.kpi.title')}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard
            title={t('reports.kpi.grossMarginRate')}
            value={kpiMetrics.grossMarginRate.value.toFixed(1)}
            unit="%"
            status={kpiMetrics.grossMarginRate.status}
            trend={kpiMetrics.grossMarginRate.trend}
            description={t('reports.kpi.salesMinusCogs')}
          />
          <KPICard
            title={t('reports.kpi.netMarginRate')}
            value={kpiMetrics.netMarginRate.value.toFixed(1)}
            unit="%"
            status={kpiMetrics.netMarginRate.status}
            trend={kpiMetrics.netMarginRate.trend}
            description={t('reports.kpi.netProfitOverSales')}
          />
          <KPICard
            title={t('reports.kpi.expenseRatio')}
            value={kpiMetrics.expenseRatio.value.toFixed(1)}
            unit="%"
            status={kpiMetrics.expenseRatio.status}
            trend={kpiMetrics.expenseRatio.trend}
            description={t('reports.kpi.expensesOverSales')}
          />
          <KPICard
            title={t('reports.kpi.growthRate')}
            value={kpiMetrics.growthRate.value.toFixed(1)}
            unit="%"
            status={kpiMetrics.growthRate.status}
            description={t('reports.kpi.vsPreviousPeriod')}
          />
          <KPICard
            title={t('reports.kpi.roi')}
            value={kpiMetrics.roi.value.toFixed(1)}
            unit="%"
            status={kpiMetrics.roi.status}
            trend={kpiMetrics.roi.trend}
            description={t('reports.kpi.netProfitOverCogs')}
          />
        </div>
      </Card>
      
      {/* Chart */}
      <Card className="mb-6" title={t('reports.chart.title')}>
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setShowTrend(!showTrend)}
            className={`px-3 py-1 text-sm rounded-md border ${
              showTrend 
                ? 'bg-gray-100 border-gray-300 text-gray-700' 
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {showTrend ? t('reports.chart.hideTrendLine') : t('reports.chart.showTrendLine')}
          </button>
        </div>
        <div className="h-80">
          <Line data={chartData} options={chartOptions} />
        </div>
      </Card>
      
      {/* Top Products & Customers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card title={t('reports.tables.topProducts.title')}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('reports.tables.topProducts.product')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('reports.tables.topProducts.quantity')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('reports.tables.topProducts.customers')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('reports.tables.topProducts.sales')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('reports.tables.topProducts.cumulative')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topProducts.map((product, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.quantity} {t('reports.tables.topProducts.units')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.customersCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatPrice(product.totalSales)} XAF
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatPrice(product.cumulativeSales)} XAF
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        
        <Card title={t('reports.tables.topCustomers.title')}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('reports.tables.topCustomers.customer')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('reports.tables.topCustomers.sales')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('reports.tables.topCustomers.orders')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('reports.tables.topCustomers.cumulative')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topCustomers.map((customer, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {customer.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatPrice(customer.sales)} XAF
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {customer.orders}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatPrice(customer.cumulativeSales)} XAF
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* All Products Sold - Comprehensive View with Pagination */}
      <AllProductsSold productsData={allProductsSold} />

      {/* Expenses List */}
      <Card title={t('reports.tables.expenses.title')} className="mb-6">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.tables.expenses.date')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.tables.expenses.description')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.tables.expenses.category')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.tables.expenses.amount')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.tables.expenses.cumulative')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-sm text-gray-500 text-center">{t('reports.tables.expenses.noExpenses')}</td>
                </tr>
              ) : (
                (() => {
                  // Sort expenses by date (oldest first for cumulative calculation)
                  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
                    const dateA = a.createdAt?.seconds || 0;
                    const dateB = b.createdAt?.seconds || 0;
                    return dateA - dateB;
                  });
                  
                  let cumulative = 0;
                  return sortedExpenses.map((ex, idx) => {
                    cumulative += ex.amount || 0;
                    const d = ex.createdAt?.seconds ? new Date(ex.createdAt.seconds * 1000) : null;
                    const dateStr = d ? d.toLocaleDateString() : '';
                    return (
                      <tr key={ex.id || idx}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dateStr}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ex.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ex.category}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatPrice(ex.amount)} XAF</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{formatPrice(cumulative)} XAF</td>
                      </tr>
                    );
                  });
                })()
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Advanced Analyses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Product Profitability Analysis */}
        <Card title={t('reports.tables.productProfitability.title')}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.tables.productProfitability.product')}</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.tables.productProfitability.qtySold')}</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.tables.productProfitability.sales')}</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.tables.productProfitability.cogs')}</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.tables.productProfitability.profit')}</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.tables.productProfitability.margin')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {productProfitability.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-sm text-gray-500 text-center">{t('reports.tables.productProfitability.noData')}</td>
                  </tr>
                ) : (
                  productProfitability.map((product, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{product.quantitySold}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{product.totalSales} XAF</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{product.totalCOGS} XAF</td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${product.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {product.grossProfit} XAF
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${product.profitMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {product.profitMargin.toFixed(1)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Expense Category Analysis */}
        <Card title={t('reports.tables.expenseCategory.title')}>
          {expenseCategoryAnalysis.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">{t('reports.tables.expenseCategory.noData')}</p>
          ) : (
            <>
              <div className="h-64 mb-4">
                <Pie
                  data={{
                    labels: expenseCategoryAnalysis.map(e => e.category),
                    datasets: [{
                      data: expenseCategoryAnalysis.map(e => e.amount),
                      backgroundColor: [
                        '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
                        '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#A855F7'
                      ],
                      borderWidth: 2,
                      borderColor: '#fff'
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom'
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} XAF (${percentage}%)`;
                          }
                        }
                      }
                    }
                  }}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.tables.expenseCategory.category')}</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.tables.expenseCategory.amount')}</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.tables.expenseCategory.percentage')}</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.tables.expenseCategory.count')}</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.tables.expenseCategory.average')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {expenseCategoryAnalysis.map((exp, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{exp.category}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{exp.amount.toLocaleString()} XAF</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{exp.percentage.toFixed(1)}%</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{exp.count}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{exp.average.toLocaleString()} XAF</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Customer Source Statistics */}
      {sources.length > 0 && (
        <Card title={t('reports.customerSourceStats.title')} className="mb-6">
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {sources.map((source) => {
                const sourceSales = filteredSales.filter(s => s.customerSourceId === source.id);
                const sourceRevenue = sourceSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
                const sourceProfit = sourceSales.reduce((sum, sale) => {
                  return sum + sale.products.reduce((productSum: number, sp: { negotiatedPrice?: number; basePrice: number; costPrice: number; quantity: number; batchLevelProfits?: Array<{ costPrice: number; consumedQuantity: number }> }) => {
                    const unitSalePrice = sp.negotiatedPrice ?? sp.basePrice;
                    if (sp.batchLevelProfits && sp.batchLevelProfits.length > 0) {
                      return productSum + sp.batchLevelProfits.reduce(
                        (batchSum: number, batch: { costPrice: number; consumedQuantity: number }) => batchSum + (unitSalePrice - batch.costPrice) * batch.consumedQuantity,
                        0
                      );
                    }
                    return productSum + (unitSalePrice - sp.costPrice) * sp.quantity;
                  }, 0);
                }, 0);
                const sourceCustomers = new Set(sourceSales.map(s => s.customerInfo.phone)).size;
                const profitMargin = sourceRevenue > 0 ? (sourceProfit / sourceRevenue) * 100 : 0;

                return (
                  <div key={source.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      {source.color && (
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: source.color }}
                        />
                      )}
                      <h4 className="font-medium text-gray-900">{source.name}</h4>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t('reports.customerSourceStats.sales')}:</span>
                        <span className="font-semibold">{sourceSales.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t('reports.customerSourceStats.revenue')}:</span>
                        <span className="font-semibold">{sourceRevenue.toLocaleString()} XAF</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t('reports.customerSourceStats.profit')}:</span>
                        <span className="font-semibold text-emerald-600">{sourceProfit.toLocaleString()} XAF</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t('reports.customerSourceStats.customers')}:</span>
                        <span className="font-semibold">{sourceCustomers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t('reports.customerSourceStats.margin')}:</span>
                        <span className="font-semibold">{profitMargin.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Table détaillée */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.customerSourceStats.source')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.customerSourceStats.sales')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.customerSourceStats.customers')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.customerSourceStats.totalRevenue')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.customerSourceStats.totalProfit')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reports.customerSourceStats.margin')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sources.map((source) => {
                    const sourceSales = filteredSales.filter(s => s.customerSourceId === source.id);
                    const sourceRevenue = sourceSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
                    const sourceProfit = sourceSales.reduce((sum, sale) => {
                      return sum + sale.products.reduce((productSum, sp) => {
                        const unitSalePrice = sp.negotiatedPrice ?? sp.basePrice;
                        if (sp.batchLevelProfits && sp.batchLevelProfits.length > 0) {
                          return productSum + sp.batchLevelProfits.reduce(
                            (batchSum, batch) => batchSum + (unitSalePrice - batch.costPrice) * batch.consumedQuantity,
                            0
                          );
                        }
                        return productSum + (unitSalePrice - sp.costPrice) * sp.quantity;
                      }, 0);
                    }, 0);
                    const sourceCustomers = new Set(sourceSales.map(s => s.customerInfo.phone)).size;
                    const profitMargin = sourceRevenue > 0 ? (sourceProfit / sourceRevenue) * 100 : 0;

                    return (
                      <tr key={source.id}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {source.color && (
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: source.color }}
                              />
                            )}
                            <span className="text-sm font-medium text-gray-900">{source.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{sourceSales.length}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{sourceCustomers}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{sourceRevenue.toLocaleString()} XAF</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-emerald-600 font-semibold">{sourceProfit.toLocaleString()} XAF</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{profitMargin.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                  {/* Ligne pour les ventes sans source */}
                  {(() => {
                    const noSourceSales = filteredSales.filter(s => !s.customerSourceId);
                    if (noSourceSales.length > 0) {
                      const noSourceRevenue = noSourceSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
                      const noSourceProfit = noSourceSales.reduce((sum, sale) => {
                        return sum + sale.products.reduce((productSum, sp) => {
                          const unitSalePrice = sp.negotiatedPrice ?? sp.basePrice;
                          if (sp.batchLevelProfits && sp.batchLevelProfits.length > 0) {
                            return productSum + sp.batchLevelProfits.reduce(
                              (batchSum, batch) => batchSum + (unitSalePrice - batch.costPrice) * batch.consumedQuantity,
                              0
                            );
                          }
                          return productSum + (unitSalePrice - sp.costPrice) * sp.quantity;
                        }, 0);
                      }, 0);
                      const noSourceCustomers = new Set(noSourceSales.map(s => s.customerInfo.phone)).size;
                      const noSourceProfitMargin = noSourceRevenue > 0 ? (noSourceProfit / noSourceRevenue) * 100 : 0;

                      return (
                        <tr className="bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-500 italic">{t('reports.customerSourceStats.noSource')}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{noSourceSales.length}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{noSourceCustomers}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{noSourceRevenue.toLocaleString()} XAF</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-emerald-600 font-semibold">{noSourceProfit.toLocaleString()} XAF</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{noSourceProfitMargin.toFixed(1)}%</td>
                        </tr>
                      );
                    }
                    return null;
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Customer Metrics */}
      <Card title={t('reports.customerMetrics.title')} className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">{t('reports.customerMetrics.totalCustomers')}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{customerMetrics.totalCustomers}</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">{t('reports.customerMetrics.totalOrders')}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{customerMetrics.totalOrders}</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">{t('reports.customerMetrics.averageBasket')}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{customerMetrics.averageBasket.toLocaleString()} XAF</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">{t('reports.customerMetrics.repeatCustomers')}</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-600">{customerMetrics.repeatCustomers}</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">{t('reports.customerMetrics.newCustomers')}</p>
            <p className="mt-1 text-2xl font-semibold text-blue-600">{customerMetrics.newCustomers}</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">{t('reports.customerMetrics.retentionRate')}</p>
            <p className="mt-1 text-2xl font-semibold text-indigo-600">{customerMetrics.retentionRate.toFixed(1)}%</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Reports;