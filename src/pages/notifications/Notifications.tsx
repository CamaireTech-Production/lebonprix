import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, XCircle, Package, ShoppingCart, ArrowRight, AlertCircle, Filter, X, Eye, Plus, AlertTriangle } from 'lucide-react';
import { SkeletonTable, Button, Card, Select, Badge } from "@components/common";
import { useNotifications } from '@hooks/data/useFirestore';
import { useAuth } from '@contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import type { Notification } from '../../types/models';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

const Notifications: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { company, user } = useAuth();
  const { notifications, loading, markAsRead, markAllAsRead, markMultipleAsRead } = useNotifications({
    companyId: company?.id
  });

  const [filterType, setFilterType] = useState<'all' | Notification['type']>('all');
  const [filterRead, setFilterRead] = useState<'all' | 'read' | 'unread'>('all');
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [isMarkingAsRead, setIsMarkingAsRead] = useState(false);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let result = [...notifications];

    if (filterType !== 'all') {
      result = result.filter(n => n.type === filterType);
    }

    if (filterRead === 'read') {
      result = result.filter(n => n.read);
    } else if (filterRead === 'unread') {
      result = result.filter(n => !n.read);
    }

    return result;
  }, [notifications, filterType, filterRead]);

  const unreadNotifications = useMemo(() => {
    return filteredNotifications.filter(n => !n.read);
  }, [filteredNotifications]);

  const readNotifications = useMemo(() => {
    return filteredNotifications.filter(n => n.read);
  }, [filteredNotifications]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      try {
        await markAsRead(notification.id);
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    // Navigate based on notification type and data
    if (notification.data) {
      const { requestId, transferId, shopId, warehouseId, productId } = notification.data;
      const cid = companyId || company?.id;

      if (notification.type === 'replenishment_request_created' || 
          notification.type === 'replenishment_request_fulfilled' ||
          notification.type === 'replenishment_request_rejected') {
        if (cid) {
          navigate(`/company/${cid}/replenishment-requests`);
        }
      } else if (notification.type === 'transfer_created') {
        if (cid) {
          navigate(`/company/${cid}/stock-transfers`);
        }
      } else if (notification.type === 'stock_low' || notification.type === 'stock_rupture') {
        const { productId: notifProductId, matiereId } = notification.data || {};
        
        // Navigate to product detail if productId exists
        if (notifProductId && cid) {
          // Navigate to products page with productId query param to open modal
          navigate(`/company/${cid}/products?productId=${notifProductId}`);
        } else if (matiereId && cid) {
          navigate(`/company/${cid}/magasin/matieres`);
        } else if (shopId && cid) {
          navigate(`/company/${cid}/shops/${shopId}`);
        } else if (warehouseId && cid) {
          navigate(`/company/${cid}/warehouse/${warehouseId}`);
        } else if (cid) {
          navigate(`/company/${cid}/products/stocks`);
        }
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsMarkingAsRead(true);
    try {
      await markAllAsRead();
      setSelectedNotifications(new Set());
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    } finally {
      setIsMarkingAsRead(false);
    }
  };

  const handleMarkSelectedAsRead = async () => {
    if (selectedNotifications.size === 0) return;
    setIsMarkingAsRead(true);
    try {
      await markMultipleAsRead(Array.from(selectedNotifications));
      setSelectedNotifications(new Set());
    } catch (error) {
      console.error('Error marking selected notifications as read:', error);
    } finally {
      setIsMarkingAsRead(false);
    }
  };

  const toggleNotificationSelection = (notificationId: string) => {
    setSelectedNotifications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'replenishment_request_created':
      case 'replenishment_request_fulfilled':
      case 'replenishment_request_rejected':
        return <ShoppingCart className="h-5 w-5" />;
      case 'transfer_created':
        return <ArrowRight className="h-5 w-5" />;
      case 'stock_low':
        return <AlertCircle className="h-5 w-5" />;
      case 'stock_rupture':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'replenishment_request_created':
        return 'text-blue-600 bg-blue-50';
      case 'replenishment_request_fulfilled':
        return 'text-green-600 bg-green-50';
      case 'replenishment_request_rejected':
        return 'text-red-600 bg-red-50';
      case 'transfer_created':
        return 'text-indigo-600 bg-indigo-50';
      case 'stock_low':
        return 'text-yellow-600 bg-yellow-50';
      case 'stock_rupture':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const handleStockAlertAction = (e: React.MouseEvent, notification: Notification, action: 'view' | 'restock') => {
    e.preventDefault();
    e.stopPropagation();
    
    const { productId, matiereId } = notification.data || {};
    const cid = companyId || company?.id;

    if (!cid) {
      console.error('Company ID is missing');
      return;
    }

    if (action === 'view') {
      if (productId) {
        // Navigate to products page with productId query param to open modal
        navigate(`/company/${cid}/products?productId=${productId}`, { replace: false });
      } else if (matiereId) {
        navigate(`/company/${cid}/magasin/matieres`, { replace: false });
      } else {
        navigate(`/company/${cid}/products/stocks`, { replace: false });
      }
    } else if (action === 'restock') {
      // Navigate to stock replenishment or stock management
      if (productId) {
        // Navigate to products page with productId and action=restock query params
        navigate(`/company/${cid}/products?productId=${productId}&action=restock`, { replace: false });
      } else {
        // Navigate to replenishment requests page to create new request
        navigate(`/company/${cid}/replenishment-requests?create=true`, { replace: false });
      }
    }
  };

  const formatNotificationDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const locale = i18n.language === 'fr' ? fr : enUS;
    return format(date, 'PPp', { locale });
  };

  if (loading) {
    return <SkeletonTable rows={5} />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('notifications.pageTitle', 'Notifications')}</h1>
          <p className="text-gray-600 mt-1">{t('notifications.pageSubtitle', 'View and manage all your notifications')}</p>
        </div>
        <div className="flex gap-2">
          {selectedNotifications.size > 0 && (
            <Button
              variant="outline"
              onClick={handleMarkSelectedAsRead}
              disabled={isMarkingAsRead}
            >
              {t('notifications.markSelectedRead', 'Mark selected as read')}
            </Button>
          )}
          {unreadNotifications.length > 0 && (
            <Button
              variant="default"
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAsRead}
            >
              {t('notifications.markAllRead', 'Mark all as read')}
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Select
              label={t('notifications.filters.type', 'Type')}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as typeof filterType)}
              className="w-full"
              options={[
                { value: 'all', label: t('common.all', 'All') },
                { value: 'replenishment_request_created', label: t('notifications.types.replenishmentRequestCreated', 'Replenishment Request Created') },
                { value: 'replenishment_request_fulfilled', label: t('notifications.types.replenishmentRequestFulfilled', 'Replenishment Request Fulfilled') },
                { value: 'replenishment_request_rejected', label: t('notifications.types.replenishmentRequestRejected', 'Replenishment Request Rejected') },
                { value: 'transfer_created', label: t('notifications.types.transferCreated', 'Transfer Created') },
                { value: 'stock_low', label: t('notifications.types.stockLow', 'Stock Low') },
                { value: 'stock_rupture', label: t('notifications.types.stockRupture', 'Stock Out') }
              ]}
            />
          </div>

          <div>
            <Select
              label={t('notifications.filters.status', 'Status')}
              value={filterRead}
              onChange={(e) => setFilterRead(e.target.value as typeof filterRead)}
              className="w-full"
              options={[
                { value: 'all', label: t('common.all', 'All') },
                { value: 'unread', label: t('notifications.unread', 'Unread') },
                { value: 'read', label: t('notifications.read', 'Read') }
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <Card className="p-8 text-center">
          <Bell className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('notifications.noNotifications', 'No notifications')}</h3>
          <p className="text-gray-600">
            {filterType !== 'all' || filterRead !== 'all'
              ? t('notifications.noNotificationsFiltered', 'No notifications match your filters')
              : t('notifications.noNotificationsEmpty', 'You have no notifications yet')}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Unread Notifications */}
          {unreadNotifications.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 uppercase">
                  {t('notifications.unread', 'Unread')} ({unreadNotifications.length})
                </h2>
              </div>
              {unreadNotifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={`p-5 cursor-pointer hover:shadow-lg transition-all border-l-4 mb-3 ${
                    notification.read 
                      ? 'border-transparent bg-gray-50' 
                      : notification.type === 'stock_rupture'
                      ? 'border-red-500 bg-red-50/30'
                      : notification.type === 'stock_low'
                      ? 'border-yellow-500 bg-yellow-50/30'
                      : 'border-blue-500 bg-blue-50/30'
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedNotifications.has(notification.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleNotificationSelection(notification.id);
                      }}
                      className="mt-1.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className={`flex-shrink-0 p-3 rounded-lg ${getNotificationColor(notification.type)}`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-base font-semibold text-gray-900">
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <div className="flex-shrink-0">
                                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                              </div>
                            )}
                            {(notification.type === 'stock_low' || notification.type === 'stock_rupture') && (
                              <Badge 
                                variant={notification.type === 'stock_rupture' ? 'destructive' : 'warning'}
                                className="text-xs"
                              >
                                {notification.type === 'stock_rupture' ? 'Rupture' : 'Stock Bas'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                            {notification.message}
                          </p>
                          {(notification.type === 'stock_low' || notification.type === 'stock_rupture') && (
                            <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleStockAlertAction(e, notification, 'view');
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-md transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Voir
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleStockAlertAction(e, notification, 'restock');
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-600 hover:text-green-800 hover:bg-green-100 rounded-md transition-colors"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Réapprovisionner
                              </button>
                            </div>
                          )}
                          <p className="text-xs text-gray-500 mt-3">
                            {formatNotificationDate(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}

          {/* Read Notifications */}
          {readNotifications.length > 0 && (
            <>
              {unreadNotifications.length > 0 && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <h2 className="text-sm font-semibold text-gray-700 uppercase mb-4">
                    {t('notifications.read', 'Read')} ({readNotifications.length})
                  </h2>
                </div>
              )}
              {readNotifications.map((notification) => (
                <Card
                  key={notification.id}
                  className="p-5 cursor-pointer hover:shadow-md transition-all opacity-75 mb-3 border border-gray-200"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedNotifications.has(notification.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleNotificationSelection(notification.id);
                      }}
                      className="mt-1.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className={`flex-shrink-0 p-3 rounded-lg ${getNotificationColor(notification.type)} opacity-60`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-600 mb-1">
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        {formatNotificationDate(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;

