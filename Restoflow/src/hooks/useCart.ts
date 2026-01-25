import { useState, useCallback } from 'react';
import { OrderItem, Dish } from '../types';
import toast from 'react-hot-toast';
import { t } from '../utils/i18n';

export const useCart = (language: string) => {
  const [cart, setCart] = useState<OrderItem[]>([]);

  const addToCart = useCallback((dish: Dish) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.menuItemId === dish.id);
      if (existingItem) {
        toast.success(t('item_added_to_cart', language));
        return prevCart.map((item) =>
          item.menuItemId === dish.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        toast.success(t('item_added_to_cart', language));
        return [
          ...prevCart,
          {
            id: dish.id,
            menuItemId: dish.id,
            title: dish.title,
            price: dish.price,
            quantity: 1,
            image: dish.image,
          },
        ];
      }
    });
  }, [language]);

  const incrementItem = useCallback((itemId: string) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === itemId ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  }, []);

  const decrementItem = useCallback((itemId: string) => {
    setCart((prevCart) =>
      prevCart
        .map((item) =>
          item.id === itemId
            ? { ...item, quantity: Math.max(0, item.quantity - 1) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== itemId));
    toast.success(t('item_removed', language));
  }, [language]);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return {
    cart,
    addToCart,
    incrementItem,
    decrementItem,
    removeItem,
    clearCart,
    totalCartItems,
    totalCartAmount,
  };
};


