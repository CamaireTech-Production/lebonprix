import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import Card from '../common/Card';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

interface DonutChartData {
  label: string;
  value: number;
}

interface DonutChartProps {
  title: string;
  data: DonutChartData[];
  colors?: string[];
  periodFilter?: React.ReactNode;
  className?: string;
}

const DonutChart = ({ title, data, colors, periodFilter, className = '' }: DonutChartProps) => {
  const { t, i18n } = useTranslation();
  const { company } = useAuth();

  // Get company colors with fallbacks
  const getCompanyColors = () => {
    const colors = {
      primary: company?.dashboardColors?.primary || company?.primaryColor || '#183524',
      secondary: company?.dashboardColors?.secondary || company?.secondaryColor || '#e2b069',
      tertiary: company?.dashboardColors?.tertiary || company?.tertiaryColor || '#2a4a3a'
    };
    return colors;
  };

  // Default color palette
  const defaultColors = [
    '#3B82F6', // blue
    '#10B981', // emerald
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#14B8A6', // teal
    '#F97316', // orange
    '#6366F1', // indigo
    '#A855F7', // purple
  ];

  const chartColors = colors || defaultColors;

  const chartData = {
    labels: data.map(item => item.label),
    datasets: [{
      data: data.map(item => item.value),
      backgroundColor: chartColors.slice(0, data.length),
      borderColor: '#fff',
      borderWidth: 2,
    }]
  };

  const options: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 15,
          usePointStyle: true,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${label}: ${new Intl.NumberFormat(i18n.language, { 
              style: 'currency', 
              currency: 'XAF',
              maximumFractionDigits: 0
            }).format(value)} (${percentage}%)`;
          }
        }
      }
    },
    cutout: '60%', // Makes it a donut chart
  };

  return (
    <Card className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{color: getCompanyColors().primary}}>
          {title}
        </h3>
        {periodFilter}
      </div>
      <div className="h-64">
        <Pie data={chartData} options={options} />
      </div>
    </Card>
  );
};

export default DonutChart;

