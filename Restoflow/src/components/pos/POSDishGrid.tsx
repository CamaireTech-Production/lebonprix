// POSDishGrid - Dish selection grid for POS
import React, { useState } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import type { Dish, Category } from '../../types/index';

interface POSDishGridProps {
  dishes: Dish[];
  categories: Category[];
  searchQuery: string;
  selectedCategory: string | null;
  onSearchChange: (query: string) => void;
  onCategoryChange: (categoryId: string | null) => void;
  onAddToCart: (dish: Dish, quantity?: number, specialInstructions?: string) => void;
}

const POSDishGrid: React.FC<POSDishGridProps> = ({
  dishes,
  categories,
  searchQuery,
  selectedCategory,
  onSearchChange,
  onCategoryChange,
  onAddToCart,
}) => {
  const { language } = useLanguage();
  const [instructionsModal, setInstructionsModal] = useState<{ dish: Dish; open: boolean } | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Count dishes per category
  const categoryDishCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    dishes.forEach(dish => {
      if (dish.categoryId) {
        counts[dish.categoryId] = (counts[dish.categoryId] || 0) + 1;
      }
    });
    return counts;
  }, [dishes]);

  const handleDishClick = (dish: Dish) => {
    onAddToCart(dish, 1);
  };

  const handleDishLongPress = (dish: Dish) => {
    setInstructionsModal({ dish, open: true });
    setSpecialInstructions('');
  };

  const handleAddWithInstructions = () => {
    if (instructionsModal?.dish) {
      onAddToCart(instructionsModal.dish, 1, specialInstructions || undefined);
      setInstructionsModal(null);
      setSpecialInstructions('');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price) + ' XAF';
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Search */}
      <div className="p-3 bg-white border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('pos_search_dishes', language) || 'Search dishes...'}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="p-2 bg-white border-b overflow-x-auto">
        <div className="flex space-x-2">
          <button
            onClick={() => onCategoryChange(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === null
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('all', language) || 'All'} ({dishes.length})
          </button>
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => onCategoryChange(category.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === category.id
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.title} ({categoryDishCounts[category.id] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Dishes Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {dishes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            {searchQuery
              ? t('no_dishes_found', language) || 'No dishes found'
              : t('no_dishes', language) || 'No dishes available'}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {dishes.map(dish => (
              <button
                key={dish.id}
                onClick={() => handleDishClick(dish)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleDishLongPress(dish);
                }}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md hover:border-primary/50 transition-all text-left group"
              >
                {/* Dish Image */}
                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                  {dish.image ? (
                    <img
                      src={dish.image}
                      alt={dish.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <span className="text-4xl">🍽️</span>
                    </div>
                  )}
                  {/* Quick add overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-white p-2 rounded-full">
                      <Plus size={20} />
                    </div>
                  </div>
                </div>

                {/* Dish Info */}
                <div className="p-2">
                  <h3 className="font-medium text-gray-900 text-sm truncate">{dish.title}</h3>
                  <p className="text-primary font-semibold text-sm mt-1">{formatPrice(dish.price)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Special Instructions Modal */}
      {instructionsModal?.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">
                {t('pos_special_instructions', language) || 'Special Instructions'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">{instructionsModal.dish.title}</p>
            </div>

            <div className="p-4">
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder={t('pos_instructions_placeholder', language) || 'e.g., No onions, extra spicy...'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                rows={3}
              />
            </div>

            <div className="p-4 border-t flex justify-end space-x-3">
              <button
                onClick={() => setInstructionsModal(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {t('cancel', language) || 'Cancel'}
              </button>
              <button
                onClick={handleAddWithInstructions}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                {t('pos_add_to_cart', language) || 'Add to Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSDishGrid;
