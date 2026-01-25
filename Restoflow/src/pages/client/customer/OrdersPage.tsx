import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { subscribeToTableOrders, updateOrderCustomerStatus } from '../../../services/orderService';
import { Order } from '../../../types';
import { ChefHat, Clock, CheckCircle2, XCircle } from 'lucide-react';

const statusMap: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: 'Pending', icon: <Clock className="text-yellow-500" />, color: 'text-yellow-700' },
  preparing: { label: 'Preparing', icon: <ChefHat className="text-indigo-500" />, color: 'text-indigo-700' },
  ready: { label: 'Ready', icon: <CheckCircle2 className="text-green-500" />, color: 'text-green-700' },
  completed: { label: 'Completed', icon: <CheckCircle2 className="text-green-700" />, color: 'text-green-900' },
  cancelled: { label: 'Cancelled', icon: <XCircle className="text-red-500" />, color: 'text-red-700' },
};

const OrdersPage: React.FC = () => {
  const { tableNumber } = useParams<{ tableNumber: string }>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurant, setRestaurant] = useState<{ name: string; logo?: string } | null>(null);
  const navigate = useNavigate();

  // Hide order handler: update customerViewStatus in DB to 'deleted'
  const hideOrder = async (orderId: string) => {
    await updateOrderCustomerStatus(orderId, 'deleted');
    setOrders(prev => prev.filter(order => order.id !== orderId));
  };

  useEffect(() => {
    if (!tableNumber) return;
    const unsubscribe = subscribeToTableOrders(Number(tableNumber), setOrders);
    const storedRestaurant = localStorage.getItem('selectedRestaurant');
    if (storedRestaurant) {
      try {
        const rest = JSON.parse(storedRestaurant);
        setRestaurant({ name: rest.name, logo: rest.logo });
      } catch {}
    }
    return () => unsubscribe();
  }, [tableNumber]);

  // Only show orders that are not deleted for the customer
  const visibleOrders = orders.filter(order => order.customerViewStatus !== 'deleted');

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your Orders (Table #{tableNumber})</h1>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-md bg-primary text-white font-semibold hover:bg-primary-dark transition-colors"
        >
          Back to Home
        </button>
      </div>
      {visibleOrders.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow text-center">
          <ChefHat size={40} className="mx-auto mb-2 text-primary" />
          <p className="text-gray-600">No orders yet. Place an order to get started!</p>
        </div>
      ) : (
        <div className="space-y-8">
          {visibleOrders.map(order => (
            <div key={order.id} className="bg-white rounded-lg shadow p-6 border border-gray-100 relative">
              {/* Close/Hide Order Button */}
              <button
                onClick={() => hideOrder(order.id)}
                className="absolute top-2 right-2 text-gray-400 hover:text-red-500 focus:outline-none"
                title="Close this order"
              >
                <span className="sr-only">Close</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {/* Invoice header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {restaurant?.logo ? (
                    <img src={restaurant.logo} alt={restaurant.name} className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover border-2 shadow-md bg-white transition-all duration-200 flex-shrink-0" style={{ borderColor: 'var(--color-accent, #f59e42)', background: 'white', aspectRatio: '1/1' }} />
                  ) : (
                    <ChefHat size={32} className="text-primary" />
                  )}
                  <div>
                    <h2 className="text-lg font-bold text-primary">{restaurant?.name || 'Restaurant'}</h2>
                    <span className="text-xs text-gray-500">Order #{order.id.slice(-6)}</span>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusMap[order.status]?.color || ''}`}>
                  {statusMap[order.status]?.icon}
                  <span className="ml-1">{statusMap[order.status]?.label || order.status}</span>
                </span>
              </div>
              <div className="mb-2 text-sm text-gray-500">Placed: {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : ''}</div>
              <div className="divide-y divide-gray-100 mb-2">
                {order.items.map(item => (
                  <div key={item.id} className="flex justify-between py-1 text-sm">
                    <span>{item.quantity} × {item.title}</span>
                    <span>{(item.price * item.quantity).toLocaleString()} FCFA</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold mt-2 mb-4">
                <span>Total:</span>
                <span>{order.totalAmount.toLocaleString()} FCFA</span>
              </div>
              <div className="text-center mt-6">
                <p className="text-lg font-semibold text-primary">Thank you for your order!</p>
                <p className="text-gray-500 text-sm">We appreciate your business. Enjoy your meal!</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
