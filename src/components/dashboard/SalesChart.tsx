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
  const data = {
    labels,
    datasets: [
      {
        label: 'Sales',
        data: salesData,
        borderColor: '#10B981', // emerald-500
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
      },
      {
        label: 'Expenses',
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
              label += new Intl.NumberFormat('en-US', { 
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
          borderDash: [2, 4],
          color: 'rgba(0, 0, 0, 0.06)',
        },
        ticks: {
          callback: function(value) {
            return new Intl.NumberFormat('en-US', { 
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
    <Card title="Sales & Expenses Overview">
      <div className="h-64">
        <Line data={data} options={options} />
      </div>
    </Card>
  );
};

export default SalesChart;