// src/pages/expenses/ExpensesAnalytics.tsx
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, Pie, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import Card from '../../components/common/Card';
import { useInfiniteExpenses } from '@hooks/data/useInfiniteExpenses';
import { useExpenseStats, ExpenseFilterOptions } from '@hooks/business/useExpenseStats';
import { useExpenseCategories } from '@hooks/business/useExpenseCategories';
import type { Expense, ExpenseType } from '../../types/models';
import ExpenseFiltersComponent from './shared/ExpenseFilters';
import { SkeletonTable } from "@components/common";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const ExpensesAnalytics = () => {
  const { t } = useTranslation();
  const { expenses, loading } = useInfiniteExpenses();
  const { expenseTypesList } = useExpenseCategories();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(2025, 3, 1),
    to: new Date(2100, 0, 1),
  });

  // Filter expenses
  const visibleExpenses = expenses.filter((exp: Expense) => exp.isAvailable !== false);
  
  const filters: ExpenseFilterOptions = useMemo(() => ({
    category: selectedCategory !== 'All' ? selectedCategory : undefined,
    searchQuery: searchQuery || undefined,
    dateRange
  }), [selectedCategory, searchQuery, dateRange]);

  const stats = useExpenseStats(visibleExpenses, filters);

  // Prepare chart data
  const barChartData = useMemo(() => {
    const sortedCategories = [...stats.categoryBreakdown].sort((a, b) => b.totalAmount - a.totalAmount);
    return {
      labels: sortedCategories.map((item: { category: string; totalAmount: number }) => {
        const defaultCategories = ['transportation', 'purchase', 'other'];
        const isDefault = defaultCategories.includes(item.category);
        return isDefault ? t(`expenses.categories.${item.category}`, item.category) : item.category;
      }),
      datasets: [{
        label: 'Montant (XAF)',
        data: sortedCategories.map(item => item.totalAmount),
        backgroundColor: [
          'rgba(59, 130, 246, 0.5)',
          'rgba(239, 68, 68, 0.5)',
          'rgba(234, 179, 8, 0.5)',
          'rgba(34, 197, 94, 0.5)',
          'rgba(168, 85, 247, 0.5)',
          'rgba(99, 102, 241, 0.5)',
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(234, 179, 8, 1)',
          'rgba(34, 197, 94, 1)',
          'rgba(168, 85, 247, 1)',
          'rgba(99, 102, 241, 1)',
        ],
        borderWidth: 1
      }]
    };
  }, [stats.categoryBreakdown, t]);

  const pieChartData = useMemo(() => {
    return {
      labels: stats.categoryBreakdown.map((item: { category: string; totalAmount: number }) => {
        const defaultCategories = ['transportation', 'purchase', 'other'];
        const isDefault = defaultCategories.includes(item.category);
        return isDefault ? t(`expenses.categories.${item.category}`, item.category) : item.category;
      }),
      datasets: [{
        data: stats.categoryBreakdown.map((item: { category: string; totalAmount: number }) => item.totalAmount),
        backgroundColor: [
          'rgba(59, 130, 246, 0.7)',
          'rgba(239, 68, 68, 0.7)',
          'rgba(234, 179, 8, 0.7)',
          'rgba(34, 197, 94, 0.7)',
          'rgba(168, 85, 247, 0.7)',
          'rgba(99, 102, 241, 0.7)',
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(234, 179, 8, 1)',
          'rgba(34, 197, 94, 1)',
          'rgba(168, 85, 247, 1)',
          'rgba(99, 102, 241, 1)',
        ],
        borderWidth: 2
      }]
    };
  }, [stats.categoryBreakdown, t]);

  // Time series data (group by month)
  const lineChartData = useMemo(() => {
    const monthlyData: Record<string, number> = {};
    
    visibleExpenses.forEach((expense: Expense) => {
      const timestamp = expense.date || expense.createdAt;
      if (!timestamp?.seconds) return;
      
      const date = new Date(timestamp.seconds * 1000);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0;
      }
      monthlyData[monthKey] += expense.amount;
    });

    const sortedMonths = Object.keys(monthlyData).sort();
    
    return {
      labels: sortedMonths.map(month => {
        const [year, monthNum] = month.split('-');
        return `${monthNum}/${year}`;
      }),
      datasets: [{
        label: 'Dépenses mensuelles (XAF)',
        data: sortedMonths.map(month => monthlyData[month]),
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true
      }]
    };
  }, [visibleExpenses]);

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Dépenses par catégorie'
      }
    }
  };

  const pieChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right' as const,
      },
      title: {
        display: true,
        text: 'Répartition des dépenses'
      }
    }
  };

  const lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Évolution des dépenses dans le temps'
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  // Top expenses
  const topExpenses = useMemo(() => {
    return [...visibleExpenses]
      .filter(exp => {
        const timestamp = exp.date || exp.createdAt;
        if (!timestamp?.seconds) return false;
        const expenseDate = new Date(timestamp.seconds * 1000);
        return expenseDate >= dateRange.from && expenseDate <= dateRange.to;
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [visibleExpenses, dateRange]);

  if (loading) {
    return <SkeletonTable rows={5} />;
  }

  return (
    <div className="pb-16 md:pb-0">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Analyses et Statistiques</h1>
        <p className="text-gray-600">Analysez vos dépenses avec des graphiques et statistiques détaillées</p>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <ExpenseFiltersComponent
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          showDateRange={true}
        />
        
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <select
            className="rounded-md border border-gray-300 shadow-sm py-2 px-3 bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="All">Toutes les catégories</option>
            {expenseTypesList.map((category: ExpenseType) => {
              const defaultCategories = ['transportation', 'purchase', 'other'];
              const isDefault = defaultCategories.includes(category.name);
              const label = isDefault 
                ? t(`expenses.categories.${category.name}`, category.name)
                : category.name;
              return (
                <option key={category.id} value={category.name}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-sm font-medium text-gray-600">Total des dépenses</p>
          <p className="text-2xl font-semibold text-gray-900">
            {stats.totalAmount.toLocaleString()} XAF
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-600">Nombre de dépenses</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.totalCount}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-600">Moyenne par dépense</p>
          <p className="text-2xl font-semibold text-gray-900">
            {stats.averageAmount.toLocaleString()} XAF
          </p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          {barChartData.labels.length > 0 ? (
            <Bar data={barChartData} options={chartOptions} />
          ) : (
            <div className="p-8 text-center text-gray-500">
              Aucune donnée à afficher
            </div>
          )}
        </Card>

        <Card>
          {pieChartData.labels.length > 0 ? (
            <Pie data={pieChartData} options={pieChartOptions} />
          ) : (
            <div className="p-8 text-center text-gray-500">
              Aucune donnée à afficher
            </div>
          )}
        </Card>
      </div>

      {/* Line Chart */}
      <Card className="mb-6">
        {lineChartData.labels.length > 0 ? (
          <Line data={lineChartData} options={lineChartOptions} />
        ) : (
          <div className="p-8 text-center text-gray-500">
            Aucune donnée à afficher
          </div>
        )}
      </Card>

      {/* Top Expenses */}
      {topExpenses.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 10 des dépenses</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topExpenses.map((expense) => {
                  const timestamp = expense.date || expense.createdAt;
                  const date = timestamp?.seconds 
                    ? new Date(timestamp.seconds * 1000).toLocaleDateString('fr-FR')
                    : 'N/A';
                  const defaultCategories = ['transportation', 'purchase', 'other'];
                  const isDefault = defaultCategories.includes(expense.category);
                  const categoryLabel = isDefault 
                    ? t(`expenses.categories.${expense.category}`, expense.category)
                    : expense.category;
                  
                  return (
                    <tr key={expense.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {expense.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {categoryLabel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                        {expense.amount.toLocaleString()} XAF
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ExpensesAnalytics;

