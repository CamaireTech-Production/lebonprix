import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../../../firebase/config';
import { collection, query, where, doc, onSnapshot, orderBy } from 'firebase/firestore';
import PublicMenuContent from '../../../shared/public/PublicMenuContent';
import { useOfflineSync } from '../../../contexts/OfflineSyncContext';
import { useVisitorTracking } from '../../../hooks/useVisitorTracking';
import RestaurantMetaTags from '../../../components/seo/RestaurantMetaTags';
import StructuredData from '../../../components/seo/StructuredData';

const PublicMenuPage: React.FC = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  console.log('PublicMenuPage - restaurantId from params:', restaurantId);
  useOfflineSync();
  
  // Initialize visitor tracking
  useVisitorTracking({
    restaurantId: restaurantId || '',
    pageType: 'menu',
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
        const restaurantData = { id: restaurantDoc.id, ...restaurantDoc.data() };
        console.log('PublicMenuPage - Restaurant data:', restaurantData);
        setRestaurant(restaurantData);
      } else {
        console.log('PublicMenuPage - Restaurant not found');
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

  return (
    <>
      <RestaurantMetaTags
        restaurant={restaurant}
        menuItems={menuItems}
        pageType="menu"
      />
      {restaurant && (
        <StructuredData
          restaurant={restaurant}
          menuItems={menuItems}
          pageType="menu"
        />
      )}
      <PublicMenuContent
        restaurant={restaurant}
        categories={categories}
        menuItems={menuItems}
        loading={loading}
        isDemo={false}
      />
    </>
  );
};

export default PublicMenuPage;
// Manual Test Notes:
// 1. Visit /public-menu/:restaurantId in browser (with a valid restaurantId).
// 2. Should see all active dishes grouped by category, no cart or table logic.
// 3. No add-to-cart or order buttons, just read-only menu.
// 4. Works offline if localStorage caches exist.
