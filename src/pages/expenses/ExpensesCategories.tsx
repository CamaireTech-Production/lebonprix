// src/pages/expenses/ExpensesCategories.tsx
import { useState } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { Card, Badge, Modal, ModalFooter, Input } from '@components/common';
import { useExpenseCategories } from '@hooks/business/useExpenseCategories';
import { useAuth } from '@contexts/AuthContext';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import type { ExpenseType } from '../../types/models';

const ExpensesCategories = () => {
  const { company } = useAuth();
  const {
    expenseTypesList,
    categoryUsageCounts,
    loading,
    updateCategory,
    deleteCategory,
    refresh
  } = useExpenseCategories();

  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [isDeleteCategoryModalOpen, setIsDeleteCategoryModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<ExpenseType | null>(null);
  const [categoryEditName, setCategoryEditName] = useState('');
  const [categoryDeleteLoading, setCategoryDeleteLoading] = useState(false);
  const [categoryEditLoading, setCategoryEditLoading] = useState(false);

  const handleEditCategory = (category: ExpenseType) => {
    setCurrentCategory(category);
    setCategoryEditName(category.name);
    setIsEditCategoryModalOpen(true);
  };

  const handleSaveCategoryEdit = async () => {
    if (!currentCategory || !categoryEditName.trim()) return;
    
    if (currentCategory.isDefault) {
      showErrorToast('Cannot edit default expense categories');
      setIsEditCategoryModalOpen(false);
      return;
    }
    
    setCategoryEditLoading(true);
    try {
      await updateCategory(currentCategory.id, categoryEditName.trim());
      showSuccessToast('Category updated successfully');
      setIsEditCategoryModalOpen(false);
      setCurrentCategory(null);
      setCategoryEditName('');
      await refresh();
    } catch (error: any) {
      console.error('Error updating category:', error);
      showErrorToast(error.message || 'Failed to update category');
    } finally {
      setCategoryEditLoading(false);
    }
  };

  const handleDeleteCategory = (category: ExpenseType) => {
    setCurrentCategory(category);
    setIsDeleteCategoryModalOpen(true);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!currentCategory || !company?.id) return;
    
    setCategoryDeleteLoading(true);
    try {
      await deleteCategory(currentCategory.id, company.id);
      showSuccessToast('Category deleted successfully');
      setIsDeleteCategoryModalOpen(false);
      setCurrentCategory(null);
      await refresh();
    } catch (error: any) {
      console.error('Error deleting category:', error);
      showErrorToast(error.message || 'Failed to delete category');
    } finally {
      setCategoryDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="pb-16 md:pb-0">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Gestion des Catégories</h1>
        <p className="text-gray-600">Gérez vos catégories de dépenses. Les catégories par défaut ne peuvent pas être modifiées.</p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom de la catégorie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre d'utilisations
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {expenseTypesList.map((category) => {
                const usageCount = categoryUsageCounts[category.name] || 0;
                return (
                  <tr key={category.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{category.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={usageCount > 0 ? 'info' : 'warning'}>
                        {usageCount} {usageCount === 1 ? 'dépense' : 'dépenses'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={category.isDefault ? 'info' : 'warning'}>
                        {category.isDefault ? 'Par défaut' : 'Personnalisée'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEditCategory(category)}
                          disabled={category.isDefault}
                          className={`text-indigo-600 hover:text-indigo-900 ${category.isDefault ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={category.isDefault ? 'Les catégories par défaut ne peuvent pas être modifiées' : 'Modifier la catégorie'}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category)}
                          disabled={category.isDefault || usageCount > 0}
                          className={`text-red-600 hover:text-red-900 ${category.isDefault || usageCount > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={
                            category.isDefault
                              ? 'Les catégories par défaut ne peuvent pas être supprimées'
                              : usageCount > 0
                              ? `Impossible de supprimer: ${usageCount} dépense(s) utilisent cette catégorie`
                              : 'Supprimer la catégorie'
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {expenseTypesList.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    Aucune catégorie trouvée. Les catégories apparaîtront ici après leur création.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit Category Modal */}
      <Modal
        isOpen={isEditCategoryModalOpen}
        onClose={() => {
          setIsEditCategoryModalOpen(false);
          setCurrentCategory(null);
          setCategoryEditName('');
        }}
        title="Modifier la catégorie"
        footer={
          <ModalFooter
            onCancel={() => {
              setIsEditCategoryModalOpen(false);
              setCurrentCategory(null);
              setCategoryEditName('');
            }}
            onConfirm={handleSaveCategoryEdit}
            confirmText="Enregistrer"
            isLoading={categoryEditLoading}
          />
        }
      >
        <div className="space-y-4">
          <Input
            label="Nom de la catégorie"
            name="categoryName"
            value={categoryEditName}
            onChange={(e) => setCategoryEditName(e.target.value)}
            required
            placeholder="Entrez le nom de la catégorie"
          />
          {currentCategory?.isDefault && (
            <p className="text-sm text-yellow-600">
              ⚠️ Note: Les catégories par défaut ne peuvent pas être modifiées.
            </p>
          )}
        </div>
      </Modal>

      {/* Delete Category Modal */}
      <Modal
        isOpen={isDeleteCategoryModalOpen}
        onClose={() => {
          setIsDeleteCategoryModalOpen(false);
          setCurrentCategory(null);
        }}
        title="Supprimer la catégorie"
        footer={
          <ModalFooter
            onCancel={() => {
              setIsDeleteCategoryModalOpen(false);
              setCurrentCategory(null);
            }}
            onConfirm={handleConfirmDeleteCategory}
            confirmText="Supprimer"
            isDanger
            isLoading={categoryDeleteLoading}
          />
        }
      >
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Êtes-vous sûr de vouloir supprimer la catégorie "{currentCategory?.name}" ?
          </p>
          {currentCategory && categoryUsageCounts[currentCategory.name] > 0 && (
            <p className="text-sm text-red-600 mb-2">
              ⚠️ Cette catégorie est utilisée dans {categoryUsageCounts[currentCategory.name]} dépense(s). 
              Vous ne pouvez pas la supprimer tant qu'elle est utilisée.
            </p>
          )}
          {currentCategory?.isDefault && (
            <p className="text-sm text-yellow-600 mb-2">
              ⚠️ Les catégories par défaut ne peuvent pas être supprimées.
            </p>
          )}
          <p className="text-sm text-red-600">
            Cette action est irréversible.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default ExpensesCategories;



