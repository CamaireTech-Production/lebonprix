import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Card, LoadingSpinner, Input, Button } from '../../../components/ui';
import ExpenseErrorBoundary from '../../../components/expenses/ExpenseErrorBoundary';
import { useExpenses } from '../../../hooks/business/useExpenses';
import { useExpenseCategories } from '../../../hooks/business/useExpenseCategories';
import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { t } from '../../../utils/i18n';
import { normalizeDate } from '../../../utils/dateUtils';
import type { Expense } from '../../../types/geskap';
import toast from 'react-hot-toast';

const COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#F59E0B', // amber
  '#22C55E', // green
  '#A855F7', // purple
  '#6366F1', // indigo
  '#EC4899', // pink
  '#14B8A6', // teal
];

const ExpensesAnalytics = () => {
  const { currentUser, restaurant } = useAuth();
  const { language } = useLanguage();
  const restaurantId = restaurant?.id || currentUser?.uid || '';
  const userId = currentUser?.uid || '';

  const { expenses, loading: expensesLoading } = useExpenses({ restaurantId, userId });
  const { categories } = useExpenseCategories({ restaurantId });

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return {
      from: thirtyDaysAgo,
      to: now
    };
  });
  const [dateFromInput, setDateFromInput] = useState(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return thirtyDaysAgo.toISOString().split('T')[0];
  });
  const [dateToInput, setDateToInput] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp: Expense) => {
      if (selectedCategory !== 'all' && exp.category !== selectedCategory) {
        return false;
      }
      const timestamp = exp.date || exp.createdAt;
      const expDate = normalizeDate(timestamp);
      if (!expDate) return false;
      return expDate >= dateRange.from && expDate <= dateRange.to;
    });
  }, [expenses, selectedCategory, dateRange]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalAmount = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalCount = filteredExpenses.length;
    const averageAmount = totalCount > 0 ? Math.round(totalAmount / totalCount) : 0;

    // Category breakdown
    const categoryTotals: Record<string, number> = {};
    filteredExpenses.forEach(exp => {
      const cat = exp.category || 'Other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (exp.amount || 0);
    });

    const categoryBreakdown = Object.entries(categoryTotals)
      .map(([category, totalAmount]) => ({ category, totalAmount }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    return { totalAmount, totalCount, averageAmount, categoryBreakdown };
  }, [filteredExpenses]);

  // Prepare bar chart data
  const barChartData = useMemo(() => {
    return stats.categoryBreakdown.map(item => ({
      name: item.category,
      amount: item.totalAmount
    }));
  }, [stats.categoryBreakdown]);

  // Prepare pie chart data
  const pieChartData = useMemo(() => {
    return stats.categoryBreakdown.map(item => ({
      name: item.category,
      value: item.totalAmount
    }));
  }, [stats.categoryBreakdown]);

  // Prepare line chart data (monthly trends)
  const lineChartData = useMemo(() => {
    const monthlyData: Record<string, number> = {};

    filteredExpenses.forEach((expense: Expense) => {
      const timestamp = expense.date || expense.createdAt;
      const date = normalizeDate(timestamp);
      if (!date) return;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0;
      }
      monthlyData[monthKey] += expense.amount || 0;
    });

    const sortedMonths = Object.keys(monthlyData).sort();

    return sortedMonths.map(month => {
      const [year, monthNum] = month.split('-');
      return {
        name: `${monthNum}/${year}`,
        amount: monthlyData[month]
      };
    });
  }, [filteredExpenses]);

  // Top expenses
  const topExpenses = useMemo(() => {
    return [...filteredExpenses]
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .slice(0, 10);
  }, [filteredExpenses]);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' XAF';
  };

  const formatDate = (timestamp: any) => {
    const date = normalizeDate(timestamp);
    if (!date) return '-';
    return date.toLocaleDateString('fr-FR');
  };

  const handleDateRangeChange = () => {
    const from = new Date(dateFromInput);
    const to = new Date(dateToInput);
    to.setHours(23, 59, 59, 999); // Include the full end date
    
    if (from > to) {
      toast.error(t('invalid_date_range', language) || 'Start date must be before end date');
      return;
    }
    
    setDateRange({ from, to });
  };

  const setQuickFilter = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    
    setDateFromInput(from.toISOString().split('T')[0]);
    setDateToInput(to.toISOString().split('T')[0]);
    setDateRange({ from, to });
  };

  if (expensesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="pb-16 md:pb-0">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">{t('analytics_title', language)}</h2>
        <p className="text-gray-600">{t('analytics_subtitle', language)}</p>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            className="rounded-lg border border-gray-300 shadow-sm py-2 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">{t('expense_all_categories', language)}</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Date Range Picker */}
        <Card>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700">{t('date_range', language) || 'Date Range'}</h3>
            
            {/* Quick Filters */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickFilter(7)}
              >
                {t('last_7_days', language) || 'Last 7 days'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickFilter(30)}
              >
                {t('last_30_days', language) || 'Last 30 days'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickFilter(90)}
              >
                {t('last_3_months', language) || 'Last 3 months'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  const yearStart = new Date(now.getFullYear(), 0, 1);
                  setDateFromInput(yearStart.toISOString().split('T')[0]);
                  setDateToInput(now.toISOString().split('T')[0]);
                  setDateRange({ from: yearStart, to: now });
                }}
              >
                {t('this_year', language) || 'This year'}
              </Button>
            </div>

            {/* Date Inputs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  label={t('from_date', language) || 'From'}
                  type="date"
                  value={dateFromInput}
                  onChange={(e) => setDateFromInput(e.target.value)}
                  max={dateToInput}
                />
              </div>
              <div className="flex-1">
                <Input
                  label={t('to_date', language) || 'To'}
                  type="date"
                  value={dateToInput}
                  onChange={(e) => setDateToInput(e.target.value)}
                  min={dateFromInput}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleDateRangeChange}
                  disabled={!dateFromInput || !dateToInput}
                >
                  {t('apply_filter', language) || 'Apply'}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-sm font-medium text-gray-600">{t('total_expenses', language)}</p>
          <p className="text-2xl font-semibold text-gray-900">
            {formatAmount(stats.totalAmount)}
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-600">{t('expense_count', language)}</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.totalCount}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-600">{t('average_expense', language)}</p>
          <p className="text-2xl font-semibold text-gray-900">
            {formatAmount(stats.averageAmount)}
          </p>
        </Card>
      </div>

      {/* Charts */}
      <ExpenseErrorBoundary>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Bar Chart */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('expenses_by_category', language)}</h3>
            {barChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => [formatAmount(value), t('amount', language)]}
                  />
                  <Legend />
                  <Bar dataKey="amount" name={t('amount', language)} fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="p-8 text-center text-gray-500">
                {t('no_data', language)}
              </div>
            )}
          </Card>

          {/* Pie Chart */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('expense_distribution', language)}</h3>
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatAmount(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="p-8 text-center text-gray-500">
                {t('no_data', language)}
              </div>
            )}
          </Card>
        </div>

        {/* Line Chart - Monthly Trends */}
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('monthly_trends', language)}</h3>
          {lineChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => [formatAmount(value), t('amount', language)]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="amount"
                  name={t('monthly_expenses', language)}
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="p-8 text-center text-gray-500">
              {t('no_data', language)}
            </div>
          )}
        </Card>
      </ExpenseErrorBoundary>

      {/* Top Expenses Table */}
      {topExpenses.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('top_expenses', language)}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('description', language)}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('category', language)}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('date', language)}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    {t('amount', language)}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {expense.category || 'Other'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(expense.date || expense.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                      {formatAmount(expense.amount || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ExpensesAnalytics;
