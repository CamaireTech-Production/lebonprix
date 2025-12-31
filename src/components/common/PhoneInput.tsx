import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { countryCodes, defaultCountry, type CountryCode } from '../../data/countryCodes';
import { normalizePhoneNumber } from '@utils/core/phoneUtils';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  className?: string;
}

const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  error,
  placeholder = "Enter phone number",
  className = ""
}) => {
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(defaultCountry);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter countries based on search query
  const filteredCountries = countryCodes.filter(country =>
    country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    country.dialCode.includes(searchQuery) ||
    country.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle country selection
  const handleCountrySelect = (country: CountryCode) => {
    setSelectedCountry(country);
    setIsDropdownOpen(false);
    setSearchQuery('');
    
    // Update the phone number with new country code
    const currentNumber = getDisplayValue();
    if (currentNumber) {
      onChange(`${country.dialCode}${currentNumber}`);
    } else {
      onChange(country.dialCode);
    }
    
    // Focus back to input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Handle phone number input
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Remove any non-digit characters
    const cleanValue = inputValue.replace(/[^\d]/g, '');
    
    // Send the full phone number (country code + number) to parent
    const fullNumber = cleanValue ? `${selectedCountry.dialCode}${cleanValue}` : selectedCountry.dialCode;
    
    // Normalize the phone number before sending to parent
    const normalized = normalizePhoneNumber(fullNumber, selectedCountry.dialCode);
    onChange(normalized);
  };

  // Handle input focus
  const handleInputFocus = () => {
    // If input is empty, set the country code
    if (!value) {
      onChange(selectedCountry.dialCode);
    } else {
      // Normalize existing value on focus
      const normalized = normalizePhoneNumber(value, selectedCountry.dialCode);
      if (normalized !== value) {
        onChange(normalized);
      }
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Parse current value to extract country code and number
  const getDisplayValue = () => {
    if (!value) return '';
    
    // If value starts with a country code, extract it
    for (const country of countryCodes) {
      if (value.startsWith(country.dialCode)) {
        return value.substring(country.dialCode.length);
      }
    }
    
    return value;
  };

  // Get full phone number with country code
  const getFullPhoneNumber = () => {
    const displayValue = getDisplayValue();
    return displayValue ? `${selectedCountry.dialCode}${displayValue}` : selectedCountry.dialCode;
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex">
        {/* Country Code Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`flex items-center space-x-2 px-3 py-2 border-r-0 border rounded-l-lg focus:ring-2 focus:ring-theme-brown focus:border-theme-brown ${
              error ? 'border-red-500' : 'border-gray-300'
            } bg-gray-50 hover:bg-gray-100 transition-colors`}
          >
            <span className="text-lg">{selectedCountry.flag}</span>
            <span className="text-sm font-medium text-gray-700">{selectedCountry.dialCode}</span>
            <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-hidden">
              {/* Search Input */}
              <div className="p-3 border-b border-gray-200">
                <input
                  type="text"
                  placeholder="Search countries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Country List */}
              <div className="max-h-48 overflow-y-auto">
                {filteredCountries.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleCountrySelect(country)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                      selectedCountry.code === country.code ? 'bg-emerald-50 text-theme-olive' : ''
                    }`}
                  >
                    <span className="text-lg">{country.flag}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{country.name}</div>
                      <div className="text-xs text-gray-500">{country.dialCode}</div>
                    </div>
                    {selectedCountry.code === country.code && (
                      <div className="w-2 h-2 bg-theme-olive rounded-full"></div>
                    )}
                  </button>
                ))}
              </div>

              {/* No Results */}
              {filteredCountries.length === 0 && (
                <div className="p-3 text-center text-gray-500 text-sm">
                  No countries found
                </div>
              )}
            </div>
          )}
        </div>

        {/* Phone Number Input */}
        <input
          ref={inputRef}
          type="tel"
          value={getDisplayValue()}
          onChange={handlePhoneChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className={`flex-1 px-3 py-2 border rounded-r-lg focus:ring-2 focus:ring-theme-brown focus:border-theme-brown ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
        />
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-red-500 text-xs mt-1">{error}</p>
      )}

      {/* Full Phone Number Display (for debugging) */}
      {process.env.NODE_ENV === 'development' && (
        <p className="text-xs text-gray-400 mt-1">
          Full number: {getFullPhoneNumber()}
        </p>
      )}
    </div>
  );
};

export default PhoneInput;
