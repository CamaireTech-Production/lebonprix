import { ShoppingCart, DollarSign, TrendingUp, Package2, BarChart2 } from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import SalesChart from '../components/dashboard/SalesChart';
import ActivityList from '../components/dashboard/ActivityList';
import Table from '../components/common/Table';
import Card from '../components/common/Card';
import { useSales, useExpenses, useProducts } from '../hooks/useFirestore';
import LoadingScreen from '../components/common/LoadingScreen';

const Dashboard = () => {
  const { sales, loading: salesLoading } = useSales();
  const { expenses, loading: expensesLoading } = useExpenses();
  const { products, loading: productsLoading } = useProducts();

  // Calculate gross profit (selling price - cost price) * quantity for all sales
  const grossProfit = sales?.reduce((sum, sale) => {
    const product = products?.find(p => p.id === sale.productId);
    if (!product) return sum;
    return sum + (product.sellingPrice - product.costPrice) * sale.quantity;
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
    const product = products?.find(p => p.id === sale.productId);
    if (!product) return;
    if (!productSalesMap[product.id]) {
      productSalesMap[product.id] = { name: product.name, quantity: 0, sales: 0 };
    }
    productSalesMap[product.id].quantity += sale.quantity;
    productSalesMap[product.id].sales += sale.totalAmount;
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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's what's happening with your business today.</p>
      </div>
      {/* Stats section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard 
          title="Gross Profit"
          value={`${grossProfit.toLocaleString()} XAF`}
          icon={<BarChart2 size={24} />}
        />
        <StatCard 
          title="Net Profit"
          value={`${netProfit.toLocaleString()} XAF`}
          icon={<TrendingUp size={24} />}
        />
        <StatCard 
          title="Total Orders"
          value={totalOrders}
          icon={<Package2 size={24} />}
        />
        <StatCard 
          title="Delivery Expenses"
          value={`${totalDeliveryExpenses.toLocaleString()} XAF`}
          icon={<DollarSign size={24} />}
        />
        <StatCard 
          title="Total Sales (Amount)"
          value={`${totalSalesAmount.toLocaleString()} XAF`}
          icon={<ShoppingCart size={24} />}
        />
        <StatCard 
          title="Total Sales (Count)"
          value={totalOrders}
          icon={<ShoppingCart size={24} />}
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
    </div>
  );
};

export default Dashboard;