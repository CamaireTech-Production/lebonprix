import React, { useState, useEffect } from 'react';
import { 
  X, 
  Clock, 
  CheckCircle2, 
  ChefHat, 
  XCircle, 
  Phone, 
  MessageCircle, 
  Printer, 
  Edit3,
  Trash2,
  MapPin,
  User,
  Calendar,
  CreditCard,
  Truck,
  ClipboardList,
  Table
} from 'lucide-react';
import Modal from '../ui/Modal';
import ReactDOM from 'react-dom';
import LoadingSpinner from '../ui/LoadingSpinner';
import designSystem from '../../designSystem';
import { Order } from '../../types';
import { t } from '../../utils/i18n';
import { useLanguage } from '../../contexts/LanguageContext';
import { getCurrencySymbol } from '../../data/currencies';

interface OrderDetailModalProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
  onStatusChange: (orderId: string, newStatus: Order['status']) => void;
  onDelete: (orderId: string) => void;
  onEdit?: (order: Order) => void;
  restaurant?: any;
  updatingOrderId?: string | null;
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

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  isOpen,
  order,
  onClose,
  onStatusChange,
  onDelete,
  onEdit,
  restaurant,
  updatingOrderId
}) => {
  const { language } = useLanguage();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showStatusChangeConfirm, setShowStatusChangeConfirm] = useState<{newStatus: Order['status']} | null>(null);

  // Close on ESC key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!order) return null;

  const currencyCode = restaurant?.currency || 'XAF';
  const currencySymbol = getCurrencySymbol(currencyCode) || 'FCFA';

  const handleStatusChange = (newStatus: Order['status']) => {
    setShowStatusChangeConfirm({ newStatus });
  };

  const confirmStatusChange = () => {
    if (showStatusChangeConfirm) {
      onStatusChange(order.id, showStatusChangeConfirm.newStatus);
      setShowStatusChangeConfirm(null);
    }
  };

  const handleDelete = () => {
    onDelete(order.id);
    setShowDeleteConfirm(false);
    onClose();
  };

  const handlePrintReceipt = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const receiptContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - Order #${order.id.slice(-6)}</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              line-height: 1.4;
              margin: 0;
              padding: 20px;
              color: #000;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            .restaurant-name {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .restaurant-info {
              font-size: 10px;
              margin-bottom: 5px;
            }
            .order-info {
              margin-bottom: 20px;
            }
            .order-info div {
              margin-bottom: 3px;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .items-table th,
            .items-table td {
              border-bottom: 1px solid #ccc;
              padding: 5px 0;
              text-align: left;
            }
            .items-table th {
              font-weight: bold;
              border-bottom: 2px solid #000;
            }
            .qty, .price, .total {
              text-align: right;
            }
            .total-row {
              border-top: 2px solid #000;
              font-weight: bold;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              font-size: 10px;
            }
            .status {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 10px;
              font-weight: bold;
              margin-left: 5px;
            }
            .status.pending { background: #fef3c7; color: #92400e; }
            .status.preparing { background: #dbeafe; color: #1e40af; }
            .status.ready { background: #d1fae5; color: #065f46; }
            .status.completed { background: #d1fae5; color: #065f46; }
            .status.cancelled { background: #fee2e2; color: #991b1b; }
            @media print {
              body { margin: 0; padding: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="restaurant-name">${restaurant?.name || 'Restaurant'}</div>
            <div class="restaurant-info">${restaurant?.address || ''}</div>
            <div class="restaurant-info">Tel: ${restaurant?.phone || ''}</div>
            <div class="restaurant-info">Email: ${restaurant?.email || ''}</div>
          </div>

          <div class="order-info">
            <div><strong>Order #:</strong> ${order.id.slice(-6)}</div>
            <div><strong>Date:</strong> ${formatDate(order.createdAt)}</div>
            <div><strong>Status:</strong> ${t(order.status, language)} <span class="status ${order.status}">${order.status.toUpperCase()}</span></div>
            <div><strong>Order Type:</strong> ${order.orderType === 'whatsapp' ? 'WhatsApp Delivery' : 'Restaurant Pickup'}</div>
            ${order.tableNumber > 0 ? `<div><strong>Table:</strong> #${order.tableNumber}</div>` : ''}
          </div>

          <div class="order-info">
            <div><strong>Customer:</strong> ${order.customerName || 'N/A'}</div>
            <div><strong>Phone:</strong> ${order.customerPhone || 'N/A'}</div>
            ${order.customerLocation && order.customerLocation !== 'Restaurant Pickup' ? `<div><strong>Address:</strong> ${order.customerLocation}</div>` : ''}
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="qty">Qty</th>
                <th class="price">Price</th>
                <th class="total">Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map(item => `
                <tr>
                  <td>${item.title}</td>
                  <td class="qty">${item.quantity}</td>
                  <td class="price">${item.price.toLocaleString()} ${currencySymbol}</td>
                  <td class="total">${(item.price * item.quantity).toLocaleString()} ${currencySymbol}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3"><strong>Subtotal:</strong></td>
                <td class="total"><strong>${order.totalAmount.toLocaleString()} ${currencySymbol}</strong></td>
              </tr>
              ${order.deliveryFee && order.deliveryFee > 0 ? `
                <tr>
                  <td colspan="3">Delivery Fee:</td>
                  <td class="total">${order.deliveryFee.toLocaleString()} ${currencySymbol}</td>
                </tr>
              ` : ''}
              ${order.mtnFee && order.mtnFee > 0 ? `
                <tr>
                  <td colspan="3">MTN Fee:</td>
                  <td class="total">${order.mtnFee.toLocaleString()} ${currencySymbol}</td>
                </tr>
              ` : ''}
              ${order.orangeFee && order.orangeFee > 0 ? `
                <tr>
                  <td colspan="3">Orange Fee:</td>
                  <td class="total">${order.orangeFee.toLocaleString()} ${currencySymbol}</td>
                </tr>
              ` : ''}
              <tr class="total-row">
                <td colspan="3"><strong>GRAND TOTAL:</strong></td>
                <td class="total"><strong>${(order.totalAmount + (order.deliveryFee || 0) + (order.mtnFee || 0) + (order.orangeFee || 0)).toLocaleString()} ${currencySymbol}</strong></td>
              </tr>
            </tfoot>
          </table>

          <div class="footer">
            <div>Thank you for your order!</div>
            <div>For inquiries, contact: ${restaurant?.phone || ''}</div>
            <div>Generated on: ${new Date().toLocaleString()}</div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(receiptContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const getNextStatus = (currentStatus: string): Order['status'] | null => {
    switch (currentStatus) {
      case 'pending': return 'preparing';
      case 'preparing': return 'ready';
      case 'ready': return 'completed';
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return designSystem.colors.statusPendingText;
      case 'preparing': return designSystem.colors.statusPreparingText;
      case 'ready': return designSystem.colors.statusReadyText;
      case 'completed': return designSystem.colors.statusCompletedText;
      case 'cancelled': return designSystem.colors.statusCancelledText;
      default: return designSystem.colors.text;
    }
  };

  if (!isOpen || !order) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-black bg-opacity-50 pt-8 pb-8"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full mx-4 max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white rounded-t-xl">
          <h2 className="text-2xl font-bold text-gray-900">
            Order #{order.id.slice(-6)}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
          {/* Order Header */}
          <div className="relative overflow-hidden bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 rounded-full -translate-y-16 translate-x-16 opacity-20"></div>
            <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: getStatusColor(order.status) + '20' }}>
                    {getStatusIcon(order.status)}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-gray-900">
                      Order #{order.id.slice(-6)}
                    </h2>
                    <span 
                      className="px-3 py-1 rounded-full text-sm font-medium"
                      style={{ 
                        backgroundColor: getStatusColor(order.status) + '20',
                        color: getStatusColor(order.status)
                      }}
                    >
                      {t(order.status, language).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar size={16} />
                      <span>{formatDate(order.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CreditCard size={16} />
                      <span>{order.items.length} {t('items_order', language)}</span>
                    </div>
                    {order.tableNumber > 0 && (
                      <div className="flex items-center gap-1">
                        <Table size={16} />
                        <span>Table #{order.tableNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {(order.totalAmount + (order.deliveryFee || 0) + (order.mtnFee || 0) + (order.orangeFee || 0)).toLocaleString()} {currencySymbol}
                </div>
                <div className="text-sm text-gray-600">
                  Total Amount
                </div>
              </div>
            </div>
          </div>

          {/* Customer Information & Order Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Information Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <User size={20} className="text-blue-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900">Customer Information</h4>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <User size={18} className="text-gray-500" />
                  <div>
                    <div className="font-medium text-gray-900">{order.customerName || 'N/A'}</div>
                    <div className="text-sm text-gray-500">Customer Name</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Phone size={18} className="text-gray-500" />
                  <div>
                    <div className="font-medium text-gray-900">{order.customerPhone || 'N/A'}</div>
                    <div className="text-sm text-gray-500">Phone Number</div>
                  </div>
                </div>
                {order.customerLocation && order.customerLocation !== 'Restaurant Pickup' && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <MapPin size={18} className="text-gray-500" />
                    <div>
                      <div className="font-medium text-gray-900">{order.customerLocation}</div>
                      <div className="text-sm text-gray-500">Delivery Address</div>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  {order.orderType === 'whatsapp' ? (
                    <MessageCircle size={18} className="text-green-500" />
                  ) : (
                    <Truck size={18} className="text-blue-500" />
                  )}
                  <div>
                    <div className="font-medium text-gray-900">
                      {order.orderType === 'whatsapp' ? 'WhatsApp Delivery' : 'Restaurant Pickup'}
                    </div>
                    <div className="text-sm text-gray-500">Order Type</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Summary Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CreditCard size={20} className="text-green-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900">Order Summary</h4>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium text-gray-900">{order.totalAmount.toLocaleString()} {currencySymbol}</span>
                </div>
                {order.deliveryFee && order.deliveryFee > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Delivery Fee:</span>
                    <span className="font-medium text-gray-900">{order.deliveryFee.toLocaleString()} {currencySymbol}</span>
                  </div>
                )}
                {order.mtnFee && order.mtnFee > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">MTN Fee:</span>
                    <span className="font-medium text-gray-900">{order.mtnFee.toLocaleString()} {currencySymbol}</span>
                  </div>
                )}
                {order.orangeFee && order.orangeFee > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Orange Fee:</span>
                    <span className="font-medium text-gray-900">{order.orangeFee.toLocaleString()} {currencySymbol}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">Total:</span>
                    <span className="text-xl font-bold text-gray-900">
                      {(order.totalAmount + (order.deliveryFee || 0) + (order.mtnFee || 0) + (order.orangeFee || 0)).toLocaleString()} {currencySymbol}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <ClipboardList size={20} className="text-purple-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900">Order Items</h4>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    {item.image && (
                      <img 
                        src={item.image} 
                        alt={item.title} 
                        className="w-16 h-16 rounded-lg object-cover border border-gray-200 flex-shrink-0" 
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h5 className="font-semibold text-gray-900 truncate">{item.title}</h5>
                      <p className="text-sm text-gray-600">Unit Price: {item.price.toLocaleString()} {currencySymbol}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-sm text-gray-600">Quantity</div>
                        <div className="text-lg font-semibold text-gray-900">{item.quantity}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-600">Total</div>
                        <div className="text-lg font-bold text-gray-900">{(item.price * item.quantity).toLocaleString()} {currencySymbol}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <ChefHat size={20} className="text-orange-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900">Actions</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Status Change Buttons */}
              {getNextStatus(order.status) && (
                <button
                  onClick={() => handleStatusChange(getNextStatus(order.status)!)}
                  disabled={updatingOrderId === order.id}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  {updatingOrderId === order.id ? (
                    <LoadingSpinner size={16} />
                  ) : (
                    getStatusIcon(getNextStatus(order.status)!)
                  )}
                  <span className="font-medium">
                    {getNextStatus(order.status) === 'preparing' && 'Start Preparing'}
                    {getNextStatus(order.status) === 'ready' && 'Mark Ready'}
                    {getNextStatus(order.status) === 'completed' && 'Complete Order'}
                  </span>
                </button>
              )}

              {/* Cancel Button */}
              {(order.status === 'pending' || order.status === 'preparing') && (
                <button
                  onClick={() => handleStatusChange('cancelled')}
                  disabled={updatingOrderId === order.id}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <XCircle size={16} />
                  <span className="font-medium">Cancel Order</span>
                </button>
              )}

              {/* Contact Customer */}
              {order.customerPhone && (
                <a
                  href={`tel:${order.customerPhone}`}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <Phone size={16} />
                  <span className="font-medium">Call Customer</span>
                </a>
              )}

              {/* WhatsApp Contact */}
              {order.customerPhone && order.orderType === 'whatsapp' && (
                <a
                  href={`https://wa.me/${order.customerPhone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <MessageCircle size={16} />
                  <span className="font-medium">WhatsApp</span>
                </a>
              )}

              {/* Print Receipt */}
              <button
                onClick={handlePrintReceipt}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Printer size={16} />
                <span className="font-medium">Print Receipt</span>
              </button>

              {/* Edit Order */}
              {onEdit && (
                <button
                  onClick={() => onEdit(order)}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <Edit3 size={16} />
                  <span className="font-medium">Edit Order</span>
                </button>
              )}

              {/* Delete Order */}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Trash2 size={16} />
                <span className="font-medium">Delete Order</span>
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {ReactDOM.createPortal(modalContent, document.body)}
      
      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Order">
        <div className="p-4">
          <p className="text-gray-800 text-base mb-4">
            Are you sure you want to delete this order? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Status Change Confirmation Modal */}
      <Modal isOpen={!!showStatusChangeConfirm} onClose={() => setShowStatusChangeConfirm(null)} title="Confirm Status Change">
        <div className="p-4">
          <p className="text-gray-800 text-base mb-4">
            Are you sure you want to change the order status to "{t(showStatusChangeConfirm?.newStatus || '', language)}"?
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowStatusChangeConfirm(null)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmStatusChange}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default OrderDetailModal;
