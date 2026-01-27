import React, { useMemo, useState, useEffect } from 'react';
import { Card } from '../ui';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import type { Sale } from '../../types/geskap';

interface RevenueReportProps {
  sales: Sale[];
  dateRange: { start: Date; end: Date };
  restaurantId: string;
  getSalesByDate: (startDate: Date, endDate: Date) => Promise<Sale[]>;
}

export const RevenueReport: React.FC<RevenueReportProps> = ({
  sales,
  dateRange,
  restaurantId,
  getSalesByDate
}) => {
  const { language } = useLanguage();
  const [filteredSales, setFilteredSales] = useState<Sale[]>(sales);

  useEffect(() => {
    const loadSales = async () => {
      try {
        const salesData = await getSalesByDate(dateRange.start, dateRange.end);
        setFilteredSales(salesData);
      } catch (err) {
        console.error('Error loading sales:', err);
        setFilteredSales(sales);
      }
    };
    loadSales();
  }, [dateRange, getSalesByDate, sales]);

  // Calculate revenue by day
  const revenueByDay = useMemo(() => {
    const revenueMap: Record<string, number> = {};
    
    filteredSales.forEach((sale) => {
      if (sale.paymentStatus === 'paid' && sale.totalAmount) {
        const date = sale.createdAt?.seconds
          ? new Date(sale.createdAt.seconds * 1000).toLocaleDateString()
          : new Date().toLocaleDateString();
        revenueMap[date] = (revenueMap[date] || 0) + sale.totalAmount;
      }
    });

    return Object.entries(revenueMap)
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredSales]);

  const totalRevenue = useMemo(() => {
    return filteredSales
      .filter(sale => sale.paymentStatus === 'paid')
      .reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
  }, [filteredSales]);

  const totalOrders = filteredSales.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-600">{t('total_revenue', language)}</p>
            <p className="text-2xl font-bold text-gray-900">{totalRevenue.toLocaleString()} XAF</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-600">{t('total_orders', language)}</p>
            <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-600">{t('average_order_value', language)}</p>
            <p className="text-2xl font-bold text-gray-900">{averageOrderValue.toLocaleString()} XAF</p>
          </div>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">{t('revenue_trend', language)}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#8884d8" name={t('revenue', language)} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Revenue by Day Chart */}
      <Card>
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">{t('daily_revenue', language)}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="revenue" fill="#8884d8" name={t('revenue', language)} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
