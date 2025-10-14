import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShoppingBag, X, Plus, Minus } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import CheckoutModal from '../checkout/CheckoutModal';

const placeholderImg = '/placeholder.png';

interface FloatingCartButtonProps {
  className?: string;
}

const FloatingCartButton: React.FC<FloatingCartButtonProps> = ({ className = '' }) => {
  const { companyId } = useParams<{ companyId: string }>();
  const { cart, updateCartItem, getCartItemCount, getCartTotal } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const handleUpdateQuantity = (productId: string, quantity: number, selectedColor?: string, selectedSize?: string) => {
    updateCartItem(productId, quantity, selectedColor, selectedSize);
  };

  return (
    <>
      {/* Floating Cart Button */}
      <div className={`fixed bottom-20 right-4 z-40 ${className}`}>
        <button
          onClick={() => setIsCartOpen(true)}
          className="relative text-white p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-105" style={{backgroundColor: '#e2b069'}} onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#d4a05a'} onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#e2b069'}
        >
          <ShoppingBag className="h-6 w-6" />
          {getCartItemCount() > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-semibold">
              {getCartItemCount()}
            </div>
          )}
        </button>
      </div>

      {/* Cart Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
          <div className="bg-white w-full max-h-[90vh] rounded-t-lg flex flex-col">
            {/* Cart Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                Cart ({getCartItemCount()})
              </h3>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Cart Content - Scrollable */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-500 text-lg">Your cart is empty</p>
                  <p className="text-gray-400 text-sm mt-2">Add some products to get started</p>
                </div>
              ) : (
                <div className="p-4 space-y-4 pb-4">
                  {cart.map((item) => (
                    <div key={`${item.productId}-${item.selectedColor || 'default'}-${item.selectedSize || 'default'}`} 
                         className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      {/* Product Image */}
                      <img
                        src={item.image || placeholderImg}
                        alt={item.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                      
                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-gray-900 truncate">
                          {item.name}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {item.category}
                          {item.selectedColor && ` • ${item.selectedColor}`}
                          {item.selectedSize && ` • ${item.selectedSize}`}
                        </p>
                        <p className="font-semibold text-sm" style={{color: '#e2b069'}}>
                          {(item.price * item.quantity).toLocaleString('fr-FR', {
                            style: 'currency',
                            currency: 'XAF'
                          })}
                        </p>
                      </div>
                      
                      {/* Quantity Controls */}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1, item.selectedColor, item.selectedSize)}
                          className="w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1, item.selectedColor, item.selectedSize)}
                          className="w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Footer - Always visible */}
            {cart.length > 0 && (
              <div className="border-t border-gray-200 p-4 flex-shrink-0">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-semibold text-gray-900">Total:</span>
                  <span className="font-bold text-lg" style={{color: '#e2b069'}}>
                    {getCartTotal().toLocaleString('fr-FR', {
                      style: 'currency',
                      currency: 'XAF'
                    })}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    setIsCheckoutOpen(true);
                  }}
                  className="w-full text-white py-3 rounded-lg font-semibold transition-colors" style={{backgroundColor: '#e2b069'}} onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#d4a05a'} onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#e2b069'}
                >
                  Checkout Now
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {companyId && (
        <CheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          companyId={companyId}
        />
      )}
    </>
  );
};

export default FloatingCartButton;
