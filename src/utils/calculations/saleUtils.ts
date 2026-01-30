import { showErrorToast } from '@utils/core/toast';
import { normalizePhoneNumber } from '@utils/core/phoneUtils';
import type { OrderStatus, PaymentStatus, SaleProduct } from '../../types/models';

type TranslationFunction = (key: string) => string;

export interface SaleDataInput {
  products?: SaleProduct[];
  totalAmount?: number;
  userId?: string;
  companyId?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  customerInfo?: {
    name?: string;
    phone?: string;
    quarter?: string;
  };
  deliveryFee?: number;
  inventoryMethod?: 'FIFO' | 'LIFO' | 'CMUP' | 'fifo' | 'lifo' | 'cmup';
  saleDate?: string;
  createdAt?: any; // Timestamp or Date
  [key: string]: any; // Allow other fields
}

export interface NormalizedSaleData {
  products: SaleProduct[];
  totalAmount: number;
  userId: string;
  companyId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  customerInfo: {
    name: string;
    phone: string;
    quarter?: string;
  };
  deliveryFee: number;
  inventoryMethod: 'FIFO' | 'LIFO' | 'CMUP';
  createdAt?: any;
  [key: string]: any; // Allow other fields
}

/**
 * Validates sale data and shows toast notifications for missing required fields
 * @param data - Sale data to validate
 * @param t - Translation function (optional, will use default messages if not provided)
 * @param showToasts - Whether to show toast notifications (default: true)
 * @returns true if valid, false otherwise
 */
export const validateSaleData = (
  data: SaleDataInput,
  t?: TranslationFunction,
  showToasts: boolean = true
): boolean => {
  const errors: string[] = [];

  // Validate products
  if (!data.products || !Array.isArray(data.products) || data.products.length === 0) {
    errors.push('productsRequired');
  } else {
    // Validate each product has required fields
    for (let i = 0; i < data.products.length; i++) {
      const product = data.products[i];
      if (!product.productId) {
        errors.push(`productXMissingId`);
      }
      if (product.quantity === undefined || product.quantity <= 0) {
        errors.push(`productXInvalidQuantity`);
      }
      if (product.basePrice === undefined || product.basePrice < 0) {
        errors.push(`productXInvalidPrice`);
      }
    }
  }

  // Validate totalAmount
  if (data.totalAmount === undefined || data.totalAmount < 0) {
    errors.push('totalAmountRequired');
  }

  // Validate userId
  if (!data.userId) {
    errors.push('userIdRequired');
  }

  // Validate companyId
  if (!data.companyId) {
    errors.push('companyIdRequired');
  }

  // Show toasts for errors
  if (showToasts && errors.length > 0) {
    errors.forEach(error => {
      let message = '';
      if (t) {
        // Use translation if provided
        message = t(`sales.validation.${error}`);
      }
      
      // Fallback to default messages
      if (!message) {
        switch (error) {
          case 'productsRequired':
            message = 'At least one product is required';
            break;
          case 'totalAmountRequired':
            message = 'Total amount is required and must be >= 0';
            break;
          case 'userIdRequired':
            message = 'User ID is required';
            break;
          case 'companyIdRequired':
            message = 'Company ID is required';
            break;
          case 'productXMissingId':
            message = 'Product ID is required for all products';
            break;
          case 'productXInvalidQuantity':
            message = 'Product quantity must be greater than 0';
            break;
          case 'productXInvalidPrice':
            message = 'Product base price must be >= 0';
            break;
        }
      }
      
      if (message) {
        showErrorToast(message);
      }
    });
  }

  return errors.length === 0;
};

/**
 * Normalizes sale data by applying default values for missing fields
 * @param data - Sale data to normalize
 * @param userId - User ID (will be added if not in data)
 * @param companyId - Company ID (will be added if not in data)
 * @returns Normalized sale data with all required fields and defaults
 */
export const normalizeSaleData = (
  data: SaleDataInput,
  userId: string,
  companyId: string
): NormalizedSaleData => {
  // Normalize inventoryMethod to uppercase
  const normalizeInventoryMethod = (method?: string): 'FIFO' | 'LIFO' | 'CMUP' => {
    if (!method) return 'FIFO';
    const upper = method.toUpperCase();
    if (upper === 'LIFO') return 'LIFO';
    if (upper === 'CMUP') return 'CMUP';
    return 'FIFO';
  };

  // Normalize sale data with defaults
  const normalizedInventoryMethod = normalizeInventoryMethod(data.inventoryMethod);
  const { inventoryMethod: _, ...restData } = data; // Remove inventoryMethod from spread
  const normalized: NormalizedSaleData = {
    ...restData, // Keep all other fields first
    products: data.products || [],
    totalAmount: data.totalAmount ?? 0,
    userId: data.userId || userId,
    companyId: data.companyId || companyId,
    status: (data.status || 'paid') as OrderStatus,
    paymentStatus: (data.paymentStatus || 'paid') as PaymentStatus,
    customerInfo: {
      name: (data.customerInfo?.name || 'Client de passage') as string,
      phone: data.customerInfo?.phone ? normalizePhoneNumber(data.customerInfo.phone) : '',
      quarter: data.customerInfo?.quarter,
    },
    deliveryFee: data.deliveryFee ?? 0,
    inventoryMethod: normalizedInventoryMethod, // Override with normalized value
  };

  // Handle saleDate conversion if provided
  if (data.saleDate && !data.createdAt) {
    // saleDate is ISO string, will be converted to timestamp in createSale
    normalized.saleDate = data.saleDate;
  }

  return normalized;
};

