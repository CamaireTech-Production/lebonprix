import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../../../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import { Restaurant, OrderItem, Order } from '../../../types';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import CheckoutContent from '../../../shared/public/CheckoutContent';
import { createOrder } from '../../../services/orderService';
import { logActivity } from '../../../services/activityLogService';

const CheckoutPage: React.FC = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<OrderItem[]>([]);

  // Get cart from location state or localStorage
  useEffect(() => {
    if (location.state?.cart) {
      console.log('Cart from location state:', location.state.cart);
      setCart(location.state.cart);
    } else {
      const savedCart = localStorage.getItem(`cart_${restaurantId}`);
      console.log('Saved cart from localStorage:', savedCart);
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          console.log('Parsed cart:', parsedCart);
          setCart(parsedCart);
        } catch (error) {
          console.error('Error parsing cart from localStorage:', error);
          navigate(`/public-order/${restaurantId}`);
        }
      } else {
        console.log('No cart found in localStorage, redirecting to menu');
        navigate(`/public-order/${restaurantId}`);
      }
    }
  }, [location, restaurantId, navigate]);

  // Load restaurant data
  useEffect(() => {
    if (!restaurantId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'restaurants', restaurantId),
      (snapshot: unknown) => {
        const docSnapshot = snapshot as { exists: () => boolean; id: string; data: () => unknown };
        if (docSnapshot.exists()) {
          setRestaurant({ id: docSnapshot.id, ...(docSnapshot.data() as Record<string, unknown>) } as Restaurant);
        }
        setLoading(false);
      },
      (error: unknown) => {
        console.error('Error loading restaurant:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [restaurantId]);

  const createOrderWithLog = async (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const orderWithDeleted = { ...order, deleted: false } as Omit<Order, 'id' | 'createdAt' | 'updatedAt'>;
      const orderId = await createOrder(orderWithDeleted);
      
      if (restaurant?.id) {
        await logActivity({
          userId: restaurant.id,
          userEmail: restaurant.email,
          action: 'order_created',
          entityType: 'order',
          entityId: orderId,
          details: orderWithDeleted
        });
      }
      
      return orderId;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <CheckoutContent
      restaurant={restaurant}
      cart={cart}
      createOrder={createOrderWithLog}
    />
  );
};

export default CheckoutPage;
