import React, { useMemo } from 'react';
import { Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ImageWithSkeleton from '../common/ImageWithSkeleton';
import type { Product } from '../../types/models';
import { getEffectiveProductStock, type ProductStockTotals } from '@utils/inventory/stockHelpers';

interface POSProductGridProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  categories: string[];
  stockMap: Map<string, ProductStockTotals>;
}

export const POSProductGrid: React.FC<POSProductGridProps> = ({
  products,
  onAddToCart,
  selectedCategory,
  onCategoryChange,
  categories,
  stockMap,
}) => {
  const { t } = useTranslation();

  // Calculate product count per category (only counting products with stock > 0)
  const categoryProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    
    products.forEach(product => {
      if (product.category && product.isAvailable !== false) {
        const stock = getEffectiveProductStock(product, stockMap);
        if (stock > 0) {
          counts[product.category] = (counts[product.category] || 0) + 1;
        }
      }
    });
    
    return counts;
  }, [products, stockMap]);

  return (
    <div className="h-full flex flex-col">
      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="mb-4 flex flex-nowrap gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-400">
            <button
            onClick={() => onCategoryChange(null)}
            className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
              selectedCategory === null
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {t('pos.products.all')} ({products.filter(p => p.isAvailable !== false && getEffectiveProductStock(p, stockMap) > 0).length})
          </button>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => onCategoryChange(category)}
              className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                selectedCategory === category
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {category} ({categoryProductCounts[category] || 0})
            </button>
          ))}
        </div>
      )}

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Package size={48} className="mb-4 opacity-50" />
            <p>{t('pos.products.noProducts')}</p>
          </div>
        ) : (
          <div 
            className="grid gap-3"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 140px), 1fr))'
            }}
          >
            {products.map(product => {
              const stock = getEffectiveProductStock(product, stockMap);
              return (
                <button
                  key={product.id}
                  onClick={() => onAddToCart(product)}
                  disabled={stock <= 0}
                  className={`p-3 bg-white border-2 rounded-lg hover:border-emerald-500 transition-all text-left flex flex-col ${
                    stock <= 0
                      ? 'opacity-50 cursor-not-allowed border-gray-200'
                      : 'border-gray-200 hover:shadow-md'
                  }`}
                >
                  <div className="w-full h-28 mb-2 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                    <ImageWithSkeleton
                      src={product.images && product.images.length > 0 ? product.images[0] : '/placeholder.png'}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      placeholder="/placeholder.png"
                    />
                  </div>
                  <div className="font-medium text-xs mb-1 line-clamp-2 flex-grow">{product.name}</div>
                  <div className="text-emerald-600 font-semibold text-sm mb-1">
                    {product.sellingPrice.toLocaleString()} XAF
                  </div>
                  <div className={`text-xs ${
                    stock <= 5
                      ? 'text-red-600 font-semibold'
                      : stock <= 10
                      ? 'text-orange-600'
                      : 'text-gray-600'
                  }`}>
                    {t('pos.products.stock')}: {stock}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

