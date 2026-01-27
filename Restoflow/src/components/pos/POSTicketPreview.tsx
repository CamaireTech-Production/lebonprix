// POSTicketPreview - Preview ticket before printing with edit capability
import React, { useState } from 'react';
import { X, Printer, Minus, Plus, ChefHat, Receipt, Edit3, MessageSquare } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import type { POSCartItem, POSOrderType } from '../../types/pos';
import type { Table } from '../../types/index';

interface POSTicketPreviewProps {
  isOpen: boolean;
  cart: POSCartItem[];
  orderType: POSOrderType;
  table?: Table | null;
  deliveryFee: number;
  onClose: () => void;
  onConfirm: (kitchenTickets: number, cashierTickets: number, notes: string) => void;
  onUpdateItem: (dishId: string, updates: Partial<POSCartItem>) => void;
  onRemoveItem: (dishId: string) => void;
  isSubmitting: boolean;
}

const POSTicketPreview: React.FC<POSTicketPreviewProps> = ({
  isOpen,
  cart,
  orderType,
  table,
  deliveryFee,
  onClose,
  onConfirm,
  onUpdateItem,
  onRemoveItem,
  isSubmitting,
}) => {
  const { language } = useLanguage();
  const [kitchenTickets, setKitchenTickets] = useState(1);
  const [cashierTickets, setCashierTickets] = useState(1);
  const [orderNotes, setOrderNotes] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [tempInstructions, setTempInstructions] = useState('');

  if (!isOpen) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price) + ' XAF';
  };

  const subtotal = cart.reduce((sum, item) => {
    const price = item.modifiedPrice ?? item.dish.price;
    return sum + (price * item.quantity);
  }, 0);

  const total = subtotal + (orderType === 'delivery' ? deliveryFee : 0);

  const handleConfirm = () => {
    onConfirm(kitchenTickets, cashierTickets, orderNotes);
  };

  const handleClose = () => {
    setKitchenTickets(1);
    setCashierTickets(1);
    setOrderNotes('');
    setEditingItem(null);
    onClose();
  };

  const handleEditInstructions = (dishId: string, currentInstructions?: string) => {
    setEditingItem(dishId);
    setTempInstructions(currentInstructions || '');
  };

  const handleSaveInstructions = (dishId: string) => {
    onUpdateItem(dishId, { specialInstructions: tempInstructions || undefined });
    setEditingItem(null);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-green-600 text-white">
          <div className="flex items-center space-x-2">
            <Printer size={20} />
            <h2 className="text-lg font-semibold">
              {t('pos_ticket_preview', language) || 'Ticket Preview'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Ticket Preview */}
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 mb-4">
            {/* Ticket Header */}
            <div className="text-center border-b border-gray-300 pb-3 mb-3">
              <h3 className="text-xl font-bold">
                {t('pos_kitchen_ticket', language) || 'KITCHEN TICKET'}
              </h3>
              <div className="text-sm text-gray-600 mt-1">
                {new Date().toLocaleString()}
              </div>
              <div className="flex justify-center gap-4 mt-2 text-sm">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                  {getOrderTypeLabel()}
                </span>
                {table && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                    {t('table', language) || 'Table'} {table.number}
                  </span>
                )}
              </div>
            </div>

            {/* Order Items */}
            <div className="space-y-3">
              {cart.map((item, index) => (
                <div key={item.dish.id} className="border-b border-gray-200 pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-lg">{item.quantity}x</span>
                        <span className="font-semibold">{item.dish.title}</span>
                      </div>

                      {/* Special Instructions */}
                      {editingItem === item.dish.id ? (
                        <div className="mt-2 flex items-center space-x-2">
                          <input
                            type="text"
                            value={tempInstructions}
                            onChange={(e) => setTempInstructions(e.target.value)}
                            placeholder={t('pos_instructions_placeholder', language) || 'Special instructions...'}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveInstructions(item.dish.id);
                              if (e.key === 'Escape') setEditingItem(null);
                            }}
                          />
                          <button
                            onClick={() => handleSaveInstructions(item.dish.id)}
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            {t('save', language) || 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingItem(null)}
                            className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          >
                            {t('cancel', language) || 'Cancel'}
                          </button>
                        </div>
                      ) : item.specialInstructions ? (
                        <div
                          className="mt-1 text-sm text-orange-600 italic flex items-center space-x-1 cursor-pointer hover:text-orange-700"
                          onClick={() => handleEditInstructions(item.dish.id, item.specialInstructions)}
                        >
                          <MessageSquare size={12} />
                          <span>*** {item.specialInstructions} ***</span>
                          <Edit3 size={12} />
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditInstructions(item.dish.id)}
                          className="mt-1 text-xs text-gray-400 hover:text-gray-600 flex items-center space-x-1"
                        >
                          <MessageSquare size={12} />
                          <span>{t('pos_add_note', language) || 'Add note'}</span>
                        </button>
                      )}
                    </div>

                    <div className="text-right ml-4">
                      <div className="font-semibold">
                        {formatPrice((item.modifiedPrice ?? item.dish.price) * item.quantity)}
                      </div>
                      <button
                        onClick={() => onRemoveItem(item.dish.id)}
                        className="text-xs text-red-500 hover:text-red-700 mt-1"
                      >
                        {t('remove', language) || 'Remove'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t-2 border-gray-400 mt-4 pt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span>{t('subtotal', language) || 'Subtotal'}:</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {orderType === 'delivery' && deliveryFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span>{t('delivery_fee', language) || 'Delivery'}:</span>
                  <span>{formatPrice(deliveryFee)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>{t('total', language) || 'TOTAL'}:</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>

            {/* Order Notes */}
            <div className="mt-4 pt-3 border-t border-gray-300">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                {t('pos_order_notes', language) || 'Order Notes (optional)'}
              </label>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder={t('pos_order_notes_placeholder', language) || 'General notes for this order...'}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                rows={2}
              />
            </div>
          </div>

          {/* Print Options */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">
              {t('pos_print_options', language) || 'Print Options'}
            </h4>

            {/* Kitchen Tickets */}
            <div className="flex items-center justify-between bg-orange-50 p-3 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <ChefHat size={20} className="text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {t('pos_kitchen_tickets', language) || 'Kitchen Tickets'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t('pos_kitchen_tickets_desc', language) || 'For the kitchen/chef'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setKitchenTickets(Math.max(0, kitchenTickets - 1))}
                  className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Minus size={16} />
                </button>
                <span className="w-8 text-center font-semibold text-lg">{kitchenTickets}</span>
                <button
                  onClick={() => setKitchenTickets(kitchenTickets + 1)}
                  className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Cashier Tickets */}
            <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Receipt size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {t('pos_cashier_tickets', language) || 'Cashier Tickets'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t('pos_cashier_tickets_desc', language) || 'For the cashier/customer'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setCashierTickets(Math.max(0, cashierTickets - 1))}
                  className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Minus size={16} />
                </button>
                <span className="w-8 text-center font-semibold text-lg">{cashierTickets}</span>
                <button
                  onClick={() => setCashierTickets(cashierTickets + 1)}
                  className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Warning if no tickets */}
            {kitchenTickets === 0 && cashierTickets === 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-700">
                  {t('pos_no_tickets_warning', language) || 'No tickets will be printed. The order will still be created.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {t('cancel', language) || 'Cancel'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || cart.length === 0}
            className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>{t('processing', language) || 'Processing...'}</span>
              </>
            ) : (
              <>
                <Printer size={18} />
                <span>
                  {t('pos_send_and_print', language) || 'Send & Print'}
                  {(kitchenTickets + cashierTickets) > 0 && ` (${kitchenTickets + cashierTickets})`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSTicketPreview;
