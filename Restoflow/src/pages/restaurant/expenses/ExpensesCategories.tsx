import React, { useState } from 'react';
import { Edit2, Trash2, Plus } from 'lucide-react';
import { Card, Button, Input, Modal, Badge, LoadingSpinner } from '../../../components/ui';
import { useExpenseCategories } from '../../../hooks/business/useExpenseCategories';
import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { t } from '../../../utils/i18n';
import type { ExpenseType } from '../../../types/geskap';
import toast from 'react-hot-toast';

const ExpensesCategories = () => {
  const { currentUser, restaurant } = useAuth();
  const { language } = useLanguage();
  const restaurantId = restaurant?.id || currentUser?.uid || '';

  const {
    categories,
    categoryUsageCounts,
    loading,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useExpenseCategories({ restaurantId });

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<ExpenseType | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateCategory = () => {
    setCategoryName('');
    setIsCreateModalOpen(true);
  };

  const handleSaveCreate = async () => {
    if (!categoryName.trim()) {
      toast.error(t('category_name_required', language));
      return;
    }

    // Check for duplicates
    const duplicate = categories.find(
      cat => cat.name.toLowerCase().trim() === categoryName.toLowerCase().trim()
    );
    if (duplicate) {
      toast.error(t('category_already_exists', language));
      return;
    }

    setIsSubmitting(true);
    try {
      await addCategory(categoryName.trim());
      toast.success(t('category_created', language));
      setIsCreateModalOpen(false);
      setCategoryName('');
    } catch (error: any) {
      console.error('Error creating category:', error);
      toast.error(error.message || t('category_create_error', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCategory = (category: ExpenseType) => {
    setCurrentCategory(category);
    setCategoryName(category.name);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!currentCategory || !categoryName.trim()) return;

    if (currentCategory.isDefault) {
      toast.error(t('cannot_edit_default_category', language));
      setIsEditModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await updateCategory(currentCategory.id, categoryName.trim());
      toast.success(t('category_updated', language));
      setIsEditModalOpen(false);
      setCurrentCategory(null);
      setCategoryName('');
    } catch (error: any) {
      console.error('Error updating category:', error);
      toast.error(error.message || t('category_update_error', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = (category: ExpenseType) => {
    setCurrentCategory(category);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!currentCategory) return;

    const usageCount = categoryUsageCounts[currentCategory.name] || 0;
    if (usageCount > 0) {
      toast.error(t('cannot_delete_category_in_use', language));
      setIsDeleteModalOpen(false);
      return;
    }

    if (currentCategory.isDefault) {
      toast.error(t('cannot_delete_default_category', language));
      setIsDeleteModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteCategory(currentCategory.id);
      toast.success(t('category_deleted', language));
      setIsDeleteModalOpen(false);
      setCurrentCategory(null);
    } catch (error: any) {
      console.error('Error deleting category:', error);
      toast.error(error.message || t('category_delete_error', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="pb-16 md:pb-0">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t('category_management', language)}</h2>
          <p className="text-gray-600">{t('category_management_subtitle', language)}</p>
        </div>
        <Button onClick={handleCreateCategory} icon={<Plus size={20} />}>
          {t('create_category', language)}
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('category_name', language)}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('usage_count', language)}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('type', language)}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('actions', language)}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {categories.map((category) => {
                const usageCount = categoryUsageCounts[category.name] || 0;
                return (
                  <tr key={category.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{category.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={usageCount > 0 ? 'info' : 'warning'}>
                        {usageCount} {usageCount === 1 ? t('expense_singular', language) : t('expenses_plural', language)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={category.isDefault ? 'info' : 'warning'}>
                        {category.isDefault ? t('category_default', language) : t('category_custom', language)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEditCategory(category)}
                          disabled={category.isDefault}
                          className={`text-indigo-600 hover:text-indigo-900 p-1 ${category.isDefault ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={category.isDefault ? t('cannot_edit_default_category', language) : t('edit_category', language)}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category)}
                          disabled={category.isDefault || usageCount > 0}
                          className={`text-red-600 hover:text-red-900 p-1 ${category.isDefault || usageCount > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={
                            category.isDefault
                              ? t('cannot_delete_default_category', language)
                              : usageCount > 0
                                ? t('cannot_delete_category_in_use', language)
                                : t('delete_category', language)
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    {t('no_categories_found', language)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Category Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setCategoryName('');
        }}
        title={t('create_category', language)}
      >
        <div className="space-y-4">
          <Input
            label={t('category_name', language)}
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder={t('expense_category_placeholder', language)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && categoryName.trim() && !isSubmitting) {
                handleSaveCreate();
              }
            }}
          />

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateModalOpen(false);
                setCategoryName('');
              }}
            >
              {t('cancel', language)}
            </Button>
            <Button
              onClick={handleSaveCreate}
              disabled={isSubmitting || !categoryName.trim()}
              loading={isSubmitting}
            >
              {t('create', language)}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setCurrentCategory(null);
          setCategoryName('');
        }}
        title={t('edit_category', language)}
      >
        <div className="space-y-4">
          <Input
            label={t('category_name', language)}
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder={t('expense_category_placeholder', language)}
          />
          {currentCategory?.isDefault && (
            <p className="text-sm text-yellow-600">
              {t('default_category_warning', language)}
            </p>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditModalOpen(false);
                setCurrentCategory(null);
                setCategoryName('');
              }}
            >
              {t('cancel', language)}
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSubmitting || !categoryName.trim()}
              loading={isSubmitting}
            >
              {t('save_changes', language)}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Category Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setCurrentCategory(null);
        }}
        title={t('delete_category', language)}
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            {t('delete_category_confirm', language)} "{currentCategory?.name}"?
          </p>
          {currentCategory && (categoryUsageCounts[currentCategory.name] || 0) > 0 && (
            <p className="text-sm text-red-600">
              {t('category_in_use_warning', language).replace('{count}', String(categoryUsageCounts[currentCategory.name]))}
            </p>
          )}
          {currentCategory?.isDefault && (
            <p className="text-sm text-yellow-600">
              {t('default_category_delete_warning', language)}
            </p>
          )}
          <p className="text-sm text-red-600">
            {t('action_irreversible', language)}
          </p>

          <div className="flex justify-end space-x-3 pt-4 border-t">
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
              onClick={handleConfirmDelete}
              disabled={isSubmitting || currentCategory?.isDefault || (categoryUsageCounts[currentCategory?.name || ''] || 0) > 0}
              loading={isSubmitting}
            >
              {t('delete', language)}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ExpensesCategories;
