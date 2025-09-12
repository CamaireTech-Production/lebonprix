import { useMemo, useState, useEffect, useCallback } from 'react';
import { Calendar, FileDown } from 'lucide-react';
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
  // Calculate default weekly range
  const getDefaultWeeklyRange = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    const day = (today.getDay() + 6) % 7; // make Monday=0
    startOfWeek.setDate(today.getDate() - day);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return {
      start: startOfWeek.toISOString().slice(0, 10),
      end: endOfWeek.toISOString().slice(0, 10)
    };
  };

  const defaultRange = getDefaultWeeklyRange();
  
  // UI filters - now directly used for computations
  const [startDate, setStartDate] = useState<string>(defaultRange.start);
  const [endDate, setEndDate] = useState<string>(defaultRange.end);
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [period, setPeriod] = useState<'none' | 'today' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
  
  const { sales } = useSales();
  const { expenses } = useExpenses();
  const { products } = useProducts();

  const toDate = (ts?: Timestamp) => (ts?.seconds ? new Date(ts.seconds * 1000) : null);
  const start = useMemo(() => new Date(startDate + 'T00:00:00'), [startDate]);
  const end = useMemo(() => new Date(endDate + 'T23:59:59'), [endDate]);
  const inRange = useCallback((d: Date | null) => !!d && d >= start && d <= end, [start, end]);

  const productOptions = useMemo(() => {
    const opts = products.map(p => ({ value: p.id, label: p.name }));
    return [{ value: 'all', label: 'All Products' }, ...opts];
  }, [products]);

  const toYMD = (d: Date) => d.toISOString().slice(0, 10);

  // Period helpers
  const startOfWeek = useCallback((d: Date) => {
    const date = new Date(d);
    const day = (date.getDay() + 6) % 7; // make Monday=0
    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const startOfMonth = useCallback((d: Date) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0), []);
  const startOfYear = useCallback((d: Date) => new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0), []);

  // Auto-update date ranges when period changes
  useEffect(() => {
    const today = new Date();
    
    if (period === 'today') {
      const todayStr = toYMD(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (period === 'daily') {
      const dayStr = toYMD(today);
      setStartDate(dayStr);
      setEndDate(dayStr);
    } else if (period === 'weekly') {
      const startW = startOfWeek(today);
      const endW = new Date(startW);
      endW.setDate(endW.getDate() + 6);
      setStartDate(toYMD(startW));
      setEndDate(toYMD(endW));
    } else if (period === 'monthly') {
      const startM = startOfMonth(today);
      const endM = new Date(startM.getFullYear(), startM.getMonth() + 1, 0);
      setStartDate(toYMD(startM));
      setEndDate(toYMD(endM));
    } else if (period === 'yearly') {
      const startY = startOfYear(today);
      const endY = new Date(startY.getFullYear(), 11, 31);
      setStartDate(toYMD(startY));
      setEndDate(toYMD(endY));
    }
    // For 'none' period, keep the current date range as is
  }, [period, startOfWeek, startOfMonth, startOfYear]);


  const filteredSales: Sale[] = useMemo(() => {
    const byDate = sales.filter(s => inRange(toDate(s.createdAt)));
    if (selectedProduct === 'all') return byDate;
    return byDate.filter(sale => sale.products.some(sp => sp.productId === selectedProduct));
  }, [sales, inRange, selectedProduct]);

  const filteredExpenses: Expense[] = useMemo(() => {
    return expenses.filter(e => inRange(toDate(e.createdAt)));
  }, [expenses, inRange]);

  const formatKey = useCallback((d: Date) => {
    if (period === 'yearly') return String(d.getFullYear());
    if (period === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (period === 'weekly') {
      const weekStart = startOfWeek(d);
      const y = weekStart.getFullYear();
      const m = String(weekStart.getMonth() + 1).padStart(2, '0');
      const day = String(weekStart.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`; // week start date as key
    }
    // daily/today
    return d.toISOString().slice(0, 10);
  }, [period, startOfWeek]);

  const nextBucket = useCallback((d: Date) => {
    const nd = new Date(d);
    if (period === 'yearly') nd.setFullYear(nd.getFullYear() + 1);
    else if (period === 'monthly') nd.setMonth(nd.getMonth() + 1);
    else if (period === 'weekly') nd.setDate(nd.getDate() + 7);
    else nd.setDate(nd.getDate() + 1);
    return nd;
  }, [period]);

  const normalizeToBucketStart = useCallback((d: Date) => {
    if (period === 'yearly') return startOfYear(d);
    if (period === 'monthly') return startOfMonth(d);
    if (period === 'weekly') return startOfWeek(d);
    const dd = new Date(d); dd.setHours(0, 0, 0, 0); return dd;
  }, [period, startOfYear, startOfMonth, startOfWeek]);

  const dateKeys = useMemo(() => {
    const keys: string[] = [];
    let cur = normalizeToBucketStart(start);
    const endNorm = normalizeToBucketStart(end);
    while (cur <= endNorm) {
      keys.push(formatKey(cur));
      cur = nextBucket(cur);
    }
    return keys;
  }, [start, end, formatKey, nextBucket, normalizeToBucketStart]);

  const series = useMemo(() => {
    const salesByDay: Record<string, number> = Object.fromEntries(dateKeys.map(k => [k, 0]));
    const expensesByDay: Record<string, number> = Object.fromEntries(dateKeys.map(k => [k, 0]));
    const costOfGoodsSoldByDay: Record<string, number> = Object.fromEntries(dateKeys.map(k => [k, 0]));

    for (const s of filteredSales) {
      const d = toDate(s.createdAt);
      if (!d) continue;
      const key = formatKey(normalizeToBucketStart(d));
      if (key in salesByDay) {
        salesByDay[key] += s.totalAmount || 0;
        
        // Calculate cost of goods sold for this sale
        const costOfGoodsSold = s.products.reduce((sum, saleProduct) => {
          const product = products.find(p => p.id === saleProduct.productId);
          if (!product) return sum;
          return sum + ((product.costPrice || 0) * saleProduct.quantity);
        }, 0);
        
        costOfGoodsSoldByDay[key] += costOfGoodsSold;
      }
    }
    for (const ex of filteredExpenses) {
      const d = toDate(ex.createdAt);
      if (!d) continue;
      const key = formatKey(normalizeToBucketStart(d));
      if (key in expensesByDay) expensesByDay[key] += ex.amount || 0;
    }

    const salesData = dateKeys.map(k => salesByDay[k]);
    const expensesData = dateKeys.map(k => expensesByDay[k]);
    const costOfGoodsSoldData = dateKeys.map(k => costOfGoodsSoldByDay[k]);
    const profitData = dateKeys.map((_, i) => salesData[i] - costOfGoodsSoldData[i] - expensesData[i]);
    return { salesData, expensesData, costOfGoodsSoldData, profitData };
  }, [dateKeys, filteredSales, filteredExpenses, products, formatKey, normalizeToBucketStart]);

  const labels = useMemo(() => {
    return dateKeys.map(k => {
      if (period === 'yearly') return k;
      if (period === 'monthly') {
        const [y, m] = k.split('-').map(Number);
        const dt = new Date(y, (m || 1) - 1, 1);
        return dt.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      }
      if (period === 'weekly') {
        const dt = new Date(k + 'T00:00:00');
        const endW = new Date(dt);
        endW.setDate(endW.getDate() + 6);
        return `${dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endW.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      }
      // daily/today
      const dt = new Date(k + 'T00:00:00');
      return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });
  }, [dateKeys, period]);

  const chartData = useMemo(() => ({
    labels,
    datasets: [
      { label: 'Sales', data: series.salesData, borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: false, tension: 0.4, borderWidth: 2 },
      { label: 'Cost of Goods Sold', data: series.costOfGoodsSoldData, borderColor: '#F59E0B', backgroundColor: 'rgba(245, 158, 11, 0.1)', fill: false, tension: 0.4, borderWidth: 2 },
      { label: 'Expenses', data: series.expensesData, borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: false, tension: 0.4, borderWidth: 2 },
      { label: 'Net Profit', data: series.profitData, borderColor: '#4F46E5', backgroundColor: 'rgba(79, 70, 229, 0.1)', fill: false, tension: 0.4, borderWidth: 2 },
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
  
  // Calculate total cost of goods sold
  const totalCostOfGoodsSold = useMemo(() => {
    return filteredSales.reduce((sum, sale) => {
      return sum + sale.products.reduce((productSum, saleProduct) => {
        // Find the product to get its cost price
        const product = products.find(p => p.id === saleProduct.productId);
        if (!product) return productSum;
        
        // Use the cost price from the product (this assumes all products have costPrice)
        const costPrice = product.costPrice || 0;
        return productSum + (costPrice * saleProduct.quantity);
      }, 0);
    }, 0);
  }, [filteredSales, products]);
  
  const netProfit = useMemo(() => totalSales - totalCostOfGoodsSold - totalExpenses, [totalSales, totalCostOfGoodsSold, totalExpenses]);

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
    const header = ['Date', 'Sales', 'Cost of Goods Sold', 'Expenses', 'Net Profit'];
    const rows = dateKeys.map((key, i) => [
      key,
      String(series.salesData[i] || 0),
      String(series.costOfGoodsSoldData[i] || 0),
      String(series.expensesData[i] || 0),
      String(series.profitData[i] || 0),
    ]);
    rows.push(['TOTAL', String(totalSales), String(totalCostOfGoodsSold), String(totalExpenses), String(netProfit)]);
    const csv = [header, ...rows].map(r => r.map(field => /[,"]/.test(field) ? '"' + field.replace(/"/g, '""') + '"' : field).join(',')).join('\n');
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
              onChange={(e) => setPeriod(e.target.value as 'none' | 'today' | 'daily' | 'weekly' | 'monthly' | 'yearly')}
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
      </Card>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-emerald-50 border border-emerald-100">
          <div className="text-center">
            <p className="text-sm font-medium text-emerald-700">Total Sales</p>
            <p className="mt-1 text-3xl font-semibold text-emerald-900">{totalSales.toLocaleString()} XAF</p>
            <p className="mt-1 text-sm text-emerald-600">
              <span className="font-medium">{filteredSales.length}</span> orders
            </p>
          </div>
        </Card>
        
        <Card className="bg-amber-50 border border-amber-100">
          <div className="text-center">
            <p className="text-sm font-medium text-amber-700">Cost of Goods Sold</p>
            <p className="mt-1 text-3xl font-semibold text-amber-900">{totalCostOfGoodsSold.toLocaleString()} XAF</p>
            <p className="mt-1 text-sm text-amber-600">
              <span className="font-medium">{(totalSales ? Math.round(((totalCostOfGoodsSold) / totalSales) * 100) : 0)}%</span> of sales
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