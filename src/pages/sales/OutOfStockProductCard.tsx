import React from 'react';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ImageWithSkeleton } from '@components/common';
import type { Product } from '../../types/models';

interface OutOfStockProductCardProps {
  product: Product;
  quantity: string;
}

const OutOfStockProductCard: React.FC<OutOfStockProductCardProps> = ({ product, quantity }) => {
  const { t } = useTranslation();
  
  return (
    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-orange-200">
          <ImageWithSkeleton
            src={product.images && product.images.length > 0 ? product.images[0] : '/placeholder.png'}
            alt={product.name}
            className="w-full h-full object-cover"
            placeholder="/placeholder.png"
          />
        </div>
        <div className="flex-1">
          <div className="font-medium text-gray-900">{product.name}</div>
          <div className="text-sm text-orange-600 font-medium flex items-center gap-1">
            <Info size={14} />
            {t('sales.modals.edit.products.outOfStock') || 'Out of stock'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {t('sales.modals.edit.products.currentStock') || 'Current stock'}: <span className="font-semibold text-red-600">0</span>
            {' | '}
            {t('sales.modals.edit.products.saleQuantity') || 'Sale quantity'}: <span className="font-semibold text-blue-600">{quantity}</span>
          </div>
        </div>
      </div>
      <div className="mt-2 text-xs text-orange-700 bg-orange-100 p-2 rounded">
        {t('sales.modals.edit.products.outOfStockWarning') || 'This product is currently out of stock. You cannot change the product selection, but you can adjust the quantity or remove it from the sale.'}
      </div>
    </div>
  );
};

export default OutOfStockProductCard;