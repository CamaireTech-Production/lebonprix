import React, { useState, useEffect } from 'react';
// Helper to queue admin actions offline
import { useAuth } from '../../../contexts/AuthContext';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { db } from '../../../firebase/config';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { Category } from '../../../types';
import MenuManagementContent from '../../../shared/MenuManagementContent';
import { logActivity } from '../../../services/activityLogService';
import designSystem from '../../../designSystem';

const MenuManagement: React.FC = () => {
  const { restaurant } = useAuth();
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMenuItems = async () => {
      if (!restaurant?.id) return;
      try {
        if (!navigator.onLine) {
          // Offline: load from localStorage
          const offlineCategories = localStorage.getItem('offline_menuCategories');
          const offlineMenuItems = localStorage.getItem('offline_menuItems');
          setCategories(offlineCategories ? JSON.parse(offlineCategories).filter((c: { restaurantId: string; })=>c.restaurantId===restaurant.id) : []);
          setMenuItems(offlineMenuItems ? JSON.parse(offlineMenuItems).filter((m: { restaurantId: string; })=>m.restaurantId===restaurant.id) : []);
        } else {
          // Online: fetch from Firestore
          const categoriesQuery = query(
            collection(db, 'categories'),
            where('restaurantId', '==', restaurant.id),
            orderBy('title')
          );
          const categoriesSnapshot = await getDocs(categoriesQuery);
          const categoriesData = categoriesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Category[];
          setCategories(categoriesData.filter((cat: any) => !cat.deleted));
          const menuItemsQuery = query(
            collection(db, 'menuItems'),
            where('restaurantId', '==', restaurant.id),
            orderBy('createdAt', 'desc')
          );
          const menuItemsSnapshot = await getDocs(menuItemsQuery);
          const menuItemsData = menuItemsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as any[];
          setMenuItems(menuItemsData.filter((item: any) => !item.deleted));
        }
      } catch (error) {
        console.error('Error fetching dishes:', error);
        toast.error('Failed to load dishes', {
          style: {
            background: designSystem.colors.error,
            color: designSystem.colors.textInverse,
          },
        });
      } finally {
        setLoading(false);
      }
    };
    fetchMenuItems();
  }, [restaurant]);

  // CRUD handlers
  const handleAdd = async (data: any) => {
    if (!restaurant?.id) return;
    try {
      const docRef = await addDoc(collection(db, 'menuItems'), {
        ...data,
        restaurantId: restaurant.id,
        createdAt: serverTimestamp(),
        deleted: false,
      });
      setMenuItems(prev => [...prev, { ...data, id: docRef.id, restaurantId: restaurant.id, createdAt: new Date(), deleted: false }]);
      toast.success('Dish added!', {
        style: {
          background: designSystem.colors.success,
          color: designSystem.colors.textInverse,
        },
      });
      await logActivity({
        userId: restaurant.id,
        userEmail: restaurant.email,
        action: 'add_dish',
        entityType: 'dish',
        entityId: docRef.id,
        details: data,
      });
    } catch (error) {
      toast.error('Failed to add dish', {
        style: {
          background: designSystem.colors.error,
          color: designSystem.colors.textInverse,
        },
      });
    }
  };

  const handleEdit = async (item: any, data: any) => {
    if (!restaurant?.id) return;
    try {
      await updateDoc(doc(db, 'menuItems', item.id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
      setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, ...data, updatedAt: new Date() } : i));
      toast.success('Dish updated!', {
        style: {
          background: designSystem.colors.success,
          color: designSystem.colors.textInverse,
        },
      });
      await logActivity({
        userId: restaurant.id,
        userEmail: restaurant.email,
        action: 'edit_dish',
        entityType: 'dish',
        entityId: item.id,
        details: data,
      });
    } catch (error) {
      toast.error('Failed to update dish', {
        style: {
          background: designSystem.colors.error,
          color: designSystem.colors.textInverse,
        },
      });
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!restaurant?.id) return;
    try {
      await updateDoc(doc(db, 'menuItems', itemId), {
        deleted: true,
          updatedAt: serverTimestamp(),
        });
      setMenuItems(prev => prev.filter(i => i.id !== itemId));
      toast.success('Dish deleted!', {
        style: {
          background: designSystem.colors.success,
          color: designSystem.colors.textInverse,
        },
      });
      await logActivity({
        userId: restaurant.id,
        userEmail: restaurant.email,
        action: 'delete_dish',
        entityType: 'dish',
        entityId: itemId,
      });
    } catch (error) {
      toast.error('Failed to delete dish', {
        style: {
          background: designSystem.colors.error,
          color: designSystem.colors.textInverse,
        },
      });
    }
  };

  const handleToggleStatus = async (item: any) => {
    if (!restaurant?.id) return;
    try {
      const newStatus = item.status === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, 'menuItems', item.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus, updatedAt: new Date() } : i));
      toast.success(`Dish ${newStatus === 'active' ? 'activated' : 'deactivated'}!`, {
        style: {
          background: designSystem.colors.success,
          color: designSystem.colors.textInverse,
        },
      });
      await logActivity({
        userId: restaurant.id,
        userEmail: restaurant.email,
        action: newStatus === 'active' ? 'activate_dish' : 'deactivate_dish',
        entityType: 'dish',
        entityId: item.id,
        details: { status: newStatus },
      });
    } catch (error) {
      toast.error('Failed to update status', {
        style: {
          background: designSystem.colors.error,
          color: designSystem.colors.textInverse,
        },
      });
    }
  };

  const handleBulkAction = async (action: 'delete' | 'activate' | 'deactivate', itemIds: string[]) => {
    if (!restaurant?.id) return;
    try {
      if (action === 'delete') {
        for (const itemId of itemIds) {
          await updateDoc(doc(db, 'menuItems', itemId), {
            deleted: true,
            updatedAt: serverTimestamp(),
          });
          await logActivity({
            userId: restaurant.id,
            userEmail: restaurant.email,
            action: 'delete_dish',
            entityType: 'dish',
            entityId: itemId,
          });
        }
        setMenuItems(prev => prev.filter(i => !itemIds.includes(i.id)));
        toast.success(`${itemIds.length} dishes deleted!`, {
          style: {
            background: designSystem.colors.success,
            color: designSystem.colors.textInverse,
          },
        });
      } else {
        const newStatus = action === 'activate' ? 'active' : 'inactive';
        for (const itemId of itemIds) {
          await updateDoc(doc(db, 'menuItems', itemId), {
            status: newStatus,
            updatedAt: serverTimestamp(),
          });
          await logActivity({
            userId: restaurant.id,
            userEmail: restaurant.email,
            action: newStatus === 'active' ? 'activate_dish' : 'deactivate_dish',
            entityType: 'dish',
            entityId: itemId,
            details: { status: newStatus },
          });
        }
        setMenuItems(prev => prev.map(i => itemIds.includes(i.id) ? { ...i, status: newStatus, updatedAt: new Date() } : i));
        toast.success(`${itemIds.length} dishes ${action === 'activate' ? 'activated' : 'deactivated'}!`, {
          style: {
            background: designSystem.colors.success,
            color: designSystem.colors.textInverse,
          },
        });
      }
    } catch (error) {
      toast.error('Failed to perform bulk action', {
        style: {
          background: designSystem.colors.error,
          color: designSystem.colors.textInverse,
        },
      });
    }
  };

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
      <MenuManagementContent
        menuItems={menuItems}
        categories={categories}
        loading={loading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
        onBulkAction={handleBulkAction}
        isDemoUser={false}
        restaurantId={restaurant?.id || ''}
        restaurant={restaurant}
      />
    </DashboardLayout>
  );
};

export default MenuManagement;