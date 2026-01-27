// POSPrintDialog - Dialog for selecting print quantities before sending order to kitchen
import React, { useState } from 'react';
import { X, Printer, ChefHat, Receipt, Minus, Plus } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';

interface POSPrintDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (kitchenTickets: number, cashierTickets: number) => void;
  isSubmitting: boolean;
}

const POSPrintDialog: React.FC<POSPrintDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
}) => {
  const { language } = useLanguage();
  const [kitchenTickets, setKitchenTickets] = useState(1);
  const [cashierTickets, setCashierTickets] = useState(1);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(kitchenTickets, cashierTickets);
  };

  const handleClose = () => {
    // Reset to defaults when closing
    setKitchenTickets(1);
    setCashierTickets(1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-green-600 text-white">
          <div className="flex items-center space-x-2">
            <Printer size={20} />
            <h2 className="text-lg font-semibold">
              {t('pos_print_tickets', language) || 'Print Tickets'}
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
        <div className="p-6 space-y-6">
          {/* Kitchen Tickets */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <ChefHat size={20} className="text-orange-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {t('pos_kitchen_tickets', language) || 'Kitchen Tickets'}
                </p>
                <p className="text-sm text-gray-500">
                  {t('pos_kitchen_tickets_desc', language) || 'For the kitchen/chef'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setKitchenTickets(Math.max(0, kitchenTickets - 1))}
                className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              >
                <Minus size={16} />
              </button>
              <span className="w-8 text-center font-semibold text-lg">{kitchenTickets}</span>
              <button
                onClick={() => setKitchenTickets(kitchenTickets + 1)}
                className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Cashier Tickets */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Receipt size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {t('pos_cashier_tickets', language) || 'Cashier Tickets'}
                </p>
                <p className="text-sm text-gray-500">
                  {t('pos_cashier_tickets_desc', language) || 'For the cashier/customer'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setCashierTickets(Math.max(0, cashierTickets - 1))}
                className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              >
                <Minus size={16} />
              </button>
              <span className="w-8 text-center font-semibold text-lg">{cashierTickets}</span>
              <button
                onClick={() => setCashierTickets(cashierTickets + 1)}
                className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Warning if no tickets selected */}
          {kitchenTickets === 0 && cashierTickets === 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700">
                {t('pos_no_tickets_warning', language) || 'No tickets will be printed. The order will still be created.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-4 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {t('cancel', language) || 'Cancel'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
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
                <span>{t('pos_confirm_print', language) || 'Confirm & Print'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSPrintDialog;
