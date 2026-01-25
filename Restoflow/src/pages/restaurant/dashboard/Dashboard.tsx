import React, { useState, useEffect } from 'react';
// import QRCode from 'qrcode.react'; // Uncomment if you add qrcode.react to dependencies
import { useAuth } from '../../../contexts/AuthContext';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { db } from '../../../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import DashboardContent from '../../../shared/DashboardContent';
import { subscribeToVisitorStats } from '../../../services/visitorTrackingService';
import { toast } from 'react-hot-toast';


const Dashboard: React.FC = () => {
  const { restaurant } = useAuth();
  const isDemoUser = false; // Demo functionality removed
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!restaurant?.id) return;
      setLoading(true);
      try {
        // Fetch menu items (excluding deleted)
        const menuItemsQuery = query(
          collection(db, 'menuItems'),
          where('restaurantId', '==', restaurant.id)
        );
        const menuItemsSnapshot = await getDocs(menuItemsQuery);
        const menuItemsData = menuItemsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(item => !item.deleted);
        setMenuItems(menuItemsData);
        // Fetch categories (excluding deleted)
        const categoriesQuery = query(
          collection(db, 'categories'),
          where('restaurantId', '==', restaurant.id)
        );
        const categoriesSnapshot = await getDocs(categoriesQuery);
        const categoriesData = categoriesSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(category => !category.deleted);
        setCategories(categoriesData);
        // Fetch orders (excluding deleted)
        const ordersQuery = query(
          collection(db, 'orders'),
          where('restaurantId', '==', restaurant.id),
          where('deleted', '!=', true)
        );
        const ordersSnapshot = await getDocs(ordersQuery);
        const ordersData = ordersSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }));
        setOrders(ordersData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [restaurant]);

  // Toast on new visitor increment (listens to visitor stats doc)
  useEffect(() => {
    if (!restaurant?.id) return;
    let previousTotals: number | null = null;
    const unsubscribe = subscribeToVisitorStats(
      restaurant.id,
      false,
      undefined,
      (stats: any) => {
        if (stats) {
          if (previousTotals !== null && stats.totalVisitors > previousTotals) {
            toast.success(`New visitor recorded (${stats.totalVisitors} total)`, {
              style: { background: '#fef3c7', color: '#92400e' },
            });
          }
          previousTotals = stats?.totalVisitors ?? 0;
        }
      }
    );
    return () => unsubscribe && unsubscribe();
  }, [restaurant?.id]);

  if (loading) {
    return (
      <DashboardLayout title="">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size={60} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="">
      <DashboardContent
        restaurant={restaurant}
        orders={orders}
        menuItems={menuItems}
        categories={categories}
        isDemoUser={isDemoUser}
        loading={loading}
      />
    </DashboardLayout>
  );
};

export default Dashboard;