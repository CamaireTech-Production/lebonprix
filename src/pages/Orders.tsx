import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  subscribeToOrders, 
  getOrderStats, 
  updateOrderStatus, 
  addOrderNote,
  deleteOrder 
} from '../services/orderService';
import { formatCreatorName } from '../utils/employeeUtils';
import { Order, OrderFilters, OrderStats } from '../types/order';
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  Eye, 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Truck, 
  Package,
  DollarSign,
  Calendar,
  Phone,
  MapPin,
  User,
  Edit,
  RefreshCw,
  Trash2
} from 'lucide-react';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Badge from '../components/common/Badge';
import Card from '../components/common/Card';
import SyncIndicator from '../components/common/SyncIndicator';
import { toast } from 'react-hot-toast';

const Orders: React.FC = () => {
  const { user, company } = useAuth();
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
  
  // Order actions
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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
        console.error('Error loading order stats:', error);
        toast.error('Failed to load order statistics');
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
      toast.success('Order status updated successfully');
      setShowStatusModal(false);
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
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
      toast.success('Note added successfully');
      setShowNoteModal(false);
      setNewNote('');
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
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
      toast.success('Order deleted successfully');
      setShowDeleteModal(false);
      setSelectedOrder(null);
      
      // Remove from local state
      setOrders(prevOrders => prevOrders.filter(o => o.id !== selectedOrder.id));
      setFilteredOrders(prevFiltered => prevFiltered.filter(o => o.id !== selectedOrder.id));
    } catch (error) {
      console.error('Error deleting order:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete order';
      toast.error(errorMessage);
    } finally {
      setSyncing(false);
    }
  };

  // Get status badge color
  const getStatusBadgeColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'yellow';
      case 'confirmed': return 'blue';
      case 'preparing': return 'purple';
      case 'ready': return 'green';
      case 'delivered': return 'green';
      case 'cancelled': return 'red';
      default: return 'gray';
    }
  };

  // Get payment status badge color
  const getPaymentStatusBadgeColor = (status: Order['paymentStatus']) => {
    switch (status) {
      case 'pending': return 'yellow';
      case 'paid': return 'green';
      case 'failed': return 'red';
      case 'awaiting_payment': return 'orange';
      case 'cancelled': return 'red';
      default: return 'gray';
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
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6" />
            Orders
          </h1>
          <p className="text-gray-600 mt-1">
            Manage and track customer orders
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
            Filters
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalOrders}</p>
              </div>
              <ShoppingBag className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendingOrders}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completedOrders}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search orders by number, customer name, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <Card className="p-8 text-center">
            <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-600">
              {searchTerm ? 'No orders match your search criteria.' : 'You haven\'t received any orders yet.'}
            </p>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <h3 className="font-semibold text-gray-900">
                      {order.orderNumber}
                    </h3>
                    <Badge color={getStatusBadgeColor(order.status)}>
                      {getStatusIcon(order.status)}
                      <span className="ml-1 capitalize">{order.status}</span>
                    </Badge>
                    <Badge color={getPaymentStatusBadgeColor(order.paymentStatus)}>
                      <span className="capitalize">{order.paymentStatus.replace('_', ' ')}</span>
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>{order.customerInfo.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      <span>{order.customerInfo.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{order.customerInfo.location}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(order.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="font-medium">{formatCurrency(order.pricing.total)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="w-4 h-4" />
                      <span>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      <span className="text-gray-500">Créé par: {formatCreatorName(order.createdBy)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      setSelectedOrder(order);
                      setShowOrderModal(true);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    onClick={() => {
                      setSelectedOrder(order);
                      setNewStatus(order.status);
                      setShowStatusModal(true);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    onClick={() => {
                      setSelectedOrder(order);
                      setShowNoteModal(true);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    onClick={() => {
                      setSelectedOrder(order);
                      setShowDeleteModal(true);
                    }}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:border-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Order Details Modal */}
      <Modal
        isOpen={showOrderModal}
        onClose={() => {
          setShowOrderModal(false);
          setSelectedOrder(null);
        }}
        title="Order Details"
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-6">
            {/* Order Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{selectedOrder.orderNumber}</h3>
                <p className="text-sm text-gray-600">
                  Created on {formatDate(selectedOrder.createdAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge color={getStatusBadgeColor(selectedOrder.status)}>
                  {getStatusIcon(selectedOrder.status)}
                  <span className="ml-1 capitalize">{selectedOrder.status}</span>
                </Badge>
                <Badge color={getPaymentStatusBadgeColor(selectedOrder.paymentStatus)}>
                  <span className="capitalize">{selectedOrder.paymentStatus.replace('_', ' ')}</span>
                </Badge>
              </div>
            </div>

            {/* Customer Info */}
            <div>
              <h4 className="font-medium mb-3">Customer Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-medium">{selectedOrder.customerInfo.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium">{selectedOrder.customerInfo.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Location</p>
                  <p className="font-medium">{selectedOrder.customerInfo.location}</p>
                </div>
                {selectedOrder.customerInfo.email && (
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{selectedOrder.customerInfo.email}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Order Items */}
            <div>
              <h4 className="font-medium mb-3">Order Items</h4>
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
                          <p className="text-xs text-gray-500">Color: {item.selectedColor}</p>
                        )}
                        {item.selectedSize && (
                          <p className="text-xs text-gray-500">Size: {item.selectedSize}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(item.price)}</p>
                      <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <div>
              <h4 className="font-medium mb-3">Pricing</h4>
              <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(selectedOrder.pricing.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fee:</span>
                  <span>{formatCurrency(selectedOrder.pricing.deliveryFee)}</span>
                </div>
                {selectedOrder.pricing.tax && selectedOrder.pricing.tax > 0 && (
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>{formatCurrency(selectedOrder.pricing.tax)}</span>
                  </div>
                )}
                {selectedOrder.pricing.discount && selectedOrder.pricing.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span>-{formatCurrency(selectedOrder.pricing.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(selectedOrder.pricing.total)}</span>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h4 className="font-medium mb-3">Order Timeline</h4>
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
        title="Update Order Status"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Status
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as Order['status'])}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setShowStatusModal(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleStatusUpdate}
              disabled={syncing}
            >
              {syncing ? 'Updating...' : 'Update Status'}
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
        title="Add Note to Order"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Note
            </label>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note about this order..."
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setShowNoteModal(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddNote}
              disabled={syncing || !newNote.trim()}
            >
              {syncing ? 'Adding...' : 'Add Note'}
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
        title="Delete Order"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete order <strong>{selectedOrder?.orderNumber}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            This action cannot be undone. The order will be permanently deleted.
          </p>
          
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setShowDeleteModal(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteOrder}
              disabled={syncing}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {syncing ? 'Deleting...' : 'Delete Order'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Orders;