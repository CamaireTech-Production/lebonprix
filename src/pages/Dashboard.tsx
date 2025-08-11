import { ShoppingCart, DollarSign, TrendingUp, Package2, BarChart2, Info, Receipt, Copy, Check, ExternalLink, Plus } from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import SalesChart from '../components/dashboard/SalesChart';
import ActivityList from '../components/dashboard/ActivityList';
import Table from '../components/common/Table';
import Card from '../components/common/Card';
import { useSales, useExpenses, useProducts, useStockChanges, useFinanceEntries } from '../hooks/useFirestore';
import LoadingScreen from '../components/common/LoadingScreen';
import { useState } from 'react';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import { useAuth } from '../contexts/AuthContext';
import type { DashboardStats } from '../types/models';
import { showSuccessToast, showErrorToast } from '../utils/toast';
import { useTranslation } from 'react-i18next';
import { getLatestCostPrice } from '../utils/productUtils';
import { startOfMonth, endOfMonth, differenceInDays, format, startOfWeek, endOfWeek, addDays, addWeeks, startOfMonth as startMonth, endOfMonth as endMonth, addMonths, isSameMonth, isSameWeek, isSameDay } from 'date-fns';
import DateRangePicker from '../components/common/DateRangePicker';
import ObjectivesBar from '../components/objectives/ObjectivesBar';
import ObjectivesModal from '../components/objectives/ObjectivesModal';

const Dashboard = () => {
  const { t } = useTranslation();
  const { sales, loading: salesLoading } = useSales();
  const { expenses, loading: expensesLoading } = useExpenses();
  const { products, loading: productsLoading } = useProducts();
  const { stockChanges, loading: stockChangesLoading } = useStockChanges();
  const { entries: financeEntries, loading: financeLoading } = useFinanceEntries();
  const [showCalculationsModal, setShowCalculationsModal] = useState(false);
  const { company } = useAuth();
  const [] = useState<Partial<DashboardStats>>({});
  const [copied, setCopied] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: new Date(2025, 3, 1), // April 1st, 2025
    to: new Date(2100, 0, 1),
  });
  const [showObjectivesModal, setShowObjectivesModal] = useState(false);
  const [applyDateFilter, setApplyDateFilter] = useState(true);
  const metricsOptions = [
    { value: 'profit', label: t('dashboard.stats.profit') },
    { value: 'totalExpenses', label: t('dashboard.stats.totalExpenses') },
    { value: 'totalProductsSold', label: t('dashboard.stats.totalProductsSold') },
    { value: 'deliveryFee', label: t('dashboard.stats.deliveryFee') },
    { value: 'totalSalesAmount', label: t('dashboard.stats.totalSalesAmount') },
    { value: 'totalSalesCount', label: t('dashboard.stats.totalSalesCount') },
  ];

  // Filter sales and expenses by selected date range
  const filteredSales = sales?.filter(sale => {
    if (!sale.createdAt?.seconds) return false;
    const saleDate = new Date(sale.createdAt.seconds * 1000);
    return saleDate >= dateRange.from && saleDate <= dateRange.to;
  });

  const filteredExpenses = expenses?.filter(expense => {
    if (!expense.createdAt?.seconds) return false;
    const expenseDate = new Date(expense.createdAt.seconds * 1000);
    return expenseDate >= dateRange.from && expenseDate <= dateRange.to;
  });

  // Calculate profit (gross profit: selling price - purchase price) * quantity for all sales
  const profit = filteredSales?.reduce((sum, sale) => {
    return sum + sale.products.reduce((productSum, product) => {
      const productData = products?.find(p => p.id === product.productId);
      if (!productData) return productSum;
      const sellingPrice = product.negotiatedPrice || product.basePrice;
      const costPrice = getLatestCostPrice(productData.id, stockChanges);
      if (costPrice === undefined) return productSum;
      return productSum + (sellingPrice - costPrice) * product.quantity;
    }, 0);
  }, 0) || 0;

  // Calculate total expenses
  const totalExpenses = filteredExpenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;

  // Total orders
  const totalOrders = filteredSales?.length || 0;

  // Total delivery fee (from sales)
  const totalDeliveryFee = filteredSales?.reduce((sum, sale) => sum + (sale.deliveryFee || 0), 0) || 0;

  // Total sales amount
  const totalSalesAmount = filteredSales?.reduce((sum, sale) => sum + sale.totalAmount, 0) || 0;

  // Calculate total purchase price for all products in stock as of the end of the selected period
  const getStockAtDate = (productId: string, date: Date) => {
    // Sum all stock changes for this product up to and including the date
    return stockChanges
      .filter((sc: any) => sc.productId === productId && sc.createdAt?.seconds && new Date(sc.createdAt.seconds * 1000) <= date)
      .reduce((sum: number, sc: any) => sum + sc.change, 0);
  };
  const totalPurchasePrice = products?.reduce((sum, product) => {
    const stockAtDate = getStockAtDate(product.id, dateRange.to);
    const costPrice = getLatestCostPrice(product.id, stockChanges);
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

  // Generate the company's product page URL
  const productPageUrl = company ? `${window.location.origin}/company/${company.id}/products` : '';

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

  if (salesLoading || expensesLoading || productsLoading || stockChangesLoading || financeLoading) {
    return <LoadingScreen />;
  }

  // Process recent activities
  const recentActivities = [
    ...(filteredSales?.slice(0, 3).map(sale => ({
      id: sale.id,
      title: 'New sale recorded',
      description: `${sale.customerInfo.name} purchased items for ${sale.totalAmount.toLocaleString()} XAF`,
      timestamp: sale.createdAt?.seconds ? new Date(sale.createdAt.seconds * 1000) : new Date(),
      type: 'sale' as const,
    })) || []),
    ...(filteredExpenses?.slice(0, 3).map(expense => ({
      id: expense.id,
      title: 'Expense added',
      description: `${expense.description}: ${expense.amount.toLocaleString()} XAF`,
      timestamp: expense.createdAt?.seconds ? new Date(expense.createdAt.seconds * 1000) : new Date(),
      type: 'expense' as const,
    })) || []),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Table columns for best selling products
  const bestProductColumns = [
    { header: t('dashboard.bestSellingProducts.product'), accessor: (row: any) => row.name },
    { header: t('dashboard.bestSellingProducts.quantitySold'), accessor: (row: any) => row.quantity },
    { header: t('dashboard.bestSellingProducts.totalSales'), accessor: (row: any) => `${row.sales.toLocaleString()} XAF` },
  ];

  // Total products sold (sum of all product quantities in filteredSales)
  const totalProductsSold = filteredSales?.reduce((sum, sale) => sum + sale.products.reduce((pSum, p) => pSum + p.quantity, 0), 0) || 0;

  const statsMap = {
    profit,
    totalExpenses,
    totalProductsSold,
    deliveryFee: totalDeliveryFee,
    totalSalesAmount,
    totalSalesCount: totalOrders,
  };

  // Calculate balance (solde) from all active finance entries (not soft deleted)
  const activeFinanceEntries = financeEntries?.filter(entry => !entry.isDeleted) || [];
  const solde = activeFinanceEntries.reduce((sum, entry) => sum + entry.amount, 0);

  // Stat cards (show only solde, profit, depense, produit vendu)
  const statCards: { title: string; value: string | number; icon: JSX.Element; type: 'products' | 'sales' | 'expenses' | 'profit' | 'orders' | 'delivery' | 'solde'; }[] = [
    { title: t('dashboard.stats.solde'), value: `${solde.toLocaleString()} XAF`, icon: <DollarSign size={20} />, type: 'solde' },
    { title: t('dashboard.stats.profit'), value: `${profit.toLocaleString()} XAF`, icon: <TrendingUp size={20} />, type: 'profit' },
    { title: t('dashboard.stats.expenses'), value: `${totalExpenses.toLocaleString()} XAF`, icon: <Receipt size={20} />, type: 'expenses' },
    { title: t('dashboard.stats.productsSold'), value: totalProductsSold, icon: <Package2 size={20} />, type: 'products' },
  ];

  return (
    <div className="pb-16 md:pb-0">
      {/* Company Products Link Section */}
      {company && (
        <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                {t('dashboard.publicProducts.title')}
              </h2>
              <p className="text-sm text-gray-600">
                {t('dashboard.publicProducts.description')}
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-grow">
                  <div className="relative">
                    <input
                      type="text"
                      value={productPageUrl}
                      readOnly
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50 text-sm"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      title={t('dashboard.publicProducts.copyLink')}
                    >
                      {copied ? (
                        <Check className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Copy className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 sm:w-auto">
                  <a
                    href={productPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t('dashboard.publicProducts.open')}
                  </a>
                  <button
                    onClick={handleShareLink}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t('dashboard.publicProducts.share')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6 mt-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('dashboard.title')}</h1>
          <p className="text-gray-600">{t('dashboard.welcome')}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            icon={<Info size={16} />}
            onClick={() => setShowCalculationsModal(true)}
          >
            {t('dashboard.howCalculated')}
          </Button>
        </div>
      </div>
      <div className="mb-6 flex">
        <div className="max-w-md w-full">
          <DateRangePicker onChange={setDateRange} className="w-full" />
        </div>
      </div>
      {/* Objectives global bar */}
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
      />
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
        />
      )}
      {/* Stats section */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card, index) => (
          <StatCard
            key={index}
            title={card.title}
            value={card.value}
            icon={card.icon}
            type={card.type}
          />
        ))}
      </div>
      {/* Chart section */}
      <div className="mb-6">
        <SalesChart
          labels={chartData.labels}
          salesData={chartData.salesData}
          expensesData={chartData.expensesData}
        />
      </div>
      {/* Best Selling Products Table */}
      <div className="mb-6">
        <Card title={t('dashboard.bestSellingProducts.title')}>
          <Table
            data={bestSellingProducts}
            columns={bestProductColumns}
            keyExtractor={row => row.name}
            emptyMessage={t('dashboard.bestSellingProducts.noData')}
          />
        </Card>
      </div>
      {/* Activity section */}
      <div>
        <ActivityList activities={recentActivities} />
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