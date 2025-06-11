import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import Card from '../common/Card';
import { useTranslation } from 'react-i18next';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface SalesChartProps {
  salesData: number[];
  expensesData: number[];
  labels: string[];
}

const SalesChart = ({ salesData, expensesData, labels }: SalesChartProps) => {
  const { t, i18n } = useTranslation();

  const data = {
    labels,
    datasets: [
      {
        label: t('dashboard.chart.sales'),
        data: salesData,
        borderColor: '#10B981', // emerald-500
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
      },
      {
        label: t('dashboard.chart.expenses'),
        data: expensesData,
        borderColor: '#EF4444', // red-500
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat(i18n.language, { 
                style: 'currency', 
                currency: 'XAF' 
              }).format(context.parsed.y);
            }
            return label;
          }
        }
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.06)',
        },
        ticks: {
          callback: function(value) {
            return new Intl.NumberFormat(i18n.language, { 
              style: 'currency', 
              currency: 'XAF',
              maximumSignificantDigits: 3
            }).format(Number(value));
          }
        }
      },
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
  };

  return (
    <Card title={t('dashboard.chart.title')}>
      <div className="h-64">
        {salesData.length === 0 && expensesData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            {t('dashboard.chart.noData')}
          </div>
        ) : (
          <Line data={data} options={options} />
        )}
      </div>
    </Card>
  );
};

export default SalesChart;