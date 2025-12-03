import { Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ImageWithSkeleton } from '../common/ImageWithSkeleton';
import type { Product } from '../../types/models';

interface POSProductGridProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  categories: string[];
}

export const POSProductGrid: React.FC<POSProductGridProps> = ({
  products,
  onAddToCart,
  selectedCategory,
  onCategoryChange,
  categories,
}) => {
  const { t } = useTranslation();
  return (
    <div className="h-full flex flex-col">
      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
            <button
            onClick={() => onCategoryChange(null)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              selectedCategory === null
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {t('pos.products.all')}
          </button>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => onCategoryChange(category)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedCategory === category
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {category}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(product => (
              <button
                key={product.id}
                onClick={() => onAddToCart(product)}
                disabled={product.stock <= 0}
                className={`p-4 bg-white border-2 rounded-lg hover:border-emerald-500 transition-all text-left ${
                  product.stock <= 0
                    ? 'opacity-50 cursor-not-allowed border-gray-200'
                    : 'border-gray-200 hover:shadow-md'
                }`}
              >
                <div className="w-full h-32 mb-3 rounded overflow-hidden bg-gray-100">
                  <ImageWithSkeleton
                    src={product.images && product.images.length > 0 ? product.images[0] : '/placeholder.png'}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    placeholder="/placeholder.png"
                  />
                </div>
                <div className="font-medium text-sm mb-1 line-clamp-2">{product.name}</div>
                <div className="text-emerald-600 font-semibold mb-1">
                  {product.sellingPrice.toLocaleString()} XAF
                </div>
                <div className={`text-xs ${
                  product.stock <= 5
                    ? 'text-red-600 font-semibold'
                    : product.stock <= 10
                    ? 'text-orange-600'
                    : 'text-gray-600'
                }`}>
                  {t('pos.products.stock')}: {product.stock}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

