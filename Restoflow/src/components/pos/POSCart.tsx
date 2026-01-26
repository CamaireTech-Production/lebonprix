// POSCart - Cart display component for POS
import React from 'react';
import { Minus, Plus, Trash2, MessageSquare, Save } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import type { POSCartItem, POSCartTotals, POSOrderType } from '../../types/pos';

interface POSCartProps {
  cart: POSCartItem[];
  cartTotals: POSCartTotals;
  orderType: POSOrderType;
  tip: number;
  deliveryFee: number;
  tableNumber?: number;
  onUpdateQuantity: (dishId: string, quantity: number) => void;
  onRemoveItem: (dishId: string) => void;
  onUpdateItem: (dishId: string, updates: Partial<POSCartItem>) => void;
  onTipChange: (tip: number) => void;
  onDeliveryFeeChange: (fee: number) => void;
  onClearCart: () => void;
  onSaveDraft: () => void;
  onCompleteOrder: () => void;
  isSubmitting: boolean;
}

const POSCart: React.FC<POSCartProps> = ({
  cart,
  cartTotals,
  orderType,
  tip,
  deliveryFee,
  tableNumber,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateItem,
  onTipChange,
  onDeliveryFeeChange,
  onClearCart,
  onSaveDraft,
  onCompleteOrder,
  isSubmitting,
}) => {
  const { language } = useLanguage();
  const [editingInstructions, setEditingInstructions] = React.useState<string | null>(null);
  const [tempInstructions, setTempInstructions] = React.useState('');

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price) + ' XAF';
  };

  const handleEditInstructions = (dishId: string, currentInstructions?: string) => {
    setEditingInstructions(dishId);
    setTempInstructions(currentInstructions || '');
  };

  const handleSaveInstructions = (dishId: string) => {
    onUpdateItem(dishId, { specialInstructions: tempInstructions || undefined });
    setEditingInstructions(null);
    setTempInstructions('');
  };

  // Tip presets
  const tipPresets = [0, 500, 1000, 2000];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {t('pos_current_order', language) || 'Current Order'}
            </h2>
            {tableNumber && (
              <p className="text-sm text-gray-500">
                {t('table', language) || 'Table'} {tableNumber}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {cart.length > 0 && (
              <>
                <button
                  onClick={onSaveDraft}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title={t('pos_save_draft', language) || 'Save Draft'}
                >
                  <Save size={18} />
                </button>
                <button
                  onClick={onClearCart}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title={t('pos_clear_cart', language) || 'Clear Cart'}
                >
                  <Trash2 size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
            <span className="text-6xl mb-4">🛒</span>
            <p className="text-center">{t('pos_cart_empty', language) || 'Cart is empty'}</p>
            <p className="text-sm text-center mt-1">
              {t('pos_cart_empty_hint', language) || 'Click on dishes to add them to the order'}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {cart.map(item => (
              <div key={item.dish.id} className="p-3">
                <div className="flex items-start space-x-3">
                  {/* Image */}
                  {item.dish.image && (
                    <img
                      src={item.dish.image}
                      alt={item.dish.title}
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                    />
                  )}

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">{item.dish.title}</h4>
                        <p className="text-sm text-primary font-medium">
                          {formatPrice(item.modifiedPrice ?? item.dish.price)}
                        </p>
                      </div>
                      <button
                        onClick={() => onRemoveItem(item.dish.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Special Instructions */}
                    {editingInstructions === item.dish.id ? (
                      <div className="mt-2 flex items-center space-x-2">
                        <input
                          type="text"
                          value={tempInstructions}
                          onChange={(e) => setTempInstructions(e.target.value)}
                          placeholder={t('pos_instructions_placeholder', language) || 'Special instructions...'}
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveInstructions(item.dish.id);
                            }
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveInstructions(item.dish.id)}
                          className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90"
                        >
                          {t('save', language) || 'Save'}
                        </button>
                      </div>
                    ) : item.specialInstructions ? (
                      <button
                        onClick={() => handleEditInstructions(item.dish.id, item.specialInstructions)}
                        className="mt-1 text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1"
                      >
                        <MessageSquare size={12} />
                        <span className="italic truncate">{item.specialInstructions}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEditInstructions(item.dish.id)}
                        className="mt-1 text-xs text-gray-400 hover:text-gray-600 flex items-center space-x-1"
                      >
                        <MessageSquare size={12} />
                        <span>{t('pos_add_note', language) || 'Add note'}</span>
                      </button>
                    )}

                    {/* Quantity Controls */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onUpdateQuantity(item.dish.id, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(item.dish.id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <span className="font-semibold text-gray-900">
                        {formatPrice((item.modifiedPrice ?? item.dish.price) * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals & Actions */}
      {cart.length > 0 && (
        <div className="border-t bg-gray-50 p-4 space-y-3">
          {/* Tip Section */}
          <div>
            <label className="text-sm text-gray-600 mb-1 block">
              {t('pos_tip', language) || 'Tip'}
            </label>
            <div className="flex items-center space-x-2">
              {tipPresets.map(preset => (
                <button
                  key={preset}
                  onClick={() => onTipChange(preset)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    tip === preset
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {preset === 0 ? t('no_tip', language) || 'No tip' : formatPrice(preset)}
                </button>
              ))}
              <input
                type="number"
                value={tip || ''}
                onChange={(e) => onTipChange(parseInt(e.target.value) || 0)}
                placeholder={t('pos_custom', language) || 'Custom'}
                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                min="0"
              />
            </div>
          </div>

          {/* Delivery Fee (only for delivery orders) */}
          {orderType === 'delivery' && (
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">
                {t('delivery_fee', language) || 'Delivery Fee'}
              </label>
              <input
                type="number"
                value={deliveryFee || ''}
                onChange={(e) => onDeliveryFeeChange(parseInt(e.target.value) || 0)}
                className="w-28 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary text-right"
                min="0"
              />
            </div>
          )}

          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>{t('subtotal', language) || 'Subtotal'}</span>
              <span>{formatPrice(cartTotals.subtotal)}</span>
            </div>
            {tip > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>{t('pos_tip', language) || 'Tip'}</span>
                <span>{formatPrice(tip)}</span>
              </div>
            )}
            {orderType === 'delivery' && deliveryFee > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>{t('delivery_fee', language) || 'Delivery'}</span>
                <span>{formatPrice(deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-lg pt-2 border-t">
              <span>{t('total', language) || 'Total'}</span>
              <span className="text-primary">{formatPrice(cartTotals.total)}</span>
            </div>
          </div>

          {/* Complete Order Button */}
          <button
            onClick={onCompleteOrder}
            disabled={isSubmitting || cart.length === 0}
            className="w-full py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>{t('processing', language) || 'Processing...'}</span>
              </>
            ) : (
              <span>{t('pos_complete_order', language) || 'Complete Order'}</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default POSCart;
