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

const Dashboard = () => {
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
    { header: 'Product', accessor: (row: any) => row.name },
    { header: 'Quantity Sold', accessor: (row: any) => row.quantity },
    { header: 'Total Sales', accessor: (row: any) => `${row.sales.toLocaleString()} XAF` },
  ];

  return (
    <div className="pb-16 md:pb-0">
      {/* Company Products Link Section */}
      {company && (
        <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Page Publique des Produits
              </h2>
              <p className="text-sm text-gray-600">
                Partagez le lien de votre catalogue de produits avec vos clients
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
                      title="Copier le lien"
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
                  <Button
                    variant="outline"
                    onClick={handleShareLink}
                    className="flex-1 sm:flex-none whitespace-nowrap"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Partager
                  </Button>
                  <a
                    href={productPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ouvrir
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6 mt-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's what's happening with your business today.</p>
        </div>
        <Button
          variant="outline"
          icon={<Info size={16} />}
          onClick={() => setShowCalculationsModal(true)}
        >
          How are these calculated?
        </Button>
      </div>
      {/* Stats section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard 
          title="Gross Profit"
          value={`${grossProfit.toLocaleString()} XAF`}
          icon={<BarChart2 size={24} />}
          tooltip="Total revenue minus cost of goods sold. For each product: (Selling Price - Cost Price) × Quantity Sold"
        />
        <StatCard 
          title="Net Profit"
          value={`${netProfit.toLocaleString()} XAF`}
          icon={<TrendingUp size={24} />}
          tooltip="Gross Profit minus all expenses (including delivery, utilities, etc.)"
        />
        <StatCard 
          title="Total Expenses"
          value={`${totalExpenses.toLocaleString()} XAF`}
          icon={<Receipt size={24} />}
          tooltip="Sum of all business expenses across all categories"
        />
        <StatCard 
          title="Total Orders"
          value={totalOrders}
          icon={<Package2 size={24} />}
          tooltip="Total number of sales transactions recorded"
        />
        <StatCard 
          title="Delivery Expenses"
          value={`${totalDeliveryExpenses.toLocaleString()} XAF`}
          icon={<DollarSign size={24} />}
          tooltip="Sum of all expenses categorized as 'delivery'"
        />
        <StatCard 
          title="Total Sales (Amount)"
          value={`${totalSalesAmount.toLocaleString()} XAF`}
          icon={<ShoppingCart size={24} />}
          tooltip="Sum of all sales amounts, including negotiated prices"
        />
        <StatCard 
          title="Total Sales (Count)"
          value={totalOrders}
          icon={<ShoppingCart size={24} />}
          tooltip="Total number of sales transactions (same as Total Orders)"
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
        <Card title="Best Selling Products">
          <Table
            data={bestSellingProducts}
            columns={bestProductColumns}
            keyExtractor={row => row.name}
            emptyMessage="No sales data available"
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
        title="Dashboard Calculations Explained"
        size="lg"
      >
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Gross Profit</h3>
            <p className="text-gray-600">
              Gross profit is calculated by subtracting the cost price from the selling price for each product sold, then multiplying by the quantity sold.
              <br /><br />
              Formula: Σ((Selling Price - Cost Price) × Quantity Sold) for each product in each sale
              <br /><br />
              Example: If you sell 5 units of a product that costs 1000 XAF and sells for 1500 XAF:
              <br />
              Gross Profit = (1500 - 1000) × 5 = 2500 XAF
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Net Profit</h3>
            <p className="text-gray-600">
              Net profit is the gross profit minus all business expenses.
              <br /><br />
              Formula: Gross Profit - Total Expenses
              <br /><br />
              Example: If your gross profit is 100,000 XAF and total expenses are 30,000 XAF:
              <br />
              Net Profit = 100,000 - 30,000 = 70,000 XAF
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Total Expenses</h3>
            <p className="text-gray-600">
              The sum of all business expenses across all categories.
              <br /><br />
              Formula: Σ(Expense Amount) for all expenses
              <br /><br />
              This includes all types of expenses such as:
              <br />
              - Delivery expenses
              <br />
              - Utility bills
              <br />
              - Rent
              <br />
              - Other operational costs
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Total Sales Amount</h3>
            <p className="text-gray-600">
              The total revenue from all sales, including any negotiated prices.
              <br /><br />
              Formula: Σ(Sale Amount) for each sale
              <br /><br />
              Note: If a product was sold at a negotiated price, that price is used instead of the standard selling price.
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Delivery Expenses</h3>
            <p className="text-gray-600">
              The sum of all expenses categorized as 'delivery'.
              <br /><br />
              Formula: Σ(Expense Amount) for all expenses with category = 'delivery'
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Best Selling Products</h3>
            <p className="text-gray-600">
              Products are ranked by the total quantity sold.
              <br /><br />
              For each product:
              <br />
              - Total Quantity = Σ(Quantity Sold) across all sales
              <br />
              - Total Sales = Σ(Selling Price × Quantity Sold) across all sales
              <br /><br />
              Products are then sorted by total quantity in descending order.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;