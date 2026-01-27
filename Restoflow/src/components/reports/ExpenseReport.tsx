import React, { useMemo } from 'react';
import { Card } from '../ui';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { Expense } from '../../types/geskap';

interface ExpenseReportProps {
  expenses: Expense[];
  dateRange: { start: Date; end: Date };
}

export const ExpenseReport: React.FC<ExpenseReportProps> = ({
  expenses,
  dateRange
}) => {
  const { language } = useLanguage();

  // Filter expenses by date range
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      if (!expense.date) return false;
      const expenseDate = expense.date.seconds
        ? new Date(expense.date.seconds * 1000)
        : new Date(expense.date);
      return expenseDate >= dateRange.start && expenseDate <= dateRange.end;
    });
  }, [expenses, dateRange]);

  // Calculate expenses by category
  const expensesByCategory = useMemo(() => {
    const categoryMap: Record<string, number> = {};
    
    filteredExpenses.forEach((expense) => {
      const category = expense.category || t('uncategorized', language);
      categoryMap[category] = (categoryMap[category] || 0) + (expense.amount || 0);
    });

    return Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses, language]);

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  }, [filteredExpenses]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <div className="p-4">
          <p className="text-sm text-gray-600">{t('total_expenses', language)}</p>
          <p className="text-2xl font-bold text-gray-900">{totalExpenses.toLocaleString()} XAF</p>
        </div>
      </Card>

      {/* Expenses by Category Pie Chart */}
      <Card>
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">{t('expenses_by_category', language)}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={expensesByCategory}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {expensesByCategory.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Expenses by Category Bar Chart */}
      <Card>
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">{t('expenses_by_category', language)}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={expensesByCategory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#8884d8" name={t('amount', language)} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
