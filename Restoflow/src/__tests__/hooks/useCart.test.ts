/**
 * Tests for useCart hook
 */

import { renderHook, act } from '@testing-library/react';
import { useCart } from '../../hooks/useCart';
import { Dish } from '../../types';

// Mock data
const mockDish: Dish = {
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

describe('useCart', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should initialize with empty cart', () => {
    const { result } = renderHook(() => useCart());
    
    expect(result.current.items).toEqual([]);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.totalPrice).toBe(0);
  });

  it('should add item to cart', () => {
    const { result } = renderHook(() => useCart());
    
    act(() => {
      result.current.addItem(mockDish);
    });
    
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toEqual({
      dish: mockDish,
      quantity: 1
    });
    expect(result.current.totalItems).toBe(1);
    expect(result.current.totalPrice).toBe(1500);
  });

  it('should increment quantity when adding same item', () => {
    const { result } = renderHook(() => useCart());
    
    act(() => {
      result.current.addItem(mockDish);
      result.current.addItem(mockDish);
    });
    
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.totalItems).toBe(2);
    expect(result.current.totalPrice).toBe(3000);
  });

  it('should remove item from cart', () => {
    const { result } = renderHook(() => useCart());
    
    act(() => {
      result.current.addItem(mockDish);
      result.current.removeItem(mockDish.id);
    });
    
    expect(result.current.items).toHaveLength(0);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.totalPrice).toBe(0);
  });

  it('should increment item quantity', () => {
    const { result } = renderHook(() => useCart());
    
    act(() => {
      result.current.addItem(mockDish);
      result.current.incrementItem(mockDish.id);
    });
    
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.totalItems).toBe(2);
    expect(result.current.totalPrice).toBe(3000);
  });

  it('should decrement item quantity', () => {
    const { result } = renderHook(() => useCart());
    
    act(() => {
      result.current.addItem(mockDish);
      result.current.addItem(mockDish);
      result.current.decrementItem(mockDish.id);
    });
    
    expect(result.current.items[0].quantity).toBe(1);
    expect(result.current.totalItems).toBe(1);
    expect(result.current.totalPrice).toBe(1500);
  });

  it('should remove item when decrementing to zero', () => {
    const { result } = renderHook(() => useCart());
    
    act(() => {
      result.current.addItem(mockDish);
      result.current.decrementItem(mockDish.id);
    });
    
    expect(result.current.items).toHaveLength(0);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.totalPrice).toBe(0);
  });

  it('should clear cart', () => {
    const { result } = renderHook(() => useCart());
    
    act(() => {
      result.current.addItem(mockDish);
      result.current.clearCart();
    });
    
    expect(result.current.items).toHaveLength(0);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.totalPrice).toBe(0);
  });

  it('should persist cart to localStorage', () => {
    const { result } = renderHook(() => useCart());
    
    act(() => {
      result.current.addItem(mockDish);
    });
    
    const savedCart = localStorage.getItem('cart');
    expect(savedCart).toBeTruthy();
    
    const parsedCart = JSON.parse(savedCart!);
    expect(parsedCart.items).toHaveLength(1);
    expect(parsedCart.items[0].dish.id).toBe(mockDish.id);
  });

  it('should restore cart from localStorage', () => {
    // Pre-populate localStorage
    const cartData = {
      items: [{ dish: mockDish, quantity: 2 }],
      totalItems: 2,
      totalPrice: 3000
    };
    localStorage.setItem('cart', JSON.stringify(cartData));
    
    const { result } = renderHook(() => useCart());
    
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.totalItems).toBe(2);
    expect(result.current.totalPrice).toBe(3000);
  });

  it('should handle multiple different items', () => {
    const mockDish2: Dish = {
      ...mockDish,
      id: 'dish-2',
      title: 'Test Dish 2',
      price: 2000
    };
    
    const { result } = renderHook(() => useCart());
    
    act(() => {
      result.current.addItem(mockDish);
      result.current.addItem(mockDish2);
    });
    
    expect(result.current.items).toHaveLength(2);
    expect(result.current.totalItems).toBe(2);
    expect(result.current.totalPrice).toBe(3500);
  });

  it('should calculate correct totals', () => {
    const mockDish2: Dish = {
      ...mockDish,
      id: 'dish-2',
      title: 'Test Dish 2',
      price: 2000
    };
    
    const { result } = renderHook(() => useCart());
    
    act(() => {
      result.current.addItem(mockDish);
      result.current.addItem(mockDish);
      result.current.addItem(mockDish2);
    });
    
    expect(result.current.totalItems).toBe(3);
    expect(result.current.totalPrice).toBe(5000); // 1500 * 2 + 2000
  });
});

