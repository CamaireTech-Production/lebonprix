// Helper to queue admin actions offline
import type { PendingAction } from '../../../types';
function queuePendingAction(action: PendingAction) {
  const arr = JSON.parse(localStorage.getItem('pendingActions') || '[]');
  arr.push({ ...action, timestamp: Date.now() });
  localStorage.setItem('pendingActions', JSON.stringify(arr));
}
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import CategoryManagementContent from '../../../shared/CategoryManagementContent';
import { db } from '../../../firebase/config';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  serverTimestamp,
  orderBy, 
  addDoc
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { Category } from '../../../types';
import { logActivity } from '../../../services/activityLogService';
import { t } from '../../../utils/i18n';
import { useLanguage } from '../../../contexts/LanguageContext';

const CategoryManagement: React.FC = () => {
  const { restaurant } = useAuth();
  const { language } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setIsModalOpen] = useState(false);
  const [, setIsDeleting] = useState(false);
  const [, setEditingCategory] = useState<Category | null>(null);
  const [] = useState<string>('');
  const [] = useState<'title' | 'order'>('order');
  const [] = useState<'asc' | 'desc'>('asc');
  const [] = useState(1);
  const [] = useState(10);
  
  // Form state
  const [, setFormData] = useState({
    title: '',
    status: 'active' as 'active' | 'inactive',
    order: 0
  });

  useEffect(() => {
    const fetchCategoriesAndMenuItems = async () => {
      if (!restaurant?.id) return;
      try {
        if (!navigator.onLine) {
          // Offline: load from localStorage
          const offlineCategories = localStorage.getItem('offline_menuCategories');
          const filteredOfflineCategories = offlineCategories ? JSON.parse(offlineCategories).filter((c: { restaurantId: string; deleted?: boolean; })=>c.restaurantId===restaurant.id && !c.deleted) : [];
          setCategories(filteredOfflineCategories);
          const offlineMenuItems = localStorage.getItem('offline_menuItems');
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
          // Filter out soft-deleted categories
          setCategories(categoriesData.filter(category => !category.deleted));
          const menuItemsQuery = query(
            collection(db, 'menuItems'),
            where('restaurantId', '==', restaurant.id),
            orderBy('title')
          );
          const menuItemsSnapshot = await getDocs(menuItemsQuery);
          const menuItemsData = menuItemsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as any[];
          setMenuItems(menuItemsData.filter((item: any) => !item.deleted));
        }
      } catch (error) {
        console.error('Error fetching categories or menu items:', error);
        toast.error(t('failed_load_categories_menu_items', language));
      } finally {
        setLoading(false);
      }
    };
    fetchCategoriesAndMenuItems();
  }, [restaurant]);

  const resetForm = () => {
    setFormData({
      title: '',
      status: 'active',
      order: 0
    });
    setEditingCategory(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      title: category.title,
      status: category.status,
      order: category.order || 0
    });
    setIsModalOpen(true);
  };

  const handleAdd = async (data: any) => {
    if (!restaurant?.id) return;
    try {
      const docRef = await addDoc(collection(db, 'categories'), {
        ...data,
        parentCategoryId: data.parentCategoryId || null,
        restaurantId: restaurant.id,
        createdAt: serverTimestamp(),
        deleted: false,
      });
      setCategories(prev => [...prev, { ...data, id: docRef.id, parentCategoryId: data.parentCategoryId || null, restaurantId: restaurant.id, createdAt: new Date(), deleted: false }]);
      toast.success('Category added!');
      await logActivity({
        userId: restaurant.id,
        userEmail: restaurant.email,
        action: 'add_category',
        entityType: 'category',
        entityId: docRef.id,
        details: data,
      });
      if (data.parentCategoryId) {
        await logActivity({
          userId: restaurant.id,
          userEmail: restaurant.email,
          action: 'add_subcategory',
          entityType: 'category',
          entityId: docRef.id,
          details: data,
        });
      }
    } catch (error) {
      toast.error('Failed to add category');
    }
  };

  const handleEdit = async (category: any, data: any) => {
    if (!restaurant?.id) return;
    try {
      await updateDoc(doc(db, 'categories', category.id), {
        ...data,
        parentCategoryId: data.parentCategoryId || null,
        updatedAt: serverTimestamp(),
      });
      setCategories(prev => prev.map(c => c.id === category.id ? { ...c, ...data, parentCategoryId: data.parentCategoryId || null, updatedAt: new Date() } : c));
      toast.success('Category updated!');
      await logActivity({
        userId: restaurant.id,
        userEmail: restaurant.email,
        action: 'edit_category',
        entityType: 'category',
        entityId: category.id,
        details: data,
      });
      if (data.parentCategoryId) {
        await logActivity({
          userId: restaurant.id,
          userEmail: restaurant.email,
          action: 'edit_subcategory',
          entityType: 'category',
          entityId: category.id,
          details: data,
        });
      }
    } catch (error) {
      toast.error('Failed to update category');
    }
  };

  const toggleCategoryStatus = async (category: Category) => {
    if (!restaurant?.id) return;
    
    try {
      const newStatus = category.status === 'active' ? 'inactive' : 'active';
      
      await updateDoc(doc(db, 'categories', category.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      
      // Update local state
      setCategories(prevCategories => 
        prevCategories.map(c => 
          c.id === category.id 
            ? { ...c, status: newStatus, updatedAt: new Date() } 
            : c
        )
      );
      
      toast.success(t('category_status_updated', language).replace('{{status}}', newStatus === 'active' ? t('activated', language) : t('deactivated', language)));
      await logActivity({
        userId: restaurant.id,
        userEmail: restaurant.email,
        action: newStatus === 'active' ? 'activate_category' : 'deactivate_category',
        entityType: 'category',
        entityId: category.id,
        details: { status: newStatus },
      });
    } catch (error) {
      console.error('Error updating category status:', error);
      toast.error(t('failed_update_category_status', language));
    }
  };

  const deleteCategory = async (categoryId: string) => {
    if (!restaurant?.id) return;
    try {
      setIsDeleting(true);
      // Check for subcategories
      const subcategories = categories.filter(cat => cat.parentCategoryId === categoryId && !cat.deleted);
      if (subcategories.length > 0) {
        toast.error(t('cannot_delete_category_with_subcategories', language));
        await logActivity({
          userId: restaurant.id,
          userEmail: restaurant.email,
          action: 'delete_category_failed_subcategories',
          entityType: 'category',
          entityId: categoryId,
          details: { subcategoryCount: subcategories.length },
        });
        setIsDeleting(false);
        return;
      }
      if (!navigator.onLine) {
        queuePendingAction({ type: 'deleteCategory', payload: { id: categoryId } });
        setCategories(prevCategories => prevCategories.filter(category => category.id !== categoryId));
        toast.success(t('category_delete_queued_sync', language));
        setIsDeleting(false);
        return;
      }
      // Soft delete: set deleted: true
      await updateDoc(doc(db, 'categories', categoryId), { deleted: true, updatedAt: serverTimestamp() });
      setCategories(prevCategories => prevCategories.filter(category => category.id !== categoryId));
      toast.success(t('category_deleted_success', language));
      await logActivity({
        userId: restaurant.id,
        userEmail: restaurant.email,
        action: 'delete_category',
        entityType: 'category',
        entityId: categoryId,
      });
      // Optionally, recursively soft-delete all subcategories (uncomment to enable)
      // for (const subcat of subcategories) {
      //   await updateDoc(doc(db, 'categories', subcat.id), { deleted: true, updatedAt: serverTimestamp() });
      //   await logActivity({
      //     userId: restaurant.id,
      //     userEmail: restaurant.email,
      //     action: 'delete_subcategory',
      //     entityType: 'category',
      //     entityId: subcat.id,
      //     details: { parentCategoryId: categoryId },
      //   });
      // }
    } catch (error) {
      toast.error(t('failed_delete_category', language));
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading && categories.length === 0) {
    return (
      <DashboardLayout title="">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size={60} />
        </div>
      </DashboardLayout>
    );
  }

  // Handlers to be passed to shared content
  const handleDelete = deleteCategory;
  const handleToggleStatus = toggleCategoryStatus;

  return (
    <DashboardLayout title="">
      <CategoryManagementContent
        categories={categories}
        loading={loading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
        isDemoUser={false}
        menuItems={menuItems}
      />
    </DashboardLayout>
  );
};

export default CategoryManagement;