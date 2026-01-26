// POS Draft Storage Utility
// Handles saving and restoring POS drafts to localStorage

import type { POSDraft, POSCartItem, POSCustomerInfo, POSOrderType } from '../../types/pos';
import type { Dish } from '../../types/index';

const STORAGE_KEY = 'restoflow_pos_drafts';

interface StoredDraft {
  id: string;
  restaurantId: string;
  userId: string;
  cart: Array<{
    dishId: string;
    dishTitle: string;
    dishPrice: number;
    dishImage?: string;
    dishCategoryId: string;
    quantity: number;
    specialInstructions?: string;
    modifiedPrice?: number;
  }>;
  customer: POSCustomerInfo | null;
  tableId?: string;
  tableNumber?: number;
  orderType: POSOrderType;
  tip: number;
  deliveryFee: number;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Get all drafts from localStorage
 */
function getAllDrafts(): StoredDraft[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as StoredDraft[];
  } catch (error) {
    console.error('Error reading POS drafts from localStorage:', error);
    return [];
  }
}

/**
 * Save all drafts to localStorage
 */
function saveAllDrafts(drafts: StoredDraft[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.error('Error saving POS drafts to localStorage:', error);
  }
}

/**
 * Generate a unique draft ID
 */
function generateDraftId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Save a new draft or update existing one
 */
export function saveDraft(
  restaurantId: string,
  userId: string,
  cart: POSCartItem[],
  customer: POSCustomerInfo | null,
  tableId: string | undefined,
  tableNumber: number | undefined,
  orderType: POSOrderType,
  tip: number,
  deliveryFee: number,
  notes: string,
  existingDraftId?: string
): POSDraft {
  const drafts = getAllDrafts();
  const now = Date.now();

  // Convert cart items to storable format (without full Dish objects)
  const storableCart = cart.map(item => ({
    dishId: item.dish.id,
    dishTitle: item.dish.title,
    dishPrice: item.dish.price,
    dishImage: item.dish.image,
    dishCategoryId: item.dish.categoryId,
    quantity: item.quantity,
    specialInstructions: item.specialInstructions,
    modifiedPrice: item.modifiedPrice,
  }));

  const draftId = existingDraftId || generateDraftId();

  const newDraft: StoredDraft = {
    id: draftId,
    restaurantId,
    userId,
    cart: storableCart,
    customer,
    tableId,
    tableNumber,
    orderType,
    tip,
    deliveryFee,
    notes,
    createdAt: existingDraftId ? (drafts.find(d => d.id === existingDraftId)?.createdAt || now) : now,
    updatedAt: now,
  };

  // Remove existing draft with same ID if updating
  const filteredDrafts = drafts.filter(d => d.id !== draftId);

  // Add the new/updated draft
  filteredDrafts.push(newDraft);

  // Save back to localStorage
  saveAllDrafts(filteredDrafts);

  // Return the draft in the full POSDraft format (will need dishes to be rehydrated later)
  return {
    id: newDraft.id,
    restaurantId: newDraft.restaurantId,
    userId: newDraft.userId,
    cart: [], // Will be rehydrated when loading
    customer: newDraft.customer,
    tableId: newDraft.tableId,
    tableNumber: newDraft.tableNumber,
    orderType: newDraft.orderType,
    tip: newDraft.tip,
    deliveryFee: newDraft.deliveryFee,
    notes: newDraft.notes,
    createdAt: newDraft.createdAt,
    updatedAt: newDraft.updatedAt,
  };
}

/**
 * Get drafts for a specific restaurant and user
 */
export function getDrafts(restaurantId: string, userId: string, dishes: Dish[]): POSDraft[] {
  const allDrafts = getAllDrafts();

  // Filter by restaurant and user
  const userDrafts = allDrafts.filter(
    d => d.restaurantId === restaurantId && d.userId === userId
  );

  // Create a map of dishes for quick lookup
  const dishMap = new Map<string, Dish>();
  dishes.forEach(dish => dishMap.set(dish.id, dish));

  // Rehydrate drafts with full Dish objects
  return userDrafts.map(stored => {
    const hydratedCart: POSCartItem[] = stored.cart
      .map(item => {
        const dish = dishMap.get(item.dishId);
        if (!dish) {
          // Dish no longer exists, create a placeholder
          return {
            dish: {
              id: item.dishId,
              title: item.dishTitle,
              price: item.dishPrice,
              image: item.dishImage,
              categoryId: item.dishCategoryId,
              status: 'inactive' as const,
              restaurantId: stored.restaurantId,
              createdAt: null,
            },
            quantity: item.quantity,
            specialInstructions: item.specialInstructions,
            modifiedPrice: item.modifiedPrice,
          };
        }
        return {
          dish,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions,
          modifiedPrice: item.modifiedPrice,
        };
      });

    return {
      id: stored.id,
      restaurantId: stored.restaurantId,
      userId: stored.userId,
      cart: hydratedCart,
      customer: stored.customer,
      tableId: stored.tableId,
      tableNumber: stored.tableNumber,
      orderType: stored.orderType,
      tip: stored.tip,
      deliveryFee: stored.deliveryFee,
      notes: stored.notes,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
    };
  }).sort((a, b) => b.updatedAt - a.updatedAt); // Most recently updated first
}

/**
 * Get a single draft by ID
 */
export function getDraftById(draftId: string, dishes: Dish[]): POSDraft | null {
  const allDrafts = getAllDrafts();
  const stored = allDrafts.find(d => d.id === draftId);

  if (!stored) return null;

  // Create a map of dishes for quick lookup
  const dishMap = new Map<string, Dish>();
  dishes.forEach(dish => dishMap.set(dish.id, dish));

  // Rehydrate cart with full Dish objects
  const hydratedCart: POSCartItem[] = stored.cart
    .map(item => {
      const dish = dishMap.get(item.dishId);
      if (!dish) {
        return {
          dish: {
            id: item.dishId,
            title: item.dishTitle,
            price: item.dishPrice,
            image: item.dishImage,
            categoryId: item.dishCategoryId,
            status: 'inactive' as const,
            restaurantId: stored.restaurantId,
            createdAt: null,
          },
          quantity: item.quantity,
          specialInstructions: item.specialInstructions,
          modifiedPrice: item.modifiedPrice,
        };
      }
      return {
        dish,
        quantity: item.quantity,
        specialInstructions: item.specialInstructions,
        modifiedPrice: item.modifiedPrice,
      };
    });

  return {
    id: stored.id,
    restaurantId: stored.restaurantId,
    userId: stored.userId,
    cart: hydratedCart,
    customer: stored.customer,
    tableId: stored.tableId,
    tableNumber: stored.tableNumber,
    orderType: stored.orderType,
    tip: stored.tip,
    deliveryFee: stored.deliveryFee,
    notes: stored.notes,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

/**
 * Delete a draft by ID
 */
export function deleteDraft(draftId: string): boolean {
  const drafts = getAllDrafts();
  const filteredDrafts = drafts.filter(d => d.id !== draftId);

  if (filteredDrafts.length === drafts.length) {
    return false; // Draft not found
  }

  saveAllDrafts(filteredDrafts);
  return true;
}

/**
 * Delete all drafts for a restaurant/user
 */
export function clearDrafts(restaurantId: string, userId: string): void {
  const drafts = getAllDrafts();
  const filteredDrafts = drafts.filter(
    d => !(d.restaurantId === restaurantId && d.userId === userId)
  );
  saveAllDrafts(filteredDrafts);
}

/**
 * Get draft count for a restaurant/user
 */
export function getDraftCount(restaurantId: string, userId: string): number {
  const allDrafts = getAllDrafts();
  return allDrafts.filter(
    d => d.restaurantId === restaurantId && d.userId === userId
  ).length;
}

/**
 * Clean up old drafts (older than 7 days)
 */
export function cleanupOldDrafts(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): number {
  const drafts = getAllDrafts();
  const cutoff = Date.now() - maxAgeMs;
  const filteredDrafts = drafts.filter(d => d.updatedAt > cutoff);
  const removedCount = drafts.length - filteredDrafts.length;

  if (removedCount > 0) {
    saveAllDrafts(filteredDrafts);
  }

  return removedCount;
}
