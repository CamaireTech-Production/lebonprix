import React, { useState } from 'react';
import { ClipboardList, Clock, CheckCircle2, ChefHat, XCircle, Filter, Table, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import OrderDetailModal from '../components/orders/OrderDetailModal';
import designSystem from '../designSystem';
import { Order } from '../types';
import { t } from '../utils/i18n';
import { useLanguage } from '../contexts/LanguageContext';
import { getCurrencySymbol } from '../data/currencies';

interface OrderManagementContentProps {
  orders: Order[];
  loading: boolean;
  updatingOrderId: string | null;
  onStatusChange: (orderId: string, newStatus: Order['status']) => void;
  onDelete: (orderId: string) => void;
  isDemoUser: boolean;
  restaurant?: any; // add restaurant prop for currency
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return <Clock size={20} style={{ color: designSystem.colors.statusPendingText }} />;
    case 'preparing':
      return <ChefHat size={20} style={{ color: designSystem.colors.statusPreparingText }} />;
    case 'ready':
      return <CheckCircle2 size={20} style={{ color: designSystem.colors.statusReadyText }} />;
    case 'completed':
      return <CheckCircle2 size={20} style={{ color: designSystem.colors.statusCompletedText }} />;
    case 'cancelled':
      return <XCircle size={20} style={{ color: designSystem.colors.statusCancelledText }} />;
    default:
      return null;
  }
};

const formatDate = (timestamp: any) => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
};

const OrderManagementContent: React.FC<OrderManagementContentProps> = ({
  orders,
  loading,
  updatingOrderId,
  onStatusChange,
  onDelete,
  isDemoUser,
  restaurant,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [orderDetailModal, setOrderDetailModal] = useState<Order | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const { language } = useLanguage();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [statusChangeModal, setStatusChangeModal] = useState<{order: Order, newStatus: Order['status']}|null>(null);

  // Determine currency symbol
  const currencyCode = restaurant?.currency || 'XAF';
  const currencySymbol = getCurrencySymbol(currencyCode) || 'FCFA';

  // Filter orders based on status
  let filteredOrders = statusFilter === 'all'
    ? orders
    : orders.filter(order => order.status === statusFilter);

  // Sort orders by createdAt (toggle asc/desc)
  filteredOrders = filteredOrders.slice().sort((a, b) => {
    const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
    const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
    return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredOrders.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };
  const handleSortDate = () => {
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  };
  const renderPagination = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    pages.push(
      <button key="prev" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">&lt;</button>
    );
    if (startPage > 1) {
      pages.push(<button key={1} onClick={() => handlePageChange(1)} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">1</button>);
      if (startPage > 2) {
        pages.push(<span key="start-ellipsis" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>);
      }
    }
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button key={i} onClick={() => handlePageChange(i)} className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium ${currentPage === i ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>{i}</button>
      );
    }
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(<span key="end-ellipsis" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>);
      }
      pages.push(<button key={totalPages} onClick={() => handlePageChange(totalPages)} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">{totalPages}</button>);
    }
    pages.push(
      <button key="next" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">&gt;</button>
    );
    return pages;
  };

  return (
    <div className="shadow rounded-lg overflow-hidden" style={{ background: designSystem.colors.white }}>
      <div className="p-4 sm:p-6 border-b" style={{ borderColor: designSystem.colors.borderLightGray }}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: designSystem.colors.primary }}>{t('order_management', language)}</h2>
            <p className="text-sm" style={{ color: designSystem.colors.text }}>{t('manage_and_track_orders', language)}</p>
            <p className="text-xs text-gray-500 mt-1">
              <span className="font-semibold text-blue-600">{orders.filter(o => o.status !== 'pending').length} {t('completed_orders', language)}</span>, <span className="font-semibold text-orange-600">{orders.filter(o => o.status === 'pending').length} {t('pending', language)}</span>
            </p>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter size={18} style={{ color: designSystem.colors.secondary }} />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="pl-10 block w-full py-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
              style={{ color: designSystem.colors.text }}
            >
              <option value="all">{t('all_orders', language)}</option>
              <option value="pending">{t('pending', language)}</option>
              <option value="preparing">{t('preparing', language)}</option>
              <option value="ready">{t('ready', language)}</option>
              <option value="completed">{t('completed', language)}</option>
              <option value="cancelled">{t('cancelled', language)}</option>
            </select>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size={60} />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-10">
          <ClipboardList size={48} className="mx-auto" style={{ color: designSystem.colors.secondary }} />
          <h3 className="mt-2 text-sm font-medium" style={{ color: designSystem.colors.primary }}>{t('no_orders', language)}</h3>
          <p className="mt-1 text-sm" style={{ color: designSystem.colors.text }}>
            {orders.length === 0 ? t('no_orders_placed', language) : t('no_orders_match_filter', language)}
          </p>
        </div>
      ) : (
        <>
          {/* Top Pagination Controls */}
          <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200">
            <div className="flex-1 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <p className="text-sm text-gray-700">
                  {t('showing_results', language)} <span className="font-medium">{startIndex + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(endIndex, filteredOrders.length)}</span>{' '}
                  {t('of_results', language)} <span className="font-medium">{filteredOrders.length}</span>
                </p>
                <div className="flex items-center space-x-2">
                  <label htmlFor="itemsPerPage" className="text-sm text-gray-700">{t('items_per_page', language)}</label>
                  <select
                    id="itemsPerPage"
                    value={itemsPerPage}
                    onChange={handleItemsPerPageChange}
                    className="block w-20 py-1 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  {renderPagination()}
                </nav>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead style={{ background: designSystem.colors.statusDefaultBg }}>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: designSystem.colors.text }}>{t('order_details_order', language)}</th>
                  {!isDemoUser && (
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: designSystem.colors.text }}>{t('table_order', language)}</th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: designSystem.colors.text }}>{t('status_order', language)}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: designSystem.colors.text }}>{t('total_order', language)}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: designSystem.colors.text }}>{t('final_total_order', language) || 'Final Total'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: designSystem.colors.text }}>{t('customer_info', language)}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none" style={{ color: designSystem.colors.text }} onClick={handleSortDate}>
                    {t('date_order', language)}
                    <span className="ml-1 align-middle">
                      {sortDirection === 'asc' ? <ArrowUp size={14} style={{ display: 'inline' }} /> : sortDirection === 'desc' ? <ArrowDown size={14} style={{ display: 'inline' }} /> : <ArrowUpDown size={14} style={{ display: 'inline' }} />}
                    </span>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: designSystem.colors.text }}>{t('actions_order', language)}</th>
                </tr>
              </thead>
              <tbody style={{ background: designSystem.colors.white }}>
                {currentItems.map((order) => (
                  <tr 
                    key={order.id} 
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setOrderDetailModal(order)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {t('order_order', language)} #{order.id.slice(-6)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {order.items.length} {t('items_order', language)}
                      </div>
                    </td>
                    {!isDemoUser && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Table size={16} className="mr-1" style={{ color: designSystem.colors.secondary }} />
                          <span className="text-sm" style={{ color: designSystem.colors.primary }}>
                            #{order.tableNumber}
                          </span>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          background: order.status === 'pending' ? designSystem.colors.statusPendingBg
                            : order.status === 'preparing' ? designSystem.colors.statusPreparingBg
                            : order.status === 'ready' ? designSystem.colors.statusReadyBg
                            : order.status === 'completed' ? designSystem.colors.statusCompletedBg
                            : designSystem.colors.statusCancelledBg,
                          color: order.status === 'pending' ? designSystem.colors.statusPendingText
                            : order.status === 'preparing' ? designSystem.colors.statusPreparingText
                            : order.status === 'ready' ? designSystem.colors.statusReadyText
                            : order.status === 'completed' ? designSystem.colors.statusCompletedText
                            : designSystem.colors.statusCancelledText,
                        }}
                      >
                        <span className="mr-1.5">{getStatusIcon(order.status)}</span>
                        {t(order.status, language)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm" style={{ color: designSystem.colors.primary }}>
                        {order.totalAmount.toLocaleString()} {currencySymbol}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold" style={{ color: designSystem.colors.primary }}>
                        {(order.totalAmount + (order.deliveryFee || 0)).toLocaleString()} {currencySymbol}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {order.customerName || '-'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.customerPhone || '-'}<br />
                        {order.customerLocation || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm" style={{ color: designSystem.colors.primary }}>
                        {formatDate(order.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {updatingOrderId === order.id ? (
                        <LoadingSpinner size={20} />
                      ) : (
                        <div className="flex items-center justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                          {order.status === 'pending' && (
                            <button
                              onClick={() => setStatusChangeModal({ order, newStatus: 'preparing' })}
                              className="px-2 py-1 text-xs rounded-md border"
                              style={{
                                color: designSystem.colors.statusPreparingText,
                                borderColor: designSystem.colors.statusPreparingText,
                              }}
                            >
                              {t('start_preparing_order', language)}
                            </button>
                          )}
                          {order.status === 'preparing' && (
                            <button
                              onClick={() => setStatusChangeModal({ order, newStatus: 'ready' })}
                              className="px-2 py-1 text-xs rounded-md border"
                              style={{
                                color: designSystem.colors.statusReadyText,
                                borderColor: designSystem.colors.statusReadyText,
                              }}
                            >
                              {t('mark_ready_order', language)}
                            </button>
                          )}
                          {order.status === 'ready' && (
                            <button
                              onClick={() => setStatusChangeModal({ order, newStatus: 'completed' })}
                              className="px-2 py-1 text-xs rounded-md border"
                              style={{
                                color: designSystem.colors.statusCompletedText,
                                borderColor: designSystem.colors.statusCompletedText,
                              }}
                            >
                              {t('complete_order', language)}
                            </button>
                          )}
                          {(order.status === 'pending' || order.status === 'preparing') && (
                            <button
                              onClick={() => setStatusChangeModal({ order, newStatus: 'cancelled' })}
                              className="px-2 py-1 text-xs rounded-md border"
                              style={{
                                color: designSystem.colors.statusCancelledText,
                                borderColor: designSystem.colors.statusCancelledText,
                              }}
                            >
                              {t('cancel_order', language)}
                            </button>
                          )}
                          {!isDemoUser && (
                            <button
                              onClick={() => setViewOrder(order)}
                              className="px-2 py-1 text-xs rounded-md border"
                              style={{
                                color: designSystem.colors.secondary,
                                borderColor: designSystem.colors.secondary,
                              }}
                            >
                              {t('view_items_order', language)}
                            </button>
                          )}
                          <button
                            onClick={() => { setOrderToDelete(order); setDeleteConfirmOpen(true); }}
                            className="px-2 py-1 text-xs rounded-md border"
                            style={{
                              color: designSystem.colors.statusCancelledText,
                              borderColor: designSystem.colors.statusCancelledText,
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Bottom Pagination Controls */}
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <p className="text-sm text-gray-700">
                  {t('showing_results', language)} <span className="font-medium">{startIndex + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(endIndex, filteredOrders.length)}</span>{' '}
                  {t('of_results', language)} <span className="font-medium">{filteredOrders.length}</span>
                </p>
                <div className="flex items-center space-x-2">
                  <label htmlFor="itemsPerPageBottom" className="text-sm text-gray-700">{t('items_per_page', language)}</label>
                  <select
                    id="itemsPerPageBottom"
                    value={itemsPerPage}
                    onChange={handleItemsPerPageChange}
                    className="block w-20 py-1 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  {renderPagination()}
                </nav>
              </div>
            </div>
          </div>
        </>
      )}
      {/* View Items Modal */}
      <Modal isOpen={!!viewOrder} onClose={() => setViewOrder(null)} title={viewOrder ? `${t('order_order', language)} #${viewOrder.id.slice(-6)} ${t('items_order', language)}` : ''}>
        {viewOrder && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead style={{ background: designSystem.colors.statusDefaultBg }}>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase" style={{ color: designSystem.colors.text }}>{t('dish_order', language)}</th>
                  <th className="px-4 py-2 text-center text-xs font-medium uppercase" style={{ color: designSystem.colors.text }}>{t('qty_order', language)}</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase" style={{ color: designSystem.colors.text }}>{t('price_order', language)}</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase" style={{ color: designSystem.colors.text }}>{t('subtotal_order', language)}</th>
                </tr>
              </thead>
              <tbody style={{ background: designSystem.colors.white }}>
                {viewOrder.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 flex items-center gap-2">
                      {item.image && (
                        <img src={item.image} alt={item.title} className="w-8 h-8 rounded object-cover border" />
                      )}
                      <span className="font-medium" style={{ color: designSystem.colors.primary }}>{item.title}</span>
                    </td>
                    <td className="px-4 py-2 text-center" style={{ color: designSystem.colors.primary }}>{item.quantity}</td>
                    <td className="px-4 py-2 text-right" style={{ color: designSystem.colors.primary }}>{item.price.toLocaleString()} {currencySymbol}</td>
                    <td className="px-4 py-2 text-right" style={{ color: designSystem.colors.primary }}>{(item.price * item.quantity).toLocaleString()} {currencySymbol}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right font-bold" style={{ color: designSystem.colors.primary }}>{t('total_order', language)}</td>
                  <td className="px-4 py-2 text-right font-bold" style={{ color: designSystem.colors.primary }}>{viewOrder.totalAmount.toLocaleString()} {currencySymbol}</td>
                </tr>

                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right" style={{ color: designSystem.colors.primary }}>{t('delivery_fee', language)}</td>
                  <td className="px-4 py-2 text-right" style={{ color: designSystem.colors.primary }}>
                    {viewOrder.deliveryFee !== undefined && viewOrder.deliveryFee !== null ? viewOrder.deliveryFee.toLocaleString() : '-'} {currencySymbol}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right font-bold" style={{ color: designSystem.colors.primary }}>{t('final_total_order', language)}</td>
                  <td className="px-4 py-2 text-right font-bold" style={{ color: designSystem.colors.primary }}>
                    {(viewOrder.totalAmount + (viewOrder.deliveryFee || 0)).toLocaleString()} {currencySymbol}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Modal>
      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title={t('delete_order_order', language)} >
        <div className="p-4">
          <p className="text-gray-800 text-base mb-4">{t('delete_order_confirm_order', language)}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(false)}
              className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:w-auto sm:text-sm"
            >
              {t('cancel_order', language)}
            </button>
            <button
              type="button"
              onClick={() => { if (orderToDelete) { onDelete(orderToDelete.id); setDeleteConfirmOpen(false); setOrderToDelete(null); } }}
              className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm"
            >
              {t('delete', language)}
            </button>
          </div>
        </div>
      </Modal>
      {/* Status Change Confirmation Modal */}
      <Modal isOpen={!!statusChangeModal} onClose={() => setStatusChangeModal(null)} title={statusChangeModal ? t('confirm_status_change', language) : ''}>
        <div className="p-4">
          <p className="text-gray-800 text-base mb-4">
            {statusChangeModal && t(`confirm_change_to_${statusChangeModal.newStatus}`, language)}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setStatusChangeModal(null)}
              className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:w-auto sm:text-sm"
            >
              {t('cancel', language)}
            </button>
            <button
              type="button"
              onClick={() => { if (statusChangeModal) { onStatusChange(statusChangeModal.order.id, statusChangeModal.newStatus); setStatusChangeModal(null); } }}
              className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:w-auto sm:text-sm"
            >
              {t('confirm', language)}
            </button>
          </div>
        </div>
      </Modal>

      {/* Order Detail Modal */}
      <OrderDetailModal
        isOpen={!!orderDetailModal}
        order={orderDetailModal}
        onClose={() => setOrderDetailModal(null)}
        onStatusChange={onStatusChange}
        onDelete={onDelete}
        restaurant={restaurant}
        updatingOrderId={updatingOrderId}
      />
    </div>
  );
};

export default OrderManagementContent; 