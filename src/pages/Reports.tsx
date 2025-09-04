import { useMemo, useState } from 'react';
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
import { useProducts, useSales, useExpenses } from '../hooks/useFirestore';
import type { Timestamp, Product, Sale, Expense } from '../types/models';

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
  // UI (staged) filters
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [period, setPeriod] = useState<'none' | 'today' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('today');

  // Applied filters (used for computations/rendering)
  const [appliedStartDate, setAppliedStartDate] = useState<string>(startDate);
  const [appliedEndDate, setAppliedEndDate] = useState<string>(endDate);
  const [appliedSelectedProduct, setAppliedSelectedProduct] = useState<string>(selectedProduct);
  const [appliedPeriod, setAppliedPeriod] = useState<'none' | 'today' | 'daily' | 'weekly' | 'monthly' | 'yearly'>(period);
  
  const { sales } = useSales();
  const { expenses } = useExpenses();
  const { products } = useProducts();

  const toDate = (ts?: Timestamp) => (ts?.seconds ? new Date(ts.seconds * 1000) : null);
  const start = useMemo(() => new Date(appliedStartDate + 'T00:00:00'), [appliedStartDate]);
  const end = useMemo(() => new Date(appliedEndDate + 'T23:59:59'), [appliedEndDate]);
  const inRange = (d: Date | null) => !!d && d >= start && d <= end;

  const productOptions = useMemo(() => {
    const opts = products.map(p => ({ value: p.id, label: p.name }));
    return [{ value: 'all', label: 'All Products' }, ...opts];
  }, [products]);

  const toYMD = (d: Date) => d.toISOString().slice(0, 10);
  const parseYMD = (s: string) => new Date(s + 'T00:00:00');

  const applyFilters = () => {
    const reference = (startDate ? parseYMD(startDate) : (endDate ? parseYMD(endDate) : new Date()));
    if (period === 'none') {
      // Use explicit dates if provided; otherwise default to today
      if (startDate && endDate) {
        setAppliedStartDate(startDate);
        setAppliedEndDate(endDate);
      } else if (startDate && !endDate) {
        setAppliedStartDate(startDate);
        setAppliedEndDate(startDate);
      } else if (!startDate && endDate) {
        setAppliedStartDate(endDate);
        setAppliedEndDate(endDate);
      } else {
        const today = toYMD(new Date());
        setAppliedStartDate(today);
        setAppliedEndDate(today);
      }
      setAppliedSelectedProduct(selectedProduct);
      setAppliedPeriod('none');
      return;
    }
    if (period === 'today') {
      const today = toYMD(new Date());
      setAppliedStartDate(today);
      setAppliedEndDate(today);
      setAppliedSelectedProduct(selectedProduct);
      setAppliedPeriod(period);
      return;
    }
    if (period === 'daily') {
      const day = toYMD(reference);
      setAppliedStartDate(day);
      setAppliedEndDate(day);
      setAppliedSelectedProduct(selectedProduct);
      setAppliedPeriod(period);
      return;
    }
    if (period === 'weekly') {
      const startW = startOfWeek(reference);
      const endW = new Date(startW);
      endW.setDate(endW.getDate() + 6);
      setAppliedStartDate(toYMD(startW));
      setAppliedEndDate(toYMD(endW));
      setAppliedSelectedProduct(selectedProduct);
      setAppliedPeriod(period);
      return;
    }
    if (period === 'monthly') {
      const startM = startOfMonth(reference);
      const endM = new Date(startM.getFullYear(), startM.getMonth() + 1, 0);
      setAppliedStartDate(toYMD(startM));
      setAppliedEndDate(toYMD(endM));
      setAppliedSelectedProduct(selectedProduct);
      setAppliedPeriod(period);
      return;
    }
    if (period === 'yearly') {
      const startY = startOfYear(reference);
      const endY = new Date(startY.getFullYear(), 11, 31);
      setAppliedStartDate(toYMD(startY));
      setAppliedEndDate(toYMD(endY));
      setAppliedSelectedProduct(selectedProduct);
      setAppliedPeriod(period);
      return;
    }

    // Fallback: explicit dates provided without relying on period
    if (startDate && endDate) {
      setAppliedStartDate(startDate);
      setAppliedEndDate(endDate);
      setAppliedSelectedProduct(selectedProduct);
      setAppliedPeriod('daily');
      return;
    }
    if (startDate && !endDate) {
      setAppliedStartDate(startDate);
      setAppliedEndDate(startDate);
      setAppliedSelectedProduct(selectedProduct);
      setAppliedPeriod('daily');
      return;
    }
    if (!startDate && endDate) {
      setAppliedStartDate(endDate);
      setAppliedEndDate(endDate);
      setAppliedSelectedProduct(selectedProduct);
      setAppliedPeriod('daily');
      return;
    }
  };

  const filteredSales: Sale[] = useMemo(() => {
    const byDate = sales.filter(s => inRange(toDate(s.createdAt)));
    if (appliedSelectedProduct === 'all') return byDate;
    return byDate.filter(sale => sale.products.some(sp => sp.productId === appliedSelectedProduct));
  }, [sales, start, end, appliedSelectedProduct]);

  const filteredExpenses: Expense[] = useMemo(() => {
    return expenses.filter(e => inRange(toDate(e.createdAt)));
  }, [expenses, start, end]);

  // Period helpers
  const startOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = (date.getDay() + 6) % 7; // make Monday=0
    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);
    return date;
  };
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);

  const formatKey = (d: Date) => {
    if (appliedPeriod === 'yearly') return String(d.getFullYear());
    if (appliedPeriod === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (appliedPeriod === 'weekly') {
      const weekStart = startOfWeek(d);
      const y = weekStart.getFullYear();
      const m = String(weekStart.getMonth() + 1).padStart(2, '0');
      const day = String(weekStart.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`; // week start date as key
    }
    // daily/today
    return d.toISOString().slice(0, 10);
  };

  const nextBucket = (d: Date) => {
    const nd = new Date(d);
    if (appliedPeriod === 'yearly') nd.setFullYear(nd.getFullYear() + 1);
    else if (appliedPeriod === 'monthly') nd.setMonth(nd.getMonth() + 1);
    else if (appliedPeriod === 'weekly') nd.setDate(nd.getDate() + 7);
    else nd.setDate(nd.getDate() + 1);
    return nd;
  };

  const normalizeToBucketStart = (d: Date) => {
    if (appliedPeriod === 'yearly') return startOfYear(d);
    if (appliedPeriod === 'monthly') return startOfMonth(d);
    if (appliedPeriod === 'weekly') return startOfWeek(d);
    const dd = new Date(d); dd.setHours(0, 0, 0, 0); return dd;
  };

  const dateKeys = useMemo(() => {
    const keys: string[] = [];
    let cur = normalizeToBucketStart(start);
    const endNorm = normalizeToBucketStart(end);
    while (cur <= endNorm) {
      keys.push(formatKey(cur));
      cur = nextBucket(cur);
    }
    return keys;
  }, [start, end, appliedPeriod]);

  const series = useMemo(() => {
    const salesByDay: Record<string, number> = Object.fromEntries(dateKeys.map(k => [k, 0]));
    const expensesByDay: Record<string, number> = Object.fromEntries(dateKeys.map(k => [k, 0]));

    for (const s of filteredSales) {
      const d = toDate(s.createdAt);
      if (!d) continue;
      const key = formatKey(normalizeToBucketStart(d));
      if (key in salesByDay) salesByDay[key] += s.totalAmount || 0;
    }
    for (const ex of filteredExpenses) {
      const d = toDate(ex.createdAt);
      if (!d) continue;
      const key = formatKey(normalizeToBucketStart(d));
      if (key in expensesByDay) expensesByDay[key] += ex.amount || 0;
    }

    const salesData = dateKeys.map(k => salesByDay[k]);
    const expensesData = dateKeys.map(k => expensesByDay[k]);
    const profitData = dateKeys.map((_, i) => salesData[i] - expensesData[i]);
    return { salesData, expensesData, profitData };
  }, [dateKeys, filteredSales, filteredExpenses]);

  const labels = useMemo(() => {
    return dateKeys.map(k => {
      if (appliedPeriod === 'yearly') return k;
      if (appliedPeriod === 'monthly') {
        const [y, m] = k.split('-').map(Number);
        const dt = new Date(y, (m || 1) - 1, 1);
        return dt.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      }
      if (appliedPeriod === 'weekly') {
        const dt = new Date(k + 'T00:00:00');
        const endW = new Date(dt);
        endW.setDate(endW.getDate() + 6);
        return `${dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endW.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      }
      // daily/today
      const dt = new Date(k + 'T00:00:00');
      return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });
  }, [dateKeys, appliedPeriod]);

  const chartData = useMemo(() => ({
    labels,
    datasets: [
      { label: 'Sales', data: series.salesData, borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: false, tension: 0.4, borderWidth: 2 },
      { label: 'Expenses', data: series.expensesData, borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: false, tension: 0.4, borderWidth: 2 },
      { label: 'Profit', data: series.profitData, borderColor: '#4F46E5', backgroundColor: 'rgba(79, 70, 229, 0.1)', fill: false, tension: 0.4, borderWidth: 2 },
    ],
  }), [labels, series]);
  
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
  
  // Aggregates and rankings
  const totalSales = useMemo(() => filteredSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0), [filteredSales]);
  const totalExpenses = useMemo(() => filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0), [filteredExpenses]);
  const netProfit = useMemo(() => totalSales - totalExpenses, [totalSales, totalExpenses]);

  const topProducts = useMemo(() => {
    const byId = new Map<string, { name: string; quantity: number; customers: Set<string> }>();
    const productById: Record<string, Product> = Object.fromEntries(products.map(p => [p.id, p]));
    for (const s of filteredSales) {
      const customerName = s.customerInfo?.name || 'Unknown';
      for (const sp of s.products) {
        if (selectedProduct !== 'all' && sp.productId !== selectedProduct) continue;
        const entry = byId.get(sp.productId) || { name: productById[sp.productId]?.name || 'Unknown', quantity: 0, customers: new Set<string>() };
        entry.quantity += sp.quantity || 0;
        entry.customers.add(customerName);
        byId.set(sp.productId, entry);
      }
    }
    return Array.from(byId.values())
      .map(v => ({ name: v.name, quantity: v.quantity, customersCount: v.customers.size }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [filteredSales, products, selectedProduct]);

  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; sales: number; orders: number }>();
    for (const s of filteredSales) {
      const name = s.customerInfo?.name || 'Unknown';
      const entry = map.get(name) || { name, sales: 0, orders: 0 };
      entry.sales += s.totalAmount || 0;
      entry.orders += 1;
      map.set(name, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.sales - a.sales).slice(0, 5);
  }, [filteredSales]);

  const handleExport = () => {
    const header = ['Date', 'Sales', 'Expenses', 'Profit'];
    const rows = dateKeys.map((key, i) => [
      key,
      String(series.salesData[i] || 0),
      String(series.expensesData[i] || 0),
      String(series.profitData[i] || 0),
    ]);
    rows.push(['TOTAL', String(totalSales), String(totalExpenses), String(netProfit)]);
    const csv = [header, ...rows].map(r => r.map(field => /[,\"]/.test(field) ? '"' + field.replace(/\"/g, '""') + '"' : field).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
            onClick={handleExport}
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
              Period
            </label>
            <select
              className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
            >
              <option value="none">None</option>
              <option value="today">Today</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
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
              {productOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="mt-4 flex justify-end">
          <Button
            icon={<Filter size={16} />}
            onClick={applyFilters}
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
            <p className="mt-1 text-3xl font-semibold text-emerald-900">{totalSales.toLocaleString()} XAF</p>
            <p className="mt-1 text-sm text-emerald-600">
              <span className="font-medium">{filteredSales.length}</span> orders
            </p>
          </div>
        </Card>
        
        <Card className="bg-red-50 border border-red-100">
          <div className="text-center">
            <p className="text-sm font-medium text-red-700">Total Expenses</p>
            <p className="mt-1 text-3xl font-semibold text-red-900">{totalExpenses.toLocaleString()} XAF</p>
            <p className="mt-1 text-sm text-red-600">
              <span className="font-medium">{filteredExpenses.length}</span> entries
            </p>
          </div>
        </Card>
        
        <Card className="bg-indigo-50 border border-indigo-100">
          <div className="text-center">
            <p className="text-sm font-medium text-indigo-700">Net Profit</p>
            <p className="mt-1 text-3xl font-semibold text-indigo-900">{netProfit.toLocaleString()} XAF</p>
            <p className="mt-1 text-sm text-indigo-600">
              <span className="font-medium">{(totalSales ? Math.round(((netProfit) / totalSales) * 100) : 0)}%</span> margin
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
        <Card title="Top Products (Customers & Quantity)">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customers
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
                      {product.quantity} units
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.customersCount}
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

      {/* Expenses List */}
      <Card title="Expenses" className="mb-6">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-sm text-gray-500 text-center">No expenses for selected period.</td>
                </tr>
              ) : (
                filteredExpenses.map((ex, idx) => {
                  const d = ex.createdAt?.seconds ? new Date(ex.createdAt.seconds * 1000) : null;
                  const dateStr = d ? d.toLocaleDateString() : '';
                  return (
                    <tr key={idx}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dateStr}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ex.description}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ex.category}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ex.amount.toLocaleString()} XAF</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Reports;