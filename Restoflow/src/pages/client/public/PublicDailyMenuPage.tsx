import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../../../firebase/config';
import { collection, query, where, doc, onSnapshot, orderBy } from 'firebase/firestore';
import { useVisitorTracking } from '../../../hooks/useVisitorTracking';
import PublicOrderContent from '../../../shared/public/PublicOrderContent';
import { createOrder } from '../../../services/orderService';
import RestaurantMetaTags from '../../../components/seo/RestaurantMetaTags';
import StructuredData from '../../../components/seo/StructuredData';

const PublicDailyMenuPage: React.FC = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Initialize visitor tracking
  useVisitorTracking({
    restaurantId: restaurantId || '',
    pageType: 'daily-menu',
    isDemo: false
  });

  useEffect(() => {
    if (!restaurantId) return;

    // Listen for restaurant updates
    const restaurantUnsub = onSnapshot(doc(db, 'restaurants', restaurantId), (restaurantDoc) => {
      if (restaurantDoc.exists()) {
        setRestaurant({ id: restaurantDoc.id, ...restaurantDoc.data() });
      }
    });

    // Active categories
    const categoriesQuery = query(
      collection(db, 'categories'),
      where('restaurantId', '==', restaurantId),
      where('status', '==', 'active'),
      orderBy('order')
    );
    const categoriesUnsub = onSnapshot(categoriesQuery, (categoriesSnapshot) => {
      const categoriesData = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any), deleted: (doc.data() as any).deleted }));
      const filtered = categoriesData.filter(cat => cat.status === 'active' && (cat.deleted === undefined || cat.deleted === false));
      setCategories(filtered.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)));
    }, () => setCategories([]));

    // Daily menu items
    const menuItemsQuery = query(
      collection(db, 'menuItems'),
      where('restaurantId', '==', restaurantId),
      where('status', '==', 'active'),
      orderBy('title')
    );
    const menuItemsUnsub = onSnapshot(menuItemsQuery, (menuItemsSnapshot) => {
      const items = menuItemsSnapshot.docs.map(doc => {
        const data = doc.data() as any;
        return { id: doc.id, title: data.title, description: data.description || '', price: data.price || 0, image: data.image || '', categoryId: data.categoryId || '', status: data.status || 'active', restaurantId: data.restaurantId || restaurantId, deleted: data.deleted, dailyMenu: data.dailyMenu === true };
      });
      const dailyMenuItems = items.filter(i => i.status === 'active' && (i.deleted === undefined || i.deleted === false) && i.dailyMenu);
      console.log('PublicDailyMenuPage - All items:', items.length);
      console.log('PublicDailyMenuPage - Daily menu items:', dailyMenuItems.length);
      console.log('PublicDailyMenuPage - Daily menu items data:', dailyMenuItems);
      setMenuItems(dailyMenuItems);
      setLoading(false);
    }, () => { setMenuItems([]); setLoading(false); });

    return () => {
      restaurantUnsub();
      categoriesUnsub();
      menuItemsUnsub();
    };
  }, [restaurantId]);

  return (
    <>
      <RestaurantMetaTags
        restaurant={restaurant}
        menuItems={menuItems}
        pageType="daily-menu"
      />
      {restaurant && (
        <StructuredData
          restaurant={restaurant}
          menuItems={menuItems}
          pageType="daily-menu"
        />
      )}
      <PublicOrderContent
        restaurant={restaurant}
        categories={categories}
        menuItems={menuItems}
        loading={loading}
        createOrder={createOrder}
        isDemo={false}
      />
    </>
  );
};

export default PublicDailyMenuPage; 