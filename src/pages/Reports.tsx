import { useState } from 'react';
import { Calendar, FileDown, Filter } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
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

const Reports = () => {
  const [startDate, setStartDate] = useState('2025-04-01');
  const [endDate, setEndDate] = useState('2025-04-30');
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState('all');
  
  // Mock data
  const salesData = [150000, 190000, 170000, 220000, 200000, 250000, 270000, 240000, 280000, 310000, 290000, 320000];
  const expensesData = [90000, 100000, 95000, 110000, 105000, 120000, 125000, 115000, 130000, 140000, 135000, 145000];
  const profitData = salesData.map((sale, index) => sale - expensesData[index]);
  
  const labels = [
    'Apr 1', 'Apr 5', 'Apr 10', 'Apr 15', 
    'Apr 20', 'Apr 25', 'Apr 30', 'May 5', 
    'May 10', 'May 15', 'May 20', 'May 25'
  ];
  
  const chartData = {
    labels,
    datasets: [
      {
        label: 'Sales',
        data: salesData,
        borderColor: '#10B981', // emerald-500
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: false,
        tension: 0.4,
        borderWidth: 2,
      },
      {
        label: 'Expenses',
        data: expensesData,
        borderColor: '#EF4444', // red-500
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: false,
        tension: 0.4,
        borderWidth: 2,
      },
      {
        label: 'Profit',
        data: profitData,
        borderColor: '#4F46E5', // indigo-600
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        fill: false,
        tension: 0.4,
        borderWidth: 2,
      },
    ],
  };
  
  const chartOptions: ChartOptions<'line'> = {
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
  
  // Mock top products data
  const topProducts = [
    { name: 'Olive Oil (5L)', sales: 250000, quantity: 15 },
    { name: 'Palm Oil (10L)', sales: 200000, quantity: 8 },
    { name: 'Groundnut Oil (2L)', sales: 150000, quantity: 18 },
    { name: 'Coconut Oil (1L)', sales: 120000, quantity: 20 },
    { name: 'Avocado Oil (500ml)', sales: 90000, quantity: 12 },
  ];
  
  // Mock top customers data
  const topCustomers = [
    { name: 'Restaurant Le Meridien', sales: 180000, orders: 4 },
    { name: 'Supermarket Central', sales: 150000, orders: 3 },
    { name: 'Hotel Paradise', sales: 120000, orders: 5 },
    { name: 'Restaurant Saveur', sales: 90000, orders: 2 },
    { name: 'Beauty Salon Elegance', sales: 60000, orders: 3 },
  ];

  return (
    <div className="pb-16 md:pb-0"> {/* Add padding to bottom for mobile nav */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
          <p className="text-gray-600">View detailed business reports and analytics</p>
        </div>
        
        <div className="mt-4 md:mt-0">
          <Button 
            variant="outline" 
            icon={<FileDown size={16} />}
          >
            Export Report
          </Button>
        </div>
      </div>
      
      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-gray-500">
              <Calendar size={18} />
            </span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              label="Start Date"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-gray-500">
              <Calendar size={18} />
            </span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              label="End Date"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User
            </label>
            <select
              className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value="all">All Users</option>
              <option value="john">John Doe</option>
              <option value="marie">Marie Tongo</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product
            </label>
            <select
              className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
            >
              <option value="all">All Products</option>
              <option value="olive">Olive Oil</option>
              <option value="palm">Palm Oil</option>
              <option value="groundnut">Groundnut Oil</option>
              <option value="coconut">Coconut Oil</option>
              <option value="avocado">Avocado Oil</option>
            </select>
          </div>
        </div>
        
        <div className="mt-4 flex justify-end">
          <Button
            icon={<Filter size={16} />}
          >
            Apply Filters
          </Button>
        </div>
      </Card>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-emerald-50 border border-emerald-100">
          <div className="text-center">
            <p className="text-sm font-medium text-emerald-700">Total Sales</p>
            <p className="mt-1 text-3xl font-semibold text-emerald-900">2,850,000 XAF</p>
            <p className="mt-1 text-sm text-emerald-600">
              <span className="font-medium">+12%</span> from previous period
            </p>
          </div>
        </Card>
        
        <Card className="bg-red-50 border border-red-100">
          <div className="text-center">
            <p className="text-sm font-medium text-red-700">Total Expenses</p>
            <p className="mt-1 text-3xl font-semibold text-red-900">1,310,000 XAF</p>
            <p className="mt-1 text-sm text-red-600">
              <span className="font-medium">+5%</span> from previous period
            </p>
          </div>
        </Card>
        
        <Card className="bg-indigo-50 border border-indigo-100">
          <div className="text-center">
            <p className="text-sm font-medium text-indigo-700">Net Profit</p>
            <p className="mt-1 text-3xl font-semibold text-indigo-900">1,540,000 XAF</p>
            <p className="mt-1 text-sm text-indigo-600">
              <span className="font-medium">+18%</span> from previous period
            </p>
          </div>
        </Card>
      </div>
      
      {/* Chart */}
      <Card className="mb-6" title="Financial Overview">
        <div className="h-80">
          <Line data={chartData} options={chartOptions} />
        </div>
      </Card>
      
      {/* Top Products & Customers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card title="Top Selling Products">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sales
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topProducts.map((product, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.sales.toLocaleString()} XAF
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.quantity} units
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        
        <Card title="Top Customers">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sales
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Orders
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topCustomers.map((customer, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {customer.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {customer.sales.toLocaleString()} XAF
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {customer.orders}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Reports;