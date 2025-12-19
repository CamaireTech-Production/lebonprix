import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { Product } from '../types/models';
import { loadCartData, saveCheckoutData, clearCheckoutData } from '@utils/storage/checkoutPersistence';

// Cart item interface (following the documentation structure)
interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  category: string;
  selectedColor?: string;
  selectedSize?: string;
}

// Cart context interface
interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, selectedColor?: string, selectedSize?: string) => void;
  updateCartItem: (productId: string, quantity: number, selectedColor?: string, selectedSize?: string) => void;
  removeFromCart: (productId: string, selectedColor?: string, selectedSize?: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartItemCount: () => number;
  getCartItemQuantity: (productId: string, selectedColor?: string, selectedSize?: string) => number;
  // Company-specific persistence methods
  loadCartForCompany: (companyId: string) => void;
  saveCartForCompany: (companyId: string) => void;
  clearCartForCompany: (companyId: string) => void;
  currentCompanyId: string | null;
  setCurrentCompanyId: (companyId: string | null) => void;
}

// Create the context
const CartContext = createContext<CartContextType | undefined>(undefined);

// Cart provider component
export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);

  // Generate unique key for cart item (product + color + size combination)
  const getItemKey = (productId: string, selectedColor?: string, selectedSize?: string) => {
    return `${productId}-${selectedColor || 'default'}-${selectedSize || 'default'}`;
  };

  // Add item to cart
  const addToCart = useCallback((
    product: Product, 
    quantity: number = 1, 
    selectedColor?: string, 
    selectedSize?: string
  ) => {
    const itemKey = getItemKey(product.id, selectedColor, selectedSize);
    
    setCart(prevCart => {
      const existingItemIndex = prevCart.findIndex(item => 
        getItemKey(item.productId, item.selectedColor, item.selectedSize) === itemKey
      );

      if (existingItemIndex >= 0) {
        // Update existing item
        const updatedCart = [...prevCart];
        updatedCart[existingItemIndex] = {
          ...updatedCart[existingItemIndex],
          quantity: updatedCart[existingItemIndex].quantity + quantity
        };
        
        // Dispatch event to open cart drawer
        window.dispatchEvent(new CustomEvent('cart:itemAdded', { 
          detail: { product, quantity, isUpdate: true } 
        }));
        
        return updatedCart;
      } else {
        // Add new item
        const newItem: CartItem = {
          productId: product.id,
          name: product.name,
          price: product.cataloguePrice ?? 0,
          quantity,
          image: product.images?.[0],
          category: product.category,
          selectedColor,
          selectedSize
        };
        
        // Dispatch event to open cart drawer
        window.dispatchEvent(new CustomEvent('cart:itemAdded', { 
          detail: { product, quantity, isUpdate: false } 
        }));
        
        return [...prevCart, newItem];
      }
    });
  }, []);

  // Update cart item quantity
  const updateCartItem = useCallback((
    productId: string, 
    quantity: number, 
    selectedColor?: string, 
    selectedSize?: string
  ) => {
    if (quantity <= 0) {
      removeFromCart(productId, selectedColor, selectedSize);
      return;
    }

    const itemKey = getItemKey(productId, selectedColor, selectedSize);
    
    setCart(prevCart => 
      prevCart.map(item => 
        getItemKey(item.productId, item.selectedColor, item.selectedSize) === itemKey
          ? { ...item, quantity }
          : item
      )
    );
  }, []);

  // Remove item from cart
  const removeFromCart = useCallback((
    productId: string, 
    selectedColor?: string, 
    selectedSize?: string
  ) => {
    const itemKey = getItemKey(productId, selectedColor, selectedSize);
    
    setCart(prevCart => 
      prevCart.filter(item => 
        getItemKey(item.productId, item.selectedColor, item.selectedSize) !== itemKey
      )
    );
  }, []);

  // Clear entire cart
  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  // Get total cart value
  const getCartTotal = useCallback(() => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  }, [cart]);

  // Get total number of items in cart
  const getCartItemCount = useCallback(() => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }, [cart]);

  // Get quantity of specific item in cart
  const getCartItemQuantity = useCallback((
    productId: string, 
    selectedColor?: string, 
    selectedSize?: string
  ) => {
    const itemKey = getItemKey(productId, selectedColor, selectedSize);
    const item = cart.find(item => 
      getItemKey(item.productId, item.selectedColor, item.selectedSize) === itemKey
    );
    return item ? item.quantity : 0;
  }, [cart]);

  // Load cart for specific company
  const loadCartForCompany = useCallback((companyId: string) => {
    try {
      console.log('Loading cart for company:', companyId);
      const cartData = loadCartData(companyId);
      console.log('Loaded cart data:', cartData);
      if (cartData && cartData.cartItems && cartData.cartItems.length > 0) {
        setCart(cartData.cartItems);
        setCurrentCompanyId(companyId);
        console.log('Cart loaded successfully:', cartData.cartItems);
      } else {
        console.log('No cart data found for company:', companyId);
      }
    } catch (error) {
      console.error('Error loading cart for company:', error);
    }
  }, []);

  // Save cart for specific company
  const saveCartForCompany = useCallback((companyId: string) => {
    try {
      const cartTotal = getCartTotal();
      console.log('Saving cart for company:', companyId, 'Items:', cart.length, 'Total:', cartTotal);
      // Save cart data using the persistence utility
      saveCheckoutData(companyId, {
        customerInfo: {
          name: '',
          phone: '',
          location: '',
          deliveryInstructions: ''
        },
        selectedPaymentMethod: '',
        selectedPaymentOption: '',
        paymentFormData: {
          mtnNumber: '',
          orangeNumber: '',
          cardNumber: '',
          expiryDate: '',
          securityCode: '',
          nameOnCard: ''
        }
      }, cart, cartTotal);
      console.log('Cart saved successfully for company:', companyId);
    } catch (error) {
      console.error('Error saving cart for company:', error);
    }
  }, [cart, getCartTotal]);

  // Clear cart for specific company
  const clearCartForCompany = useCallback((companyId: string) => {
    try {
      clearCheckoutData(companyId);
      setCart([]);
      setCurrentCompanyId(null);
    } catch (error) {
      console.error('Error clearing cart for company:', error);
    }
  }, []);

  // Auto-save cart when it changes (if company is set)
  useEffect(() => {
    if (currentCompanyId && cart.length > 0) {
      console.log('Auto-saving cart for company:', currentCompanyId, 'Items:', cart.length);
      const timeoutId = setTimeout(() => {
        saveCartForCompany(currentCompanyId);
      }, 1000); // Debounce saves

      return () => clearTimeout(timeoutId);
    }
  }, [cart, currentCompanyId, saveCartForCompany]);

  const value: CartContextType = {
    cart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    getCartTotal,
    getCartItemCount,
    getCartItemQuantity,
    // Company-specific persistence methods
    loadCartForCompany,
    saveCartForCompany,
    clearCartForCompany,
    currentCompanyId,
    setCurrentCompanyId
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

// Custom hook to use cart context
export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export default CartContext;
