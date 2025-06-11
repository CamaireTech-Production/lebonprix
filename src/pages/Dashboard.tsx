import { ShoppingCart, DollarSign, TrendingUp, Package2, BarChart2, Info, Receipt, Copy, Check, ExternalLink } from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import SalesChart from '../components/dashboard/SalesChart';
import ActivityList from '../components/dashboard/ActivityList';
import Table from '../components/common/Table';
import Card from '../components/common/Card';
import { useSales, useExpenses, useProducts } from '../hooks/useFirestore';
import LoadingScreen from '../components/common/LoadingScreen';
import { useState } from 'react';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import { useAuth } from '../contexts/AuthContext';
import type { DashboardStats } from '../types/models';
import { showSuccessToast, showErrorToast } from '../utils/toast';
import { useTranslation } from 'react-i18next';

const Dashboard = () => {
  const { t } = useTranslation();
  const { sales, loading: salesLoading } = useSales();
  const { expenses, loading: expensesLoading } = useExpenses();
  const { products, loading: productsLoading } = useProducts();
  const [showCalculationsModal, setShowCalculationsModal] = useState(false);
  const { company } = useAuth();
  const [] = useState<Partial<DashboardStats>>({});
  const [copied, setCopied] = useState(false);

  // Calculate gross profit (selling price - cost price) * quantity for all sales
  const grossProfit = sales?.reduce((sum, sale) => {
    return sum + sale.products.reduce((productSum, product) => {
      const productData = products?.find(p => p.id === product.productId);
      if (!productData) return productSum;
      const sellingPrice = product.negotiatedPrice || product.basePrice;
      return productSum + (sellingPrice - productData.costPrice) * product.quantity;
    }, 0);
  }, 0) || 0;

  // Calculate net profit (gross profit - total expenses)
  const totalExpenses = expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
  const netProfit = grossProfit - totalExpenses;

  // Total orders
  const totalOrders = sales?.length || 0;

  // Total delivery expenses
  const totalDeliveryExpenses = expenses?.filter(e => e.category.toLowerCase() === 'delivery').reduce((sum, e) => sum + e.amount, 0) || 0;

  // Total sales amount
  const totalSalesAmount = sales?.reduce((sum, sale) => sum + sale.totalAmount, 0) || 0;

  // Best selling products (by quantity sold)
  const productSalesMap: Record<string, { name: string; quantity: number; sales: number }> = {};
  sales?.forEach(sale => {
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
    const today = new Date();
    const labels = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (6 - i));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const salesData = Array(7).fill(0);
    const expensesData = Array(7).fill(0);

    sales?.forEach(sale => {
      if (!sale.createdAt?.seconds) return;
      const saleDate = new Date(sale.createdAt.seconds * 1000);
      const dayIndex = Math.floor((today.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
      if (dayIndex >= 0 && dayIndex < 7) {
        salesData[6 - dayIndex] += sale.totalAmount;
      }
    });

    expenses?.forEach(expense => {
      if (!expense.createdAt?.seconds) return;
      const expenseDate = new Date(expense.createdAt.seconds * 1000);
      const dayIndex = Math.floor((today.getTime() - expenseDate.getTime()) / (1000 * 60 * 60 * 24));
      if (dayIndex >= 0 && dayIndex < 7) {
        expensesData[6 - dayIndex] += expense.amount;
      }
    });

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

  if (salesLoading || expensesLoading || productsLoading) {
    return <LoadingScreen />;
  }

  // Process recent activities
  const recentActivities = [
    ...(sales?.slice(0, 3).map(sale => ({
      id: sale.id,
      title: 'New sale recorded',
      description: `${sale.customerInfo.name} purchased items for ${sale.totalAmount.toLocaleString()} XAF`,
      timestamp: sale.createdAt?.seconds ? new Date(sale.createdAt.seconds * 1000) : new Date(),
      type: 'sale' as const,
    })) || []),
    ...(expenses?.slice(0, 3).map(expense => ({
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
        <Button
          variant="outline"
          icon={<Info size={16} />}
          onClick={() => setShowCalculationsModal(true)}
        >
          {t('dashboard.howCalculated')}
        </Button>
      </div>
      {/* Stats section */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard 
          title={t('dashboard.stats.grossProfit')}
          value={`${grossProfit.toLocaleString()} XAF`}
          icon={<BarChart2 size={20} />}
          tooltipKey="grossProfit"
          type="profit"
        />
        <StatCard 
          title={t('dashboard.stats.netProfit')}
          value={`${netProfit.toLocaleString()} XAF`}
          icon={<TrendingUp size={20} />}
          tooltipKey="netProfit"
          type="profit"
        />
        <StatCard 
          title={t('dashboard.stats.totalExpenses')}
          value={`${totalExpenses.toLocaleString()} XAF`}
          icon={<Receipt size={20} />}
          tooltipKey="totalExpenses"
          type="expenses"
        />
        <StatCard 
          title={t('dashboard.stats.totalOrders')}
          value={totalOrders}
          icon={<Package2 size={20} />}
          tooltipKey="totalOrders"
          type="orders"
        />
        <StatCard 
          title={t('dashboard.stats.deliveryExpenses')}
          value={`${totalDeliveryExpenses.toLocaleString()} XAF`}
          icon={<DollarSign size={20} />}
          tooltipKey="deliveryExpenses"
          type="delivery"
        />
        <StatCard 
          title={t('dashboard.stats.totalSalesAmount')}
          value={`${totalSalesAmount.toLocaleString()} XAF`}
          icon={<ShoppingCart size={20} />}
          tooltipKey="totalSalesAmount"
          type="sales"
        />
        <StatCard 
          title={t('dashboard.stats.totalSalesCount')}
          value={totalOrders}
          icon={<ShoppingCart size={20} />}
          tooltipKey="totalSalesCount"
          type="sales"
        />
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.grossProfit.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.grossProfit.description')}
              <br /><br />
              {t('dashboard.calculations.grossProfit.formula')}
              <br /><br />
              {t('dashboard.calculations.grossProfit.example')}
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.netProfit.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.netProfit.description')}
              <br /><br />
              {t('dashboard.calculations.netProfit.formula')}
              <br /><br />
              {t('dashboard.calculations.netProfit.example')}
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.deliveryExpenses.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.deliveryExpenses.description')}
              <br /><br />
              {t('dashboard.calculations.deliveryExpenses.formula')}
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