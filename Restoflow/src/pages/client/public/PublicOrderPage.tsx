import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../../../firebase/config';
import { collection, query, where, doc, onSnapshot, orderBy } from 'firebase/firestore';
import PublicOrderContent from '../../../shared/public/PublicOrderContent';
import { createOrder } from '../../../services/orderService';
import { logActivity } from '../../../services/activityLogService';
import { useVisitorTracking } from '../../../hooks/useVisitorTracking';

const PublicOrderPage: React.FC = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  
  // Initialize visitor tracking
  useVisitorTracking({
    restaurantId: restaurantId || '',
    pageType: 'order',
    isDemo: false
  });
  
  const [restaurant, setRestaurant] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;

    // Listen for real-time updates to the restaurant document
    const restaurantUnsub = onSnapshot(doc(db, 'restaurants', restaurantId), (restaurantDoc) => {
      if (restaurantDoc.exists()) {
        setRestaurant({ id: restaurantDoc.id, ...restaurantDoc.data() });
      }
    });

    // Listen for real-time updates to categories
    const categoriesQuery = query(
      collection(db, 'categories'),
      where('restaurantId', '==', restaurantId),
      where('status', '==', 'active'),
      orderBy('order')
    );
    
    const categoriesUnsub = onSnapshot(categoriesQuery, (categoriesSnapshot) => {
      const categoriesData = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any),
        deleted: (doc.data() as any).deleted
      }));
      
      const filteredCategories = categoriesData.filter(
        cat => cat.status === 'active' && (cat.deleted === undefined || cat.deleted === false)
      );
      
      setCategories(filteredCategories.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)));
    }, (error) => {
      console.error('Error listening to categories:', error);
      setCategories([]);
    });

    // Listen for real-time updates to menu items
    const menuItemsQuery = query(
      collection(db, 'menuItems'),
      where('restaurantId', '==', restaurantId),
      where('status', '==', 'active'),
      orderBy('title')
    );
    
    const menuItemsUnsub = onSnapshot(menuItemsQuery, (menuItemsSnapshot) => {
      const menuItemsData = menuItemsSnapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          title: data.title,
          description: data.description || '',
          price: data.price || 0,
          image: data.image || '',
          categoryId: data.categoryId || '',
          status: data.status || 'active',
          restaurantId: data.restaurantId || restaurantId,
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
          deleted: data.deleted
        };
      });
      
      const filteredMenuItems = menuItemsData.filter(
        item => item.status === 'active' && (item.deleted === undefined || item.deleted === false)
      );
      
      setMenuItems(filteredMenuItems);
    }, (error) => {
      console.error('Error listening to menu items:', error);
      setMenuItems([]);
    });

    // Set loading to false after initial data load
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    // Cleanup function to unsubscribe from all listeners
    return () => {
      restaurantUnsub();
      categoriesUnsub();
      menuItemsUnsub();
      clearTimeout(timer);
    };
  }, [restaurantId]);

  // Custom createOrder with activity log
  const createOrderWithLog = async (order: Omit<any, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const orderWithDeleted = { ...order, deleted: false } as Omit<import('../../../types').Order, 'id' | 'createdAt' | 'updatedAt'>;
      const orderId = await createOrder(orderWithDeleted);
      
      // Log activity if restaurant exists
      if (restaurant?.id) {
        try {
          await logActivity({
            userId: restaurant.id,
            userEmail: restaurant.email,
            action: 'order_created',
            entityType: 'order',
            entityId: orderId,
            details: orderWithDeleted
          });
        } catch (logError) {
          console.warn('Failed to log activity:', logError);
          // Don't fail the order creation if logging fails
        }
      }
      
      return orderId;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  };

  return (
    <PublicOrderContent
      restaurant={restaurant}
      categories={categories}
      menuItems={menuItems}
      loading={loading}
      createOrder={createOrderWithLog}
      isDemo={false}
    />
  );
};

export default PublicOrderPage; 