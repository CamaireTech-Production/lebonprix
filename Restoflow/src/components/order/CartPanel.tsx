import React from 'react';
import { OrderItem } from '../../types';
import { X, ShoppingCart, PlusCircle, MinusCircle, Trash2 } from 'lucide-react';
import { t } from '../../utils/i18n';

interface CartPanelProps {
  cart: OrderItem[];
  currencySymbol: string;
  language: string;
  onClose: () => void;
  onProceedToCheckout: () => void;
  onIncrementItem: (id: string) => void;
  onDecrementItem: (id: string) => void;
  onRemoveItem: (id: string) => void;
}

const CartPanel: React.FC<CartPanelProps> = ({
  cart,
  currencySymbol,
  language,
  onClose,
  onProceedToCheckout,
  onIncrementItem,
  onDecrementItem,
  onRemoveItem,
}) => {
  const totalCartAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="p-6">
      {/* Modal Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">{t('your_cart', language)}</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {cart.length === 0 ? (
        <div className="text-center py-8">
          <ShoppingCart size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">{t('your_cart_is_empty', language)}</p>
        </div>
      ) : (
        <>
          {/* Cart Items */}
          <div className="space-y-4 mb-6">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                {/* Dish Image */}
                <div className="flex-shrink-0 w-12 h-12 mr-3">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                      <span className="text-gray-400 text-xs">No Image</span>
                    </div>
                  )}
                </div>
                
                <div className="flex-1">
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="text-sm text-gray-600">
                    {item.price.toLocaleString()} {currencySymbol}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onDecrementItem(item.id)}
                    className="p-1 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
                  >
                    <MinusCircle size={16} />
                  </button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <button
                    onClick={() => onIncrementItem(item.id)}
                    className="p-1 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
                  >
                    <PlusCircle size={16} />
                  </button>
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="p-1 rounded-full bg-red-100 hover:bg-red-200 text-red-600 ml-2 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Total and Proceed Button */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-bold">{t('total', language)}:</span>
              <span className="text-lg font-bold">
                {totalCartAmount.toLocaleString()} {currencySymbol}
              </span>
            </div>

            <button
              onClick={onProceedToCheckout}
              className="w-full bg-primary hover:bg-primary-dark text-white py-3 rounded-lg font-medium transition-colors"
            >
              {t('finalize_order', language)}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CartPanel;


