// POSOrdersSidebar - Active orders and drafts sidebar
import React from 'react';
import { Clock, Play, Trash2, ChefHat, CheckCircle, XCircle, CreditCard, Edit3 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import type { POSOrder, POSDraft } from '../../types/pos';
import type { Order } from '../../types/index';

interface POSOrdersSidebarProps {
  activeOrders: (POSOrder | Order)[];
  drafts: POSDraft[];
  onResumeDraft: (draft: POSDraft) => void;
  onDeleteDraft: (draftId: string) => void;
  onEditOrder?: (order: POSOrder | Order) => void;
  onPayOrder?: (order: POSOrder | Order) => void;
}

const POSOrdersSidebar: React.FC<POSOrdersSidebarProps> = ({
  activeOrders,
  drafts,
  onResumeDraft,
  onDeleteDraft,
  onEditOrder,
  onPayOrder,
}) => {
  const { language } = useLanguage();

  // Format relative time
  const formatTimeAgo = (timestamp: any) => {
    if (!timestamp) return '';

    let date: Date;
    if (timestamp?.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      return '';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return t('just_now', language) || 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return `${Math.floor(diffHours / 24)}d`;
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return <Clock size={14} className="text-yellow-500" />;
      case 'preparing':
        return <ChefHat size={14} className="text-blue-500" />;
      case 'ready':
        return <CheckCircle size={14} className="text-green-500" />;
      case 'completed':
        return <CheckCircle size={14} className="text-gray-400" />;
      case 'cancelled':
        return <XCircle size={14} className="text-red-500" />;
      default:
        return <Clock size={14} className="text-gray-400" />;
    }
  };

  const getStatusLabel = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return t('order_pending', language) || 'Pending';
      case 'preparing':
        return t('order_preparing', language) || 'Preparing';
      case 'ready':
        return t('order_ready', language) || 'Ready';
      case 'completed':
        return t('order_completed', language) || 'Completed';
      case 'cancelled':
        return t('order_cancelled', language) || 'Cancelled';
      default:
        return status;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price) + ' XAF';
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 border-r">
      {/* Header */}
      <div className="p-3 bg-white border-b">
        <h3 className="font-semibold text-gray-900">
          {t('pos_active_orders', language) || 'Active Orders'}
        </h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Active Orders */}
        <div className="p-2">
          {activeOrders.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              {t('pos_no_active_orders', language) || 'No active orders'}
            </div>
          ) : (
            <div className="space-y-2">
              {activeOrders.map(order => (
                <div
                  key={order.id}
                  className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(order.status)}
                      <span className="text-xs font-medium text-gray-600">
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatTimeAgo(order.createdAt)}
                    </span>
                  </div>

                  {order.tableNumber && (
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      {t('table', language) || 'Table'} {order.tableNumber}
                    </div>
                  )}

                  <div className="text-xs text-gray-500 mb-1">
                    {order.items?.length || 0} {(order.items?.length || 0) === 1 ? 'item' : 'items'}
                  </div>

                  <div className="text-sm font-semibold text-primary mb-2">
                    {formatPrice(order.totalAmount || 0)}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2 pt-2 border-t">
                    {onEditOrder && (
                      <button
                        onClick={() => onEditOrder(order)}
                        className="flex-1 flex items-center justify-center space-x-1 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                        title={t('edit', language) || 'Edit'}
                      >
                        <Edit3 size={12} />
                        <span>{t('edit', language) || 'Edit'}</span>
                      </button>
                    )}
                    {onPayOrder && order.status !== 'completed' && order.status !== 'cancelled' && (
                      <button
                        onClick={() => onPayOrder(order)}
                        className="flex-1 flex items-center justify-center space-x-1 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded transition-colors"
                        title={t('pos_pay', language) || 'Pay'}
                      >
                        <CreditCard size={12} />
                        <span>{t('pos_pay', language) || 'Pay'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drafts Section */}
        {drafts.length > 0 && (
          <>
            <div className="px-3 py-2 bg-gray-100 border-y">
              <h4 className="text-xs font-semibold text-gray-600 uppercase">
                {t('pos_drafts', language) || 'Saved Drafts'} ({drafts.length})
              </h4>
            </div>
            <div className="p-2 space-y-2">
              {drafts.map(draft => (
                <div
                  key={draft.id}
                  className="bg-white rounded-lg p-3 shadow-sm border border-dashed border-gray-300"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">
                      {formatTimeAgo(draft.updatedAt)}
                    </span>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => onResumeDraft(draft)}
                        className="p-1 text-primary hover:bg-primary/10 rounded transition-colors"
                        title={t('pos_resume', language) || 'Resume'}
                      >
                        <Play size={14} />
                      </button>
                      <button
                        onClick={() => onDeleteDraft(draft.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                        title={t('delete', language) || 'Delete'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {draft.tableNumber && (
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      {t('table', language) || 'Table'} {draft.tableNumber}
                    </div>
                  )}

                  <div className="text-xs text-gray-500">
                    {draft.cart.length} {draft.cart.length === 1 ? 'item' : 'items'}
                  </div>

                  {draft.cart.slice(0, 2).map((item, index) => (
                    <div key={index} className="text-xs text-gray-400 truncate">
                      {item.quantity}x {item.dish.title}
                    </div>
                  ))}
                  {draft.cart.length > 2 && (
                    <div className="text-xs text-gray-400">
                      +{draft.cart.length - 2} more...
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default POSOrdersSidebar;
