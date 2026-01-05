import { useTranslation } from 'react-i18next';
import { useCompanyColors } from '@hooks/business/useCompanyColors';
import Card from '../common/Card';
import { ExternalLink } from 'lucide-react';
import type { Product } from '../../types/models';

interface BestProduct {
  productId: string;
  name: string;
  image?: string;
  orders: number;
  revenue: number;
}

interface BestProductsListProps {
  products: BestProduct[];
  allProducts?: Product[];
  onViewAll?: () => void;
  className?: string;
}

const BestProductsList = ({ products, allProducts = [], onViewAll, className = '' }: BestProductsListProps) => {
  const { t } = useTranslation();
  const colors = useCompanyColors();

  const getProductImage = (productId: string) => {
    const product = allProducts.find(p => p.id === productId);
    return product?.image || product?.images?.[0] || null;
  };

  return (
    <Card className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{color: colors.primary}}>
          {t('dashboard.bestProducts.title', { defaultValue: 'Meilleurs produits' })}
        </h3>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            {t('dashboard.bestProducts.viewAll', { defaultValue: 'Tout voir' })}
            <ExternalLink size={14} />
          </button>
        )}
      </div>
      <div className="space-y-3">
        {products.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            {t('dashboard.bestProducts.noData', { defaultValue: 'Aucun produit' })}
          </p>
        ) : (
          products.map((product, index) => {
            const productImage = getProductImage(product.productId);
            return (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                {productImage ? (
                  <img
                    src={productImage}
                    alt={product.name}
                    className="w-12 h-12 rounded object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center">
                    <span className="text-xs text-gray-400">No img</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {product.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {product.orders} {t('dashboard.bestProducts.orders', { defaultValue: 'Commandes' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold" style={{color: colors.primary}}>
                    {product.revenue.toLocaleString()} FCFA
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};

export default BestProductsList;

