import { 
  restaurantRepo, 
  categoryRepo, 
  dishRepo, 
  orderRepo, 
  mediaRepo, 
  activityLogRepo,
  firestoreUtils 
} from '../data/firestore';
import { Restaurant, Category, Dish, Order, MediaItem, ActivityLog } from '../types';

// Service layer that provides business logic and validation
export class FirestoreService {
  // Restaurant operations
  static async getRestaurant(id: string): Promise<Restaurant | null> {
    return firestoreUtils.withRetry(() => restaurantRepo.getById(id));
  }

  static async getRestaurantByEmail(email: string): Promise<Restaurant | null> {
    return firestoreUtils.withRetry(() => restaurantRepo.getByEmail(email));
  }

  static async getRestaurantByUid(uid: string): Promise<Restaurant | null> {
    return firestoreUtils.withRetry(() => restaurantRepo.getByUid(uid));
  }

  static async createRestaurant(data: Omit<Restaurant, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return firestoreUtils.withRetry(() => restaurantRepo.create(data));
  }

  static async updateRestaurant(id: string, data: Partial<Restaurant>): Promise<void> {
    return firestoreUtils.withRetry(() => restaurantRepo.update(id, data));
  }

  // Category operations
  static async getCategories(restaurantId: string): Promise<Category[]> {
    return firestoreUtils.withRetry(() => categoryRepo.getByRestaurant(restaurantId));
  }

  static async getActiveCategories(restaurantId: string): Promise<Category[]> {
    return firestoreUtils.withRetry(() => categoryRepo.getActiveByRestaurant(restaurantId));
  }

  static async getMainCategories(restaurantId: string): Promise<Category[]> {
    return firestoreUtils.withRetry(() => categoryRepo.getMainCategories(restaurantId));
  }

  static async getSubcategories(restaurantId: string, parentId: string): Promise<Category[]> {
    return firestoreUtils.withRetry(() => categoryRepo.getSubcategories(restaurantId, parentId));
  }

  static async createCategory(restaurantId: string, data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return firestoreUtils.withRetry(() => categoryRepo.create(data, restaurantId));
  }

  static async updateCategory(restaurantId: string, id: string, data: Partial<Category>): Promise<void> {
    return firestoreUtils.withRetry(() => categoryRepo.update(id, data, restaurantId));
  }

  static async deleteCategory(restaurantId: string, id: string): Promise<void> {
    return firestoreUtils.withRetry(() => categoryRepo.delete(id, restaurantId));
  }

  // Dish operations
  static async getDishes(restaurantId: string): Promise<Dish[]> {
    return firestoreUtils.withRetry(() => dishRepo.getByRestaurant(restaurantId));
  }

  static async getActiveDishes(restaurantId: string): Promise<Dish[]> {
    return firestoreUtils.withRetry(() => dishRepo.getActiveByRestaurant(restaurantId));
  }

  static async getDishesByCategory(restaurantId: string, categoryId: string): Promise<Dish[]> {
    return firestoreUtils.withRetry(() => dishRepo.getByCategory(restaurantId, categoryId));
  }

  static async searchDishes(restaurantId: string, searchTerm: string): Promise<Dish[]> {
    return firestoreUtils.withRetry(() => dishRepo.searchByRestaurant(restaurantId, searchTerm));
  }

  static async createDish(restaurantId: string, data: Omit<Dish, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return firestoreUtils.withRetry(() => dishRepo.create(data, restaurantId));
  }

  static async updateDish(restaurantId: string, id: string, data: Partial<Dish>): Promise<void> {
    return firestoreUtils.withRetry(() => dishRepo.update(id, data, restaurantId));
  }

  static async deleteDish(restaurantId: string, id: string): Promise<void> {
    return firestoreUtils.withRetry(() => dishRepo.delete(id, restaurantId));
  }

  // Order operations
  static async getOrders(restaurantId: string): Promise<Order[]> {
    return firestoreUtils.withRetry(() => orderRepo.getByRestaurant(restaurantId));
  }

  static async getOrdersByTable(restaurantId: string, tableNumber: number): Promise<Order[]> {
    return firestoreUtils.withRetry(() => orderRepo.getByTable(restaurantId, tableNumber));
  }

  static async getOrdersByStatus(restaurantId: string, status: Order['status']): Promise<Order[]> {
    return firestoreUtils.withRetry(() => orderRepo.getByStatus(restaurantId, status));
  }

  static async getFilteredOrders(
    restaurantId: string,
    filters: {
      tableNumber?: number;
      status?: Order['status'];
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<Order[]> {
    return firestoreUtils.withRetry(() => orderRepo.getFiltered(restaurantId, filters));
  }

  static async createOrder(restaurantId: string, data: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return firestoreUtils.withRetry(() => orderRepo.create(data, restaurantId));
  }

  static async updateOrder(restaurantId: string, id: string, data: Partial<Order>): Promise<void> {
    return firestoreUtils.withRetry(() => orderRepo.update(id, data, restaurantId));
  }

  static async updateOrderStatus(restaurantId: string, id: string, status: Order['status']): Promise<void> {
    return firestoreUtils.withRetry(() => orderRepo.update(id, { status }, restaurantId));
  }

  // Real-time subscriptions
  static subscribeToTableOrders(
    restaurantId: string,
    tableNumber: number,
    callback: (orders: Order[]) => void
  ): () => void {
    return orderRepo.subscribeToTableOrders(restaurantId, tableNumber, callback);
  }

  static subscribeToAllOrders(
    restaurantId: string,
    callback: (orders: Order[]) => void
  ): () => void {
    return orderRepo.subscribeToAllOrders(restaurantId, callback);
  }

  // Media operations
  static async getMedia(restaurantId: string): Promise<MediaItem[]> {
    return firestoreUtils.withRetry(() => mediaRepo.getByRestaurant(restaurantId));
  }

  static async getMediaByType(restaurantId: string, type: MediaItem['type']): Promise<MediaItem[]> {
    return firestoreUtils.withRetry(() => mediaRepo.getByType(restaurantId, type));
  }

  static async searchMedia(restaurantId: string, searchTerm: string): Promise<MediaItem[]> {
    return firestoreUtils.withRetry(() => mediaRepo.searchByRestaurant(restaurantId, searchTerm));
  }

  static async createMedia(restaurantId: string, data: Omit<MediaItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return firestoreUtils.withRetry(() => mediaRepo.create(data, restaurantId));
  }

  static async updateMedia(restaurantId: string, id: string, data: Partial<MediaItem>): Promise<void> {
    return firestoreUtils.withRetry(() => mediaRepo.update(id, data, restaurantId));
  }

  static async deleteMedia(restaurantId: string, id: string): Promise<void> {
    return firestoreUtils.withRetry(() => mediaRepo.delete(id, restaurantId));
  }

  // Activity log operations
  static async logActivity(data: Omit<ActivityLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return firestoreUtils.withRetry(() => activityLogRepo.create(data));
  }

  static async getActivityLogsByUser(userId: string): Promise<ActivityLog[]> {
    return firestoreUtils.withRetry(() => activityLogRepo.getByUser(userId));
  }

  static async getActivityLogsByEntity(entityType: string, entityId: string): Promise<ActivityLog[]> {
    return firestoreUtils.withRetry(() => activityLogRepo.getByEntity(entityType, entityId));
  }

  // Batch operations
  static async executeBatch(operations: Array<{
    type: 'create' | 'update' | 'delete';
    collection: string;
    docId?: string;
    data?: Record<string, any>;
    restaurantId?: string;
  }>): Promise<void> {
    return firestoreUtils.withRetry(() => firestoreUtils.executeBatch(operations));
  }

  // Validation helpers
  static async validateRestaurantAccess(restaurantId: string, userId: string): Promise<boolean> {
    return firestoreUtils.withRetry(() => firestoreUtils.validateRestaurantAccess(restaurantId, userId));
  }
}

// Export the service as default
export default FirestoreService;
