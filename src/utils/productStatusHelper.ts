import type { Product } from '../types/models';

export interface ProductStatus {
  isAvailable: boolean;
  isDeleted: boolean;
  statusText: string;
  statusColor: string;
  allowEdit: boolean;
  allowSelect: boolean;
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
}

/**
 * Determines the status of a product for UI display and interaction
 */
export const getProductStatus = (product: Product | null | undefined): ProductStatus => {
  if (!product) {
    return {
      isAvailable: false,
      isDeleted: true,
      statusText: '(Not Found)',
      statusColor: 'text-red-600',
      allowEdit: false,
      allowSelect: false,
      badgeVariant: 'destructive'
    };
  }

  if (product.isDeleted === true) {
    return {
      isAvailable: false,
      isDeleted: true,
      statusText: '(Deleted)',
      statusColor: 'text-red-600',
      allowEdit: false,
      allowSelect: false,
      badgeVariant: 'destructive'
    };
  }
  
  if (product.isAvailable === false) {
    return {
      isAvailable: false,
      isDeleted: false,
      statusText: '(Inactive)',
      statusColor: 'text-orange-600',
      allowEdit: true, // Can be reactivated
      allowSelect: false, // Don't allow selection in new sales
      badgeVariant: 'secondary'
    };
  }
  
  if (product.isAvailable === undefined) {
    return {
      isAvailable: false,
      isDeleted: false,
      statusText: '(Status Unknown)',
      statusColor: 'text-gray-600',
      allowEdit: true,
      allowSelect: false,
      badgeVariant: 'outline'
    };
  }
  
  return {
    isAvailable: true,
    isDeleted: false,
    statusText: '',
    statusColor: 'text-green-600',
    allowEdit: true,
    allowSelect: true,
    badgeVariant: 'default'
  };
};

/**
 * Checks if a sale can be edited based on its products
 */
export const canEditSale = (sale: any, products: Product[]): boolean => {
  if (!sale.products || !Array.isArray(sale.products)) {
    return true;
  }
  
  return !sale.products.some((saleProduct: any) => {
    const product = products.find(p => p.id === saleProduct.productId);
    const status = getProductStatus(product);
    return !status.allowEdit;
  });
};

/**
 * Filters products for dropdown selection (excludes deleted/inactive)
 */
export const filterProductsForSelection = (products: Product[]): Product[] => {
  return products.filter(product => {
    const status = getProductStatus(product);
    return status.allowSelect;
  });
};

/**
 * Gets products referenced in a sale with their status
 */
export const getSaleProductsWithStatus = (sale: any, allProducts: Product[]) => {
  if (!sale.products || !Array.isArray(sale.products)) {
    return [];
  }
  
  return sale.products.map((saleProduct: any) => {
    const product = allProducts.find(p => p.id === saleProduct.productId);
    const status = getProductStatus(product);
    
    return {
      ...saleProduct,
      product,
      status
    };
  });
};

/**
 * Formats product name with status for display
 */
export const formatProductNameWithStatus = (product: Product | null | undefined): string => {
  const status = getProductStatus(product);
  const productName = product?.name || 'Unknown Product';
  
  return status.statusText ? `${productName} ${status.statusText}` : productName;
};
