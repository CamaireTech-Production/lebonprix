import { Plus, Minus, Trash2, ShoppingCart, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ImageWithSkeleton, PriceInput } from '@components/common';
import { formatPrice } from '@utils/formatting/formatPrice';
import type { CartItem } from '@hooks/forms/usePOS';

interface POSCartProps {
  cart: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onUpdateNegotiatedPrice: (productId: string, price: number | undefined) => void;
  onClearCart: () => void;
  subtotal: number;
  deliveryFee: number;
  total: number;
  onDeliveryFeeChange: (fee: number) => void;
  onCompleteSale: () => void;
  isSubmitting: boolean;
}

export const POSCart: React.FC<POSCartProps> = ({
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateNegotiatedPrice,
  onClearCart,
  subtotal,
  deliveryFee,
  total,
  onDeliveryFeeChange,
  onCompleteSale,
  isSubmitting,
}) => {
  const { t } = useTranslation();
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Cart Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2">
          <ShoppingCart size={20} />
          <h2 className="text-lg font-semibold">{t('pos.cart.title')} ({cart.length})</h2>
        </div>
        {cart.length > 0 && (
          <button
            onClick={onClearCart}
            className="text-red-600 hover:text-red-800 text-sm flex items-center space-x-1"
          >
            <X size={16} />
            <span>{t('pos.cart.clear')}</span>
          </button>
        )}
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <ShoppingCart size={48} className="mb-4 opacity-50" />
            <p>{t('pos.cart.empty')}</p>
            <p className="text-sm mt-2">{t('pos.cart.emptyMessage')}</p>
          </div>
        ) : (
          cart.map(item => {
            const price = item.negotiatedPrice ?? item.product.sellingPrice;
            const itemTotal = price * item.quantity;

            return (
              <div
                key={item.product.id}
                className="bg-gray-50 rounded-lg p-3 border border-gray-200"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-16 h-16 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                    <ImageWithSkeleton
                      src={item.product.images && item.product.images.length > 0 ? item.product.images[0] : '/placeholder.png'}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                      placeholder="/placeholder.png"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm mb-1">{item.product.name}</div>
                    <div className="text-xs text-gray-600 mb-2">
                      {formatPrice(price)} XAF × {item.quantity}
                    </div>
                    
                    {/* Quantity Controls */}
                    <div className="flex items-center space-x-2 mb-2">
                      <button
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                        className="p-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                        disabled={item.quantity >= item.product.stock}
                        className="p-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {/* Negotiated Price Input */}
                    {item.negotiatedPrice !== undefined && (
                      <PriceInput
                        name={`negotiatedPrice-${item.product.id}`}
                        value={item.negotiatedPrice.toString()}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          onUpdateNegotiatedPrice(item.product.id, isNaN(value) || e.target.value === '' ? undefined : value);
                        }}
                        placeholder="Negotiated price"
                        className="w-full px-2 py-1 text-xs mb-2"
                      />
                    )}
                  </div>

                  <div className="flex flex-col items-end">
                    <button
                      onClick={() => onRemoveItem(item.product.id)}
                      className="p-1 text-red-600 hover:text-red-800 mb-2"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="text-sm font-semibold text-emerald-600">
                      {formatPrice(itemTotal)} XAF
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Cart Footer */}
      {cart.length > 0 && (
        <div className="border-t p-4 space-y-3 bg-gray-50">
          {/* Delivery Fee */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700">{t('pos.cart.deliveryFee')}:</label>
            <PriceInput
              name="deliveryFee"
              value={deliveryFee.toString()}
              onChange={(e) => onDeliveryFeeChange(parseFloat(e.target.value) || 0)}
              className="w-24 px-2 py-1 text-sm text-right"
            />
          </div>

          {/* Totals */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('pos.cart.subtotal')}:</span>
              <span className="font-medium">{formatPrice(subtotal)} XAF</span>
            </div>
            {deliveryFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('pos.cart.deliveryFee')}:</span>
                <span className="font-medium">{formatPrice(deliveryFee)} XAF</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>{t('pos.cart.total')}:</span>
              <span className="text-emerald-600">{formatPrice(total)} XAF</span>
            </div>
          </div>

          {/* Complete Sale Button */}
          <button
            onClick={onCompleteSale}
            disabled={isSubmitting}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t('common.saving') : t('pos.cart.completeSale')}
          </button>
        </div>
      )}
    </div>
  );
};

