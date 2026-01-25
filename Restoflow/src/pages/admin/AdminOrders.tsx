import React, { useEffect, useState } from 'react';
import AdminDashboardLayout from '../../components/layout/AdminDashboardLayout';
import { getFirestore, collection, getDocs, orderBy, query } from 'firebase/firestore';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import designSystem from '../../designSystem';

const PAGE_SIZE = 10;
const ITEMS_PER_PAGE_OPTIONS = [5, 10, 20, 50, 100];

const AdminOrders: React.FC = () => {
  const db = getFirestore();
  const [orders, setOrders] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRestaurant, setSelectedRestaurant] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    const fetchOrdersAndRestaurants = async () => {
      setLoading(true);
      try {
        // Fetch all restaurants and build a map
        const restaurantsSnap = await getDocs(query(collection(db, 'restaurants')));
        const restaurantMap: Record<string, any> = {};
        restaurantsSnap.docs.forEach(doc => {
          restaurantMap[doc.id] = doc.data();
        });
        setRestaurants(restaurantMap);
        // Fetch all orders
        const ordersSnap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
        const allOrders = ordersSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setOrders(allOrders);
      } finally {
        setLoading(false);
      }
    };
    fetchOrdersAndRestaurants();
  }, [db]);

  // Filtering
  const filteredOrders = orders.filter(order => {
    const matchRestaurant = selectedRestaurant === 'all' || order.restaurantId === selectedRestaurant;
    const matchStatus = selectedStatus === 'all' || order.status === selectedStatus;
    return matchRestaurant && matchStatus;
  });

  // Sorting
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];
    if (sortField === 'createdAt') {
      aValue = aValue?.toDate ? aValue.toDate() : new Date(aValue);
      bValue = bValue?.toDate ? bValue.toDate() : new Date(bValue);
    }
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
  const paginatedOrders = sortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderRow = (order: any, idx: number) => (
    <tr key={order.id || idx} className="hover:bg-gray-50 transition border-b last:border-none">
      <td className="px-6 py-4 whitespace-nowrap font-medium text-primary">{order.id.slice(-6)}</td>
      <td className="px-6 py-4 whitespace-nowrap">{restaurants[order.restaurantId]?.name || '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap">{order.tableNumber || '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${order.status === 'completed' ? 'bg-green-100 text-green-800' : order.status === 'cancelled' ? 'bg-red-100 text-red-800' : order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>{order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : '—'}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">{order.total ? `${order.total} FCFA` : '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap">{order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : '—'}</td>
    </tr>
  );

  return (
    <AdminDashboardLayout>
      <h1 className="text-2xl font-bold mb-4">Orders</h1>
      {loading ? (
        <div className="flex justify-center items-center h-32">
          <LoadingSpinner size={48} color={designSystem.colors.primary} />
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="flex flex-wrap gap-4 mb-4 p-4">
            <div>
              <label className="block text-sm font-medium mb-1">Filter by Restaurant</label>
              <select value={selectedRestaurant} onChange={e => { setSelectedRestaurant(e.target.value); setCurrentPage(1); }} className="border px-2 py-1 rounded">
                <option value="all">All</option>
                {Object.entries(restaurants).map(([id, r]: any) => (
                  <option key={id} value={id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Filter by Status</label>
              <select value={selectedStatus} onChange={e => { setSelectedStatus(e.target.value); setCurrentPage(1); }} className="border px-2 py-1 rounded">
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="preparing">Preparing</option>
                <option value="ready">Ready</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          {/* Pagination controls (top) */}
          <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200">
            <div className="flex-1 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(currentPage * itemsPerPage, sortedOrders.length)}</span>{' '}
                  of <span className="font-medium">{sortedOrders.length}</span> results
                </p>
                <div className="flex items-center space-x-2">
                  <label htmlFor="ordersItemsPerPage" className="text-sm text-gray-700">Items per page:</label>
                  <select
                    id="ordersItemsPerPage"
                    value={itemsPerPage}
                    onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="block w-20 py-1 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  >
                    {ITEMS_PER_PAGE_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    key="prev"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {'<'}
                  </button>
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium ${currentPage === i + 1 ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    key="next"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {'>'}
                  </button>
                </nav>
              </div>
            </div>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('id')}>Order #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('restaurantId')}>Restaurant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('tableNumber')}>Table</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('status')}>Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('total')}>Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('createdAt')}>Created At</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">No orders found.</td>
                </tr>
              ) : (
                paginatedOrders.map(renderRow)
              )}
            </tbody>
          </table>
          {/* Pagination controls (bottom) */}
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(currentPage * itemsPerPage, sortedOrders.length)}</span>{' '}
                  of <span className="font-medium">{sortedOrders.length}</span> results
                </p>
                <div className="flex items-center space-x-2">
                  <label htmlFor="ordersItemsPerPageBottom" className="text-sm text-gray-700">Items per page:</label>
                  <select
                    id="ordersItemsPerPageBottom"
                    value={itemsPerPage}
                    onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="block w-20 py-1 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  >
                    {ITEMS_PER_PAGE_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    key="prev"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {'<'}
                  </button>
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium ${currentPage === i + 1 ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    key="next"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {'>'}
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminDashboardLayout>
  );
};

export default AdminOrders; 