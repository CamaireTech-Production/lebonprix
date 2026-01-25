import React, { useEffect, useState, useMemo } from 'react';
import AdminDashboardLayout from '../../components/layout/AdminDashboardLayout';
import { getFirestore, collection, getDocs, orderBy, limit, collectionGroup, query as firestoreQuery, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { getAllRestaurantsVisitorStats } from '../../services/visitorTrackingService';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { logActivity } from '../../services/activityLogService';
import { toast } from 'react-hot-toast';

// Period options
const periods = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
];

// Data type options
const dataTypes = [
  { value: 'orders', label: 'Orders' },
  { value: 'restaurants', label: 'Restaurants' },
];

function getPeriodStart(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
      return new Date(now.getFullYear(), now.getMonth(), diff);
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    default:
      return null; // all time
  }
}

const AdminDashboard: React.FC = () => {
  const db = getFirestore();
  const { currentAdmin } = useAdminAuth();
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [dataType, setDataType] = useState<'orders' | 'restaurants'>('orders');
  const [enablingTemplateSelection, setEnablingTemplateSelection] = useState(false);

  const [stats, setStats] = useState({
    restaurants: 0,
    orders: 0,
    admins: 0,
    deletedItems: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [visitorStats, setVisitorStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const periodStart = useMemo(() => getPeriodStart(period), [period]);

  const handleEnableTemplateSelectionForAll = async () => {
    if (!confirm('Are you sure you want to enable template selection for ALL restaurants? This will allow all restaurant users to customize their templates.')) {
      return;
    }

    setEnablingTemplateSelection(true);
    try {
      const restaurantsRef = collection(db, 'restaurants');
      const snapshot = await getDocs(restaurantsRef);
      
      let updatedCount = 0;
      
      for (const docSnapshot of snapshot.docs) {
        const restaurant = docSnapshot.data();
        const restaurantId = docSnapshot.id;
        
        // Skip if template selection is already enabled or restaurant is deleted
        if (restaurant.templateSelection === true || restaurant.isDeleted === true) {
          continue;
        }
        
        // Update the restaurant to enable template selection
        const restaurantRef = doc(db, 'restaurants', restaurantId);
        await updateDoc(restaurantRef, {
          templateSelection: true,
          updatedAt: serverTimestamp()
        });
        
        updatedCount++;
      }
      
      // Log activity
      await logActivity({
        userId: currentAdmin?.id,
        userEmail: currentAdmin?.email,
        action: 'template_selection_enabled_for_all',
        entityType: 'system',
        entityId: 'all_restaurants',
        details: { 
          updatedCount
        },
      });

      toast.success(`🎨 Template selection enabled for ${updatedCount} restaurants! Restaurant users can now customize their templates.`);
    } catch (error) {
      console.error('Error enabling template selection for all restaurants:', error);
      toast.error('Failed to enable template selection for all restaurants');
    } finally {
      setEnablingTemplateSelection(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch all restaurants
        const restaurantsSnap = await getDocs(collection(db, 'restaurants'));
        // Active: isDeleted === false OR isDeleted missing
        const activeRestaurants = restaurantsSnap.docs.filter((doc: any) => {
          const d = doc.data();
          return d.isDeleted === false || d.isDeleted === undefined;
        });
        // Deleted: isDeleted === true
        const deletedRestaurants = restaurantsSnap.docs.filter((doc: any) => doc.data().isDeleted === true);
        // Period filter logic
        let filteredActiveRestaurants;
        if (period === 'all') {
          filteredActiveRestaurants = activeRestaurants;
        } else {
          filteredActiveRestaurants = activeRestaurants.filter((doc: any) => {
            const data = doc.data();
            if (!data.createdAt) return true; // include legacy docs
            const ts = data.createdAt;
            const dateObj = ts?.toDate ? ts.toDate() : new Date(ts);
            return dateObj >= (periodStart || new Date(0));
          });
        }

        // Fetch all orders
        const ordersSnap = await getDocs(collection(db, 'orders'));
        const activeOrders = ordersSnap.docs.filter((doc: any) => {
          const d = doc.data();
          return d.isDeleted === false || d.isDeleted === undefined;
        });
        const deletedOrders = ordersSnap.docs.filter((doc: any) => doc.data().isDeleted === true);
        let filteredActiveOrders;
        if (period === 'all') {
          filteredActiveOrders = activeOrders;
        } else {
          filteredActiveOrders = activeOrders.filter((doc: any) => {
            const data = doc.data();
            if (!data.createdAt) return true;
            const ts = data.createdAt;
            const dateObj = ts?.toDate ? ts.toDate() : new Date(ts);
            return dateObj >= (periodStart || new Date(0));
          });
        }

        // Admins (users) - only those with isDeleted === false or missing
        const adminsSnap = await getDocs(collection(db, 'users'));
        const activeAdmins = adminsSnap.docs.filter((doc: any) => {
          const d = doc.data();
          return d.isDeleted === false || d.isDeleted === undefined;
        });

        setStats({
          restaurants: filteredActiveRestaurants.length,
          orders: filteredActiveOrders.length,
          admins: activeAdmins.length,
          deletedItems: deletedRestaurants.length + deletedOrders.length,
        });

        // Chart data: for period, include docs with missing createdAt
        const rawDocs = dataType === 'orders' ? filteredActiveOrders : filteredActiveRestaurants;
        const map: Record<string, number> = {};
        rawDocs.forEach((doc: any) => {
          const data = doc.data();
          let dateObj;
          if (!data.createdAt) {
            dateObj = new Date(2000, 0, 1); // fallback for legacy, group as 'legacy'
          } else {
            const ts: any = data.createdAt;
            dateObj = ts?.toDate ? ts.toDate() : new Date(ts);
          }
          const key = data.createdAt ? dateObj.toISOString().slice(0, 10) : 'legacy';
          map[key] = (map[key] || 0) + 1;
        });
        const chartArr = Object.keys(map)
          .sort()
          .map(key => ({ date: key, count: map[key] }));
        setChartData(chartArr);

        // Fetch last 5 sync logs from syncLogs/*/logs subcollections
        const syncSnap = await getDocs(firestoreQuery(collectionGroup(db, 'logs'), orderBy('timestamp', 'desc'), limit(5)));
        setSyncLogs(syncSnap.docs.map((d: any) => d.data()));

        // Fetch last 5 activity logs from activityLogs collection (scaffolded, may be empty)
        const activitySnap = await getDocs(firestoreQuery(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(5)));
        setActivityLogs(activitySnap.docs.map((d: any) => d.data()));
        
        // Fetch visitor statistics for all restaurants
        const visitorStatsData = await getAllRestaurantsVisitorStats();
        setVisitorStats(visitorStatsData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [db, periodStart, dataType]);

  return (
    <AdminDashboardLayout>
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold">Admin Overview</h1>

        {/* Quick Actions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">🚀 Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleEnableTemplateSelectionForAll}
              disabled={enablingTemplateSelection}
              title="Enable template customization for all restaurants"
            >
              {enablingTemplateSelection ? '⏳ Enabling...' : '🎨 Enable Templates for All Restaurants'}
            </button>
            <div className="text-sm text-blue-700 flex items-center">
              <span className="mr-2">💡</span>
              This will allow all restaurant users to customize their templates immediately
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-row gap-4 w-full mb-2">
          <select value={period} onChange={e => setPeriod(e.target.value as any)} className="border px-3 py-2 rounded w-1/2">
            {periods.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <select value={dataType} onChange={e => setDataType(e.target.value as any)} className="border px-3 py-2 rounded w-1/2">
            {dataTypes.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size={60} />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Restaurants" value={stats.restaurants} />
              <StatCard title="Orders" value={stats.orders} />
              <StatCard title="Active Admins" value={stats.admins} />
              <StatCard title="Deleted Items" value={stats.deletedItems} />
            </div>

            {/* Chart */}
            <div className="bg-white shadow rounded p-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">{dataTypes.find(d => d.value === dataType)?.label} over time</h2>
              {chartData.length === 0 ? (
                <p className="text-gray-500">No data available for this period.</p>
              ) : (
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#FFD700" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>


            {/* Sync Logs Table */}
            <div className="bg-white shadow rounded p-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Recent Sync Logs</h2>
              {syncLogs.length === 0 ? (
                <p className="text-gray-500">No sync logs recorded.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2">Action Type</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Entity</th>
                      <th className="py-2">Error</th>
                      <th className="py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncLogs.map((log, idx) => (
                      <tr key={idx} className="border-b last:border-none">
                        <td className="py-2">{log.entry?.type || '—'}</td>
                        <td className="py-2">{log.status || '—'}</td>
                        <td className="py-2">{log.entry?.payload?.name || log.entry?.payload?.id || '—'}</td>
                        <td className="py-2">{log.error || '—'}</td>
                        <td className="py-2">{new Date(log.timestamp || Date.now()).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Activity Logs Table (placeholder) */}
            <div className="bg-white shadow rounded p-6 mt-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Recent Activity Logs</h2>
                <a 
                  href="/admin/restaurant-inspector" 
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                >
                  🔧 Restaurant Inspector
                </a>
              </div>
              {activityLogs.length === 0 ? (
                <p className="text-gray-500">No activity logs yet. This will show all user/admin actions as the app is updated to track them.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2">User</th>
                      <th className="py-2">Action</th>
                      <th className="py-2">Entity</th>
                      <th className="py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLogs.map((act, idx) => (
                      <tr key={idx} className="border-b last:border-none">
                        <td className="py-2">{act.userEmail || act.userId || '—'}</td>
                        <td className="py-2">{act.action || '—'}</td>
                        <td className="py-2">{act.entityType || '—'}</td>
                        <td className="py-2">{new Date(act.timestamp?.toDate ? act.timestamp.toDate() : act.timestamp || Date.now()).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            {/* Visitor Statistics Table */}
            <div className="bg-white shadow rounded p-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Restaurant Visitor Statistics</h2>
              {visitorStats.length === 0 ? (
                <p className="text-gray-500">No visitor statistics available yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2">Restaurant</th>
                      <th className="py-2">Type</th>
                      <th className="py-2">Total Visitors</th>
                      <th className="py-2">Today</th>
                      <th className="py-2">This Week</th>
                      <th className="py-2">This Month</th>
                      <th className="py-2">Last Visit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitorStats.map((restaurant, idx) => (
                      <tr key={idx} className="border-b last:border-none">
                        <td className="py-2 font-medium">
                          {restaurant.restaurantName}
                          {restaurant.isDemo && <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Demo</span>}
                        </td>
                        <td className="py-2">
                          {restaurant.isDemo ? 'Demo Account' : 'Regular Restaurant'}
                        </td>
                        <td className="py-2 font-bold">{restaurant.stats.totalVisitors}</td>
                        <td className="py-2">{restaurant.stats.visitsToday}</td>
                        <td className="py-2">{restaurant.stats.visitsThisWeek}</td>
                        <td className="py-2">{restaurant.stats.visitsThisMonth}</td>
                        <td className="py-2">
                          {restaurant.stats.lastVisit ? 
                            new Date(restaurant.stats.lastVisit?.toDate ? restaurant.stats.lastVisit.toDate() : restaurant.stats.lastVisit).toLocaleString() : 
                            'Never'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </AdminDashboardLayout>
  );
};

const StatCard: React.FC<{ title: string; value: number }> = ({ title, value }) => (
  <div className="bg-white rounded shadow p-6 text-center">
    <div className="text-2xl font-bold">{value}</div>
    <div className="text-gray-600">{title}</div>
  </div>
);

export default AdminDashboard; 