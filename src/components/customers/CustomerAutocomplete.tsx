import React from 'react';
import { User, Phone, MapPin, Check } from 'lucide-react';
import { useCustomerAutocomplete } from '@hooks/forms/useCustomerAutocomplete';
import type { Customer } from '../../types/models';

interface CustomerAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectCustomer?: (customer: Customer) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  error?: string;
  helpText?: string;
  /**
   * Minimum number of characters before showing suggestions
   * @default 1
   */
  minChars?: number;
  /**
   * Maximum number of suggestions to show
   * @default 10
   */
  maxSuggestions?: number;
  /**
   * Whether to search by name
   * @default true
   */
  searchByName?: boolean;
  /**
   * Whether to search by phone
   * @default true
   */
  searchByPhone?: boolean;
  /**
   * Whether to search by location
   * @default false
   */
  searchByLocation?: boolean;
}

const CustomerAutocomplete: React.FC<CustomerAutocompleteProps> = ({
  value,
  onChange,
  onSelectCustomer,
  placeholder = 'Rechercher un client (nom ou téléphone)',
  label,
  className = '',
  disabled = false,
  error,
  helpText,
  minChars = 1,
  maxSuggestions = 10,
  searchByName = true,
  searchByPhone = true,
  searchByLocation = false
}) => {
  const {
    searchTerm,
    suggestions,
    isOpen,
    selectedCustomer,
    containerRef,
    handleSearchChange,
    handleSelectCustomer,
    setIsOpen
  } = useCustomerAutocomplete({
    minChars,
    maxSuggestions,
    searchByName,
    searchByPhone,
    searchByLocation
  });

  // Sync external value with internal search term
  React.useEffect(() => {
    if (value !== searchTerm) {
      handleSearchChange(value);
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    handleSearchChange(newValue);
  };

  const handleCustomerClick = (customer: Customer) => {
    handleSelectCustomer(customer);
    onChange(customer.name || customer.phone || '');
    onSelectCustomer?.(customer);
  };

  const getMatchIcon = (matchType: string) => {
    switch (matchType) {
      case 'phone':
        return <Phone className="w-3 h-3 text-blue-500" />;
      case 'location':
        return <MapPin className="w-3 h-3 text-green-500" />;
      case 'multiple':
        return <Check className="w-3 h-3 text-purple-500" />;
      default:
        return <User className="w-3 h-3 text-gray-500" />;
    }
  };

  const highlightMatch = (text: string, searchTerm: string): React.ReactNode => {
    if (!searchTerm.trim()) return text;
    
    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => {
          if (value.trim().length >= minChars && suggestions.length > 0) {
            setIsOpen(true);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          w-full px-4 py-2 border rounded-md shadow-sm
          focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'}
        `}
      />

      {helpText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helpText}</p>
      )}

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
          data-dropdown="customer-autocomplete"
        >
          <div className="p-2 bg-gray-50 border-b sticky top-0">
            <div className="text-xs font-medium text-gray-600">
              {suggestions.length} {suggestions.length === 1 ? 'client trouvé' : 'clients trouvés'}
            </div>
          </div>

          {suggestions.map((customer) => (
            <button
              key={customer.id}
              type="button"
              className="w-full px-4 py-3 text-left hover:bg-emerald-50 border-b border-gray-100 last:border-b-0 transition-colors"
              onClick={() => handleCustomerClick(customer)}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 flex-shrink-0">
                  {getMatchIcon(customer.matchType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">
                    {customer.name ? highlightMatch(customer.name, searchTerm) : 'Client de passage'}
                  </div>
                  {customer.phone && (
                    <div className="text-sm text-gray-600 mt-1">
                      <Phone className="w-3 h-3 inline mr-1" />
                      {highlightMatch(customer.phone, searchTerm)}
                    </div>
                  )}
                  {customer.quarter && (
                    <div className="text-xs text-gray-500 mt-1">
                      <MapPin className="w-3 h-3 inline mr-1" />
                      {customer.quarter}
                    </div>
                  )}
                </div>
                {selectedCustomer?.id === customer.id && (
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-1" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && suggestions.length === 0 && value.trim().length >= minChars && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-4">
          <div className="text-sm text-gray-500 text-center">
            Aucun client trouvé pour "{value}"
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerAutocomplete;

