import { useState, useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { getUpcomingDeliveryOrders, getUpcomingDeliveryCount } from '@services/firestore/orders/orderAlertService';
import { Order } from '../../types/order';
import { logError } from '@utils/core/logger';

interface UseDeliveryAlertsOptions {
  daysAhead?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

export const useDeliveryAlerts = (options: UseDeliveryAlertsOptions = {}) => {
  const { daysAhead = 2, autoRefresh = true, refreshInterval = 5 * 60 * 1000 } = options;
  const { company } = useAuth();
  const [upcomingOrders, setUpcomingOrders] = useState<Order[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadAlerts = async () => {
    if (!company?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const orders = await getUpcomingDeliveryOrders(company.id, daysAhead);
      const count = await getUpcomingDeliveryCount(company.id, daysAhead);
      setUpcomingOrders(orders);
      setAlertCount(count);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load delivery alerts');
      logError('Error loading delivery alerts', err);
      setError(error);
      setUpcomingOrders([]);
      setAlertCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();

    if (autoRefresh) {
      const interval = setInterval(loadAlerts, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [company?.id, daysAhead, autoRefresh, refreshInterval]);

  return {
    upcomingOrders,
    alertCount,
    loading,
    error,
    refresh: loadAlerts
  };
};

