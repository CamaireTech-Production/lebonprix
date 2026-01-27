import React, { useState, useMemo } from 'react';
import { FileText, Download, Calendar, TrendingUp, DollarSign, BarChart2 } from 'lucide-react';
import { Card, Button, Select, LoadingSpinner } from '../../../components/ui';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { useSales } from '../../../hooks/business/useSales';
import { useExpenses } from '../../../hooks/business/useExpenses';
import { useFinance } from '../../../hooks/business/useFinance';
import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { t } from '../../../utils/i18n';
import { RevenueReport } from '../../../components/reports/RevenueReport';
import { ExpenseReport } from '../../../components/reports/ExpenseReport';
import { ProfitReport } from '../../../components/reports/ProfitReport';
import toast from 'react-hot-toast';

type ReportType = 'revenue' | 'expenses' | 'profit';

const ReportsPage = () => {
  const { currentUser, restaurant } = useAuth();
  const { language } = useLanguage();
  const restaurantId = restaurant?.id || currentUser?.uid || '';
  const userId = currentUser?.uid || '';

  const { sales, loading: salesLoading, getSalesByDate } = useSales({ restaurantId, userId });
  const { expenses, loading: expensesLoading } = useExpenses({ restaurantId, userId });
  const { getSummary, loading: financeLoading } = useFinance({ restaurantId, userId });

  const [reportType, setReportType] = useState<ReportType>('revenue');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const loading = salesLoading || expensesLoading || financeLoading;

  // Calculate date range
  const dateRangeData = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now);

    switch (dateRange) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'week':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case 'custom':
        start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
        end = endDate ? new Date(endDate) : new Date(now);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { start, end };
  }, [dateRange, startDate, endDate]);

  const handleExport = async (format: 'pdf' | 'csv') => {
    toast.info(t('export_coming_soon', language));
    // TODO: Implement export functionality
  };

  if (loading) {
    return (
      <DashboardLayout title={t('reports', language)}>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={t('reports', language)}>
      <div className="pb-20 md:pb-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('reports', language)}</h1>
            <p className="text-gray-600">{t('view_financial_reports', language)}</p>
          </div>

          <div className="mt-4 md:mt-0 flex gap-2">
            <Button
              icon={<Download size={16} />}
              variant="outline"
              onClick={() => handleExport('pdf')}
            >
              {t('export_pdf', language)}
            </Button>
            <Button
              icon={<Download size={16} />}
              variant="outline"
              onClick={() => handleExport('csv')}
            >
              {t('export_csv', language)}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('report_type', language)}
              </label>
              <Select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className="w-full"
              >
                <option value="revenue">{t('revenue_report', language)}</option>
                <option value="expenses">{t('expense_report', language)}</option>
                <option value="profit">{t('profit_report', language)}</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('date_range', language)}
              </label>
              <Select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                className="w-full"
              >
                <option value="today">{t('today', language)}</option>
                <option value="week">{t('last_7_days', language)}</option>
                <option value="month">{t('this_month', language)}</option>
                <option value="year">{t('this_year', language)}</option>
                <option value="custom">{t('custom', language)}</option>
              </Select>
            </div>

            {dateRange === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('start_date', language)}
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('end_date', language)}
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Report Content */}
        <div>
          {reportType === 'revenue' && (
            <RevenueReport
              sales={sales}
              dateRange={dateRangeData}
              restaurantId={restaurantId}
              getSalesByDate={getSalesByDate}
            />
          )}
          {reportType === 'expenses' && (
            <ExpenseReport
              expenses={expenses}
              dateRange={dateRangeData}
            />
          )}
          {reportType === 'profit' && (
            <ProfitReport
              sales={sales}
              expenses={expenses}
              dateRange={dateRangeData}
              restaurantId={restaurantId}
              getSummary={getSummary}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;
