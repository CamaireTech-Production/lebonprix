// Helper to queue admin actions offline
function queuePendingAction(action: { type: string; payload: any }) {
  const arr = JSON.parse(localStorage.getItem('pendingActions') || '[]');
  arr.push({ ...action, timestamp: Date.now() });
  localStorage.setItem('pendingActions', JSON.stringify(arr));
}
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { db } from '../../../firebase/config';
import { 
  collection, 
  query, 
  where,  
  doc, 
  updateDoc, 
  orderBy, 
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import designSystem from '../../../designSystem';
import OrderManagementContent from '../../../shared/OrderManagementContent';
import { logActivity } from '../../../services/activityLogService';
import { t } from '../../../utils/i18n';
import { useLanguage } from '../../../contexts/LanguageContext';

const OrdersPage: React.FC = () => {
  const { restaurant, currentUser } = useAuth();
  const { language } = useLanguage();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Persist previous order IDs across renders
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const isFirstSnapshot = useRef(true);

  // Track last seen order timestamp in localStorage
  const LAST_SEEN_KEY = `last_seen_order_${restaurant?.id || ''}`;

  useEffect(() => {
    if (!restaurant?.id) return;
    setLoading(true);

    if (!navigator.onLine) {
      // Offline: load from localStorage
      const offlineOrders = localStorage.getItem('offline_orders');
      setOrders(offlineOrders ? JSON.parse(offlineOrders).filter((o: { restaurantId: string; deleted?: boolean })=>o.restaurantId===restaurant.id && !o.deleted) : []);
      setLoading(false);
      return;
    }

    const ordersQuery = query(
      collection(db, 'orders'),
      where('restaurantId', '==', restaurant.id),
      where('deleted', '!=', true),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      }));

      const prevOrderIds = prevOrderIdsRef.current;
      const lastSeen = localStorage.getItem(LAST_SEEN_KEY);

      // Only show toast for truly new orders after initial load
      if (!isFirstSnapshot.current) {
        ordersData.forEach(order => {
          // Show toast if not in previous snapshot OR if createdAt > lastSeen
          const orderTime = typeof order.createdAt === 'string'
            ? new Date(order.createdAt).getTime()
            : order.createdAt?.toMillis?.() || 0;
          if (
            (!prevOrderIds.has(order.id)) ||
            (lastSeen && orderTime > Number(lastSeen))
          ) {
            toast.success(t('new_order_received', language).replace('{{tableNumber}}', order.tableNumber.toString()), {
              style: {
                background: designSystem.colors.success,
                color: designSystem.colors.textInverse,
              },
            });
          }
        });
      } else {
        isFirstSnapshot.current = false;
      }

      // Update last seen order timestamp
      if (ordersData.length > 0) {
        const latestOrder = ordersData[0];
        const latestTime = typeof latestOrder.createdAt === 'string'
          ? new Date(latestOrder.createdAt).getTime()
          : latestOrder.createdAt?.toMillis?.() || 0;
        localStorage.setItem(LAST_SEEN_KEY, String(latestTime));
      }

      prevOrderIdsRef.current = new Set(ordersData.map(o => o.id));
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching orders:', error);
      toast.error(t('failed_load_orders', language), {
        style: {
          background: designSystem.colors.error,
          color: designSystem.colors.textInverse,
        },
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [restaurant]);

  const updateOrderStatus = async (orderId: string, newStatus: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled') => {
    if (!restaurant?.id) return;
    setUpdatingOrderId(orderId);
    try {
      if (!navigator.onLine) {
        queuePendingAction({ type: 'updateOrderStatus', payload: { id: orderId, status: newStatus } });
        setOrders(prevOrders => prevOrders.map(order => order.id === orderId ? { ...order, status: newStatus, updatedAt: new Date() } : order));
        toast.success(t('order_status_update_queued', language), {
          style: {
            background: designSystem.colors.success,
            color: designSystem.colors.textInverse,
          },
        });
        setUpdatingOrderId(null);
        return;
      }
      const order = orders.find(o => o.id === orderId);
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      await logActivity({
        userId: currentUser?.uid ?? undefined,
        userEmail: currentUser?.email ?? undefined,
        action: 'order_status_change',
        entityType: 'order',
        entityId: orderId,
        details: { oldStatus: order?.status, newStatus },
      });
      toast.success(t('order_status_updated', language).replace('{{status}}', t(newStatus, language)), {
        style: {
          background: designSystem.colors.success,
          color: designSystem.colors.textInverse,
        },
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error(t('failed_update_order_status', language), {
        style: {
          background: designSystem.colors.error,
          color: designSystem.colors.textInverse,
        },
      });
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const softDeleteOrder = async (orderId: string) => {
    if (!restaurant?.id) return;
    setUpdatingOrderId(orderId);
    try {
      if (!navigator.onLine) {
        queuePendingAction({ type: 'deleteOrder', payload: { id: orderId } });
        setOrders(prevOrders => prevOrders.map(order => order.id === orderId ? { ...order, deleted: true, updatedAt: new Date() } : order));
        toast.success(t('order_deletion_queued', language), {
          style: {
            background: designSystem.colors.success,
            color: designSystem.colors.textInverse,
          },
        });
        setUpdatingOrderId(null);
        return;
    }
      await updateDoc(doc(db, 'orders', orderId), {
        deleted: true,
        updatedAt: serverTimestamp(),
      });
      await logActivity({
        userId: currentUser?.uid ?? undefined,
        userEmail: currentUser?.email ?? undefined,
        action: 'order_deleted',
        entityType: 'order',
        entityId: orderId,
      });
      toast.success(t('order_deleted_success', language), {
        style: {
          background: designSystem.colors.success,
          color: designSystem.colors.textInverse,
        },
      });
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error(t('failed_delete_order', language), {
        style: {
          background: designSystem.colors.error,
          color: designSystem.colors.textInverse,
        },
      });
    } finally {
      setUpdatingOrderId(null);
  }
  };

  return (
    <DashboardLayout title="">
      <OrderManagementContent
        orders={orders}
        loading={loading}
        updatingOrderId={updatingOrderId}
        onStatusChange={(orderId, newStatus) => {
          // Only allow status changes for allowed statuses
          updateOrderStatus(orderId, newStatus);
        }}
        onDelete={softDeleteOrder}
        isDemoUser={false}
        restaurant={restaurant}
      />
    </DashboardLayout>
  );
};

export default OrdersPage;