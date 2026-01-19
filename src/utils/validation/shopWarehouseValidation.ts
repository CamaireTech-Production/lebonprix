/**
 * Shop and Warehouse Validation Utilities
 * Provides validation functions for shop and warehouse operations
 */

import type { Shop, Warehouse, StockTransfer } from '../../types/models';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate shop data before creation/update
 */
export const validateShop = (shop: Partial<Shop>, isUpdate: boolean = false): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!isUpdate && !shop.name) {
    errors.push('Le nom de la boutique est requis');
  }

  if (!isUpdate && !shop.companyId) {
    errors.push('L\'ID de l\'entreprise est requis');
  }

  if (!isUpdate && !shop.userId) {
    errors.push('L\'ID de l\'utilisateur est requis');
  }

  // Name validation
  if (shop.name) {
    if (shop.name.trim().length === 0) {
      errors.push('Le nom de la boutique ne peut pas être vide');
    }
    if (shop.name.length > 100) {
      errors.push('Le nom de la boutique ne peut pas dépasser 100 caractères');
    }
  }

  // Address validation
  if (shop.address && shop.address.length > 200) {
    warnings.push('L\'adresse est très longue (plus de 200 caractères)');
  }

  // Phone validation
  if (shop.phone) {
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(shop.phone)) {
      warnings.push('Le format du numéro de téléphone semble invalide');
    }
  }

  // Email validation
  if (shop.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(shop.email)) {
      errors.push('Le format de l\'email est invalide');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Validate warehouse data before creation/update
 */
export const validateWarehouse = (warehouse: Partial<Warehouse>, isUpdate: boolean = false): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!isUpdate && !warehouse.name) {
    errors.push('Le nom de l\'entrepôt est requis');
  }

  if (!isUpdate && !warehouse.companyId) {
    errors.push('L\'ID de l\'entreprise est requis');
  }

  if (!isUpdate && !warehouse.userId) {
    errors.push('L\'ID de l\'utilisateur est requis');
  }

  // Name validation
  if (warehouse.name) {
    if (warehouse.name.trim().length === 0) {
      errors.push('Le nom de l\'entrepôt ne peut pas être vide');
    }
    if (warehouse.name.length > 100) {
      errors.push('Le nom de l\'entrepôt ne peut pas dépasser 100 caractères');
    }
  }

  // Address validation
  if (warehouse.address && warehouse.address.length > 200) {
    warnings.push('L\'adresse est très longue (plus de 200 caractères)');
  }

  // Phone validation
  if (warehouse.phone) {
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(warehouse.phone)) {
      warnings.push('Le format du numéro de téléphone semble invalide');
    }
  }

  // Email validation
  if (warehouse.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(warehouse.email)) {
      errors.push('Le format de l\'email est invalide');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Validate stock transfer data
 */
export const validateStockTransfer = (transfer: Partial<StockTransfer>): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!transfer.productId) {
    errors.push('L\'ID du produit est requis');
  }

  if (!transfer.quantity || transfer.quantity <= 0) {
    errors.push('La quantité doit être supérieure à 0');
  }

  if (!transfer.fromLocationType) {
    errors.push('Le type de source est requis');
  }

  if (!transfer.toLocationType) {
    errors.push('Le type de destination est requis');
  }

  // Quantity validation
  if (transfer.quantity && transfer.quantity > 1000000) {
    warnings.push('La quantité est très élevée (plus de 1,000,000)');
  }

  // Location validation
  if (transfer.fromLocationType === 'shop' && !transfer.fromShopId) {
    errors.push('L\'ID de la boutique source est requis');
  }

  if (transfer.fromLocationType === 'warehouse' && !transfer.fromWarehouseId) {
    errors.push('L\'ID de l\'entrepôt source est requis');
  }

  if (transfer.toLocationType === 'shop' && !transfer.toShopId) {
    errors.push('L\'ID de la boutique destination est requis');
  }

  if (transfer.toLocationType === 'warehouse' && !transfer.toWarehouseId) {
    errors.push('L\'ID de l\'entrepôt destination est requis');
  }

  // Prevent same location transfers
  if (
    transfer.fromLocationType === transfer.toLocationType &&
    transfer.fromShopId === transfer.toShopId &&
    transfer.fromWarehouseId === transfer.toWarehouseId
  ) {
    errors.push('La source et la destination ne peuvent pas être identiques');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Validate shop ID exists and belongs to company
 */
export const validateShopAccess = async (
  shopId: string,
  companyId: string,
  getShopById: (id: string) => Promise<Shop | null>
): Promise<ValidationResult> => {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const shop = await getShopById(shopId);
    if (!shop) {
      errors.push('La boutique spécifiée n\'existe pas');
      return { isValid: false, errors, warnings };
    }

    if (shop.companyId !== companyId) {
      errors.push('La boutique n\'appartient pas à cette entreprise');
    }

    if (shop.isDeleted) {
      errors.push('La boutique a été supprimée');
    }
  } catch (error) {
    errors.push('Erreur lors de la validation de la boutique');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Validate warehouse ID exists and belongs to company
 */
export const validateWarehouseAccess = async (
  warehouseId: string,
  companyId: string,
  getWarehouseById: (id: string) => Promise<Warehouse | null>
): Promise<ValidationResult> => {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const warehouse = await getWarehouseById(warehouseId);
    if (!warehouse) {
      errors.push('L\'entrepôt spécifié n\'existe pas');
      return { isValid: false, errors, warnings };
    }

    if (warehouse.companyId !== companyId) {
      errors.push('L\'entrepôt n\'appartient pas à cette entreprise');
    }

    if (warehouse.isDeleted) {
      errors.push('L\'entrepôt a été supprimé');
    }
  } catch (error) {
    errors.push('Erreur lors de la validation de l\'entrepôt');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

