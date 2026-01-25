/**
 * Tests for useCheckout hook
 */

import { renderHook, act } from '@testing-library/react';
import { useCheckout } from '../../hooks/useCheckout';
import { CartItem } from '../../types';

// Mock data
const mockCartItems: CartItem[] = [
  {
    dish: {
      id: 'dish-1',
      title: 'Test Dish 1',
      description: 'A test dish',
      price: 1500,
      categoryId: 'cat-1',
      restaurantId: 'rest-1',
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    quantity: 2
  },
  {
    dish: {
      id: 'dish-2',
      title: 'Test Dish 2',
      description: 'Another test dish',
      price: 2000,
      categoryId: 'cat-1',
      restaurantId: 'rest-1',
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    quantity: 1
  }
];

const mockRestaurant = {
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

describe('useCheckout', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should initialize with empty form data', () => {
    const { result } = renderHook(() => useCheckout(mockCartItems, mockRestaurant));
    
    expect(result.current.formData).toEqual({
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      deliveryAddress: '',
      notes: ''
    });
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.errors).toEqual({});
  });

  it('should update form data', () => {
    const { result } = renderHook(() => useCheckout(mockCartItems, mockRestaurant));
    
    act(() => {
      result.current.updateFormData('customerName', 'John Doe');
    });
    
    expect(result.current.formData.customerName).toBe('John Doe');
  });

  it('should validate required fields', () => {
    const { result } = renderHook(() => useCheckout(mockCartItems, mockRestaurant));
    
    act(() => {
      result.current.validateForm();
    });
    
    expect(result.current.errors).toHaveProperty('customerName');
    expect(result.current.errors).toHaveProperty('customerPhone');
  });

  it('should validate email format', () => {
    const { result } = renderHook(() => useCheckout(mockCartItems, mockRestaurant));
    
    act(() => {
      result.current.updateFormData('customerEmail', 'invalid-email');
      result.current.validateForm();
    });
    
    expect(result.current.errors).toHaveProperty('customerEmail');
  });

  it('should validate phone format', () => {
    const { result } = renderHook(() => useCheckout(mockCartItems, mockRestaurant));
    
    act(() => {
      result.current.updateFormData('customerPhone', 'invalid-phone');
      result.current.validateForm();
    });
    
    expect(result.current.errors).toHaveProperty('customerPhone');
  });

  it('should clear errors when form data is updated', () => {
    const { result } = renderHook(() => useCheckout(mockCartItems, mockRestaurant));
    
    act(() => {
      result.current.validateForm();
    });
    
    expect(result.current.errors).toHaveProperty('customerName');
    
    act(() => {
      result.current.updateFormData('customerName', 'John Doe');
    });
    
    expect(result.current.errors).not.toHaveProperty('customerName');
  });

  it('should generate WhatsApp message', () => {
    const { result } = renderHook(() => useCheckout(mockCartItems, mockRestaurant));
    
    act(() => {
      result.current.updateFormData('customerName', 'John Doe');
      result.current.updateFormData('customerPhone', '+1234567890');
      result.current.updateFormData('customerEmail', 'john@example.com');
      result.current.updateFormData('deliveryAddress', '123 Test St');
      result.current.updateFormData('notes', 'Please deliver quickly');
    });
    
    const message = result.current.generateWhatsAppMessage();
    
    expect(message).toContain('John Doe');
    expect(message).toContain('+1234567890');
    expect(message).toContain('john@example.com');
    expect(message).toContain('123 Test St');
    expect(message).toContain('Please deliver quickly');
    expect(message).toContain('Test Dish 1');
    expect(message).toContain('Test Dish 2');
  });

  it('should calculate order total', () => {
    const { result } = renderHook(() => useCheckout(mockCartItems, mockRestaurant));
    
    expect(result.current.orderTotal).toBe(5000); // 1500 * 2 + 2000 * 1
  });

  it('should handle empty cart', () => {
    const { result } = renderHook(() => useCheckout([], mockRestaurant));
    
    expect(result.current.orderTotal).toBe(0);
    expect(result.current.generateWhatsAppMessage()).toContain('No items in cart');
  });

  it('should reset form', () => {
    const { result } = renderHook(() => useCheckout(mockCartItems, mockRestaurant));
    
    act(() => {
      result.current.updateFormData('customerName', 'John Doe');
      result.current.updateFormData('customerPhone', '+1234567890');
    });
    
    expect(result.current.formData.customerName).toBe('John Doe');
    expect(result.current.formData.customerPhone).toBe('+1234567890');
    
    act(() => {
      result.current.resetForm();
    });
    
    expect(result.current.formData).toEqual({
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      deliveryAddress: '',
      notes: ''
    });
    expect(result.current.errors).toEqual({});
  });

  it('should handle form submission', async () => {
    const { result } = renderHook(() => useCheckout(mockCartItems, mockRestaurant));
    
    act(() => {
      result.current.updateFormData('customerName', 'John Doe');
      result.current.updateFormData('customerPhone', '+1234567890');
    });
    
    expect(result.current.isSubmitting).toBe(false);
    
    act(() => {
      result.current.submitOrder();
    });
    
    expect(result.current.isSubmitting).toBe(true);
  });

  it('should format currency correctly', () => {
    const { result } = renderHook(() => useCheckout(mockCartItems, mockRestaurant));
    
    expect(result.current.formattedTotal).toContain('5,000');
    expect(result.current.formattedTotal).toContain('XAF');
  });

  it('should handle restaurant without WhatsApp number', () => {
    const restaurantWithoutWhatsApp = {
      ...mockRestaurant,
      whatsappNumber: ''
    };
    
    const { result } = renderHook(() => useCheckout(mockCartItems, restaurantWithoutWhatsApp));
    
    const message = result.current.generateWhatsAppMessage();
    expect(message).toContain('Contact restaurant directly');
  });

  it('should handle special characters in form data', () => {
    const { result } = renderHook(() => useCheckout(mockCartItems, mockRestaurant));
    
    act(() => {
      result.current.updateFormData('customerName', 'José María');
      result.current.updateFormData('notes', 'Please deliver to "Special Address" & call first!');
    });
    
    const message = result.current.generateWhatsAppMessage();
    expect(message).toContain('José María');
    expect(message).toContain('Please deliver to "Special Address" & call first!');
  });
});

