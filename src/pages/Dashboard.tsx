import { DollarSign, TrendingUp, Package2, Info, Receipt, ScanLine, FileBarChart} from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import SalesChart from '../components/dashboard/SalesChart';
import ActivityList from '../components/dashboard/ActivityList';
import Table from '../components/common/Table';
import Card from '../components/common/Card';
import { useSales, useExpenses, useProducts, useStockChanges, useFinanceEntries, useAuditLogs } from '../hooks/useFirestore';
import { subscribeToAllSales } from '../services/firestore';
import LoadingScreen from '../components/common/LoadingScreen';
import { SkeletonStatCard, SkeletonChart, SkeletonTable, SkeletonActivityList, SkeletonObjectivesBar } from '../components/common/SkeletonLoader';
import React, { useState, useEffect } from 'react';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import { useAuth } from '../contexts/AuthContext';
import type { DashboardStats, StockChange } from '../types/models';
import { showSuccessToast, showErrorToast } from '../utils/toast';
import { useTranslation } from 'react-i18next';
import { getLatestCostPrice } from '../utils/productUtils';
import { useNavigate, useParams } from 'react-router-dom';
import { useRolePermissions } from '../hooks/useRolePermissions';
import {
  calculateTotalProfit,
  calculateDashboardProfit,
  calculateTotalExpenses,
  calculateSolde,
  calculateTotalSalesAmount,
  calculateTotalDeliveryFee,
  calculateTotalProductsSold,
  calculateTotalOrders
} from '../utils/financialCalculations';
import { useProfitPeriod } from '../hooks/useProfitPeriod';
import { getPeriodStartDate, getPeriodShortLabel } from '../utils/profitPeriodUtils';
import { differenceInDays, format, startOfWeek, endOfWeek, addDays, addWeeks, startOfMonth as startMonth, endOfMonth as endMonth, addMonths, isSameMonth, isSameDay } from 'date-fns';
import DateRangePicker from '../components/common/DateRangePicker';
import ObjectivesBar from '../components/objectives/ObjectivesBar';
import ObjectivesModal from '../components/objectives/ObjectivesModal';
import ProfitPeriodModal from '../components/dashboard/ProfitPeriodModal';
import { combineActivities } from '../utils/activityUtils';
import { getDeviceInfo } from '../utils/deviceDetection';

const Dashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { companyId } = useParams<{ companyId: string }>();
  
  // 🚀 PROGRESSIVE LOADING: Load essential data first
  const { sales, loading: salesLoading } = useSales();
  const { products, loading: productsLoading } = useProducts();
  
  // 🔄 BACKGROUND LOADING: Load all sales in background after initial render
  const [allSales, setAllSales] = useState<any[]>([]);
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
  const [] = useState<Partial<DashboardStats>>({});
  const [dateRange, setDateRange] = useState({
    from: new Date(2025, 0, 1), // January 1st, 2025
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

  // 🎯 SMART SALES FILTERING: Use all sales when available, recent sales for immediate display
  const salesDataToUse = allSales.length > 0 ? allSales : sales;
  const filteredSales = salesDataToUse?.filter(sale => {
    if (!sale.createdAt?.seconds) return false;
    const saleDate = new Date(sale.createdAt.seconds * 1000);
    return saleDate >= dateRange.from && saleDate <= dateRange.to;
  });

  // Filter out soft-deleted expenses and apply date range filter
  const filteredExpenses = expenses?.filter(expense => {
    // First filter out soft-deleted expenses
    if (expense.isAvailable === false) return false;
    // Then apply date range filter
    if (!expense.createdAt?.seconds) return false;
    const expenseDate = new Date(expense.createdAt.seconds * 1000);
    return expenseDate >= dateRange.from && expenseDate <= dateRange.to;
  });

  // Calculate financial metrics using extracted functions
  // 💰 PROFIT PERIOD: Calculate profit with dynamic date from periodType (Dashboard only)
  const customDate = profitPeriodPreference?.periodStartDate 
    ? new Date(profitPeriodPreference.periodStartDate.seconds * 1000)
    : null;
  
  const actualStartDate = profitPeriodPreference?.periodType
    ? getPeriodStartDate(profitPeriodPreference.periodType, customDate)
    : null;
  
  const profit = calculateDashboardProfit(
    filteredSales || [],
    products || [],
    (stockChanges || []) as StockChange[],
    actualStartDate,
    dateRange.from
  );
  
  // Also calculate all-time profit for comparison (optional)
  const allTimeProfit = calculateTotalProfit(filteredSales || [], products || [], (stockChanges || []) as StockChange[]);

  // 🔄 BACKGROUND DATA: Calculate expenses only when available
  // Note: Dashboard only uses expenses, not manual entries, so we pass an empty array for manual entries
  const totalExpenses = expensesLoading ? 0 : calculateTotalExpenses(filteredExpenses || [], []);

  // Total orders
  const totalOrders = calculateTotalOrders(filteredSales || []);

  // Total delivery fee (from sales)
  const totalDeliveryFee = calculateTotalDeliveryFee(filteredSales || []);

  // Total sales amount
  const totalSalesAmount = calculateTotalSalesAmount(filteredSales || []);

  // Calculate total purchase price for all products in stock as of the end of the selected period
  const getStockAtDate = (productId: string, date: Date) => {
    // Sum all stock changes for this product up to and including the date
    return stockChanges
      .filter((sc: any) => sc.productId === productId && sc.createdAt?.seconds && new Date(sc.createdAt.seconds * 1000) <= date)
      .reduce((sum: number, sc: any) => sum + sc.change, 0);
  };
  const totalPurchasePrice = products?.reduce((sum, product) => {
    const stockAtDate = getStockAtDate(product.id, dateRange.to);
    const safeStockChanges = Array.isArray(stockChanges) ? (stockChanges as StockChange[]) : [];
    const costPrice = getLatestCostPrice(product.id, safeStockChanges);
    if (costPrice === undefined) return sum;
    return sum + (costPrice * stockAtDate);
  }, 0) || 0;

  // Best selling products (by quantity sold)
  const productSalesMap: Record<string, { name: string; quantity: number; sales: number }> = {};
  filteredSales?.forEach(sale => {
    sale.products.forEach(product => {
      const productData = products?.find(p => p.id === product.productId);
      if (!productData) return;
      if (!productSalesMap[product.productId]) {
        productSalesMap[product.productId] = { name: productData.name, quantity: 0, sales: 0 };
      }
      productSalesMap[product.productId].quantity += product.quantity;
      productSalesMap[product.productId].sales += (product.negotiatedPrice || product.basePrice) * product.quantity;
    });
  });
  const bestSellingProducts = Object.values(productSalesMap).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

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

  // 🚀 SHOW UI IMMEDIATELY: Only block for essential data
  if (essentialDataLoading) {
    return <LoadingScreen />;
  }

  // 🔄 BACKGROUND DATA: Process activities only when data is available
  const recentActivities = (expensesLoading || auditLogsLoading) 
    ? [] // Show empty while loading
    : combineActivities(filteredSales, filteredExpenses, auditLogs, t);

  // Table columns for best selling products
  const bestProductColumns = [
    { header: t('dashboard.bestSellingProducts.product'), accessor: (row: any) => row.name },
    { header: t('dashboard.bestSellingProducts.quantitySold'), accessor: (row: any) => row.quantity },
    { header: t('dashboard.bestSellingProducts.totalSales'), accessor: (row: any) => `${row.sales.toLocaleString()} XAF` },
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

  // 🎯 STAT CARDS: Show loading states for background data
  const statCards: { title: string; value: string | number; icon: JSX.Element; type: 'products' | 'sales' | 'expenses' | 'profit' | 'orders' | 'delivery' | 'solde'; loading?: boolean; periodLabel?: string; showPeriodIndicator?: boolean; onPeriodSettingsClick?: () => void; }[] = [
    { 
      title: t('dashboard.stats.solde'), 
      value: financeLoading ? '...' : `${solde.toLocaleString()} XAF`, 
      icon: <DollarSign size={20} />, 
      type: 'solde',
      loading: financeLoading
    },
    { 
      title: t('dashboard.stats.profit'), 
      value: stockChangesLoading ? '...' : `${profit.toLocaleString()} XAF`, 
      icon: <TrendingUp size={20} />, 
      type: 'profit',
      loading: stockChangesLoading,
      periodLabel: profitPeriodPreference?.periodType 
        ? getPeriodShortLabel(profitPeriodPreference.periodType, customDate)
        : 'All Time',
      showPeriodIndicator: true,
      onPeriodSettingsClick: () => setShowProfitPeriodModal(true)
    },
    { 
      title: t('dashboard.stats.expenses'), 
      value: expensesLoading ? '...' : `${totalExpenses.toLocaleString()} XAF`, 
      icon: <Receipt size={20} />, 
      type: 'expenses',
      loading: expensesLoading
    },
    { 
      title: t('dashboard.stats.productsSold'), 
      value: totalProductsSold, 
      icon: <Package2 size={20} />, 
      type: 'products',
      loading: false // Products already loaded
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
                icon={<Info size={16} />}
                onClick={() => setShowCalculationsModal(true)}
                className="bg-white/20 border-white/30 text-white hover:bg-white/30 backdrop-blur-sm"
              >
                {t('dashboard.howCalculated')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Section - Report of the Day and Period Filter */}
      {companyId && (
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-lg font-semibold mb-1" style={{color: getCompanyColors().primary}}>
                {t('dashboard.quickActions')}
              </h3>
              <p className="text-sm text-gray-600">
                {t('dashboard.quickActionsDescription')}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Period Filter - Left */}
              <div className="flex-1 sm:max-w-md w-full">
                <DateRangePicker onChange={setDateRange} className="w-full" />
              </div>
              {/* Report of the Day Button - Right */}
              <Button
                onClick={() => navigate(`/company/${companyId}/reports?period=today`)}
                icon={<FileBarChart size={20} />}
                variant="outline"
              >
                {t('dashboard.viewTodayReports')}
              </Button>
            </div>
          </div>
        </div>
      )}
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
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                periodLabel={card.periodLabel}
                showPeriodIndicator={card.showPeriodIndicator}
                onPeriodSettingsClick={card.onPeriodSettingsClick}
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
      {/* Chart section */}
      <div className="mb-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold" style={{color: getCompanyColors().primary}}>
            {t('dashboard.salesChart.title')}
          </h3>
        </div>
        {expensesLoading ? (
          <SkeletonChart />
        ) : (
          <SalesChart
            labels={chartData.labels}
            salesData={chartData.salesData}
            expensesData={chartData.expensesData}
          />
        )}
      </div>
      {/* Best Selling Products Table */}
      <div className="mb-6">
        {(salesLoading || loadingAllSales) ? (
          <SkeletonTable rows={5} />
        ) : (
          <Card title={t('dashboard.bestSellingProducts.title')}>
            <div className="mb-4">
              <h3 className="text-lg font-semibold" style={{color: getCompanyColors().primary}}>
                {t('dashboard.bestSellingProducts.title')}
              </h3>
            </div>
            <Table
              data={bestSellingProducts}
              columns={bestProductColumns}
              keyExtractor={row => row.name}
              emptyMessage={t('dashboard.bestSellingProducts.noData')}
            />
          </Card>
        )}
      </div>
      {/* Activity section */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold" style={{color: getCompanyColors().primary}}>
            {t('dashboard.recentActivity.title')}
          </h3>
        </div>
        {(expensesLoading || auditLogsLoading) ? (
          <SkeletonActivityList />
        ) : (
          <ActivityList activities={recentActivities} />
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