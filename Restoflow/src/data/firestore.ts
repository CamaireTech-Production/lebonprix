import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import type { 
  WriteBatch,
  QueryConstraint
} from 'firebase/firestore';
import { ValidationError, validateFirestoreDocument } from '../utils/validation';
import { db } from '../firebase/config';
import { Restaurant, Category, Dish, Order, MediaItem, ActivityLog } from '../types';

// Type definitions for better type safety
export interface FirestoreDocument {
  id: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface RestaurantScopedDocument extends FirestoreDocument {
  restaurantId: string;
}

export interface FirestoreErrorType extends Error {
  code: string;
  message: string;
}

// Collection names with restaurant scoping
export const COLLECTIONS = {
  RESTAURANTS: 'restaurants',
  CATEGORIES: 'categories',
  DISHES: 'menuItems',
  ORDERS: 'orders',
  MEDIA: 'media',
  TABLES: 'tables',
  ACTIVITY_LOGS: 'activityLogs',
  TEMPLATE_SETTINGS: 'templateSettings'
} as const;

// Restaurant-scoped collection paths
export const getRestaurantScopedPath = (restaurantId: string, collection: string) => 
  `restaurants/${restaurantId}/${collection}`;

// Base repository class for common Firestore operations
export abstract class BaseRepository<T extends FirestoreDocument> {
  protected db = db;
  protected collectionName: string;
  protected isRestaurantScoped: boolean;

  constructor(collectionName: string, isRestaurantScoped: boolean = false) {
    this.collectionName = collectionName;
    this.isRestaurantScoped = isRestaurantScoped;
  }

  protected getCollection(restaurantId?: string): any {
    if (this.isRestaurantScoped && !restaurantId) {
      throw new Error(`Restaurant ID required for scoped collection: ${this.collectionName}`);
    }
    
    if (this.isRestaurantScoped) {
      return collection(this.db, getRestaurantScopedPath(restaurantId!, this.collectionName));
    }
    
    return collection(this.db, this.collectionName);
  }

  protected getDocument(id: string, restaurantId?: string): any {
    if (this.isRestaurantScoped && !restaurantId) {
      throw new Error(`Restaurant ID required for scoped document: ${this.collectionName}/${id}`);
    }
    
    if (this.isRestaurantScoped) {
      return doc(this.db, getRestaurantScopedPath(restaurantId!, this.collectionName), id);
    }
    
    return doc(this.db, this.collectionName, id);
  }

  // Create document with automatic timestamps and validation
  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>, restaurantId?: string): Promise<string> {
    try {
      // Validate data before creating
      validateFirestoreDocument(data, this.collectionName);
      
      const collectionRef = this.getCollection(restaurantId);
      const docData = {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collectionRef, docData);
      return docRef.id;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      console.error(`Error creating document in ${this.collectionName}:`, error);
      throw this.handleError(error);
    }
  }

  // Get single document by ID
  async getById(id: string, restaurantId?: string): Promise<T | null> {
    try {
      const docRef = this.getDocument(id, restaurantId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      return { id: docSnap.id, ...docSnap.data() } as T;
    } catch (error) {
      console.error(`Error getting document ${id} from ${this.collectionName}:`, error);
      throw this.handleError(error);
    }
  }

  // Get all documents with optional query constraints
  async getAll(
    restaurantId?: string, 
    constraints: QueryConstraint[] = []
  ): Promise<T[]> {
    try {
      const collectionRef = this.getCollection(restaurantId);
      const q = query(collectionRef, ...constraints);
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
    } catch (error) {
      console.error(`Error getting all documents from ${this.collectionName}:`, error);
      throw this.handleError(error);
    }
  }

  // Update document with automatic updatedAt timestamp and validation
  async update(id: string, data: Partial<Omit<T, 'id' | 'createdAt'>>, restaurantId?: string): Promise<void> {
    try {
      // Validate data before updating
      validateFirestoreDocument(data, this.collectionName);
      
      const docRef = this.getDocument(id, restaurantId);
      const updateData = {
        ...data,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      console.error(`Error updating document ${id} in ${this.collectionName}:`, error);
      throw this.handleError(error);
    }
  }

  // Delete document
  async delete(id: string, restaurantId?: string): Promise<void> {
    try {
      const docRef = this.getDocument(id, restaurantId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting document ${id} from ${this.collectionName}:`, error);
      throw this.handleError(error);
    }
  }

  // Subscribe to real-time updates
  subscribe(
    callback: (docs: T[]) => void,
    restaurantId?: string,
    constraints: QueryConstraint[] = []
  ): () => void {
    try {
      const collectionRef = this.getCollection(restaurantId);
      const q = query(collectionRef, ...constraints);
      
      return onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data()
        })) as T[];
        callback(docs);
      });
    } catch (error) {
      console.error(`Error setting up subscription for ${this.collectionName}:`, error);
      throw this.handleError(error);
    }
  }

  // Batch operations
  createBatch(): WriteBatch {
    return writeBatch(this.db);
  }

  // Error handling
  protected handleError(error: unknown): FirestoreErrorType {
    if (error instanceof Error) {
      return {
        name: 'FirestoreError',
        message: error.message,
        code: 'unknown',
        stack: error.stack
      };
    }
    
    return {
      name: 'FirestoreError',
      message: 'Unknown error occurred',
      code: 'unknown'
    };
  }
}

// Restaurant repository
export class RestaurantRepository extends BaseRepository<Restaurant> {
  constructor() {
    super(COLLECTIONS.RESTAURANTS, false);
  }

  async getByEmail(email: string): Promise<Restaurant | null> {
    try {
      const constraints = [where('email', '==', email)];
      const restaurants = await this.getAll(undefined, constraints);
      return restaurants[0] || null;
    } catch (error) {
      console.error('Error getting restaurant by email:', error);
      throw this.handleError(error);
    }
  }

  async getByUid(uid: string): Promise<Restaurant | null> {
    try {
      const constraints = [where('uid', '==', uid)];
      const restaurants = await this.getAll(undefined, constraints);
      return restaurants[0] || null;
    } catch (error) {
      console.error('Error getting restaurant by UID:', error);
      throw this.handleError(error);
    }
  }
}

// Category repository (restaurant-scoped)
export class CategoryRepository extends BaseRepository<Category> {
  constructor() {
    super(COLLECTIONS.CATEGORIES, true);
  }

  async getByRestaurant(restaurantId: string): Promise<Category[]> {
    return this.getAll(restaurantId);
  }

  async getActiveByRestaurant(restaurantId: string): Promise<Category[]> {
    const constraints = [
      where('status', '==', 'active'),
      orderBy('createdAt', 'asc')
    ];
    return this.getAll(restaurantId, constraints);
  }

  async getMainCategories(restaurantId: string): Promise<Category[]> {
    const constraints = [
      where('status', '==', 'active'),
      where('parentCategoryId', '==', null),
      orderBy('createdAt', 'asc')
    ];
    return this.getAll(restaurantId, constraints);
  }

  async getSubcategories(restaurantId: string, parentId: string): Promise<Category[]> {
    const constraints = [
      where('status', '==', 'active'),
      where('parentCategoryId', '==', parentId),
      orderBy('createdAt', 'asc')
    ];
    return this.getAll(restaurantId, constraints);
  }
}

// Dish repository (restaurant-scoped)
export class DishRepository extends BaseRepository<Dish> {
  constructor() {
    super(COLLECTIONS.DISHES, true);
  }

  async getByRestaurant(restaurantId: string): Promise<Dish[]> {
    return this.getAll(restaurantId);
  }

  async getActiveByRestaurant(restaurantId: string): Promise<Dish[]> {
    const constraints = [
      where('status', '==', 'active'),
      orderBy('createdAt', 'asc')
    ];
    return this.getAll(restaurantId, constraints);
  }

  async getByCategory(restaurantId: string, categoryId: string): Promise<Dish[]> {
    const constraints = [
      where('status', '==', 'active'),
      where('categoryId', '==', categoryId),
      orderBy('createdAt', 'asc')
    ];
    return this.getAll(restaurantId, constraints);
  }

  async searchByRestaurant(restaurantId: string, searchTerm: string): Promise<Dish[]> {
    const allDishes = await this.getActiveByRestaurant(restaurantId);
    const term = searchTerm.toLowerCase();
    
    return allDishes.filter(dish => 
      dish.title.toLowerCase().includes(term) ||
      (dish.description && dish.description.toLowerCase().includes(term))
    );
  }
}

// Order repository (restaurant-scoped)
export class OrderRepository extends BaseRepository<Order> {
  constructor() {
    super(COLLECTIONS.ORDERS, true);
  }

  async getByRestaurant(restaurantId: string): Promise<Order[]> {
    const constraints = [orderBy('createdAt', 'desc')];
    return this.getAll(restaurantId, constraints);
  }

  async getByTable(restaurantId: string, tableNumber: number): Promise<Order[]> {
    const constraints = [
      where('tableNumber', '==', tableNumber),
      orderBy('createdAt', 'desc')
    ];
    return this.getAll(restaurantId, constraints);
  }

  async getByStatus(restaurantId: string, status: Order['status']): Promise<Order[]> {
    const constraints = [
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    ];
    return this.getAll(restaurantId, constraints);
  }

  async getFiltered(
    restaurantId: string,
    filters: {
      tableNumber?: number;
      status?: Order['status'];
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<Order[]> {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    
    if (filters.tableNumber !== undefined) {
      constraints.push(where('tableNumber', '==', filters.tableNumber));
    }
    
    if (filters.status) {
      constraints.push(where('status', '==', filters.status));
    }
    
    if (filters.startDate) {
      constraints.push(where('createdAt', '>=', Timestamp.fromDate(filters.startDate)));
    }
    
    if (filters.endDate) {
      constraints.push(where('createdAt', '<=', Timestamp.fromDate(filters.endDate)));
    }
    
    return this.getAll(restaurantId, constraints);
  }

  subscribeToTableOrders(
    restaurantId: string,
    tableNumber: number,
    callback: (orders: Order[]) => void
  ): () => void {
    const constraints = [
      where('tableNumber', '==', tableNumber),
      orderBy('createdAt', 'desc')
    ];
    return this.subscribe(callback, restaurantId, constraints);
  }

  subscribeToAllOrders(
    restaurantId: string,
    callback: (orders: Order[]) => void
  ): () => void {
    const constraints = [orderBy('createdAt', 'desc')];
    return this.subscribe(callback, restaurantId, constraints);
  }
}

// Media repository (restaurant-scoped)
export class MediaRepository extends BaseRepository<MediaItem> {
  constructor() {
    super(COLLECTIONS.MEDIA, true);
  }

  async getByRestaurant(restaurantId: string): Promise<MediaItem[]> {
    return this.getAll(restaurantId);
  }

  async getByType(restaurantId: string, type: MediaItem['type']): Promise<MediaItem[]> {
    const constraints = [where('type', '==', type)];
    return this.getAll(restaurantId, constraints);
  }

  async searchByRestaurant(restaurantId: string, searchTerm: string): Promise<MediaItem[]> {
    const allMedia = await this.getByRestaurant(restaurantId);
    const term = searchTerm.toLowerCase();
    
    return allMedia.filter(item => 
      item.dishName?.toLowerCase().includes(term) ||
      item.originalFileName.toLowerCase().includes(term) ||
      Object.values(item.metadata?.customMetadata || {}).some(value => 
        value.toLowerCase().includes(term)
      )
    );
  }
}

// Activity log repository (global)
export class ActivityLogRepository extends BaseRepository<ActivityLog & FirestoreDocument> {
  constructor() {
    super(COLLECTIONS.ACTIVITY_LOGS, false);
  }

  async getByUser(userId: string): Promise<ActivityLog[]> {
    const constraints = [
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    ];
    return this.getAll(undefined, constraints);
  }

  async getByEntity(entityType: string, entityId: string): Promise<ActivityLog[]> {
    const constraints = [
      where('entityType', '==', entityType),
      where('entityId', '==', entityId),
      orderBy('timestamp', 'desc')
    ];
    return this.getAll(undefined, constraints);
  }
}

// Export repository instances
export const restaurantRepo = new RestaurantRepository();
export const categoryRepo = new CategoryRepository();
export const dishRepo = new DishRepository();
export const orderRepo = new OrderRepository();
export const mediaRepo = new MediaRepository();
export const activityLogRepo = new ActivityLogRepository();

// Utility functions for common operations
export const firestoreUtils = {
  // Retry operation with exponential backoff
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  },

  // Validate restaurant access
  async validateRestaurantAccess(restaurantId: string, userId: string): Promise<boolean> {
    try {
      const restaurant = await restaurantRepo.getById(restaurantId);
      return (restaurant as any)?.uid === userId || (restaurant as any)?.adminUsers?.includes(userId) || false;
    } catch {
      return false;
    }
  },

  // Batch operations helper
  async executeBatch(operations: Array<{
    type: 'create' | 'update' | 'delete';
    collection: string;
    docId?: string;
    data?: Record<string, any>;
    restaurantId?: string;
  }>): Promise<void> {
    const batch = writeBatch(db);
    
    for (const op of operations) {
      const collectionRef = collection(db, op.restaurantId 
        ? getRestaurantScopedPath(op.restaurantId, op.collection)
        : op.collection
      );
      
      switch (op.type) {
        case 'create':
          if (op.data) {
            batch.set(doc(collectionRef), {
              ...op.data,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
          break;
        case 'update':
          if (op.docId && op.data) {
            batch.update(doc(collectionRef, op.docId), {
              ...op.data,
              updatedAt: serverTimestamp()
            });
          }
          break;
        case 'delete':
          if (op.docId) {
            batch.delete(doc(collectionRef, op.docId));
          }
          break;
      }
    }
    
    await batch.commit();
  }
};
