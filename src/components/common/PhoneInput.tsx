import React, { useState, useEffect, useRef } from 'react';
import { COUNTRIES, DEFAULT_COUNTRY, Country } from '../../config/phoneConfig';
import { getCountryFromPhone, formatPhoneDigits, normalizePhoneNumber, validatePhonePrefix } from '@utils/core/phoneUtils';
import { ChevronDown, Check } from 'lucide-react';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  helpText?: string;
  disabled?: boolean;
  className?: string; // Additional classes for the container
  required?: boolean;
}

const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  label,
  error,
  helpText,
  disabled = false,
  className = '',
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [displayValue, setDisplayValue] = useState('');
  const [isPrefixInvalid, setIsPrefixInvalid] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize state from props
  useEffect(() => {
    const country = getCountryFromPhone(value);
    setSelectedCountry(country);

    // Extract local part
    // Normalized value is typically +237XXXXXXXXX
    // We want to display formatted local part: XXX XXX XXX

    // First normalize ensuring we work with clean data
    const normalized = normalizePhoneNumber(value, country.code);

    // Remove country code from start
    let localPart = '';
    const codeDigits = country.code.replace('+', '');

    // Remove all non-digits
    const allDigits = normalized.replace(/\D/g, '');

    if (allDigits.startsWith(codeDigits)) {
      localPart = allDigits.substring(codeDigits.length);
    } else {
      // Fallback if something is weird, just keep digits
      localPart = allDigits;
    }

    // Format the local part
    const formatted = formatPhoneDigits(localPart, country);
    setDisplayValue(formatted);

    // Validate prefix initially if value exists
    if (localPart) {
      setIsPrefixInvalid(!validatePhonePrefix(localPart, country));
    }
  }, [value]); // careful with dependency loop, but value comes from parent

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setIsOpen(false);

    // When country changes, keep the local digits but update the prefix
    // Get raw digits from current display value
    const currentDigits = displayValue.replace(/\D/g, '');

    // Re-validate length? For now just switch code.
    // Parent validation will handle if length is incorrect for new country.
    const newValue = `${country.code}${currentDigits}`;
    onChange(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Allow only digits and formatting chars?
    // Let's strip everything to digits first
    const rawDigits = inputValue.replace(/\D/g, '');

    // Check max length for this country (max allowed digits)
    const maxDigits = Math.max(...selectedCountry.digits);

    if (rawDigits.length > maxDigits) {
      // Don't update if too long
      return;
    }

    // Format immediately
    // const formatted = formatPhoneDigits(rawDigits, selectedCountry);
    // setDisplayValue(formatted); // This will happen in useEffect if we trust parent updates fast enough. 
    // But for smooth typing, maybe set local state too? 
    // Actually parent `onChange` updates `value` prop, which triggers `useEffect`.
    // In React controlled inputs, this might cause cursor jumps if formatting changes length.
    // Ideally we just call onChange with E.164.

    // Validate prefix
    const isValidPrefix = validatePhonePrefix(rawDigits, selectedCountry);
    setIsPrefixInvalid(!isValidPrefix);

    const newValue = `${selectedCountry.code}${rawDigits}`;
    onChange(newValue);
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && '*'}
        </label>
      )}

      <div className="relative mt-1 rounded-md shadow-sm flex">
        {/* Country Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            className={`
              relative flex items-center h-full px-3 py-2 border border-r-0 border-gray-300 rounded-l-md bg-gray-50 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors
              ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}
              ${error ? 'border-red-300' : ''}
            `}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
          >
            <span className="flex items-center gap-2">
              <span className="text-xl leading-none" role="img" aria-label={selectedCountry.name}>
                {selectedCountry.flag}
              </span>
              <span className="text-sm font-medium text-gray-700">{selectedCountry.code}</span>
            </span>
            <ChevronDown className={`w-4 h-4 ml-2 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div className="absolute z-10 w-72 mt-1 bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
              {COUNTRIES.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  className={`
                    w-full flex items-center justify-between px-4 py-2 text-sm text-left hover:bg-gray-100 transition-colors
                    ${country.code === selectedCountry.code ? 'bg-indigo-50 text-indigo-900' : 'text-gray-900'}
                  `}
                  onClick={() => handleCountrySelect(country)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl" role="img" aria-label={country.name}>{country.flag}</span>
                    <div className="flex flex-col">
                      <span className="font-medium">{country.name}</span>
                      <span className="text-gray-500 text-xs">{country.code}</span>
                    </div>
                  </div>
                  {country.code === selectedCountry.code && (
                    <Check className="w-4 h-4 text-indigo-600" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Number Input */}
        <input
          type="tel"
          className={`
            flex-1 block w-full rounded-none rounded-r-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm
            ${(error || isPrefixInvalid) ? 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50 text-red-900' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}
          `}
          placeholder={selectedCountry.format.replace(/#/g, '0')} // e.g. 699 00 00 00
          value={displayValue}
          onChange={handleInputChange}
          disabled={disabled}
        />
      </div>

      {isPrefixInvalid && !error && (
        <p className="mt-1 text-sm text-red-600 animate-fadeIn">
          Le numéro doit commencer par {selectedCountry.prefixes?.join(' ou ')}
        </p>
      )}

      {error ? (
        <p className="mt-1 text-sm text-red-600 animate-fadeIn">{error}</p>
      ) : helpText ? (
        <p className="mt-1 text-sm text-gray-500">{helpText}</p>
      ) : null}
    </div>
  );
};

export default PhoneInput;
