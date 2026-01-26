import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { t } from '../../../utils/i18n';
import { useMatieres } from '../../../hooks/business/useMatieres';
import { useStockBatches } from '../../../hooks/business/useStockBatches';
import { Card, Button, Input, Modal, LoadingSpinner } from '../../../components/ui';
import type { Matiere } from '../../../types/geskap';
import toast from 'react-hot-toast';

// Default units for restaurant ingredients
const INGREDIENT_UNITS = ['kg', 'g', 'L', 'mL', 'unit', 'piece', 'portion', 'box', 'pack'];

const IngredientsPage = () => {
  const { currentUser, restaurant } = useAuth();
  const { language } = useLanguage();
  const restaurantId = restaurant?.id || currentUser?.uid || '';
  const userId = currentUser?.uid || '';

  const { matieres, loading, error, addMatiere, updateMatiere, softDeleteMatiere } = useMatieres({
    restaurantId,
    userId,
  });

  const { batches: stockBatches } = useStockBatches({
    restaurantId,
    userId,
    type: 'matiere',
  });

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentIngredient, setCurrentIngredient] = useState<Matiere | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    unit: 'kg',
    refCategorie: '',
    costPrice: 0,
    initialStock: 0,
  });

  // Calculate stock for each ingredient
  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    stockBatches.forEach(batch => {
      if (batch.matiereId) {
        const current = map.get(batch.matiereId) || 0;
        map.set(batch.matiereId, current + (batch.remainingQuantity || 0));
      }
    });
    return map;
  }, [stockBatches]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    matieres.forEach(m => {
      if (m.refCategorie) cats.add(m.refCategorie);
    });
    return Array.from(cats);
  }, [matieres]);

  // Filter ingredients
  const filteredIngredients = useMemo(() => {
    let filtered = matieres;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(query) ||
        (m.description && m.description.toLowerCase().includes(query))
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(m => m.refCategorie === selectedCategory);
    }

    return filtered;
  }, [matieres, searchQuery, selectedCategory]);

  // Stats
  const stats = useMemo(() => {
    const lowStockCount = matieres.filter(m => {
      const stock = stockMap.get(m.id!) || 0;
      return stock < 10; // Low stock threshold
    }).length;

    const totalValue = matieres.reduce((sum, m) => {
      const stock = stockMap.get(m.id!) || 0;
      return sum + (stock * (m.costPrice || 0));
    }, 0);

    return {
      total: matieres.length,
      lowStock: lowStockCount,
      totalValue,
    };
  }, [matieres, stockMap]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      unit: 'kg',
      refCategorie: '',
      costPrice: 0,
      initialStock: 0,
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (ingredient: Matiere) => {
    setCurrentIngredient(ingredient);
    setFormData({
      name: ingredient.name,
      description: ingredient.description || '',
      unit: ingredient.unit || 'kg',
      refCategorie: ingredient.refCategorie || '',
      costPrice: ingredient.costPrice || 0,
      initialStock: 0,
    });
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (ingredient: Matiere) => {
    setCurrentIngredient(ingredient);
    setIsDeleteModalOpen(true);
  };

  const handleAdd = async () => {
    if (!formData.name.trim()) {
      toast.error(t('ingredient_name_required', language));
      return;
    }

    setIsSubmitting(true);
    try {
      await addMatiere(
        {
          name: formData.name.trim(),
          description: formData.description.trim(),
          unit: formData.unit,
          refCategorie: formData.refCategorie,
          costPrice: formData.costPrice,
          refStock: '',
          userId,
          restaurantId,
        },
        formData.initialStock > 0 ? formData.initialStock : undefined,
        formData.costPrice > 0 ? formData.costPrice : undefined
      );
      toast.success(t('ingredient_added', language));
      setIsAddModalOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || t('error_adding_ingredient', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!currentIngredient || !formData.name.trim()) {
      toast.error(t('ingredient_name_required', language));
      return;
    }

    setIsSubmitting(true);
    try {
      await updateMatiere(currentIngredient.id!, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        unit: formData.unit,
        refCategorie: formData.refCategorie,
        costPrice: formData.costPrice,
      });
      toast.success(t('ingredient_updated', language));
      setIsEditModalOpen(false);
      setCurrentIngredient(null);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || t('error_updating_ingredient', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!currentIngredient) return;

    setIsSubmitting(true);
    try {
      await softDeleteMatiere(currentIngredient.id!);
      toast.success(t('ingredient_deleted', language));
      setIsDeleteModalOpen(false);
      setCurrentIngredient(null);
    } catch (err: any) {
      toast.error(err.message || t('error_deleting_ingredient', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price) + ' XAF';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <p>{t('error_loading_ingredients', language)}: {error}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="pb-20 md:pb-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('total_ingredients', language)}</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-full">
              <Package size={24} className="text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('low_stock_items', language)}</p>
              <p className="text-2xl font-bold text-orange-600">{stats.lowStock}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <AlertTriangle size={24} className="text-orange-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('inventory_value', language)}</p>
              <p className="text-2xl font-bold text-green-600">{formatPrice(stats.totalValue)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <Package size={24} className="text-green-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t('manage_ingredients', language)}</h2>
          <p className="text-sm text-gray-500">{t('manage_ingredients_desc', language)}</p>
        </div>
        <Button onClick={handleOpenAdd}>
          <Plus size={18} className="mr-2" />
          {t('add_ingredient', language)}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Input
            type="text"
            placeholder={t('search_ingredients', language)}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">{t('all_categories', language)}</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Ingredients List */}
      {filteredIngredients.length === 0 ? (
        <Card className="p-8 text-center">
          <Package size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">
            {searchQuery || selectedCategory !== 'all'
              ? t('no_ingredients_match', language)
              : t('no_ingredients', language)}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    {t('ingredient_name', language)}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    {t('category', language)}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    {t('stock_qty', language)}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    {t('cost_price', language)}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    {t('actions', language)}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredIngredients.map(ingredient => {
                  const stock = stockMap.get(ingredient.id!) || 0;
                  const isLowStock = stock < 10;

                  return (
                    <tr key={ingredient.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{ingredient.name}</p>
                          {ingredient.description && (
                            <p className="text-sm text-gray-500 truncate max-w-xs">{ingredient.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">
                          {ingredient.refCategorie || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-medium ${isLowStock ? 'text-orange-600' : 'text-gray-900'}`}>
                          {stock} {ingredient.unit || ''}
                        </span>
                        {isLowStock && (
                          <AlertTriangle size={14} className="inline ml-1 text-orange-500" />
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-gray-900">{formatPrice(ingredient.costPrice || 0)}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenEdit(ingredient)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title={t('edit', language)}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(ingredient)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title={t('delete', language)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isAddModalOpen || isEditModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
          setCurrentIngredient(null);
          resetForm();
        }}
        title={isEditModalOpen ? t('edit_ingredient', language) : t('add_ingredient', language)}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('ingredient_name', language)} *
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('ingredient_name_placeholder', language)}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('unit', language)}
              </label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {INGREDIENT_UNITS.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('category', language)}
              </label>
              <Input
                type="text"
                value={formData.refCategorie}
                onChange={(e) => setFormData(prev => ({ ...prev, refCategorie: e.target.value }))}
                placeholder={t('category_placeholder', language)}
                list="categories-list"
              />
              <datalist id="categories-list">
                {categories.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('cost_price', language)} (XAF)
              </label>
              <Input
                type="number"
                value={formData.costPrice || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, costPrice: parseFloat(e.target.value) || 0 }))}
                min="0"
              />
            </div>

            {isAddModalOpen && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('initial_stock', language)}
                </label>
                <Input
                  type="number"
                  value={formData.initialStock || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, initialStock: parseFloat(e.target.value) || 0 }))}
                  min="0"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              setIsAddModalOpen(false);
              setIsEditModalOpen(false);
              setCurrentIngredient(null);
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
          setCurrentIngredient(null);
        }}
        title={t('delete_ingredient', language)}
      >
        <p className="text-gray-600 mb-6">
          {t('delete_ingredient_confirm', language)} <strong>{currentIngredient?.name}</strong>?
        </p>
        <div className="flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={() => {
              setIsDeleteModalOpen(false);
              setCurrentIngredient(null);
            }}
          >
            {t('cancel', language)}
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={isSubmitting}
          >
            {isSubmitting ? t('deleting', language) : t('delete', language)}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default IngredientsPage;
