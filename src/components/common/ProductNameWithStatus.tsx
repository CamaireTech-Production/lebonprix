import React from 'react';
import { Badge } from '@components/common';
import { getProductStatus, formatProductNameWithStatus } from '@utils/productStatusHelper';
import type { Product } from '../../types/models';

interface ProductNameWithStatusProps {
  product: Product | null | undefined;
  showStatus?: boolean;
  className?: string;
}

/**
 * Displays product name with status badge for deleted/inactive products
 * Used in sales lists, edit forms, and other contexts where product status matters
 */
export const ProductNameWithStatus: React.FC<ProductNameWithStatusProps> = ({
  product,
  showStatus = true,
  className = ''
}) => {
  const status = getProductStatus(product);
  
  if (!product) {
    return (
      <span className={`text-red-600 ${className}`}>
        Product Not Found
      </span>
    );
  }

  const getBadgeVariant = () => {
    switch (status.badgeVariant) {
      case 'destructive': return 'error' as const;
      case 'secondary': return 'warning' as const;
      case 'outline': return 'info' as const;
      default: return 'default' as const;
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={status.statusColor}>
        {product.name}
      </span>
      {showStatus && status.statusText && (
        <Badge variant={getBadgeVariant()} className="text-xs">
          {status.statusText}
        </Badge>
      )}
    </div>
  );
};

export default ProductNameWithStatus;
