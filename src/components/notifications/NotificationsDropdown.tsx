import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@hooks/data/useFirestore';
import { useAuth } from '@contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  CheckCircle, 
  XCircle, 
  Package, 
  ShoppingCart, 
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  X,
  Eye,
  Plus
} from 'lucide-react';
import { Button, Badge, LoadingScreen } from '@components/common';
import type { Notification } from '../../types/models';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

interface NotificationsDropdownProps {
  onClose: () => void;
}

const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({ onClose }) => {
  const { t, i18n } = useTranslation();
  const { company, user } = useAuth();
  const navigate = useNavigate();
  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications({
    companyId: company?.id,
    limit: 20
  });

  const [isMarkingAsRead, setIsMarkingAsRead] = useState<string | null>(null);

  const unreadNotifications = useMemo(() => {
    return notifications.filter(n => !n.read);
  }, [notifications]);

  const readNotifications = useMemo(() => {
    return notifications.filter(n => n.read);
  }, [notifications]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      setIsMarkingAsRead(notification.id);
      try {
        await markAsRead(notification.id);
      } catch (error) {
        console.error('Error marking notification as read:', error);
      } finally {
        setIsMarkingAsRead(null);
      }
    }

    // Navigate based on notification type and data
    if (notification.data) {
      const { requestId, transferId, shopId, warehouseId, productId } = notification.data;
      const companyId = company?.id;

      if (notification.type === 'replenishment_request_created' || 
          notification.type === 'replenishment_request_fulfilled' ||
          notification.type === 'replenishment_request_rejected') {
        if (companyId) {
          navigate(`/company/${companyId}/replenishment-requests`);
          onClose();
        }
      } else if (notification.type === 'transfer_created') {
        if (companyId) {
          navigate(`/company/${companyId}/stock-transfers`);
          onClose();
        }
      } else if (notification.type === 'stock_low' || notification.type === 'stock_rupture') {
        const { productId: notifProductId, matiereId } = notification.data || {};
        
        // Navigate to product detail if productId exists
        if (notifProductId && companyId) {
          navigate(`/company/${companyId}/products/${notifProductId}`);
        } else if (matiereId && companyId) {
          navigate(`/company/${companyId}/magasin/matieres`);
        } else if (shopId && companyId) {
          navigate(`/company/${companyId}/shops/${shopId}`);
        } else if (warehouseId && companyId) {
          navigate(`/company/${companyId}/warehouse/${warehouseId}`);
        } else if (companyId) {
          navigate(`/company/${companyId}/products/stocks`);
        }
        onClose();
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'replenishment_request_created':
      case 'replenishment_request_fulfilled':
      case 'replenishment_request_rejected':
        return <ShoppingCart className="h-4 w-4" />;
      case 'transfer_created':
        return <ArrowRight className="h-4 w-4" />;
      case 'stock_low':
        return <AlertCircle className="h-4 w-4" />;
      case 'stock_rupture':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationColor = (notification: Notification) => {
    switch (notification.type) {
      case 'replenishment_request_created':
        return 'text-blue-600';
      case 'replenishment_request_fulfilled':
        return 'text-green-600';
      case 'replenishment_request_rejected':
        return 'text-red-600';
      case 'transfer_created':
        return 'text-indigo-600';
      case 'stock_low':
        return 'text-yellow-600';
      case 'stock_rupture':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStockAlertBadge = (notification: Notification) => {
    if (notification.type === 'stock_rupture') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
          Rupture
        </span>
      );
    }
    if (notification.type === 'stock_low') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
          Stock faible
        </span>
      );
    }
    return null;
  };

  const handleStockAlertAction = (e: React.MouseEvent, notification: Notification, action: 'view' | 'restock') => {
    e.preventDefault();
    e.stopPropagation();
    
    const { productId, matiereId } = notification.data || {};
    const companyId = company?.id;

    if (!companyId) {
      console.error('Company ID is missing');
      return;
    }

    if (action === 'view') {
      if (productId) {
        // Navigate to products page with productId query param to open modal
        navigate(`/company/${companyId}/products?productId=${productId}`, { replace: false });
      } else if (matiereId) {
        navigate(`/company/${companyId}/magasin/matieres`, { replace: false });
      } else {
        navigate(`/company/${companyId}/products/stocks`, { replace: false });
      }
      onClose();
    } else if (action === 'restock') {
      // Navigate to stock management or purchase order creation
      if (productId) {
        // Navigate to products page with productId and action=restock query params
        navigate(`/company/${companyId}/products?productId=${productId}&action=restock`, { replace: false });
      } else {
        navigate(`/company/${companyId}/replenishment-requests?create=true`, { replace: false });
      }
      onClose();
    }
  };

  const formatNotificationDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const locale = i18n.language === 'fr' ? fr : enUS;
    return format(date, 'PPp', { locale });
  };

  if (loading) {
    return (
      <div className="absolute right-0 mt-2 w-80 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 max-h-96 overflow-hidden">
        <div className="p-4">
          <LoadingScreen />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute right-0 mt-2 w-80 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 max-h-[32rem] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          {t('notifications.title', 'Notifications')}
        </h3>
        <div className="flex items-center gap-2">
          {unreadNotifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="text-xs"
            >
              {t('notifications.markAllRead', 'Mark all as read')}
            </Button>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">
              {t('notifications.noNotifications', 'No notifications')}
            </p>
          </div>
        ) : (
          <>
            {/* Unread Notifications */}
            {unreadNotifications.length > 0 && (
              <div className="px-2 py-2 space-y-2">
                {unreadNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full px-3 py-3 rounded-lg cursor-pointer hover:bg-gray-50 transition-all border border-gray-200 ${
                      notification.type === 'stock_rupture'
                        ? 'border-l-4 border-l-red-500 bg-red-50/10'
                        : notification.type === 'stock_low'
                        ? 'border-l-4 border-l-yellow-500 bg-yellow-50/10'
                        : 'border-l-4 border-l-blue-500 bg-blue-50/10'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 mt-0.5 p-1.5 rounded ${getNotificationColor(notification)}`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-gray-900">
                            {notification.title}
                          </p>
                          {getStockAlertBadge(notification)}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                          {notification.message}
                        </p>
                        {(notification.type === 'stock_low' || notification.type === 'stock_rupture') && (
                          <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleStockAlertAction(e, notification, 'view');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                            >
                              <Eye className="h-3 w-3" />
                              Voir
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleStockAlertAction(e, notification, 'restock');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md transition-colors cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                              Réapprovisionner
                            </button>
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          {formatNotificationDate(notification.createdAt)}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="flex-shrink-0 mt-1">
                          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Read Notifications */}
            {readNotifications.length > 0 && unreadNotifications.length > 0 && (
              <div className="border-t border-gray-200 my-2">
                <div className="px-4 py-2 bg-gray-50">
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    {t('notifications.read', 'Read')}
                  </p>
                </div>
              </div>
            )}

            {readNotifications.length > 0 && (
              <div className="px-2 py-2 space-y-2">
                {readNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className="w-full px-3 py-3 rounded-lg cursor-pointer hover:bg-gray-50 transition-all border border-gray-200 opacity-75"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 mt-0.5 p-1.5 rounded ${getNotificationColor(notification)} opacity-60`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-gray-700">
                            {notification.title}
                          </p>
                          {getStockAlertBadge(notification)}
                        </div>
                        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                          {notification.message}
                        </p>
                        {(notification.type === 'stock_low' || notification.type === 'stock_rupture') && (
                          <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleStockAlertAction(e, notification, 'view');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                            >
                              <Eye className="h-3 w-3" />
                              Voir
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleStockAlertAction(e, notification, 'restock');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md transition-colors cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                              Réapprovisionner
                            </button>
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          {formatNotificationDate(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => {
              const companyId = company?.id;
              if (companyId) {
                navigate(`/company/${companyId}/notifications`);
                onClose();
              }
            }}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {t('notifications.viewAll', 'View all notifications')}
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationsDropdown;

