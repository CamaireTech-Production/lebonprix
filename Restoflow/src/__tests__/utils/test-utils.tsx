/**
 * Testing utilities and mocks
 */

import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { AuthProvider } from '../../auth/context';

// Mock data
export const mockRestaurant = {
  id: 'rest-1',
  name: 'Test Restaurant',
  phone: '+1234567890',
  whatsappNumber: '+1234567890',
  address: 'Test Address',
  city: 'Test City',
  country: 'Test Country',
  currency: 'XAF',
  isActive: true,
  createdAt: Date.now(),
  updatedAt: Date.now()
};

export const mockDish = {
  id: 'dish-1',
  title: 'Test Dish',
  description: 'A test dish',
  price: 1500,
  categoryId: 'cat-1',
  restaurantId: 'rest-1',
  isActive: true,
  createdAt: Date.now(),
  updatedAt: Date.now()
};

export const mockCategory = {
  id: 'cat-1',
  title: 'Test Category',
  restaurantId: 'rest-1',
  isActive: true,
  createdAt: Date.now(),
  updatedAt: Date.now()
};

export const mockCartItem = {
  dish: mockDish,
  quantity: 2
};

export const mockOrder = {
  id: 'order-1',
  restaurantId: 'rest-1',
  customerName: 'John Doe',
  customerPhone: '+1234567890',
  customerEmail: 'john@example.com',
  deliveryAddress: '123 Test St',
  items: [mockCartItem],
  total: 3000,
  status: 'pending',
  createdAt: Date.now(),
  updatedAt: Date.now()
};

// Mock functions
export const mockFunctions = {
  onDishClick: jest.fn(),
  onElementClick: jest.fn(),
  onAddToCart: jest.fn(),
  onRemoveFromCart: jest.fn(),
  onIncrementItem: jest.fn(),
  onDecrementItem: jest.fn(),
  onClearCart: jest.fn(),
  onSubmitOrder: jest.fn(),
  onClose: jest.fn(),
  onReserve: jest.fn()
};

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  theme?: string;
  language?: string;
  user?: any;
  restaurant?: any;
}

export function renderWithProviders(
  ui: React.ReactElement,
  {
    theme = 'light',
    language = 'en',
    user = null,
    restaurant = mockRestaurant,
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <LanguageProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </LanguageProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Mock Firebase
export const mockFirebase = {
  auth: {
    signInWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
    currentUser: null
  },
  firestore: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      })),
      add: jest.fn(),
      where: jest.fn(() => ({
        get: jest.fn()
      }))
    }))
  },
  storage: {
    ref: jest.fn(() => ({
      put: jest.fn(() => ({
        ref: {
          getDownloadURL: jest.fn()
        }
      }))
    }))
  }
};

// Mock IndexedDB
export const mockIndexedDB = {
  open: jest.fn(() => ({
    result: {
      createObjectStore: jest.fn(),
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          add: jest.fn(),
          get: jest.fn(),
          put: jest.fn(),
          delete: jest.fn(),
          clear: jest.fn()
        }))
      }))
    },
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null
  }))
};

// Mock localStorage
export const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

// Mock fetch
export const mockFetch = jest.fn();

// Mock IntersectionObserver
export const mockIntersectionObserver = {
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
};

// Mock ResizeObserver
export const mockResizeObserver = {
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
};

// Mock matchMedia
export const mockMatchMedia = {
  matches: false,
  media: '',
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn()
};

// Setup mocks
export const setupMocks = () => {
  // Mock localStorage
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true
  });

  // Mock fetch
  global.fetch = mockFetch;

  // Mock IntersectionObserver
  Object.defineProperty(window, 'IntersectionObserver', {
    value: jest.fn(() => mockIntersectionObserver),
    writable: true
  });

  // Mock ResizeObserver
  Object.defineProperty(window, 'ResizeObserver', {
    value: jest.fn(() => mockResizeObserver),
    writable: true
  });

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    value: jest.fn(() => mockMatchMedia),
    writable: true
  });

  // Mock IndexedDB
  Object.defineProperty(window, 'indexedDB', {
    value: mockIndexedDB,
    writable: true
  });
};

// Cleanup mocks
export const cleanupMocks = () => {
  jest.clearAllMocks();
  mockLocalStorage.clear();
  mockFetch.mockClear();
};

// Test data generators
export const generateMockDishes = (count: number) => {
  return Array.from({ length: count }, (_, index) => ({
    ...mockDish,
    id: `dish-${index + 1}`,
    title: `Test Dish ${index + 1}`,
    price: 1000 + (index * 500)
  }));
};

export const generateMockCategories = (count: number) => {
  return Array.from({ length: count }, (_, index) => ({
    ...mockCategory,
    id: `cat-${index + 1}`,
    title: `Test Category ${index + 1}`
  }));
};

export const generateMockOrders = (count: number) => {
  return Array.from({ length: count }, (_, index) => ({
    ...mockOrder,
    id: `order-${index + 1}`,
    customerName: `Customer ${index + 1}`,
    total: 1000 + (index * 500)
  }));
};

// Utility functions
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const createMockFile = (name: string, type: string, content: string = 'test') => {
  return new File([content], name, { type });
};

export const createMockImageFile = (name: string = 'test.jpg') => {
  return createMockFile(name, 'image/jpeg');
};

// Assertion helpers
export const expectToBeInDocument = (element: HTMLElement) => {
  expect(element).toBeInTheDocument();
};

export const expectToHaveClass = (element: HTMLElement, className: string) => {
  expect(element).toHaveClass(className);
};

export const expectToHaveTextContent = (element: HTMLElement, text: string) => {
  expect(element).toHaveTextContent(text);
};

export const expectToHaveAttribute = (element: HTMLElement, attribute: string, value: string) => {
  expect(element).toHaveAttribute(attribute, value);
};

// Mock router
export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  pathname: '/',
  query: {},
  asPath: '/'
};

// Mock navigation
export const mockNavigation = {
  goBack: jest.fn(),
  goForward: jest.fn(),
  pushState: jest.fn(),
  replaceState: jest.fn()
};

// Mock window
export const mockWindow = {
  location: {
    href: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: ''
  },
  history: {
    pushState: jest.fn(),
    replaceState: jest.fn(),
    go: jest.fn(),
    back: jest.fn(),
    forward: jest.fn()
  },
  scrollTo: jest.fn(),
  open: jest.fn(),
  close: jest.fn()
};

// Setup window mocks
export const setupWindowMocks = () => {
  Object.defineProperty(window, 'location', {
    value: mockWindow.location,
    writable: true
  });
  
  Object.defineProperty(window, 'history', {
    value: mockWindow.history,
    writable: true
  });
  
  Object.defineProperty(window, 'scrollTo', {
    value: mockWindow.scrollTo,
    writable: true
  });
  
  Object.defineProperty(window, 'open', {
    value: mockWindow.open,
    writable: true
  });
  
  Object.defineProperty(window, 'close', {
    value: mockWindow.close,
    writable: true
  });
};

