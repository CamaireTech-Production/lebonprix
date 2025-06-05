
import { ShoppingCart, DollarSign, TrendingUp, Package2 } from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import SalesChart from '../components/dashboard/SalesChart';
import ActivityList from '../components/dashboard/ActivityList';
import { useDashboardStats, useSales, useExpenses } from '../hooks/useFirestore';
import LoadingScreen from '../components/common/LoadingScreen';

const Dashboard = () => {
  const { stats, loading: statsLoading } = useDashboardStats();
  const { sales, loading: salesLoading } = useSales();
  const { expenses, loading: expensesLoading } = useExpenses();
  
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
      if (!expense.date?.seconds) return;
      const expenseDate = new Date(expense.date.seconds * 1000);
      const dayIndex = Math.floor((today.getTime() - expenseDate.getTime()) / (1000 * 60 * 60 * 24));
      if (dayIndex >= 0 && dayIndex < 7) {
        expensesData[6 - dayIndex] += expense.amount;
      }
    });

    return { labels, salesData, expensesData };
  };

  const chartData = processChartData();

  if ( salesLoading || expensesLoading) {
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
      timestamp: expense.date?.seconds ? new Date(expense.date.seconds * 1000) : new Date(),
      type: 'expense' as const,
    })) || []),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <div className="pb-16 md:pb-0">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's what's happening with your business today.</p>
      </div>
      
      {/* Stats section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard 
          title="Total Sales"
          value={`${stats?.totalSales?.toLocaleString() || 0} XAF`}
          icon={<ShoppingCart size={24} />}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard 
          title="Total Expenses"
          value={`${stats?.totalExpenses?.toLocaleString() || 0} XAF`}
          icon={<DollarSign size={24} />}
          trend={{ value: 5, isPositive: false }}
        />
        <StatCard 
          title="Net Profit"
          value={`${((stats?.totalSales || 0) - (stats?.totalExpenses || 0)).toLocaleString()} XAF`}
          icon={<TrendingUp size={24} />}
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard 
          title="Active Orders"
          value={stats?.activeOrders || 0}
          icon={<Package2 size={24} />}
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
      
      {/* Activity section */}
      <div>
        <ActivityList activities={recentActivities} />
      </div>
    </div>
  );
};

export default Dashboard;