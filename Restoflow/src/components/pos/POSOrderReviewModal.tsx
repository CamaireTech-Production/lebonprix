// POSOrderReviewModal - Order review and action selection modal
import React, { useState } from 'react';
import { X, Printer, Save, CreditCard, Plus, Minus, Trash2, MessageSquare, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import type { POSCartItem, POSCartTotals, POSOrderType, POSOrderReviewMode } from '../../types/pos';
import type { Table } from '../../types/index';

interface POSOrderReviewModalProps {
  isOpen: boolean;
  mode: POSOrderReviewMode;
  existingOrderId?: string;
  existingItems?: POSCartItem[];
  newItems: POSCartItem[];
  cartTotals: POSCartTotals;
  orderType: POSOrderType;
  table: Table | null;
  onClose: () => void;
  onPrintBon: (kitchenTickets: number) => void;
  onSaveDraft: () => void;
  onCompletePayment: () => void;
  onUpdateItem: (dishId: string, updates: Partial<POSCartItem>) => void;
  onRemoveItem: (dishId: string) => void;
  onAddMoreItems: () => void;
}

const POSOrderReviewModal: React.FC<POSOrderReviewModalProps> = ({
  isOpen,
  mode,
  existingOrderId,
  existingItems = [],
  newItems,
  cartTotals,
  orderType,
  table,
  onClose,
  onPrintBon,
  onSaveDraft,
  onCompletePayment,
  onUpdateItem,
  onRemoveItem,
  onAddMoreItems,
}) => {
  const { language } = useLanguage();
  const [showPrintSelector, setShowPrintSelector] = useState(false);
  const [kitchenTickets, setKitchenTickets] = useState(1);
  const [editingInstructions, setEditingInstructions] = useState<string | null>(null);
  const [tempInstructions, setTempInstructions] = useState('');

  if (!isOpen) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price) + ' XAF';
  };

  const handlePrintBon = () => {
    onPrintBon(kitchenTickets);
    setShowPrintSelector(false);
    setKitchenTickets(1);
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

  const getOrderTypeLabel = () => {
    switch (orderType) {
      case 'dine-in':
        return t('pos_dine_in', language) || 'Dine In';
      case 'takeaway':
        return t('pos_takeaway', language) || 'Takeaway';
      case 'delivery':
        return t('pos_delivery', language) || 'Delivery';
      default:
        return orderType;
    }
  };

  const existingTotal = mode === 'edit' && existingItems.length > 0
    ? existingItems.reduce((sum, item) => {
        const price = item.modifiedPrice ?? item.dish.price;
        return sum + (price * item.quantity);
      }, 0)
    : 0;

  const newItemsTotal = newItems.reduce((sum, item) => {
    const price = item.modifiedPrice ?? item.dish.price;
    return sum + (price * item.quantity);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary to-primary/90 text-white">
          <div>
            <h2 className="text-xl font-semibold">
              {mode === 'edit'
                ? `${t('pos_edit_order', language) || 'Edit Order'} ${existingOrderId ? `#${existingOrderId.slice(-6)}` : ''}`
                : t('pos_order_review', language) || 'Order Review'}
            </h2>
            <div className="flex items-center space-x-3 mt-1 text-sm">
              <span className="px-2 py-0.5 bg-white/20 rounded">
                {getOrderTypeLabel()}
              </span>
              {table && (
                <span className="px-2 py-0.5 bg-white/20 rounded">
                  {t('table', language) || 'Table'} {table.number}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Existing Items Section (Edit Mode Only) */}
          {mode === 'edit' && existingItems.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center">
                <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                {t('pos_existing_items', language) || 'Existing Items (Already Sent)'}
              </h3>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                {existingItems.map(item => (
                  <div key={item.dish.id} className="flex items-center justify-between text-sm opacity-75">
                    <div className="flex items-center space-x-3">
                      {item.dish.image && (
                        <img
                          src={item.dish.image}
                          alt={item.dish.title}
                          className="w-10 h-10 rounded object-cover"
                        />
                      )}
                      <div>
                        <span className="font-medium">{item.quantity}x {item.dish.title}</span>
                        {item.specialInstructions && (
                          <p className="text-xs text-gray-500 italic">{item.specialInstructions}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-gray-500">{t('pos_sent', language) || 'Sent'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Items Section */}
          <div>
            <h3 className="text-sm font-semibold text-primary mb-2 flex items-center">
              <span className="w-2 h-2 bg-primary rounded-full mr-2 animate-pulse"></span>
              {mode === 'edit'
                ? t('pos_new_items', language) || 'New Items to Add'
                : t('pos_order_items', language) || 'Order Items'}
            </h3>
            {newItems.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <AlertCircle size={24} className="mx-auto text-yellow-600 mb-2" />
                <p className="text-sm text-yellow-700">
                  {t('pos_no_items', language) || 'No items in cart'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {newItems.map(item => (
                  <div key={item.dish.id} className="bg-white border border-primary/20 rounded-lg p-3">
                    <div className="flex items-start space-x-3">
                      {/* Image */}
                      {item.dish.image && (
                        <img
                          src={item.dish.image}
                          alt={item.dish.title}
                          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                        />
                      )}

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{item.dish.title}</h4>
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
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveInstructions(item.dish.id);
                                }
                                if (e.key === 'Escape') {
                                  setEditingInstructions(null);
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
                            <span className="italic">{item.specialInstructions}</span>
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
                              onClick={() => onUpdateItem(item.dish.id, { quantity: item.quantity - 1 })}
                              className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <button
                              onClick={() => onUpdateItem(item.dish.id, { quantity: item.quantity + 1 })}
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

          {/* Add More Items Button */}
          <button
            onClick={onAddMoreItems}
            className="w-full mt-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary hover:text-primary transition-colors flex items-center justify-center space-x-2"
          >
            <Plus size={18} />
            <span className="font-medium">{t('pos_add_more_items', language) || 'Add More Items'}</span>
          </button>

          {/* Totals */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-2">
            {mode === 'edit' && existingTotal > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>{t('pos_existing_total', language) || 'Existing Total'}:</span>
                <span>{formatPrice(existingTotal)}</span>
              </div>
            )}
            {mode === 'edit' && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>{t('pos_new_items_total', language) || 'New Items'}:</span>
                <span>{formatPrice(newItemsTotal)}</span>
              </div>
            )}
            {mode === 'new' && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>{t('subtotal', language) || 'Subtotal'}:</span>
                <span>{formatPrice(cartTotals.subtotal)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-lg pt-2 border-t">
              <span>{t('total', language) || 'Total'}:</span>
              <span className="text-primary">
                {mode === 'edit' ? formatPrice(existingTotal + newItemsTotal) : formatPrice(cartTotals.total)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer - Action Buttons */}
        {!showPrintSelector ? (
          <div className="p-4 border-t bg-gray-50">
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setShowPrintSelector(true)}
                disabled={newItems.length === 0}
                className="flex flex-col items-center justify-center py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer size={20} className="mb-1" />
                <span className="text-sm font-medium">
                  {mode === 'edit'
                    ? t('pos_print_new_items', language) || 'Print New'
                    : t('pos_print_bon', language) || 'Print Bon'}
                </span>
              </button>

              <button
                onClick={onSaveDraft}
                disabled={newItems.length === 0}
                className="flex flex-col items-center justify-center py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={20} className="mb-1" />
                <span className="text-sm font-medium">
                  {mode === 'edit'
                    ? t('pos_save_changes', language) || 'Save'
                    : t('pos_save_draft', language) || 'Draft'}
                </span>
              </button>

              <button
                onClick={onCompletePayment}
                disabled={newItems.length === 0}
                className="flex flex-col items-center justify-center py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CreditCard size={20} className="mb-1" />
                <span className="text-sm font-medium">
                  {t('pos_complete_payment', language) || 'Payment'}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 border-t bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">
                {t('pos_select_tickets', language) || 'Number of tickets to print'}:
              </span>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setKitchenTickets(Math.max(1, kitchenTickets - 1))}
                  className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-full"
                >
                  <Minus size={16} />
                </button>
                <span className="w-8 text-center font-semibold text-lg">{kitchenTickets}</span>
                <button
                  onClick={() => setKitchenTickets(kitchenTickets + 1)}
                  className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-full"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowPrintSelector(false)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {t('cancel', language) || 'Cancel'}
              </button>
              <button
                onClick={handlePrintBon}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
              >
                <Printer size={18} />
                <span>{t('pos_confirm_print', language) || 'Confirm & Print'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default POSOrderReviewModal;
