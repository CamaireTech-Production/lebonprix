import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { MoreVertical, CheckCircle, XCircle, Edit, MessageSquare, Trash2, Eye, DollarSign } from 'lucide-react';
import { Order } from '../../types/order';

interface OrderActionsMenuProps {
  order: Order;
  onViewDetails: () => void;
  onEditStatus: () => void;
  onAddNote: () => void;
  onDelete: () => void;
  onMarkAsDelivered: () => void;
  onMarkAsCancelled: () => void;
  onMarkAsPaid: () => void;
  disabled?: boolean;
}

const OrderActionsMenu: React.FC<OrderActionsMenuProps> = ({
  order,
  onViewDetails,
  onEditStatus,
  onAddNote,
  onDelete,
  onMarkAsDelivered,
  onMarkAsCancelled,
  onMarkAsPaid,
  disabled = false
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Calculate menu position (above the button)
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setMenuPosition({
          top: rect.top + window.scrollY - 8, // Position above the button with 8px gap
          left: rect.right + window.scrollX - 224 // 224px = w-56 (14rem)
        });
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const canMarkAsDelivered = order.status !== 'delivered' && order.status !== 'cancelled';
  const canMarkAsCancelled = order.status !== 'cancelled';
  const canMarkAsPaid = order.paymentStatus !== 'paid' && order.paymentStatus !== 'cancelled';

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  const menuContent = isOpen ? (
    <div
      ref={menuRef}
      className="fixed rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-[9999] w-56"
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        transform: 'translateY(-100%)', // Position above by translating up by 100% of its height
      }}
      role="menu"
    >
      <div className="py-1">
        <button
          onClick={() => handleAction(onViewDetails)}
          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          role="menuitem"
        >
          <Eye className="w-4 h-4 mr-3 text-gray-400" />
          {t('orders.quickActions.viewDetails')}
        </button>

        {canMarkAsDelivered && (
          <button
            onClick={() => handleAction(onMarkAsDelivered)}
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            role="menuitem"
          >
            <CheckCircle className="w-4 h-4 mr-3 text-green-500" />
            {t('orders.quickActions.markAsDelivered')}
          </button>
        )}

        {canMarkAsPaid && (
          <button
            onClick={() => handleAction(onMarkAsPaid)}
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            role="menuitem"
          >
            <DollarSign className="w-4 h-4 mr-3 text-green-600" />
            {t('orders.quickActions.markAsPaid')}
          </button>
        )}

        {canMarkAsCancelled && (
          <button
            onClick={() => handleAction(onMarkAsCancelled)}
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            role="menuitem"
          >
            <XCircle className="w-4 h-4 mr-3 text-red-500" />
            {t('orders.quickActions.markAsCancelled')}
          </button>
        )}

        <div className="border-t border-gray-100 my-1" />

        <button
          onClick={() => handleAction(onEditStatus)}
          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          role="menuitem"
        >
          <Edit className="w-4 h-4 mr-3 text-gray-400" />
          {t('orders.quickActions.editStatus')}
        </button>

        <button
          onClick={() => handleAction(onAddNote)}
          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          role="menuitem"
        >
          <MessageSquare className="w-4 h-4 mr-3 text-gray-400" />
          {t('orders.quickActions.addNote')}
        </button>

        <div className="border-t border-gray-100 my-1" />

        <button
          onClick={() => handleAction(onDelete)}
          className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          role="menuitem"
        >
          <Trash2 className="w-4 h-4 mr-3" />
          {t('orders.quickActions.delete')}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={t('orders.quickActions.menu')}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
      {typeof document !== 'undefined' && createPortal(menuContent, document.body)}
    </>
  );
};

export default OrderActionsMenu;

