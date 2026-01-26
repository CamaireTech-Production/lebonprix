import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Tag, Package } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { t } from '../../../utils/i18n';
import { useMatieres } from '../../../hooks/business/useMatieres';
import { Card, Button, Input, Modal, LoadingSpinner } from '../../../components/ui';
import { db } from '../../../firebase/config';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import type { Category } from '../../../types/geskap';
import toast from 'react-hot-toast';

// Default ingredient categories for restaurants
const DEFAULT_INGREDIENT_CATEGORIES = [
  { name: 'Vegetables', description: 'Fresh vegetables and produce' },
  { name: 'Meat', description: 'Beef, chicken, pork, etc.' },
  { name: 'Seafood', description: 'Fish, shrimp, etc.' },
  { name: 'Dairy', description: 'Milk, cheese, butter, etc.' },
  { name: 'Grains', description: 'Rice, flour, pasta, etc.' },
  { name: 'Spices', description: 'Spices and seasonings' },
  { name: 'Oils', description: 'Cooking oils and fats' },
  { name: 'Beverages', description: 'Drinks and liquids' },
  { name: 'Condiments', description: 'Sauces and condiments' },
  { name: 'Other', description: 'Other ingredients' },
];

const InventoryCategoriesPage = () => {
  const { currentUser, restaurant } = useAuth();
  const { language } = useLanguage();
  const restaurantId = restaurant?.id || currentUser?.uid || '';
  const userId = currentUser?.uid || '';

  const { matieres } = useMatieres({ restaurantId, userId });

  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  // Subscribe to categories
  useEffect(() => {
    if (!restaurantId) {
      setCategories([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'restaurants', restaurantId, 'inventoryCategories'),
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      setCategories(cats);
      setLoading(false);

      // Create default categories if none exist
      if (cats.length === 0) {
        createDefaultCategories();
      }
    }, (error) => {
      console.error('Error loading categories:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [restaurantId]);

  // Create default categories
  const createDefaultCategories = async () => {
    if (!restaurantId) return;

    try {
      for (const cat of DEFAULT_INGREDIENT_CATEGORIES) {
        await addDoc(collection(db, 'restaurants', restaurantId, 'inventoryCategories'), {
          name: cat.name,
          description: cat.description,
          type: 'matiere',
          matiereCount: 0,
          isActive: true,
          userId,
          restaurantId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error creating default categories:', error);
    }
  };

  // Count ingredients per category
  const categoryCountMap = useMemo(() => {
    const map = new Map<string, number>();
    matieres.forEach(m => {
      if (m.refCategorie) {
        const count = map.get(m.refCategorie) || 0;
        map.set(m.refCategorie, count + 1);
      }
    });
    return map;
  }, [matieres]);

  // Filter categories
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const query = searchQuery.toLowerCase();
    return categories.filter(c =>
      c.name.toLowerCase().includes(query) ||
      (c.description && c.description.toLowerCase().includes(query))
    );
  }, [categories, searchQuery]);

  const resetForm = () => {
    setFormData({ name: '', description: '' });
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    setCurrentCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
    });
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (category: Category) => {
    setCurrentCategory(category);
    setIsDeleteModalOpen(true);
  };

  const handleAdd = async () => {
    if (!formData.name.trim()) {
      toast.error(t('category_name_required', language));
      return;
    }

    // Check for duplicate
    if (categories.some(c => c.name.toLowerCase() === formData.name.trim().toLowerCase())) {
      toast.error(t('category_already_exists', language));
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'restaurants', restaurantId, 'inventoryCategories'), {
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: 'matiere',
        matiereCount: 0,
        isActive: true,
        userId,
        restaurantId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success(t('category_added', language));
      setIsAddModalOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || t('error_adding_category', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!currentCategory || !formData.name.trim()) {
      toast.error(t('category_name_required', language));
      return;
    }

    // Check for duplicate (excluding current)
    if (categories.some(c =>
      c.id !== currentCategory.id &&
      c.name.toLowerCase() === formData.name.trim().toLowerCase()
    )) {
      toast.error(t('category_already_exists', language));
      return;
    }

    setIsSubmitting(true);
    try {
      const catRef = doc(db, 'restaurants', restaurantId, 'inventoryCategories', currentCategory.id);
      await updateDoc(catRef, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        updatedAt: serverTimestamp(),
      });
      toast.success(t('category_updated', language));
      setIsEditModalOpen(false);
      setCurrentCategory(null);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || t('error_updating_category', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!currentCategory) return;

    // Check if category has ingredients
    const count = categoryCountMap.get(currentCategory.name) || 0;
    if (count > 0) {
      toast.error(t('category_has_ingredients', language));
      return;
    }

    setIsSubmitting(true);
    try {
      const catRef = doc(db, 'restaurants', restaurantId, 'inventoryCategories', currentCategory.id);
      await deleteDoc(catRef);
      toast.success(t('category_deleted', language));
      setIsDeleteModalOpen(false);
      setCurrentCategory(null);
    } catch (error: any) {
      toast.error(error.message || t('error_deleting_category', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t('manage_inventory_categories', language)}</h2>
          <p className="text-sm text-gray-500">{t('manage_inventory_categories_desc', language)}</p>
        </div>
        <Button onClick={handleOpenAdd}>
          <Plus size={18} className="mr-2" />
          {t('add_category', language)}
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Input
            type="text"
            placeholder={t('search_categories', language)}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Categories Grid */}
      {filteredCategories.length === 0 ? (
        <Card className="p-8 text-center">
          <Tag size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">
            {searchQuery
              ? t('no_categories_match', language)
              : t('no_categories', language)}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map(category => {
            const count = categoryCountMap.get(category.name) || 0;

            return (
              <Card key={category.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Tag size={20} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{category.name}</h3>
                      {category.description && (
                        <p className="text-sm text-gray-500 mt-1">{category.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenEdit(category)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title={t('edit', language)}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleOpenDelete(category)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title={t('delete', language)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm text-gray-500">
                  <Package size={14} className="mr-1" />
                  {count} {count === 1 ? t('ingredient', language) : t('ingredients', language)}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isAddModalOpen || isEditModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
          setCurrentCategory(null);
          resetForm();
        }}
        title={isEditModalOpen ? t('edit_category', language) : t('add_category', language)}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('category_name', language)} *
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('category_name_placeholder', language)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('description', language)}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t('description_placeholder', language)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              setIsAddModalOpen(false);
              setIsEditModalOpen(false);
              setCurrentCategory(null);
              resetForm();
            }}
          >
            {t('cancel', language)}
          </Button>
          <Button
            onClick={isEditModalOpen ? handleEdit : handleAdd}
            disabled={isSubmitting}
          >
            {isSubmitting ? t('saving', language) : (isEditModalOpen ? t('save_changes', language) : t('add', language))}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setCurrentCategory(null);
        }}
        title={t('delete_category', language)}
      >
        <p className="text-gray-600 mb-6">
          {t('delete_category_confirm', language)} <strong>{currentCategory?.name}</strong>?
        </p>
        {currentCategory && (categoryCountMap.get(currentCategory.name) || 0) > 0 && (
          <p className="text-orange-600 text-sm mb-4">
            {t('category_has_ingredients_warning', language)}
          </p>
        )}
        <div className="flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={() => {
              setIsDeleteModalOpen(false);
              setCurrentCategory(null);
            }}
          >
            {t('cancel', language)}
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={isSubmitting || (currentCategory && (categoryCountMap.get(currentCategory.name) || 0) > 0)}
          >
            {isSubmitting ? t('deleting', language) : t('delete', language)}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default InventoryCategoriesPage;
