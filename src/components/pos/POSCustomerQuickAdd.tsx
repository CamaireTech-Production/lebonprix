import { User, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Customer } from '../../types/models';
import { normalizePhoneForComparison } from '../../utils/phoneUtils';

interface POSCustomerQuickAddProps {
  customer: { name: string; phone: string; quarter?: string } | null;
  customerSearch: string;
  onCustomerSearch: (value: string) => void;
  onSelectCustomer: (customer: Customer) => void;
  onSetWalkIn: () => void;
  onClearCustomer: () => void;
  showDropdown: boolean;
  customers: Customer[];
  customerInputRef: React.RefObject<HTMLInputElement>;
}

export const POSCustomerQuickAdd: React.FC<POSCustomerQuickAddProps> = ({
  customer,
  customerSearch,
  onCustomerSearch,
  onSelectCustomer,
  onSetWalkIn,
  onClearCustomer,
  showDropdown,
  customers,
  customerInputRef,
}) => {
  const { t } = useTranslation();

  const filteredCustomers = customerSearch
    ? customers.filter(c => {
        const normalizedSearch = normalizePhoneForComparison(customerSearch);
        if (normalizedSearch.length >= 2 && /\d/.test(customerSearch)) {
          // Phone search
          if (!c.phone) return false;
          const customerPhone = normalizePhoneForComparison(c.phone);
          return customerPhone.includes(normalizedSearch) || normalizedSearch.includes(customerPhone);
        } else if (customerSearch.length >= 2) {
          // Name search
          if (!c.name) return false;
          return c.name.toLowerCase().includes(customerSearch.toLowerCase());
        }
        return false;
      })
    : [];

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        <User className="inline h-4 w-4 mr-1" />
        {t('pos.customer.title')}
      </label>
      
      {customer ? (
        <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div>
            <div className="font-medium text-gray-900">{customer.name}</div>
            {customer.phone && (
              <div className="text-sm text-gray-600">{customer.phone}</div>
            )}
            {customer.quarter && (
              <div className="text-xs text-gray-500">{customer.quarter}</div>
            )}
          </div>
          <button
            onClick={onClearCustomer}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            ref={customerInputRef}
            type="text"
            value={customerSearch}
            onChange={(e) => onCustomerSearch(e.target.value)}
            placeholder={t('pos.customer.searchPlaceholder')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          
          {showDropdown && filteredCustomers.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredCustomers.slice(0, 5).map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectCustomer(c)}
                  className="w-full text-left p-3 hover:bg-emerald-50 border-b border-gray-100 last:border-b-0 transition-colors"
                >
                  <div className="font-medium text-gray-900">{c.name || 'Divers'}</div>
                  <div className="text-sm text-gray-500">
                    {c.phone}{c.quarter ? ` • ${c.quarter}` : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
          
          <button
            onClick={onSetWalkIn}
            className="mt-2 w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm"
          >
            {t('pos.customer.walkIn')}
          </button>
        </div>
      )}
    </div>
  );
};

