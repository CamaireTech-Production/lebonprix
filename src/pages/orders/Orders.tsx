import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@contexts/AuthContext';
import {
  subscribeToOrders,
  getOrderStats,
  updateOrderStatus,
  updateOrderPaymentStatus,
  addOrderNote,
  deleteOrder
} from '@services/firestore/orders/orderService';
import { formatCreatorName } from '@utils/business/employeeUtils';
import { formatPrice } from '@utils/formatting/formatPrice';
import { usePermissionCheck } from '@components/permissions';
import { RESOURCES } from '@constants/resources';
import { Order, OrderFilters, OrderStats } from '../../types/order';
import { useProducts } from '@hooks/data/useFirestore';
import { generatePurchaseOrderPDF } from '@utils/orders/purchaseOrderPDF';
import { generatePurchaseOrderNumber } from '@services/firestore/orders/orderService';
import {
  ShoppingBag,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  Package,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Eye,
  ShoppingCart
} from 'lucide-react';
import { Button, Input, Modal, Badge, Card, SyncIndicator, SkeletonOrders } from '@components/common';
import OrderActionsMenu from '@components/orders/OrderActionsMenu';
import ConvertOrderToSaleModal from '@components/orders/ConvertOrderToSaleModal';
import DeliveryAlerts from '@components/orders/DeliveryAlerts';
import { toast } from 'react-hot-toast';
import { logError } from '@utils/core/logger';

const Orders: React.FC = () => {
  const { t } = useTranslation();
  const { user, company } = useAuth();
  const { canDelete } = usePermissionCheck(RESOURCES.ORDERS);
  const { products } = useProducts();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [filters] = useState<OrderFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Selected order for details
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Order actions
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeliveredConfirmModal, setShowDeliveredConfirmModal] = useState(false);
  const [showCancelledConfirmModal, setShowCancelledConfirmModal] = useState(false);
  const [showPaidConfirmModal, setShowPaidConfirmModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [newStatus, setNewStatus] = useState<Order['status']>('pending');
  const [newNote, setNewNote] = useState('');

  // Load orders and stats
  useEffect(() => {
    if (!user || !company) return;

    const unsubscribeOrders = subscribeToOrders(
      company.id,
      (ordersData) => {
        setOrders(ordersData);
        setFilteredOrders(ordersData);
        setLoading(false);
        setSyncing(false);
      },
      filters
    );

    const loadStats = async () => {
      try {
        const statsData = await getOrderStats(company.id);
        setStats(statsData);
      } catch (error) {
        logError('Error loading order stats', error);
        toast.error(t('orders.messages.statsLoadFailed'));
      }
    };

    loadStats();

    return () => {
      unsubscribeOrders();
    };
  }, [user, company, filters]);

  // Filter orders based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredOrders(orders);
      return;
    }

    const filtered = orders.filter(order =>
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerInfo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerInfo.phone.includes(searchTerm)
    );

    setFilteredOrders(filtered);
  }, [orders, searchTerm]);

  // Handle status update
  const handleStatusUpdate = async () => {
    if (!selectedOrder || !company) return;

    try {
      setSyncing(true);
      await updateOrderStatus(selectedOrder.id, newStatus, company.id, newNote);
      toast.success(t('orders.messages.statusUpdated'));
      setShowStatusModal(false);
      setSelectedOrder(null);
    } catch (error) {
      logError('Error updating order status', error);
      toast.error(t('orders.messages.statusUpdateFailed'));
    } finally {
      setSyncing(false);
    }
  };

  // Handle note addition
  const handleAddNote = async () => {
    if (!selectedOrder || !newNote.trim() || !company) return;

    try {
      setSyncing(true);
      await addOrderNote(selectedOrder.id, newNote.trim(), company.id);
      toast.success(t('orders.messages.noteAdded'));
      setShowNoteModal(false);
      setNewNote('');
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error(t('orders.messages.noteAddFailed'));
    } finally {
      setSyncing(false);
    }
  };

  // Handle order deletion
  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;

    try {
      setSyncing(true);
      await deleteOrder(selectedOrder.id, user!.uid);
      toast.success(t('orders.messages.orderDeleted'));
      setShowDeleteModal(false);
      setSelectedOrder(null);

      // Remove from local state
      setOrders(prevOrders => prevOrders.filter(o => o.id !== selectedOrder.id));
      setFilteredOrders(prevFiltered => prevFiltered.filter(o => o.id !== selectedOrder.id));
    } catch (error) {
      logError('Error deleting order', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete order';
      toast.error(errorMessage);
    } finally {
      setSyncing(false);
    }
  };

  // Handle mark as delivered
  const handleMarkAsDelivered = async () => {
    if (!selectedOrder || !company) return;

    try {
      setSyncing(true);
      await updateOrderStatus(selectedOrder.id, 'delivered', company.id);
      toast.success(t('orders.messages.orderMarkedAsDelivered'));
      setShowDeliveredConfirmModal(false);
      setSelectedOrder(null);
    } catch (error) {
      logError('Error marking order as delivered', error);
      toast.error(t('orders.messages.statusUpdateFailed'));
    } finally {
      setSyncing(false);
    }
  };

  // Handle mark as cancelled
  const handleMarkAsCancelled = async () => {
    if (!selectedOrder || !company) return;

    try {
      setSyncing(true);
      await updateOrderStatus(selectedOrder.id, 'cancelled', company.id);
      toast.success(t('orders.messages.orderMarkedAsCancelled'));
      setShowCancelledConfirmModal(false);
      setSelectedOrder(null);
    } catch (error) {
      logError('Error marking order as cancelled', error);
      toast.error(t('orders.messages.statusUpdateFailed'));
    } finally {
      setSyncing(false);
    }
  };

  // Handle mark as paid
  const handleMarkAsPaid = async () => {
    if (!selectedOrder || !company) return;

    try {
      setSyncing(true);
      await updateOrderPaymentStatus(selectedOrder.id, 'paid', company.id);
      toast.success(t('orders.messages.orderMarkedAsPaid'));
      setShowPaidConfirmModal(false);
      setSelectedOrder(null);
    } catch (error) {
      logError('Error marking order as paid', error);
      toast.error(t('orders.messages.paymentStatusUpdateFailed'));
    } finally {
      setSyncing(false);
    }
  };

  // Handle generate purchase order PDF
  const handleGeneratePurchaseOrder = async (order: Order) => {
    if (!order || !company || !products) return;

    try {
      setSyncing(true);

      // Generate purchase order number if not exists
      let purchaseOrderNumber = order.purchaseOrderNumber;
      if (!purchaseOrderNumber) {
        purchaseOrderNumber = await generatePurchaseOrderNumber(order.id, company.id);
      }

      // Generate filename
      const filename = `Bon-de-Commande-${purchaseOrderNumber || order.orderNumber}`;

      // Generate PDF
      await generatePurchaseOrderPDF(order, products, company, filename);

      toast.success(t('orders.messages.purchaseOrderGenerated') || 'Bon de commande généré avec succès');
    } catch (error) {
      logError('Error generating purchase order PDF', error);
      toast.error(t('orders.messages.purchaseOrderGenerationFailed') || 'Erreur lors de la génération du bon de commande');
    } finally {
      setSyncing(false);
    }
  };

  // Get status badge color
  const getStatusBadgeColor = (status: Order['status']): 'success' | 'warning' | 'error' | 'info' | 'default' => {
    switch (status) {
      case 'pending': return 'warning';
      case 'confirmed': return 'info';
      case 'preparing': return 'info';
      case 'ready': return 'success';
      case 'delivered': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  // Get payment status badge color
  const getPaymentStatusBadgeColor = (status: Order['paymentStatus']): 'success' | 'warning' | 'error' | 'info' | 'default' => {
    switch (status) {
      case 'pending': return 'warning';
      case 'paid': return 'success';
      case 'failed': return 'error';
      case 'awaiting_payment': return 'warning';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  // Get status icon
  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'confirmed': return <CheckCircle className="w-4 h-4" />;
      case 'preparing': return <Package className="w-4 h-4" />;
      case 'ready': return <Truck className="w-4 h-4" />;
      case 'delivered': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  // Format date
  const formatDate = (date: Date | { seconds: number; nanoseconds?: number }) => {
    // Convert Timestamp to Date if needed
    const dateObj = date instanceof Date ? date : new Date((date as any).seconds * 1000);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(dateObj);
  };

  // Get order product details for accordion
  const getOrderProductDetails = (order: Order) => {
    return order.items.map((item, idx) => {
      const product = products?.find((p) => p.id === item.productId);
      return (
        <tr key={item.productId + idx} className="bg-gray-50">
          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 font-medium">
            {product ? product.name : item.name || t('orders.table.unknownProduct') || 'Produit inconnu'}
          </td>
          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{item.quantity}</td>
          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
            {formatPrice(item.price)} XAF
          </td>
          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
            {formatPrice(item.price * item.quantity)} XAF
          </td>
          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
            {product ? product.reference : '-'}
          </td>
        </tr>
      );
    });
  };

  // Render table rows with accordion
  const renderRows = (data: Order[]) => {
    return data.map((order) => {
      const isExpanded = expandedOrderId === order.id;
      return [
        <tr
          key={order.id}
          className="group transition cursor-pointer hover:bg-gray-50"
          onClick={() => {
            setSelectedOrder(order);
            setShowOrderModal(true);
          }}
        >
          <td
            className="px-2 py-4 text-center align-middle cursor-pointer w-8"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedOrderId(isExpanded ? null : order.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown size={18} className="mx-auto text-emerald-600" />
            ) : (
              <ChevronRight size={18} className="mx-auto text-gray-400 group-hover:text-emerald-600" />
            )}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            <div className="font-medium">{order.orderNumber}</div>
            <div className="text-xs text-gray-600 mt-1">{order.customerInfo.name}</div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm">
            <a href={`tel:${order.customerInfo.phone}`} className="text-blue-600 hover:underline">
              {order.customerInfo.phone}
            </a>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
            {order.items.length} {order.items.length !== 1 ? t('orders.orderDetails.itemsPlural') : t('orders.orderDetails.items')}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm">
            {formatPrice(order.pricing.total)} XAF
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
            {formatDate(order.createdAt)}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm">
            <Badge variant={getStatusBadgeColor(order.status)}>
              {getStatusIcon(order.status)}
              <span className="ml-1 capitalize">{t(`orders.status.${order.status}`)}</span>
            </Badge>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm">
            <Badge variant={getPaymentStatusBadgeColor(order.paymentStatus)}>
              <span className="capitalize">{t(`orders.paymentStatus.${order.paymentStatus}`)}</span>
            </Badge>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
            {formatCreatorName(order.createdBy)}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm">
            <div className="flex space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedOrder(order);
                  setShowOrderModal(true);
                }}
                className="text-blue-600 hover:text-blue-900"
                title={t('orders.quickActions.viewDetails')}
              >
                <Eye size={16} />
              </button>
              {order.status !== 'converted' && order.status !== 'cancelled' && !order.convertedToSaleId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedOrder(order);
                    setShowConvertModal(true);
                  }}
                  className="text-green-600 hover:text-green-900"
                  title={t('orders.quickActions.convertToSale')}
                >
                  <ShoppingCart size={16} />
                </button>
              )}
              <div onClick={(e) => e.stopPropagation()}>
                <OrderActionsMenu
                  order={order}
                  onViewDetails={() => {
                    setSelectedOrder(order);
                    setShowOrderModal(true);
                  }}
                  onEditStatus={() => {
                    setSelectedOrder(order);
                    setNewStatus(order.status);
                    setShowStatusModal(true);
                  }}
                  onAddNote={() => {
                    setSelectedOrder(order);
                    setShowNoteModal(true);
                  }}
                  onDelete={() => {
                    setSelectedOrder(order);
                    setShowDeleteModal(true);
                  }}
                  onMarkAsDelivered={() => {
                    setSelectedOrder(order);
                    setShowDeliveredConfirmModal(true);
                  }}
                  onMarkAsCancelled={() => {
                    setSelectedOrder(order);
                    setShowCancelledConfirmModal(true);
                  }}
                  onMarkAsPaid={() => {
                    setSelectedOrder(order);
                    setShowPaidConfirmModal(true);
                  }}
                  onConvertToSale={() => {
                    setSelectedOrder(order);
                    setShowConvertModal(true);
                  }}
                  onGeneratePurchaseOrder={() => {
                    handleGeneratePurchaseOrder(order);
                  }}
                  disabled={syncing}
                  canDelete={canDelete}
                />
              </div>
            </div>
          </td>
        </tr>,
        isExpanded && (
          <tr key={order.id + '-details'}>
            <td colSpan={10} className="p-0 bg-white border-t-0">
              <div className="overflow-x-auto custom-scrollbar border-t border-gray-100">
                <table className="min-w-[600px] w-full text-sm">
                  <thead className="bg-emerald-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-emerald-700">
                        {t('products.table.columns.name')}
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-emerald-700">
                        {t('orders.orderDetails.quantity')}
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-emerald-700">
                        {t('products.table.columns.sellingPrice')}
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-emerald-700">
                        {t('orders.orderDetails.total')}
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-emerald-700">
                        {t('products.table.columns.reference')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>{getOrderProductDetails(order)}</tbody>
                </table>
              </div>
            </td>
          </tr>
        ),
      ];
    }).flat();
  };

  if (loading) {
    return <SkeletonOrders />;
  }

  return (
    <div className="pb-16 md:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6" />
            {t('orders.title')}
          </h1>
          <p className="text-gray-600 mt-1">
            {t('orders.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <SyncIndicator isSyncing={syncing} />
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            size="sm"
          >
            <Filter className="w-4 h-4 mr-2" />
            {t('orders.filters')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-5 hover:shadow-md transition-shadow border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{t('orders.stats.totalOrders')}</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalOrders}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <ShoppingBag className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-5 hover:shadow-md transition-shadow border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{t('orders.stats.pending')}</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.pendingOrders}</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </Card>

          <Card className="p-5 hover:shadow-md transition-shadow border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{t('orders.stats.completed')}</p>
                <p className="text-3xl font-bold text-green-600">{stats.completedOrders}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-5 hover:shadow-md transition-shadow border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{t('orders.stats.totalRevenue')}</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(stats.totalRevenue)} XAF</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Delivery Alerts */}
      <DeliveryAlerts
        daysAhead={2}
        onOrderClick={(order) => {
          setSelectedOrder(order);
          setShowOrderModal(true);
        }}
      />

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder={t('orders.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 h-11"
            />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <Card>
        <div className="overflow-x-auto custom-scrollbar">
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-gray-200">
              <div className="flex flex-col items-center">
                <div className="p-4 bg-gray-50 rounded-full mb-4">
                  <ShoppingBag className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('orders.noOrders')}</h3>
                <p className="text-gray-600 max-w-md">
                  {searchTerm ? t('orders.noOrdersSearch') : t('orders.noOrdersMessage')}
                </p>
              </div>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-8"></th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('orders.table.columns.orderNumber') || 'N° Commande'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('orders.table.columns.phone') || 'Téléphone'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('orders.table.columns.products') || 'Produits'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('orders.table.columns.amount') || 'Montant'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('orders.table.columns.date') || 'Date'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('orders.table.columns.status') || 'Statut'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('orders.table.columns.paymentStatus') || 'Paiement'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('orders.table.columns.createdBy') || 'Créé par'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('orders.table.columns.actions') || 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {renderRows(filteredOrders)}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Order Details Modal */}
      <Modal
        isOpen={showOrderModal}
        onClose={() => {
          setShowOrderModal(false);
          setSelectedOrder(null);
        }}
        title={t('orders.orderDetails.title')}
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-6">
            {/* Order Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{selectedOrder.orderNumber}</h3>
                <p className="text-sm text-gray-600">
                  {t('orders.orderDetails.createdOn')} {formatDate(selectedOrder.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getStatusBadgeColor(selectedOrder.status)}>
                  {getStatusIcon(selectedOrder.status)}
                  <span className="ml-1 capitalize">{t(`orders.status.${selectedOrder.status}`)}</span>
                </Badge>
                <Badge variant={getPaymentStatusBadgeColor(selectedOrder.paymentStatus)}>
                  <span className="capitalize">{t(`orders.paymentStatus.${selectedOrder.paymentStatus}`)}</span>
                </Badge>
                <OrderActionsMenu
                  order={selectedOrder}
                  onViewDetails={() => {
                    // Already viewing details, do nothing or scroll to top
                  }}
                  onEditStatus={() => {
                    setNewStatus(selectedOrder.status);
                    setShowOrderModal(false);
                    setShowStatusModal(true);
                  }}
                  onAddNote={() => {
                    setShowOrderModal(false);
                    setShowNoteModal(true);
                  }}
                  onDelete={() => {
                    setShowOrderModal(false);
                    setShowDeleteModal(true);
                  }}
                  onMarkAsDelivered={() => {
                    setShowOrderModal(false);
                    setShowDeliveredConfirmModal(true);
                  }}
                  onMarkAsCancelled={() => {
                    setShowOrderModal(false);
                    setShowCancelledConfirmModal(true);
                  }}
                  onMarkAsPaid={() => {
                    setShowOrderModal(false);
                    setShowPaidConfirmModal(true);
                  }}
                  onConvertToSale={() => {
                    setShowOrderModal(false);
                    setShowConvertModal(true);
                  }}
                  onGeneratePurchaseOrder={() => {
                    handleGeneratePurchaseOrder(selectedOrder);
                  }}
                  disabled={syncing}
                  canDelete={canDelete}
                />
              </div>
            </div>

            {/* Customer Info */}
            <div>
              <h4 className="font-medium mb-3">{t('orders.orderDetails.customerInformation')}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">{t('orders.orderDetails.name')}</p>
                  <p className="font-medium">{selectedOrder.customerInfo.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t('orders.orderDetails.phone')}</p>
                  <p className="font-medium">{selectedOrder.customerInfo.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t('orders.orderDetails.location')}</p>
                  <p className="font-medium">{selectedOrder.customerInfo.location}</p>
                </div>
                {selectedOrder.customerInfo.email && (
                  <div>
                    <p className="text-sm text-gray-600">{t('orders.orderDetails.email')}</p>
                    <p className="font-medium">{selectedOrder.customerInfo.email}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Order Items */}
            <div>
              <h4 className="font-medium mb-3">{t('orders.orderDetails.orderItems')}</h4>
              <div className="space-y-2">
                {selectedOrder.items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      )}
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-600">{item.category}</p>
                        {item.selectedColor && (
                          <p className="text-xs text-gray-500">{t('orders.orderDetails.color')}: {item.selectedColor}</p>
                        )}
                        {item.selectedSize && (
                          <p className="text-xs text-gray-500">{t('orders.orderDetails.size')}: {item.selectedSize}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatPrice(item.price)} XAF</p>
                      <p className="text-sm text-gray-600">{t('orders.orderDetails.qty')}: {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <div>
              <h4 className="font-medium mb-3">{t('orders.orderDetails.pricing')}</h4>
              <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between">
                  <span>{t('orders.orderDetails.subtotal')}:</span>
                  <span>{formatPrice(selectedOrder.pricing.subtotal)} XAF</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('orders.orderDetails.deliveryFee')}:</span>
                  <span>{formatPrice(selectedOrder.pricing.deliveryFee)} XAF</span>
                </div>
                {selectedOrder.pricing.tax && selectedOrder.pricing.tax > 0 && (
                  <div className="flex justify-between">
                    <span>{t('orders.orderDetails.tax')}:</span>
                    <span>{formatPrice(selectedOrder.pricing.tax)} XAF</span>
                  </div>
                )}
                {selectedOrder.pricing.discount && selectedOrder.pricing.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>{t('orders.orderDetails.discount')}:</span>
                    <span>-{formatPrice(selectedOrder.pricing.discount)} XAF</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>{t('orders.orderDetails.total')}:</span>
                  <span>{formatPrice(selectedOrder.pricing.total)} XAF</span>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h4 className="font-medium mb-3">{t('orders.orderDetails.orderTimeline')}</h4>
              <div className="space-y-2">
                {selectedOrder.timeline.map((event, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{event.type.replace('_', ' ')}</p>
                      <p className="text-xs text-gray-600">{formatDate(event.timestamp)}</p>
                      {event.note && (
                        <p className="text-sm text-gray-700 mt-1">{event.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Status Update Modal */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setSelectedOrder(null);
        }}
        title={t('orders.actions.updateStatus')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('orders.actions.newStatus')}
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as Order['status'])}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="pending">{t('orders.status.pending')}</option>
              <option value="confirmed">{t('orders.status.confirmed')}</option>
              <option value="preparing">{t('orders.status.preparing')}</option>
              <option value="ready">{t('orders.status.ready')}</option>
              <option value="delivered">{t('orders.status.delivered')}</option>
              <option value="cancelled">{t('orders.status.cancelled')}</option>
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setShowStatusModal(false)}
              variant="outline"
            >
              {t('orders.actions.cancel')}
            </Button>
            <Button
              onClick={handleStatusUpdate}
              disabled={syncing}
            >
              {syncing ? t('orders.actions.updating') : t('orders.actions.updateStatusButton')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Note Modal */}
      <Modal
        isOpen={showNoteModal}
        onClose={() => {
          setShowNoteModal(false);
          setSelectedOrder(null);
          setNewNote('');
        }}
        title={t('orders.actions.addNote')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('orders.actions.note')}
            </label>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder={t('orders.actions.notePlaceholder')}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setShowNoteModal(false)}
              variant="outline"
            >
              {t('orders.actions.cancel')}
            </Button>
            <Button
              onClick={handleAddNote}
              disabled={syncing || !newNote.trim()}
            >
              {syncing ? t('orders.actions.adding') : t('orders.actions.addNoteButton')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedOrder(null);
        }}
        title={t('orders.actions.delete')}
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            {t('orders.actions.deleteConfirm')} <strong>{selectedOrder?.orderNumber}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            {t('orders.actions.deleteWarning')}
          </p>

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setShowDeleteModal(false)}
              variant="outline"
            >
              {t('orders.actions.cancel')}
            </Button>
            <Button
              onClick={handleDeleteOrder}
              disabled={syncing}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {syncing ? t('orders.actions.deleting') : t('orders.actions.deleteButton')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Mark as Delivered Confirmation Modal */}
      <Modal
        isOpen={showDeliveredConfirmModal}
        onClose={() => {
          setShowDeliveredConfirmModal(false);
          setSelectedOrder(null);
        }}
        title={t('orders.confirmations.markAsDelivered.title')}
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            {t('orders.confirmations.markAsDelivered.message', { orderNumber: selectedOrder?.orderNumber })}
          </p>

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setShowDeliveredConfirmModal(false);
                setSelectedOrder(null);
              }}
              variant="outline"
            >
              {t('orders.confirmations.markAsDelivered.cancel')}
            </Button>
            <Button
              onClick={handleMarkAsDelivered}
              disabled={syncing}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {syncing ? t('orders.actions.updating') : t('orders.confirmations.markAsDelivered.confirm')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Mark as Cancelled Confirmation Modal */}
      <Modal
        isOpen={showCancelledConfirmModal}
        onClose={() => {
          setShowCancelledConfirmModal(false);
          setSelectedOrder(null);
        }}
        title={t('orders.confirmations.markAsCancelled.title')}
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            {t('orders.confirmations.markAsCancelled.message', { orderNumber: selectedOrder?.orderNumber })}
          </p>

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setShowCancelledConfirmModal(false);
                setSelectedOrder(null);
              }}
              variant="outline"
            >
              {t('orders.confirmations.markAsCancelled.cancel')}
            </Button>
            <Button
              onClick={handleMarkAsCancelled}
              disabled={syncing}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {syncing ? t('orders.actions.updating') : t('orders.confirmations.markAsCancelled.confirm')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Mark as Paid Confirmation Modal */}
      <Modal
        isOpen={showPaidConfirmModal}
        onClose={() => {
          setShowPaidConfirmModal(false);
          setSelectedOrder(null);
        }}
        title={t('orders.confirmations.markAsPaid.title')}
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            {t('orders.confirmations.markAsPaid.message', { orderNumber: selectedOrder?.orderNumber })}
          </p>

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setShowPaidConfirmModal(false);
                setSelectedOrder(null);
              }}
              variant="outline"
            >
              {t('orders.confirmations.markAsPaid.cancel')}
            </Button>
            <Button
              onClick={handleMarkAsPaid}
              disabled={syncing}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {syncing ? t('orders.actions.updating') : t('orders.confirmations.markAsPaid.confirm')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Convert Order to Sale Modal */}
      <ConvertOrderToSaleModal
        isOpen={showConvertModal}
        onClose={() => {
          setShowConvertModal(false);
          setSelectedOrder(null);
        }}
        order={selectedOrder}
        onSuccess={() => {
          // Refresh orders list
          setSyncing(true);
        }}
      />
    </div>
  );
};

export default Orders;