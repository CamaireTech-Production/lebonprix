import React, { useEffect, useState } from 'react';
import AdminDashboardLayout from '../../components/layout/AdminDashboardLayout';
import { getFirestore, collection, collectionGroup, getDocs, orderBy, limit, startAfter, query as firestoreQuery } from 'firebase/firestore';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import designSystem from '../../designSystem';

const ITEMS_PER_PAGE_OPTIONS = [5, 10, 20, 50, 100];

const columns = {
  sync: [
    { key: 'type', label: 'Action Type' },
    { key: 'status', label: 'Status' },
    { key: 'entity', label: 'Entity' },
    { key: 'error', label: 'Error' },
    { key: 'date', label: 'Date' },
  ],
  activity: [
    { key: 'user', label: 'User' },
    { key: 'action', label: 'Action' },
    { key: 'entityType', label: 'Entity' },
    { key: 'date', label: 'Date' },
  ],
};

const AdminActivityLog: React.FC = () => {
  const db = getFirestore();
  // Sync logs state
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncOrder, setSyncOrder] = useState<'desc' | 'asc'>('desc');
  const [syncAllLogs, setSyncAllLogs] = useState<any[]>([]);
  const [syncItemsPerPage, setSyncItemsPerPage] = useState(10);
  const [syncCurrentPage, setSyncCurrentPage] = useState(1);
  // Activity logs state
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityOrder, setActivityOrder] = useState<'desc' | 'asc'>('desc');
  const [activityAllLogs, setActivityAllLogs] = useState<any[]>([]);
  const [activityItemsPerPage, setActivityItemsPerPage] = useState(10);
  const [activityCurrentPage, setActivityCurrentPage] = useState(1);

  // Fetch all sync logs (for classic pagination)
  const fetchAllSyncLogs = async () => {
    setSyncLoading(true);
    try {
      const q = firestoreQuery(
        collectionGroup(db, 'logs'),
        orderBy('timestamp', syncOrder)
      );
      const snap = await getDocs(q);
      const logs = snap.docs.map(d => d.data());
      setSyncAllLogs(logs);
    } finally {
      setSyncLoading(false);
    }
  };

  // Fetch all activity logs (for classic pagination)
  const fetchAllActivityLogs = async () => {
    setActivityLoading(true);
    try {
      const q = firestoreQuery(
        collection(db, 'activityLogs'),
        orderBy('timestamp', activityOrder)
      );
      const snap = await getDocs(q);
      const logs = snap.docs.map(d => d.data());
      setActivityAllLogs(logs);
    } finally {
      setActivityLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchAllSyncLogs();
    fetchAllActivityLogs();
    // eslint-disable-next-line
  }, [syncOrder, activityOrder]);
  useEffect(() => { setSyncCurrentPage(1); }, [syncItemsPerPage, syncOrder]);
  useEffect(() => { setActivityCurrentPage(1); }, [activityItemsPerPage, activityOrder]);

  // Paginated logs
  const syncTotalPages = Math.ceil(syncAllLogs.length / syncItemsPerPage);
  const paginatedSyncLogs = syncAllLogs.slice((syncCurrentPage - 1) * syncItemsPerPage, syncCurrentPage * syncItemsPerPage);
  const activityTotalPages = Math.ceil(activityAllLogs.length / activityItemsPerPage);
  const paginatedActivityLogs = activityAllLogs.slice((activityCurrentPage - 1) * activityItemsPerPage, activityCurrentPage * activityItemsPerPage);

  // Table render helpers
  const renderSyncRow = (log: any, idx: number) => (
    <tr key={idx} className="border-b last:border-none">
      <td className="px-6 py-4 whitespace-nowrap">{log.entry?.type || '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap">{log.status || '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap">{log.entry?.payload?.name || log.entry?.payload?.id || '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap">{log.error || '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap">{new Date(log.timestamp || Date.now()).toLocaleString()}</td>
    </tr>
  );
  const renderActivityRow = (log: any, idx: number) => (
    <tr key={idx} className="border-b last:border-none">
      <td className="px-6 py-4 whitespace-nowrap">{log.userEmail || log.userId || '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap">{log.action || '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap">{log.entityType || '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap">{new Date(log.timestamp?.toDate ? log.timestamp.toDate() : log.timestamp || Date.now()).toLocaleString()}</td>
    </tr>
  );
  // Pagination controls
  const renderPagination = (currentPage: number, totalPages: number, setPage: (p: number) => void, itemsPerPage: number, setItemsPerPage: (n: number) => void, totalItems: number, idPrefix: string) => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    // Previous
    pages.push(
      <button
        key="prev"
        onClick={() => setPage(currentPage - 1)}
        disabled={currentPage === 1}
        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {'<'}
      </button>
    );
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => setPage(i)}
          className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium ${currentPage === i ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          {i}
        </button>
      );
    }
    // Next
    pages.push(
      <button
        key="next"
        onClick={() => setPage(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {'>'}
      </button>
    );
    return (
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalItems)}</span>{' '}
              of <span className="font-medium">{totalItems}</span> results
            </p>
            <div className="flex items-center space-x-2">
              <label htmlFor={`${idPrefix}-itemsPerPage`} className="text-sm text-gray-700">Items per page:</label>
              <select
                id={`${idPrefix}-itemsPerPage`}
                value={itemsPerPage}
                onChange={e => { setItemsPerPage(Number(e.target.value)); setPage(1); }}
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
              {pages}
            </nav>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AdminDashboardLayout>
      <h1 className="text-2xl font-bold mb-4">Activity Log</h1>
      {/* Sync Logs Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
        <div className="flex items-center justify-between mb-4 p-4">
          <h2 className="text-xl font-semibold">Sync Logs</h2>
          <div className="flex items-center gap-2">
            <label className="font-medium">Order:</label>
            <select value={syncOrder} onChange={e => { setSyncOrder(e.target.value as any); }} className="border px-2 py-1 rounded">
              <option value="desc">Newest</option>
              <option value="asc">Oldest</option>
            </select>
          </div>
        </div>
        {syncLoading ? (
          <div className="flex justify-center items-center h-32">
            <LoadingSpinner size={48} color={designSystem.colors.primary} />
          </div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {columns.sync.map(col => <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{col.label}</th>)}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedSyncLogs.length === 0 ? (
                  <tr>
                    <td colSpan={columns.sync.length} className="px-6 py-10 text-center text-gray-500">No sync logs found.</td>
                  </tr>
                ) : (
                  paginatedSyncLogs.map(renderSyncRow)
                )}
              </tbody>
            </table>
            {renderPagination(syncCurrentPage, syncTotalPages, setSyncCurrentPage, syncItemsPerPage, setSyncItemsPerPage, syncAllLogs.length, 'sync')}
          </>
        )}
      </div>
      {/* Activity Logs Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="flex items-center justify-between mb-4 p-4">
          <h2 className="text-xl font-semibold">Activity Logs</h2>
          <div className="flex items-center gap-2">
            <label className="font-medium">Order:</label>
            <select value={activityOrder} onChange={e => { setActivityOrder(e.target.value as any); }} className="border px-2 py-1 rounded">
              <option value="desc">Newest</option>
              <option value="asc">Oldest</option>
            </select>
          </div>
        </div>
        {activityLoading ? (
          <div className="flex justify-center items-center h-32">
            <LoadingSpinner size={48} color={designSystem.colors.primary} />
          </div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {columns.activity.map(col => <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{col.label}</th>)}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedActivityLogs.length === 0 ? (
                  <tr>
                    <td colSpan={columns.activity.length} className="px-6 py-10 text-center text-gray-500">No activity logs found.</td>
                  </tr>
                ) : (
                  paginatedActivityLogs.map(renderActivityRow)
                )}
              </tbody>
            </table>
            {renderPagination(activityCurrentPage, activityTotalPages, setActivityCurrentPage, activityItemsPerPage, setActivityItemsPerPage, activityAllLogs.length, 'activity')}
          </>
        )}
      </div>
    </AdminDashboardLayout>
  );
};

export default AdminActivityLog; 