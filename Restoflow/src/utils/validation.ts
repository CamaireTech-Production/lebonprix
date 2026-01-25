import { Restaurant, Category, Dish, Order, MediaItem, ActivityLog } from '../types';

// Validation error class
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Base validation functions
export const validators = {
  // String validators
  required: (value: any, field: string): void => {
    if (value === undefined || value === null || value === '') {
      throw new ValidationError(`${field} is required`, field);
    }
  },

  string: (value: any, field: string): void => {
    if (typeof value !== 'string') {
      throw new ValidationError(`${field} must be a string`, field);
    }
  },

  minLength: (value: string, min: number, field: string): void => {
    if (value.length < min) {
      throw new ValidationError(`${field} must be at least ${min} characters long`, field);
    }
  },

  maxLength: (value: string, max: number, field: string): void => {
    if (value.length > max) {
      throw new ValidationError(`${field} must be no more than ${max} characters long`, field);
    }
  },

  email: (value: string, field: string): void => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new ValidationError(`${field} must be a valid email address`, field);
    }
  },

  phone: (value: string, field: string): void => {
    const phoneRegex = /^(\+237|237)?[6-7][0-9]{8}$/;
    if (!phoneRegex.test(value.replace(/\s/g, ''))) {
      throw new ValidationError(`${field} must be a valid Cameroonian phone number`, field);
    }
  },

  // Number validators
  number: (value: any, field: string): void => {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new ValidationError(`${field} must be a number`, field);
    }
  },

  positive: (value: number, field: string): void => {
    if (value <= 0) {
      throw new ValidationError(`${field} must be positive`, field);
    }
  },

  min: (value: number, min: number, field: string): void => {
    if (value < min) {
      throw new ValidationError(`${field} must be at least ${min}`, field);
    }
  },

  max: (value: number, max: number, field: string): void => {
    if (value > max) {
      throw new ValidationError(`${field} must be no more than ${max}`, field);
    }
  },

  // Array validators
  array: (value: any, field: string): void => {
    if (!Array.isArray(value)) {
      throw new ValidationError(`${field} must be an array`, field);
    }
  },

  nonEmpty: (value: any[], field: string): void => {
    if (value.length === 0) {
      throw new ValidationError(`${field} cannot be empty`, field);
    }
  },

  // Enum validators
  enum: (value: any, allowedValues: any[], field: string): void => {
    if (!allowedValues.includes(value)) {
      throw new ValidationError(`${field} must be one of: ${allowedValues.join(', ')}`, field);
    }
  },

  // URL validators
  url: (value: string, field: string): void => {
    try {
      new URL(value);
    } catch {
      throw new ValidationError(`${field} must be a valid URL`, field);
    }
  },

  // Date validators
  date: (value: any, field: string): void => {
    if (!(value instanceof Date) && !(value && typeof value.toDate === 'function')) {
      throw new ValidationError(`${field} must be a valid date`, field);
    }
  },

  // Object validators
  object: (value: any, field: string): void => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ValidationError(`${field} must be an object`, field);
    }
  }
};

// Restaurant validation
export const validateRestaurant = (data: Partial<Restaurant>): void => {
  validators.required(data.name, 'name');
  validators.string(data.name, 'name');
  validators.minLength(data.name, 2, 'name');
  validators.maxLength(data.name, 100, 'name');

  if (data.email) {
    validators.string(data.email, 'email');
    validators.email(data.email, 'email');
  }

  if (data.phone) {
    validators.string(data.phone, 'phone');
    validators.phone(data.phone, 'phone');
  }

  if (data.address) {
    validators.string(data.address, 'address');
    validators.maxLength(data.address, 500, 'address');
  }

  if (data.currency) {
    validators.string(data.currency, 'currency');
    validators.enum(data.currency, ['XAF', 'USD', 'EUR'], 'currency');
  }

  if (data.status) {
    validators.enum(data.status, ['active', 'inactive', 'suspended'], 'status');
  }
};

// Category validation
export const validateCategory = (data: Partial<Category>): void => {
  validators.required(data.title, 'title');
  validators.string(data.title, 'title');
  validators.minLength(data.title, 2, 'title');
  validators.maxLength(data.title, 100, 'title');

  if (data.description) {
    validators.string(data.description, 'description');
    validators.maxLength(data.description, 500, 'description');
  }

  if (data.status) {
    validators.enum(data.status, ['active', 'inactive'], 'status');
  }

  if (data.parentCategoryId) {
    validators.string(data.parentCategoryId, 'parentCategoryId');
  }
};

// Dish validation
export const validateDish = (data: Partial<Dish>): void => {
  validators.required(data.title, 'title');
  validators.string(data.title, 'title');
  validators.minLength(data.title, 2, 'title');
  validators.maxLength(data.title, 100, 'title');

  validators.required(data.price, 'price');
  validators.number(data.price, 'price');
  validators.positive(data.price, 'price');

  validators.required(data.categoryId, 'categoryId');
  validators.string(data.categoryId, 'categoryId');

  if (data.description) {
    validators.string(data.description, 'description');
    validators.maxLength(data.description, 1000, 'description');
  }

  if (data.image) {
    validators.string(data.image, 'image');
    validators.url(data.image, 'image');
  }

  if (data.status) {
    validators.enum(data.status, ['active', 'inactive'], 'status');
  }

  if (data.allergens) {
    validators.array(data.allergens, 'allergens');
  }

  if (data.dietaryInfo) {
    validators.array(data.dietaryInfo, 'dietaryInfo');
  }
};

// Order validation
export const validateOrder = (data: Partial<Order>): void => {
  validators.required(data.restaurantId, 'restaurantId');
  validators.string(data.restaurantId, 'restaurantId');

  validators.required(data.items, 'items');
  validators.array(data.items, 'items');
  validators.nonEmpty(data.items, 'items');

  validators.required(data.totalAmount, 'totalAmount');
  validators.number(data.totalAmount, 'totalAmount');
  validators.positive(data.totalAmount, 'totalAmount');

  validators.required(data.status, 'status');
  validators.enum(data.status, ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'], 'status');

  if (data.tableNumber !== undefined) {
    validators.number(data.tableNumber, 'tableNumber');
    validators.min(data.tableNumber, 0, 'tableNumber');
  }

  if (data.customerName) {
    validators.string(data.customerName, 'customerName');
    validators.maxLength(data.customerName, 100, 'customerName');
  }

  if (data.customerPhone) {
    validators.string(data.customerPhone, 'customerPhone');
    validators.phone(data.customerPhone, 'customerPhone');
  }

  if (data.customerLocation) {
    validators.string(data.customerLocation, 'customerLocation');
    validators.maxLength(data.customerLocation, 500, 'customerLocation');
  }

  if (data.deliveryFee !== undefined) {
    validators.number(data.deliveryFee, 'deliveryFee');
    validators.min(data.deliveryFee, 0, 'deliveryFee');
  }
};

// Media validation
export const validateMediaItem = (data: Partial<MediaItem>): void => {
  validators.required(data.url, 'url');
  validators.string(data.url, 'url');
  validators.url(data.url, 'url');

  validators.required(data.restaurantId, 'restaurantId');
  validators.string(data.restaurantId, 'restaurantId');

  validators.required(data.type, 'type');
  validators.enum(data.type, ['dish', 'logo', 'menu'], 'type');

  validators.required(data.originalFileName, 'originalFileName');
  validators.string(data.originalFileName, 'originalFileName');

  if (data.dishName) {
    validators.string(data.dishName, 'dishName');
    validators.maxLength(data.dishName, 100, 'dishName');
  }

  if (data.size !== undefined) {
    validators.number(data.size, 'size');
    validators.positive(data.size, 'size');
  }

  if (data.quality !== undefined) {
    validators.number(data.quality, 'quality');
    validators.min(data.quality, 1, 'quality');
    validators.max(data.quality, 5, 'quality');
  }
};

// Activity log validation
export const validateActivityLog = (data: Partial<ActivityLog>): void => {
  validators.required(data.userId, 'userId');
  validators.string(data.userId, 'userId');

  validators.required(data.userEmail, 'userEmail');
  validators.string(data.userEmail, 'userEmail');
  validators.email(data.userEmail, 'userEmail');

  validators.required(data.action, 'action');
  validators.string(data.action, 'action');

  validators.required(data.entityType, 'entityType');
  validators.string(data.entityType, 'entityType');

  if (data.entityId) {
    validators.string(data.entityId, 'entityId');
  }

  if (data.details) {
    validators.object(data.details, 'details');
  }
};

// Validation helper function
export const validateData = <T>(
  data: Partial<T>,
  validator: (data: Partial<T>) => void
): void => {
  try {
    validator(data);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Validation failed');
  }
};

// Schema validation for Firestore documents
export const validateFirestoreDocument = (data: any, collection: string): void => {
  switch (collection) {
    case 'restaurants':
      validateData(data, validateRestaurant);
      break;
    case 'categories':
      validateData(data, validateCategory);
      break;
    case 'menuItems':
      validateData(data, validateDish);
      break;
    case 'orders':
      validateData(data, validateOrder);
      break;
    case 'media':
      validateData(data, validateMediaItem);
      break;
    case 'activityLogs':
      validateData(data, validateActivityLog);
      break;
    default:
      throw new ValidationError(`Unknown collection: ${collection}`);
  }
};

