import React, { useState, useMemo } from 'react';
import { Plus, Search, Package, AlertTriangle, TrendingUp, TrendingDown, History, Boxes } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { t } from '../../../utils/i18n';
import { useMatieres } from '../../../hooks/business/useMatieres';
import { useStockBatches } from '../../../hooks/business/useStockBatches';
import { Card, Button, Input, Modal, LoadingSpinner } from '../../../components/ui';
import type { Matiere, StockBatch, StockChange } from '../../../types/geskap';
import toast from 'react-hot-toast';

const StocksPage = () => {
  const { currentUser, restaurant } = useAuth();
  const { language } = useLanguage();
  const restaurantId = restaurant?.id || currentUser?.uid || '';
  const userId = currentUser?.uid || '';

  const { matieres, loading: matieresLoading } = useMatieres({ restaurantId, userId });
  const { batches: stockBatches, loading: batchesLoading, restock } = useStockBatches({
    restaurantId,
    userId,
    type: 'matiere',
  });

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'out'>('all');
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Matiere | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Restock form
  const [restockData, setRestockData] = useState({
    quantity: 0,
    costPrice: 0,
    notes: '',
  });

  // Calculate stock for each ingredient with batch details
  const ingredientStocks = useMemo(() => {
    const stockData: Array<{
      ingredient: Matiere;
      totalStock: number;
      batches: StockBatch[];
      totalValue: number;
      isLowStock: boolean;
      isOutOfStock: boolean;
    }> = [];

    matieres.forEach(matiere => {
      const ingredientBatches = stockBatches.filter(b => b.matiereId === matiere.id);
      const totalStock = ingredientBatches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
      const totalValue = ingredientBatches.reduce((sum, b) => sum + ((b.remainingQuantity || 0) * b.costPrice), 0);

      stockData.push({
        ingredient: matiere,
        totalStock,
        batches: ingredientBatches,
        totalValue,
        isLowStock: totalStock > 0 && totalStock < 10,
        isOutOfStock: totalStock === 0,
      });
    });

    return stockData;
  }, [matieres, stockBatches]);

  // Filter stocks
  const filteredStocks = useMemo(() => {
    let filtered = ingredientStocks;

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.ingredient.name.toLowerCase().includes(query) ||
        (s.ingredient.refCategorie && s.ingredient.refCategorie.toLowerCase().includes(query))
      );
    }

    // Filter by status
    if (filterStatus === 'low') {
      filtered = filtered.filter(s => s.isLowStock);
    } else if (filterStatus === 'out') {
      filtered = filtered.filter(s => s.isOutOfStock);
    }

    // Sort by stock level (lowest first)
    return filtered.sort((a, b) => a.totalStock - b.totalStock);
  }, [ingredientStocks, searchQuery, filterStatus]);

  // Stats
  const stats = useMemo(() => {
    const lowStock = ingredientStocks.filter(s => s.isLowStock).length;
    const outOfStock = ingredientStocks.filter(s => s.isOutOfStock).length;
    const totalValue = ingredientStocks.reduce((sum, s) => sum + s.totalValue, 0);

    return { lowStock, outOfStock, totalValue };
  }, [ingredientStocks]);

  const handleOpenRestock = (ingredient: Matiere) => {
    setSelectedIngredient(ingredient);
    setRestockData({
      quantity: 0,
      costPrice: ingredient.costPrice || 0,
      notes: '',
    });
    setIsRestockModalOpen(true);
  };

  const handleOpenHistory = (ingredient: Matiere) => {
    setSelectedIngredient(ingredient);
    setIsHistoryModalOpen(true);
  };

  const handleRestock = async () => {
    if (!selectedIngredient) return;

    if (restockData.quantity <= 0) {
      toast.error(t('quantity_required', language));
      return;
    }

    if (restockData.costPrice <= 0) {
      toast.error(t('cost_price_required', language));
      return;
    }

    setIsSubmitting(true);
    try {
      await restock(
        selectedIngredient.id!,
        restockData.quantity,
        restockData.costPrice,
        undefined,
        restockData.notes
      );
      toast.success(t('stock_added', language));
      setIsRestockModalOpen(false);
      setSelectedIngredient(null);
      setRestockData({ quantity: 0, costPrice: 0, notes: '' });
    } catch (error: any) {
      toast.error(error.message || t('error_adding_stock', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price) + ' XAF';
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const loading = matieresLoading || batchesLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="pb-20 md:pb-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('out_of_stock', language)}</p>
              <p className="text-2xl font-bold text-red-600">{stats.outOfStock}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle size={24} className="text-red-600" />
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
              <TrendingDown size={24} className="text-orange-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('total_stock_value', language)}</p>
              <p className="text-2xl font-bold text-green-600">{formatPrice(stats.totalValue)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp size={24} className="text-green-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t('stock_levels', language)}</h2>
          <p className="text-sm text-gray-500">{t('stock_levels_desc', language)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Input
            type="text"
            placeholder={t('search_stocks', language)}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'all' | 'low' | 'out')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">{t('all_stocks', language)}</option>
          <option value="low">{t('low_stock', language)}</option>
          <option value="out">{t('out_of_stock', language)}</option>
        </select>
      </div>

      {/* Stock List */}
      {filteredStocks.length === 0 ? (
        <Card className="p-8 text-center">
          <Boxes size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">
            {searchQuery || filterStatus !== 'all'
              ? t('no_stocks_match', language)
              : t('no_stocks', language)}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    {t('ingredient', language)}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    {t('category', language)}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    {t('current_stock', language)}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    {t('stock_value', language)}
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">
                    {t('status', language)}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    {t('actions', language)}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredStocks.map(stock => (
                  <tr key={stock.ingredient.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Package size={18} className="text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{stock.ingredient.name}</p>
                          <p className="text-xs text-gray-500">{stock.batches.length} {t('batches', language)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">
                        {stock.ingredient.refCategorie || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-medium ${
                        stock.isOutOfStock
                          ? 'text-red-600'
                          : stock.isLowStock
                          ? 'text-orange-600'
                          : 'text-gray-900'
                      }`}>
                        {stock.totalStock} {stock.ingredient.unit || ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-gray-900">{formatPrice(stock.totalValue)}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {stock.isOutOfStock ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          {t('out_of_stock', language)}
                        </span>
                      ) : stock.isLowStock ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                          {t('low_stock', language)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          {t('in_stock', language)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenRestock(stock.ingredient)}
                          className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title={t('add_stock', language)}
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={() => handleOpenHistory(stock.ingredient)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title={t('view_history', language)}
                        >
                          <History size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Restock Modal */}
      <Modal
        isOpen={isRestockModalOpen}
        onClose={() => {
          setIsRestockModalOpen(false);
          setSelectedIngredient(null);
          setRestockData({ quantity: 0, costPrice: 0, notes: '' });
        }}
        title={t('add_stock', language)}
      >
        {selectedIngredient && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">{t('ingredient', language)}</p>
              <p className="font-medium text-gray-900">{selectedIngredient.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('quantity', language)} ({selectedIngredient.unit || 'unit'}) *
                </label>
                <Input
                  type="number"
                  value={restockData.quantity || ''}
                  onChange={(e) => setRestockData(prev => ({
                    ...prev,
                    quantity: parseFloat(e.target.value) || 0
                  }))}
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('cost_price_per_unit', language)} (XAF) *
                </label>
                <Input
                  type="number"
                  value={restockData.costPrice || ''}
                  onChange={(e) => setRestockData(prev => ({
                    ...prev,
                    costPrice: parseFloat(e.target.value) || 0
                  }))}
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('notes', language)}
              </label>
              <textarea
                value={restockData.notes}
                onChange={(e) => setRestockData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder={t('notes_placeholder', language)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                rows={2}
              />
            </div>

            {restockData.quantity > 0 && restockData.costPrice > 0 && (
              <div className="p-4 bg-primary/5 rounded-lg">
                <p className="text-sm text-gray-600">{t('total_cost', language)}</p>
                <p className="text-lg font-bold text-primary">
                  {formatPrice(restockData.quantity * restockData.costPrice)}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              setIsRestockModalOpen(false);
              setSelectedIngredient(null);
              setRestockData({ quantity: 0, costPrice: 0, notes: '' });
            }}
          >
            {t('cancel', language)}
          </Button>
          <Button
            onClick={handleRestock}
            disabled={isSubmitting || restockData.quantity <= 0 || restockData.costPrice <= 0}
          >
            {isSubmitting ? t('adding', language) : t('add_stock', language)}
          </Button>
        </div>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setSelectedIngredient(null);
        }}
        title={t('stock_history', language)}
      >
        {selectedIngredient && (
          <div>
            <div className="p-4 bg-gray-50 rounded-lg mb-4">
              <p className="text-sm text-gray-500">{t('ingredient', language)}</p>
              <p className="font-medium text-gray-900">{selectedIngredient.name}</p>
            </div>

            <h4 className="text-sm font-medium text-gray-700 mb-2">{t('active_batches', language)}</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stockBatches
                .filter(b => b.matiereId === selectedIngredient.id)
                .map(batch => (
                  <div key={batch.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-gray-500">{formatDate(batch.createdAt)}</p>
                        <p className="font-medium">
                          {batch.remainingQuantity} / {batch.quantity} {selectedIngredient.unit || ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">{t('cost_price', language)}</p>
                        <p className="font-medium">{formatPrice(batch.costPrice)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              {stockBatches.filter(b => b.matiereId === selectedIngredient.id).length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">{t('no_batches', language)}</p>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              setIsHistoryModalOpen(false);
              setSelectedIngredient(null);
            }}
          >
            {t('close', language)}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default StocksPage;
