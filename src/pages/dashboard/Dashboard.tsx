import { DollarSign, TrendingUp, Info, Receipt, FileBarChart, Users } from 'lucide-react';
import StatCard from '../../components/dashboard/StatCard';
import DonutChart from '../../components/dashboard/DonutChart';
import TopSales from '../../components/dashboard/TopSales';
import BestClients from '../../components/dashboard/BestClients';
import BestProductsList from '../../components/dashboard/BestProductsList';
import LatestOrdersTable from '../../components/dashboard/LatestOrdersTable';
import { LoadingScreen, SkeletonStatCard, SkeletonChart, SkeletonTable, SkeletonObjectivesBar, Modal, Button, DateRangePicker } from '@components/common';
import { useSales, useExpenses, useProducts, useStockChanges, useFinanceEntries, useAuditLogs } from '@hooks/data/useFirestore';
import { subscribeToAllSales } from '@services/firestore/sales/saleService';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@contexts/AuthContext';
import type { StockChange, Sale, SaleProduct } from '../../types/models';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useRolePermissions } from '@hooks/business/useRolePermissions';
import { useCustomerSources } from '@hooks/business/useCustomerSources';
import {
  calculateDashboardProfit,
  calculateTotalProfit,
  calculateTotalExpenses,
  calculateSolde,
  calculateTotalSalesAmount,
  calculateTotalDeliveryFee,
  calculateTotalProductsSold,
  calculateTotalOrders,
  calculateNewOrders,
  calculateNewClients,
  calculateSalesBySource,
  calculateSalesByCategory,
  calculateExpensesByCategory,
  calculateTrendData
} from '@utils/calculations/financialCalculations';
import { useProfitPeriod } from '@hooks/business/useProfitPeriod';
import { getPeriodStartDate} from '@utils/calculations/profitPeriodUtils';
import { differenceInDays, format, startOfWeek, endOfWeek, addDays, addWeeks, startOfMonth as startMonth, endOfMonth as endMonth, addMonths, isSameMonth, isSameDay } from 'date-fns';
import ObjectivesBar from '../../components/objectives/ObjectivesBar';
import ObjectivesModal from '../../components/objectives/ObjectivesModal';
import ProfitPeriodModal from '../../components/dashboard/ProfitPeriodModal';
import { combineActivities } from '@utils/business/activityUtils';
import { getDeviceInfo } from '@utils/core/deviceDetection';

const Dashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { companyId } = useParams<{ companyId: string }>();
  
  // 🚀 PROGRESSIVE LOADING: Load essential data first
  const { sales, loading: salesLoading } = useSales();
  const { products, loading: productsLoading } = useProducts();
  
  // 🔄 BACKGROUND LOADING: Load all sales in background after initial render
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [loadingAllSales, setLoadingAllSales] = useState(false);
  const { user, company, isOwner, effectiveRole } = useAuth();
  const { canAccess } = useRolePermissions(company?.id);
  
  // Check if user has access to POS (sales resource)
  const hasPOSAccess = isOwner || effectiveRole === 'owner' || canAccess('sales');
  
  // 🔄 BACKGROUND LOADING: Load secondary data in background (don't block UI)
  const { expenses, loading: expensesLoading } = useExpenses();
  const { stockChanges, loading: stockChangesLoading } = useStockChanges();
  const { entries: financeEntries, loading: financeLoading } = useFinanceEntries();
  const { auditLogs, loading: auditLogsLoading } = useAuditLogs();
  const { sources } = useCustomerSources();
  
  // 💰 PROFIT PERIOD: Load profit period preference
  const { preference: profitPeriodPreference, setPeriod, clearPeriod } = useProfitPeriod();
  
  // 🎯 ESSENTIAL DATA: Only block UI for critical data (sales + products)
  const essentialDataLoading = salesLoading || productsLoading;

  // 🔄 LOAD ALL SALES IN BACKGROUND: After initial UI renders
  useEffect(() => {
    if (!user || !company || essentialDataLoading) return;
    
    setLoadingAllSales(true);
    
    const unsubscribe = subscribeToAllSales(company.id, (allSalesData) => {
      setAllSales(allSalesData);
      setLoadingAllSales(false);
    });
    
    // Cleanup function
    return () => {
      unsubscribe();
    };
  }, [user, company, essentialDataLoading]);
  const [showCalculationsModal, setShowCalculationsModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copied2, setCopied2] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: startMonth(new Date()), // Start of current month
    to: new Date(), // Current date
  });
  const [showObjectivesModal, setShowObjectivesModal] = useState(false);
  const [applyDateFilter, setApplyDateFilter] = useState(true);
  const [showProfitPeriodModal, setShowProfitPeriodModal] = useState(false);

  // Détecter si on est en mode mobile ou PWA
  const deviceInfo = getDeviceInfo();
  const isMobileOrPWA = deviceInfo.isMobile || deviceInfo.isStandalone;

  // Get company colors with fallbacks - prioritize dashboard colors
  const getCompanyColors = () => {
    const colors = {
      primary: company?.dashboardColors?.primary || company?.primaryColor || '#183524',
      secondary: company?.dashboardColors?.secondary || company?.secondaryColor || '#e2b069',
      tertiary: company?.dashboardColors?.tertiary || company?.tertiaryColor || '#2a4a3a',
      headerText: company?.dashboardColors?.headerText || '#ffffff'
    };
    return colors;
  };
  const metricsOptions = [
    { value: 'profit', label: t('dashboard.stats.profit') },
    { value: 'totalExpenses', label: t('dashboard.stats.totalExpenses') },
    { value: 'totalProductsSold', label: t('dashboard.stats.totalProductsSold') },
    { value: 'deliveryFee', label: t('dashboard.stats.deliveryFee') },
    { value: 'totalSalesAmount', label: t('dashboard.stats.totalSalesAmount') },
    { value: 'totalSalesCount', label: t('dashboard.stats.totalSalesCount') },
  ];

  // Use dateRange directly
  const periodDates = dateRange;

  // 🎯 SMART SALES FILTERING: Use all sales when available, recent sales for immediate display
  const salesDataToUse = allSales.length > 0 ? allSales : sales;
  const filteredSales = salesDataToUse?.filter(sale => {
    if (!sale.createdAt?.seconds) return false;
    const saleDate = new Date(sale.createdAt.seconds * 1000);
    return saleDate >= periodDates.from && saleDate <= periodDates.to;
  });

  // Filter out soft-deleted expenses and apply date range filter
  const filteredExpenses = expenses?.filter(expense => {
    // First filter out soft-deleted expenses
    if (expense.isAvailable === false) return false;
    // Then apply date range filter
    if (!expense.createdAt?.seconds) return false;
    const expenseDate = new Date(expense.createdAt.seconds * 1000);
    return expenseDate >= periodDates.from && expenseDate <= periodDates.to;
  });

  // Calculate financial metrics using extracted functions
  // 💰 PROFIT: Use same calculation as Finance.tsx (calculateTotalProfit) for consistency
  // Only use calculateDashboardProfit if user has set a profit period preference
  const customDate = profitPeriodPreference?.periodStartDate 
    ? new Date(profitPeriodPreference.periodStartDate.seconds * 1000)
    : null;
  
  const actualStartDate = profitPeriodPreference?.periodType
    ? getPeriodStartDate(profitPeriodPreference.periodType, customDate)
    : null;
  
  // Use calculateTotalProfit (same as Finance.tsx) if no period preference, otherwise use calculateDashboardProfit
  const profit = actualStartDate
    ? calculateDashboardProfit(
        filteredSales || [],
        products || [],
        (stockChanges || []) as StockChange[],
        actualStartDate,
        dateRange.from
      )
    : calculateTotalProfit(
        filteredSales || [],
        products || [],
        (stockChanges || []) as StockChange[]
      );

  // 🔄 BACKGROUND DATA: Calculate expenses only when available
  // Note: Dashboard only uses expenses, not manual entries, so we pass an empty array for manual entries
  const totalExpenses = expensesLoading ? 0 : calculateTotalExpenses(filteredExpenses || [], []);

  // Total orders
  const totalOrders = calculateTotalOrders(filteredSales || []);

  // Total delivery fee (from sales)
  const totalDeliveryFee = calculateTotalDeliveryFee(filteredSales || []);

  // Total sales amount
  const totalSalesAmount = calculateTotalSalesAmount(filteredSales || []);

  // Calculate previous period for trend comparisons (same duration, shifted back)
  const periodDuration = differenceInDays(periodDates.to, periodDates.from);
  const previousPeriodStart = new Date(periodDates.from);
  previousPeriodStart.setDate(previousPeriodStart.getDate() - periodDuration - 1);
  const previousPeriodEnd = new Date(periodDates.from);
  previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);

  const previousPeriodSales = salesDataToUse?.filter(sale => {
    if (!sale.createdAt?.seconds) return false;
    const saleDate = new Date(sale.createdAt.seconds * 1000);
    return saleDate >= previousPeriodStart && saleDate <= previousPeriodEnd;
  }) || [];

  // Calculate unique clients count
  const uniqueClientsCount = useMemo(() => {
    const clientPhones = new Set<string>();
    filteredSales?.forEach(sale => {
      const phone = sale.customerInfo?.phone;
      if (phone) {
        clientPhones.add(phone);
      }
    });
    return clientPhones.size;
  }, [filteredSales]);

  // Calculate new metrics
  const newOrdersData = calculateNewOrders(filteredSales || [], previousPeriodSales);
  const newClientsData = calculateNewClients(filteredSales || [], previousPeriodSales);
  
  // Calculate sales by product category
  const salesByCategoryData = useMemo(() => 
    calculateSalesByCategory(filteredSales || [], products || []),
    [filteredSales, products]
  );

  // Calculate expenses by category
  const expensesByCategoryData = useMemo(() => 
    calculateExpensesByCategory(filteredExpenses || []),
    [filteredExpenses]
  );

  // Top sales (highest value sales)
  const topSalesData = useMemo(() => {
    return [...(filteredSales || [])]
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);
  }, [filteredSales]);
  
  const salesBySourceData = useMemo(() => 
    calculateSalesBySource(filteredSales || [], sources.map(s => ({ id: s.id, name: s.name }))),
    [filteredSales, sources]
  );

  // Calculate trend data for mini graphs (last 7 days)
  const salesTrendData = useMemo(() => 
    calculateTrendData(filteredSales || [], 7),
    [filteredSales]
  );

  // Calculate best clients
  const bestClientsData = useMemo(() => {
    const clientMap: Record<string, { name: string; phone: string; orders: number; totalSpent: number }> = {};
    
    filteredSales?.forEach(sale => {
      const phone = sale.customerInfo?.phone;
      if (!phone) return;
      
      if (!clientMap[phone]) {
        clientMap[phone] = {
          name: sale.customerInfo?.name || 'Aucun client',
          phone,
          orders: 0,
          totalSpent: 0
        };
      }
      
      clientMap[phone].orders += 1;
      clientMap[phone].totalSpent += sale.totalAmount;
    });
    
    return Object.values(clientMap)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5)
      .map(client => ({
        initials: client.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
        name: client.name,
        orders: client.orders,
        totalSpent: client.totalSpent
      }));
  }, [filteredSales]);

  // Latest orders (most recent 5)
  const latestOrders = useMemo(() => {
    return [...(filteredSales || [])]
      .sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [filteredSales]);

  // Best selling products (by quantity sold)
  const productSalesMap = useMemo(() => {
    const map: Record<string, { name: string; quantity: number; sales: number }> = {};
  filteredSales?.forEach(sale => {
    sale.products.forEach((product: SaleProduct) => {
      const productData = products?.find(p => p.id === product.productId);
      if (!productData) return;
        if (!map[product.productId]) {
          map[product.productId] = { name: productData.name, quantity: 0, sales: 0 };
      }
        map[product.productId].quantity += product.quantity;
        map[product.productId].sales += (product.negotiatedPrice || product.basePrice) * product.quantity;
    });
  });
    return map;
  }, [filteredSales, products]);

  const bestSellingProducts = useMemo(() => 
    Object.values(productSalesMap).sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    [productSalesMap]
  );

  // Best selling products for list (with product IDs)
  const bestProductsListData = useMemo(() => {
    return Object.entries(productSalesMap)
      .map(([productId, data]) => ({
        productId,
        name: data.name,
        orders: filteredSales?.filter(sale => 
          sale.products.some((p: SaleProduct) => p.productId === productId)
        ).length || 0,
        revenue: data.sales
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3);
  }, [productSalesMap, filteredSales]);

  // Process sales and expenses data for the chart
  const processChartData = () => {
    if (!filteredSales || !filteredExpenses) {
      return { labels: [], salesData: [], expensesData: [] };
    }
    const days = differenceInDays(dateRange.to, dateRange.from) + 1;
    let labels: string[] = [];
    let salesData: number[] = [];
    let expensesData: number[] = [];

    if (days <= 31) {
      // Group by day
      for (let i = 0; i < days; i++) {
        const d = addDays(dateRange.from, i);
        labels.push(format(d, 'dd/MM'));
        const salesSum = filteredSales.filter(sale => {
          if (!sale.createdAt?.seconds) return false;
          return isSameDay(new Date(sale.createdAt.seconds * 1000), d);
        }).reduce((sum, sale) => sum + sale.totalAmount, 0);
        const expensesSum = filteredExpenses.filter(exp => {
          if (!exp.createdAt?.seconds) return false;
          return isSameDay(new Date(exp.createdAt.seconds * 1000), d);
        }).reduce((sum, exp) => sum + exp.amount, 0);
        salesData.push(salesSum);
        expensesData.push(expensesSum);
      }
    } else if (days <= 180) {
      // Group by week
      let weekStart = startOfWeek(dateRange.from);
      let weekEnd = endOfWeek(weekStart);
      while (weekStart <= dateRange.to) {
        labels.push(format(weekStart, 'dd/MM') + ' - ' + format(weekEnd, 'dd/MM'));
        const salesSum = filteredSales.filter(sale => {
          if (!sale.createdAt?.seconds) return false;
          const d = new Date(sale.createdAt.seconds * 1000);
          return d >= weekStart && d <= weekEnd;
        }).reduce((sum, sale) => sum + sale.totalAmount, 0);
        const expensesSum = filteredExpenses.filter(exp => {
          if (!exp.createdAt?.seconds) return false;
          const d = new Date(exp.createdAt.seconds * 1000);
          return d >= weekStart && d <= weekEnd;
        }).reduce((sum, exp) => sum + exp.amount, 0);
        salesData.push(salesSum);
        expensesData.push(expensesSum);
        weekStart = addWeeks(weekStart, 1);
        weekEnd = endOfWeek(weekStart);
        if (weekEnd > dateRange.to) weekEnd = dateRange.to;
      }
    } else {
      // Group by month
      let monthStart = startMonth(dateRange.from);
      let monthEnd = endMonth(monthStart);
      while (monthStart <= dateRange.to) {
        labels.push(format(monthStart, 'MMM yyyy'));
        const salesSum = filteredSales.filter(sale => {
          if (!sale.createdAt?.seconds) return false;
          const d = new Date(sale.createdAt.seconds * 1000);
          return isSameMonth(d, monthStart);
        }).reduce((sum, sale) => sum + sale.totalAmount, 0);
        const expensesSum = filteredExpenses.filter(exp => {
          if (!exp.createdAt?.seconds) return false;
          const d = new Date(exp.createdAt.seconds * 1000);
          return isSameMonth(d, monthStart);
        }).reduce((sum, exp) => sum + exp.amount, 0);
        salesData.push(salesSum);
        expensesData.push(expensesSum);
        monthStart = addMonths(monthStart, 1);
        monthEnd = endMonth(monthStart);
        if (monthEnd > dateRange.to) monthEnd = dateRange.to;
      }
    }
    return { labels, salesData, expensesData };
  };

  const chartData = processChartData();

  // Generate the company's catalogue page URL
  const productPageUrl = company ? `${window.location.origin}/catalogue/${encodeURIComponent(company.name.toLowerCase().replace(/\s+/g, '-'))}/${company.companyId || company.id}` : '';
  const sitePage  = company ? company.website : false;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(productPageUrl);
      setCopied(true);
      showSuccessToast('Lien copié avec succès!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showErrorToast('Erreur lors de la copie du lien');
    }
  };

  const handleCopyLink2 = async () => {
    try {
      await navigator.clipboard.writeText(sitePage || '');
      setCopied2(true);
      showSuccessToast('Lien copié avec succès!');
      setTimeout(() => setCopied2(false), 2000);
    } catch (err) {
      showErrorToast('Erreur lors de la copie du lien');
    }
  };

  const handleShareLink2 = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Site web de ${company?.name}`,
          text: `Découvrez le site web de ${company?.name}`,
          url: sitePage || ''
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          showErrorToast('Erreur lors du partage');
        }
      }
    } else {
      // Fallback to copy if Web Share API is not available
      handleCopyLink2();
    }
  };
  const handleShareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Produits de ${company?.name}`,
          text: `Découvrez les produits de ${company?.name}`,
          url: productPageUrl
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          showErrorToast('Erreur lors du partage');
        }
      }
    } else {
      // Fallback to copy if Web Share API is not available
      handleCopyLink();
    }
  };

  const handleOpenCatalogue = async () => {
    // Détecter si on est en mode PWA standalone
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);
    
    // En mode PWA: utiliser le modal de partage natif
    if (isStandalone && navigator.share) {
      try {
        await navigator.share({
          title: `Catalogue - ${company?.name}`,
          text: `Découvrez le catalogue de ${company?.name}`,
          url: productPageUrl
        });
      } catch (err) {
        // Si l'utilisateur annule (AbortError), ne rien faire
        if ((err as Error).name !== 'AbortError') {
          // Si erreur autre que annulation, fallback vers ouverture normale
          window.open(productPageUrl, '_blank', 'noopener,noreferrer');
        }
      }
    } else {
      // En mode navigateur normal: ouvrir normalement
      window.open(productPageUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // 🚀 SHOW UI IMMEDIATELY: Only block for essential data
  if (essentialDataLoading) {
    return <LoadingScreen />;
  }

  // 🔄 BACKGROUND DATA: Process activities only when data is available
  const recentActivities = (expensesLoading || auditLogsLoading) 
    ? [] // Show empty while loading
    : combineActivities(filteredSales, filteredExpenses, auditLogs, t);

  // Table columns for best selling products
  type BestSellingProduct = { name: string; quantity: number; sales: number };
  const bestProductColumns = [
    { header: t('dashboard.bestSellingProducts.product'), accessor: (row: BestSellingProduct) => row.name },
    { header: t('dashboard.bestSellingProducts.quantitySold'), accessor: (row: BestSellingProduct) => row.quantity },
    { header: t('dashboard.bestSellingProducts.totalSales'), accessor: (row: BestSellingProduct) => `${row.sales.toLocaleString()} XAF` },
  ];

  // Total products sold (sum of all product quantities in filteredSales)
  const totalProductsSold = calculateTotalProductsSold(filteredSales || []);

  const statsMap = {
    profit,
    totalExpenses,
    totalProductsSold,
    deliveryFee: totalDeliveryFee,
    totalSalesAmount,
    totalSalesCount: totalOrders,
  };

  // 🔄 BACKGROUND DATA: Calculate balance only when finance data is available
  // Note: Dashboard only uses non-debt entries (no customer debt added), so we pass empty arrays for debt/refund
  const solde = financeLoading ? 0 : calculateSolde(
    financeEntries?.filter(entry => !entry.isDeleted) || [],
    [], // No debt entries for Dashboard calculation
    []  // No refund entries for Dashboard calculation
  );

  // Calculate previous period unique clients for trend
  const previousPeriodClients = useMemo(() => {
    const clientPhones = new Set<string>();
    previousPeriodSales?.forEach(sale => {
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

  // Get period label based on date range
  const getPeriodLabel = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const monthStart = startMonth(new Date());
    const yearStart = new Date(today.getFullYear(), 0, 1);
    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 30);
    last30Days.setHours(0, 0, 0, 0);
    
    if (periodDates.from.getTime() === monthStart.getTime() && periodDates.to.getTime() === today.getTime()) {
      return t('dashboard.period.thisMonth', { defaultValue: 'Ce mois' });
    } else if (periodDates.from.getTime() === yearStart.getTime() && periodDates.to.getTime() === today.getTime()) {
      return t('dashboard.period.thisYear', { defaultValue: 'Cette année' });
    } else if (periodDates.from.getTime() === last30Days.getTime() && periodDates.to.getTime() === today.getTime()) {
      return t('dashboard.period.last30Days', { defaultValue: '30 derniers jours' });
    } else {
      return `${format(periodDates.from, 'dd MMM')} - ${format(periodDates.to, 'dd MMM yyyy')}`;
    }
  };

  // 🎯 STAT CARDS: 4 KPI Cards with trends and mini graphs
  const statCards: { 
    title: string; 
    value: string | number; 
    icon: JSX.Element; 
    type: 'products' | 'sales' | 'expenses' | 'profit' | 'orders' | 'delivery' | 'solde'; 
    loading?: boolean; 
    trend?: { value: number; isPositive: boolean };
    trendData?: number[];
    periodLabel?: string;
  }[] = [
    { 
      title: t('dashboard.stats.totalSalesAmount', { defaultValue: 'Ventes totales' }), 
      value: `${totalSalesAmount.toLocaleString()} FCFA`, 
      icon: <DollarSign size={20} />, 
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
      periodLabel: getPeriodLabel()
    },
    { 
      title: t('dashboard.stats.profit', { defaultValue: 'Profit' }), 
      value: `${profit.toLocaleString()} FCFA`, 
      icon: <TrendingUp size={20} />, 
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
      periodLabel: getPeriodLabel()
    },
    { 
      title: t('dashboard.stats.totalExpenses', { defaultValue: 'Dépenses totales' }), 
      value: `${totalExpenses.toLocaleString()} FCFA`, 
      icon: <Receipt size={20} />, 
      type: 'expenses',
      loading: expensesLoading,
      trend: (() => {
        const previousExpenses = expenses?.filter(expense => {
          if (expense.isAvailable === false) return false;
          if (!expense.createdAt?.seconds) return false;
          const expenseDate = new Date(expense.createdAt.seconds * 1000);
          return expenseDate >= previousPeriodStart && expenseDate <= previousPeriodEnd;
        }) || [];
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
      periodLabel: getPeriodLabel()
    },
    { 
      title: t('dashboard.stats.clients', { defaultValue: 'Clients' }), 
      value: uniqueClientsCount, 
      icon: <Users size={20} />, 
      type: 'sales',
      loading: salesLoading,
      trend: clientsTrend,
      trendData: salesTrendData,
      periodLabel: getPeriodLabel()
    },
  ];

  return (
    <div className="pb-16 md:pb-0">
      {/* Dashboard Header with Company Colors - First Item */}
      <div className="mb-6 rounded-lg overflow-hidden" style={{
        background: `linear-gradient(135deg, ${getCompanyColors().primary} 0%, ${getCompanyColors().secondary} 50%, ${getCompanyColors().tertiary} 100%)`,
        color: getCompanyColors().headerText
      }}>
        <div className="px-6 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
            <div>
              <h1 className="text-3xl font-bold" style={{color: getCompanyColors().headerText}}>{t('dashboard.title')}</h1>
              <p className="text-lg mt-1" style={{color: `${getCompanyColors().headerText}CC`}}>{t('dashboard.welcome')}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                icon={<FileBarChart size={16} />}
                onClick={() => navigate(`/company/${companyId}/reports?period=today`)}
                className="bg-white/20 border-white/30 text-white hover:bg-white/30 backdrop-blur-sm"
              >
                {t('dashboard.viewTodayReports')}
              </Button>
              <Button
                variant="outline"
                icon={<Info size={16} />}
                onClick={() => setShowCalculationsModal(true)}
                className="bg-white/20 border-white/30 text-white hover:bg-white/30 backdrop-blur-sm"
              >
                {t('dashboard.guide', { defaultValue: 'Guide' })}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Objectives global bar */}
      {(expensesLoading || stockChangesLoading) ? (
        <SkeletonObjectivesBar />
      ) : (
        <ObjectivesBar
          onAdd={() => { setShowObjectivesModal(true); }}
          onView={() => { setShowObjectivesModal(true); }}
          stats={statsMap}
          dateRange={dateRange}
          applyDateFilter={applyDateFilter}
          onToggleFilter={setApplyDateFilter}
          sales={sales}
          expenses={expenses}
          products={products}
          stockChanges={stockChanges}
        />
      )}
      {showObjectivesModal && (
        <ObjectivesModal
          isOpen={showObjectivesModal}
          onClose={() => setShowObjectivesModal(false)}
          stats={statsMap}
          dateRange={dateRange}
          metricsOptions={metricsOptions}
          applyDateFilter={applyDateFilter}
          sales={sales}
          expenses={expenses}
          products={products}
          stockChanges={stockChanges}
          onAfterAdd={() => setApplyDateFilter(false)}
        />
      )}

      {/* Period Filter - DateRangePicker with horizontal layout */}
      <div className="mb-6">
        <DateRangePicker 
          onChange={(range) => {
            setDateRange(range);
          }}
          className="w-full" 
        />
      </div>
      {/* Profit Period Modal */}
      {showProfitPeriodModal && (
        <ProfitPeriodModal
          isOpen={showProfitPeriodModal}
          onClose={() => setShowProfitPeriodModal(false)}
          currentPeriodType={profitPeriodPreference?.periodType}
          currentCustomDate={customDate}
          onSetPeriod={setPeriod}
          onClearPeriod={clearPeriod}
        />
      )}
      {/* Stats section */}
      <div className="mb-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold" style={{color: getCompanyColors().primary}}>
            {t('dashboard.stats.title')}
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {statCards.map((card, index) => (
            card.loading ? (
              <SkeletonStatCard key={`skeleton-${index}`} />
            ) : (
              <StatCard
                key={index}
                title={card.title}
                value={card.value}
                icon={card.icon}
                type={card.type}
                trend={card.trend}
                trendData={card.trendData}
                periodLabel={card.periodLabel}
              />
            )
          ))}
        </div>
      </div>
      
      {/* Data Loading Status */}
      {loadingAllSales && (
        <div className="mb-4 p-4 rounded-lg border-2" style={{backgroundColor: `${getCompanyColors().primary}20`, borderColor: `${getCompanyColors().primary}40`}}>
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 mr-3" style={{borderColor: getCompanyColors().primary}}></div>
            <span className="text-sm font-medium" style={{color: getCompanyColors().primary}}>Loading complete sales history for accurate calculations...</span>
          </div>
        </div>
      )}
      
      {allSales.length > 0 && !loadingAllSales && allSales.length > sales.length && (
        <div className="mb-4 p-4 rounded-lg border-2" style={{backgroundColor: `${getCompanyColors().secondary}20`, borderColor: `${getCompanyColors().secondary}40`}}>
          <div className="flex items-center">
            <div className="h-5 w-5 rounded-full mr-3" style={{backgroundColor: getCompanyColors().secondary}}></div>
            <span className="text-sm font-medium" style={{color: getCompanyColors().secondary}}>
              Complete data loaded: {allSales.length} total sales (showing calculations for all data)
            </span>
          </div>
        </div>
      )}
      {/* Charts and Sidebar Section - 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left Column - Donut Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sales by Product Category Chart */}
          {(salesLoading || productsLoading) ? (
            <SkeletonChart />
          ) : (
            <DonutChart
              title={t('dashboard.salesByCategory.title', { defaultValue: 'Ventes par catégorie de produits' })}
              data={salesByCategoryData.map(item => ({
                label: item.category,
                value: item.amount
              }))}
              periodFilter={
                <select 
                  className="text-sm border border-gray-300 rounded-md px-2 py-1"
                  defaultValue="thisYear"
                >
                  <option value="thisYear">{t('dashboard.period.thisYear', { defaultValue: 'Cette année' })}</option>
                  <option value="thisMonth">{t('dashboard.period.thisMonth', { defaultValue: 'Ce mois' })}</option>
                  <option value="last30Days">{t('dashboard.period.last30Days', { defaultValue: '30 derniers jours' })}</option>
                </select>
              }
            />
          )}

          {/* Expenses by Category Chart */}
        {expensesLoading ? (
          <SkeletonChart />
        ) : (
            <DonutChart
              title={t('dashboard.expensesByCategory.title', { defaultValue: 'Dépenses par catégorie' })}
              data={expensesByCategoryData.map(item => ({
                label: item.category,
                value: item.amount
              }))}
              periodFilter={
                <select 
                  className="text-sm border border-gray-300 rounded-md px-2 py-1"
                  defaultValue="thisYear"
                >
                  <option value="thisYear">{t('dashboard.period.thisYear', { defaultValue: 'Cette année' })}</option>
                  <option value="thisMonth">{t('dashboard.period.thisMonth', { defaultValue: 'Ce mois' })}</option>
                  <option value="last30Days">{t('dashboard.period.last30Days', { defaultValue: '30 derniers jours' })}</option>
                </select>
              }
            />
          )}

          {/* Sales by Source Chart */}
          {salesLoading ? (
            <SkeletonChart />
          ) : (
            <DonutChart
              title={t('dashboard.salesBySource.title', { defaultValue: 'Ventes par source' })}
              data={salesBySourceData.map(item => ({
                label: item.source,
                value: item.amount
              }))}
              periodFilter={
                <select 
                  className="text-sm border border-gray-300 rounded-md px-2 py-1"
                  defaultValue="thisYear"
                >
                  <option value="thisYear">{t('dashboard.period.thisYear', { defaultValue: 'Cette année' })}</option>
                  <option value="thisMonth">{t('dashboard.period.thisMonth', { defaultValue: 'Ce mois' })}</option>
                  <option value="last30Days">{t('dashboard.period.last30Days', { defaultValue: '30 derniers jours' })}</option>
                </select>
              }
          />
        )}
      </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Top Sales */}
          <TopSales
            sales={topSalesData}
            onViewMore={() => navigate(`/company/${companyId}/sales`)}
          />

          {/* Best Clients */}
          <BestClients
            clients={bestClientsData}
            onViewMore={() => navigate(`/company/${companyId}/contacts`)}
          />

          {/* Best Products */}
          <BestProductsList
            products={bestProductsListData}
            allProducts={products || []}
            onViewAll={() => navigate(`/company/${companyId}/products`)}
          />
        </div>
      </div>

      {/* Bottom Section - Latest Orders and Best Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Latest Orders Table */}
        {(salesLoading || loadingAllSales) ? (
          <SkeletonTable rows={5} />
        ) : (
          <LatestOrdersTable
            orders={latestOrders}
            onOrderClick={(order: Sale) => navigate(`/company/${companyId}/sales?orderId=${order.id}`)}
          />
        )}

        {/* Best Products List */}
        {(salesLoading || loadingAllSales) ? (
          <SkeletonTable rows={3} />
        ) : (
          <BestProductsList
            products={bestProductsListData}
            allProducts={products || []}
            onViewAll={() => navigate(`/company/${companyId}/products`)}
          />
        )}
      </div>
      {/* Calculations Explanation Modal */}
      <Modal
        isOpen={showCalculationsModal}
        onClose={() => setShowCalculationsModal(false)}
        title={t('dashboard.calculations.title')}
        size="lg"
      >
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.profit.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.profit.description')}
              <br /><br />
              {t('dashboard.calculations.profit.formula')}
              <br /><br />
              {t('dashboard.calculations.profit.example')}
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.totalExpenses.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.totalExpenses.description')}
              <br /><br />
              {t('dashboard.calculations.totalExpenses.formula')}
              <br /><br />
              {t('dashboard.calculations.totalExpenses.includes')}
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.totalSalesAmount.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.totalSalesAmount.description')}
              <br /><br />
              {t('dashboard.calculations.totalSalesAmount.formula')}
              <br /><br />
              {t('dashboard.calculations.totalSalesAmount.note')}
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.totalPurchasePrice.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.totalPurchasePrice.description')}
              <br /><br />
              {t('dashboard.calculations.totalPurchasePrice.formula')}
              <br /><br />
              {t('dashboard.calculations.totalPurchasePrice.example')}
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.deliveryFee.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.deliveryFee.description')}
              <br /><br />
              {t('dashboard.calculations.deliveryFee.formula')}
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.balance.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.balance.description')}
              <br /><br />
              <b>{t('dashboard.calculations.balance.formula')}</b>
              <br /><br />
              {t('dashboard.calculations.balance.note')}
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.totalDebt.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.totalDebt.description')}
              <br /><br />
              <b>{t('dashboard.calculations.totalDebt.formula')}</b>
              <br /><br />
              {t('dashboard.calculations.totalDebt.note')}
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.bestSellingProducts.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.bestSellingProducts.description')}
              <br /><br />
              {t('dashboard.calculations.bestSellingProducts.formula')}
              <br /><br />
              {t('dashboard.calculations.bestSellingProducts.note')}
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;