import React, { useMemo, useState, useEffect } from 'react';
import { Card } from '../ui';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Sale, Expense } from '../../types/geskap';

interface ProfitReportProps {
  sales: Sale[];
  expenses: Expense[];
  dateRange: { start: Date; end: Date };
  restaurantId: string;
  getSummary: (startDate: Date, endDate: Date) => Promise<{
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    byType: Record<string, number>;
  }>;
}

export const ProfitReport: React.FC<ProfitReportProps> = ({
  sales,
  expenses,
  dateRange,
  restaurantId,
  getSummary
}) => {
  const { language } = useLanguage();
  const [summary, setSummary] = useState<{
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    byType: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      setLoading(true);
      try {
        const summaryData = await getSummary(dateRange.start, dateRange.end);
        setSummary(summaryData);
      } catch (err) {
        console.error('Error loading summary:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSummary();
  }, [dateRange, getSummary]);

  // Calculate profit by day
  const profitByDay = useMemo(() => {
    const profitMap: Record<string, { revenue: number; expenses: number; profit: number }> = {};
    
    // Add revenue
    sales.forEach((sale) => {
      if (sale.paymentStatus === 'paid' && sale.totalAmount) {
        const date = sale.createdAt?.seconds
          ? new Date(sale.createdAt.seconds * 1000).toLocaleDateString()
          : new Date().toLocaleDateString();
        if (!profitMap[date]) {
          profitMap[date] = { revenue: 0, expenses: 0, profit: 0 };
        }
        profitMap[date].revenue += sale.totalAmount;
      }
    });

    // Add expenses
    expenses.forEach((expense) => {
      if (expense.date && expense.amount) {
        const date = expense.date.seconds
          ? new Date(expense.date.seconds * 1000).toLocaleDateString()
          : new Date().toLocaleDateString();
        if (!profitMap[date]) {
          profitMap[date] = { revenue: 0, expenses: 0, profit: 0 };
        }
        profitMap[date].expenses += expense.amount;
      }
    });

    // Calculate profit
    Object.keys(profitMap).forEach(date => {
      profitMap[date].profit = profitMap[date].revenue - profitMap[date].expenses;
    });

    return Object.entries(profitMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sales, expenses]);

  if (loading || !summary) {
    return (
      <div className="flex justify-center py-8">
        <p className="text-gray-500">{t('loading', language)}</p>
      </div>
    );
  }

  const profitMargin = summary.totalIncome > 0
    ? ((summary.netProfit / summary.totalIncome) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-600">{t('total_income', language)}</p>
            <p className="text-2xl font-bold text-green-600">{summary.totalIncome.toLocaleString()} XAF</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-600">{t('total_expenses', language)}</p>
            <p className="text-2xl font-bold text-red-600">{summary.totalExpenses.toLocaleString()} XAF</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-600">{t('net_profit', language)}</p>
            <p className={`text-2xl font-bold ${summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.netProfit.toLocaleString()} XAF
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-600">{t('profit_margin', language)}</p>
            <p className={`text-2xl font-bold ${parseFloat(profitMargin) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {profitMargin}%
            </p>
          </div>
        </Card>
      </div>

      {/* Profit Trend Chart */}
      <Card>
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">{t('profit_trend', language)}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={profitByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#22c55e" name={t('revenue', language)} />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" name={t('expenses', language)} />
              <Line type="monotone" dataKey="profit" stroke="#3b82f6" name={t('profit', language)} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
