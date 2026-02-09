import React from 'react';
import { X, AlertTriangle, CreditCard, DollarSign } from 'lucide-react';
import { formatPrice } from '@utils/formatting/formatPrice';

interface AmountTooLowModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAmount: number;
  minimumAmount: number;
  currency?: string;
  onAddMoreItems?: () => void;
}

export const AmountTooLowModal: React.FC<AmountTooLowModalProps> = ({
  isOpen,
  onClose,
  currentAmount,
  minimumAmount,
  currency = 'XAF',
  onAddMoreItems
}) => {
  if (!isOpen) return null;


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Amount Too Low</h3>
              <p className="text-sm text-gray-600">Payment amount below minimum</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-4">
            {/* Current Amount */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <DollarSign className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Your Order Total</p>
                  <p className="text-2xl font-bold text-gray-900">{formatPrice(currentAmount, currency)}</p>
                </div>
              </div>
            </div>

            {/* Minimum Amount */}
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <CreditCard className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-red-700">Minimum Required</p>
                  <p className="text-2xl font-bold text-red-900">{formatPrice(minimumAmount, currency)}</p>
                </div>
              </div>
            </div>

            {/* Message */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Payment Method Limitation</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Online payments require a minimum amount of {formatPrice(minimumAmount, currency)}.
                    You can either add more items to your cart or choose "Pay Onsite" instead.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => {
              onClose();
              if (onAddMoreItems) {
                onAddMoreItems();
              }
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Add More Items
          </button>
        </div>
      </div>
    </div>
  );
};

export default AmountTooLowModal;
