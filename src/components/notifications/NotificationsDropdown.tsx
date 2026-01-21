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
  X
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
      } else if (notification.type === 'stock_low') {
        if (shopId && companyId) {
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
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
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
      default:
        return 'text-gray-600';
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
              <div className="py-2">
                {unreadNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    disabled={isMarkingAsRead === notification.id}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 border-l-4 border-blue-500 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 mt-0.5 ${getNotificationColor(notification.type)}`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatNotificationDate(notification.createdAt)}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="flex-shrink-0">
                          <div className="h-2 w-2 rounded-full bg-blue-500" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Read Notifications */}
            {readNotifications.length > 0 && unreadNotifications.length > 0 && (
              <div className="border-t border-gray-200">
                <div className="px-4 py-2 bg-gray-50">
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    {t('notifications.read', 'Read')}
                  </p>
                </div>
              </div>
            )}

            {readNotifications.length > 0 && (
              <div className="py-2">
                {readNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors opacity-75"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 mt-0.5 ${getNotificationColor(notification.type)}`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700">
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatNotificationDate(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
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

