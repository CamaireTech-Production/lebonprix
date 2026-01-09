import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Line, Pie, Bar } from 'react-chartjs-2';
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
import { Card, DateRangePicker } from '@components/common';
import { useSiteAnalytics } from '@hooks/business/useSiteAnalytics';
import { Eye, Users, TrendingUp, Package } from 'lucide-react';
import { startOfMonth } from 'date-fns';
import { useState } from 'react';

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

interface AnalyticsDashboardProps {
  className?: string;
}

const AnalyticsDashboard = ({ className = '' }: AnalyticsDashboardProps) => {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: new Date()
  });

  const { metrics, analytics, loading } = useSiteAnalytics({ dateRange });

  // Views over time (Line chart)
  const lineChartData = useMemo(() => {
    if (analytics.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    const sortedAnalytics = [...analytics].sort((a, b) => {
      const dateA = a.date?.seconds || 0;
      const dateB = b.date?.seconds || 0;
      return dateA - dateB;
    });

    return {
      labels: sortedAnalytics.map(day => {
        if (!day.date?.seconds) return '';
        const date = new Date(day.date.seconds * 1000);
        return `${date.getDate()}/${date.getMonth() + 1}`;
      }),
      datasets: [
        {
          label: t('site.analytics.viewsLabel', 'Views'),
          data: sortedAnalytics.map(day => day.views || 0),
          borderColor: 'rgba(34, 197, 94, 1)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: t('site.analytics.uniqueVisitorsLabel', 'Unique Visitors'),
          data: sortedAnalytics.map(day => day.uniqueVisitors || 0),
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    };
  }, [analytics, t]);

  // Device types (Pie chart)
  const pieChartData = useMemo(() => {
    if (metrics.deviceTypes.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    return {
      labels: metrics.deviceTypes.map(dt => dt.type.charAt(0).toUpperCase() + dt.type.slice(1)),
      datasets: [
        {
          data: metrics.deviceTypes.map(dt => dt.count),
          backgroundColor: [
            'rgba(34, 197, 94, 0.7)',
            'rgba(59, 130, 246, 0.7)',
            'rgba(234, 179, 8, 0.7)'
          ],
          borderColor: [
            'rgba(34, 197, 94, 1)',
            'rgba(59, 130, 246, 1)',
            'rgba(234, 179, 8, 1)'
          ],
          borderWidth: 2
        }
      ]
    };
  }, [metrics.deviceTypes, t]);

  // Referrers (Bar chart)
  const barChartData = useMemo(() => {
    if (metrics.referrers.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    const topReferrers = metrics.referrers.slice(0, 10);

    return {
      labels: topReferrers.map(ref => ref.source === 'direct' ? t('site.analytics.direct', 'Direct') : ref.source),
      datasets: [
        {
          label: t('site.analytics.visits', 'Visits'),
          data: topReferrers.map(ref => ref.count),
          backgroundColor: 'rgba(34, 197, 94, 0.5)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 1
        }
      ]
    };
  }, [metrics.referrers, t]);

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  const pieChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const
      }
    }
  };

  const barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Date Range Picker */}
      <Card>
        <div className="p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('site.analytics.dateRange', 'Date Range')}
          </label>
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onChange={(range) => setDateRange(range)}
          />
        </div>
      </Card>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('site.analytics.totalViews', 'Total Views')}</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {loading ? '...' : metrics.totalViews.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-lg">
                <Eye className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('site.analytics.uniqueVisitors', 'Unique Visitors')}</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {loading ? '...' : metrics.totalUniqueVisitors.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('site.analytics.avgViewsPerDay', 'Avg. Views/Day')}</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {loading ? '...' : Math.round(metrics.averageViewsPerDay).toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('site.analytics.popularProducts', 'Popular Products')}</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {loading ? '...' : metrics.popularProducts.length}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Package className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Views Over Time */}
        <Card title={t('site.analytics.viewsOverTime', 'Views Over Time')}>
          <div className="p-4" style={{ height: '300px' }}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
              </div>
            ) : lineChartData.labels.length > 0 ? (
              <Line data={lineChartData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                {t('site.analytics.noData', 'No data available for selected period')}
              </div>
            )}
          </div>
        </Card>

        {/* Device Types */}
        <Card title={t('site.analytics.deviceTypes', 'Device Types')}>
          <div className="p-4" style={{ height: '300px' }}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
              </div>
            ) : pieChartData.labels.length > 0 ? (
              <Pie data={pieChartData} options={pieChartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                {t('site.analytics.noDataAvailable', 'No data available')}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Referrers Chart */}
      <Card title={t('site.analytics.trafficSources', 'Traffic Sources')}>
        <div className="p-4" style={{ height: '300px' }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : barChartData.labels.length > 0 ? (
            <Bar data={barChartData} options={barChartOptions} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              {t('site.analytics.noReferrerData', 'No referrer data available')}
            </div>
          )}
        </div>
      </Card>

      {/* Popular Products Table */}
      {metrics.popularProducts.length > 0 && (
        <Card title={t('site.analytics.popularProducts', 'Popular Products')}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('site.analytics.product', 'Product')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('site.analytics.views', 'Views')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {metrics.popularProducts.map((product, index) => (
                  <tr key={product.productId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {index + 1}. {product.productName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.views.toLocaleString()}
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

export default AnalyticsDashboard;

