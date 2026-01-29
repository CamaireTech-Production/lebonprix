import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@contexts/AuthContext';
import { markAlertAsSent } from '@services/firestore/orders/orderAlertService';
import { useDeliveryAlerts } from '@hooks/orders/useDeliveryAlerts';
import { formatPrice } from '@utils/formatting/formatPrice';
import { Card, Badge, Button } from '@components/common';
import { Order } from '../../types/order';
import { Bell, Calendar, User, Phone, MapPin, Package, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { logError } from '@utils/core/logger';

interface DeliveryAlertsProps {
  daysAhead?: number;
  onOrderClick?: (order: Order) => void;
}

const DeliveryAlerts: React.FC<DeliveryAlertsProps> = ({
  daysAhead = 2,
  onOrderClick
}) => {
  const { t } = useTranslation();
  const { company } = useAuth();
  const { upcomingOrders, loading, refresh } = useDeliveryAlerts({ daysAhead });
  const [dismissedOrders, setDismissedOrders] = useState<Set<string>>(new Set());

  const handleDismiss = async (orderId: string) => {
    if (!company?.id) return;

    try {
      await markAlertAsSent(orderId, company.id);
      setDismissedOrders(prev => new Set(prev).add(orderId));
      // Refresh alerts to get updated list
      refresh();
      toast.success(t('orders.alerts.dismissed') || 'Alert dismissed');
    } catch (error) {
      logError('Error dismissing alert', error);
      toast.error(t('orders.alerts.dismissError') || 'Failed to dismiss alert');
    }
  };

  const formatDeliveryDate = (date: Date | { seconds: number; nanoseconds?: number } | undefined): string => {
    if (!date) return '';
    
    const dateObj = date instanceof Date 
      ? date 
      : new Date((date as any).seconds * 1000);
    
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(dateObj);
  };

  const getDaysUntilDelivery = (scheduledDate: Date | { seconds: number; nanoseconds?: number } | undefined): number => {
    if (!scheduledDate) return 0;
    
    const dateObj = scheduledDate instanceof Date 
      ? scheduledDate 
      : new Date((scheduledDate as any).seconds * 1000);
    
    const now = new Date();
    const diffTime = dateObj.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const visibleOrders = upcomingOrders.filter(order => !dismissedOrders.has(order.id));

  if (loading) {
    return null; // Or return a skeleton loader
  }

  if (visibleOrders.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6 border-l-4 border-l-yellow-500 bg-yellow-50">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-yellow-600" />
            <h3 className="font-semibold text-yellow-900">
              {t('orders.alerts.title') || 'Upcoming Deliveries'}
            </h3>
            <Badge variant="warning" className="ml-2">
              {visibleOrders.length}
            </Badge>
          </div>
        </div>

        <div className="space-y-3">
          {visibleOrders.map((order) => {
            const daysUntil = getDaysUntilDelivery(order.deliveryInfo?.scheduledDate);
            const isToday = daysUntil === 0;
            const isTomorrow = daysUntil === 1;
            
            return (
              <div
                key={order.id}
                className={`p-3 rounded-lg border ${
                  isToday 
                    ? 'bg-red-50 border-red-200' 
                    : isTomorrow 
                    ? 'bg-orange-50 border-orange-200' 
                    : 'bg-white border-yellow-200'
                } hover:shadow-md transition-shadow cursor-pointer`}
                onClick={() => onOrderClick?.(order)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-900">{order.orderNumber}</span>
                      <Badge 
                        variant={isToday ? 'error' : isTomorrow ? 'warning' : 'info'}
                        className="text-xs"
                      >
                        {isToday 
                          ? (t('orders.alerts.today') || 'Today')
                          : isTomorrow 
                          ? (t('orders.alerts.tomorrow') || 'Tomorrow')
                          : `${daysUntil} ${t('orders.alerts.days') || 'days'}`
                        }
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{order.customerInfo.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{order.customerInfo.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{order.customerInfo.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 flex-shrink-0" />
                        <span>{order.items.length} {order.items.length !== 1 ? t('orders.orderDetails.itemsPlural') : t('orders.orderDetails.items')}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span className="font-medium">
                          {formatDeliveryDate(order.deliveryInfo?.scheduledDate)}
                        </span>
                      </div>
                      <div className="text-gray-700 font-semibold">
                        {formatPrice(order.pricing.total)} XAF
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDismiss(order.id);
                    }}
                    className="flex-shrink-0"
                    title={t('orders.alerts.dismiss') || 'Dismiss alert'}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

export default DeliveryAlerts;

