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

  // Detect country code from value on mount or when value changes
  useEffect(() => {
    if (value) {
      // Check if value starts with any country code
      for (const country of countryCodes) {
        if (value.startsWith(country.dialCode)) {
          setSelectedCountry(prevCountry => {
            // Only update if different to avoid unnecessary re-renders
            if (prevCountry.code !== country.code) {
              return country;
            }
            return prevCountry;
          });
          break;
        }
      }
    } else {
      // If value is empty, reset to default country
      setSelectedCountry(prevCountry => {
        if (prevCountry.code !== defaultCountry.code) {
          return defaultCountry;
        }
        return prevCountry;
      });
    }
  }, [value]);

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
    // Only combine if there's a number part
    const currentNumber = getDisplayValue();
    if (currentNumber) {
      // Simple combination: country code + number (no complex normalization)
      const fullNumber = `${country.dialCode}${currentNumber}`;
      onChange(fullNumber);
    } else {
      // If no number, keep it empty
      onChange('');
    }
    
    // Focus back to input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Handle phone number input - user types ONLY digits
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Remove any non-digit characters - user should only type digits
    let cleanValue = inputValue.replace(/[^\d]/g, '');
    
    // Remove country code digits if they were accidentally included
    // The input should only contain the number part, not the country code
    const countryCodeDigits = selectedCountry.dialCode.replace(/\D/g, '');
    if (cleanValue.startsWith(countryCodeDigits)) {
      cleanValue = cleanValue.substring(countryCodeDigits.length);
    }
    
    // Remove leading zeros
    cleanValue = cleanValue.replace(/^0+/, '');
    
    // Send to parent: combine country code + digits (simple, no complex normalization)
    if (cleanValue) {
      const fullNumber = `${selectedCountry.dialCode}${cleanValue}`;
      onChange(fullNumber);
    } else {
      // If input is empty, send empty string
      onChange('');
    }
  };

  // Handle input focus
  const handleInputFocus = () => {
    // Don't do anything on focus - let user type naturally
    // The input will show only the number part (via getDisplayValue)
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

  // Parse current value to extract ONLY the number part (digits only, no country code)
  const getDisplayValue = () => {
    if (!value) return '';
    
    // Remove all non-digits first to get pure digits
    let digitsOnly = value.replace(/\D/g, '');
    
    // If value starts with a country code, extract the number part
    // Check all country codes, starting with the selected one
    const countriesToCheck = [selectedCountry, ...countryCodes.filter(c => c.code !== selectedCountry.code)];
    
    for (const country of countriesToCheck) {
      const countryDigits = country.dialCode.replace(/\D/g, '');
      if (digitsOnly.startsWith(countryDigits)) {
        let numberPart = digitsOnly.substring(countryDigits.length);
        // Handle duplicate country codes (e.g., "237237658789345" -> "237658789345" -> "658789345")
        if (numberPart.startsWith(countryDigits)) {
          numberPart = numberPart.substring(countryDigits.length);
        }
        // Remove any leading zeros
        return numberPart.replace(/^0+/, '');
      }
    }
    
    // If no country code found, return digits as-is (remove leading zeros)
    return digitsOnly.replace(/^0+/, '');
  };

  // Get full phone number with country code for display
  const getFullPhoneNumber = () => {
    const displayValue = getDisplayValue();
    if (!displayValue) return '';
    return `${selectedCountry.dialCode}${displayValue}`;
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

      {/* Full Phone Number Display - Always show when there's a number */}
      {getDisplayValue() && (
        <p className="text-xs text-gray-500 mt-1">
          Full number: {getFullPhoneNumber()}
        </p>
      )}
    </div>
  );
};

export default PhoneInput;
