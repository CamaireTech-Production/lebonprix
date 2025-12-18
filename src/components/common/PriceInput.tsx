import React, { InputHTMLAttributes, forwardRef, useState, useEffect, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PriceInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  label?: string;
  error?: string;
  helpText?: string;
  value: string | number;
  onChange: (e: { target: { name: string; value: string } }) => void;
  allowDecimals?: boolean; // Default: false for prices (integers only)
  name: string;
}

/**
 * Format a numeric string with French thousand separators (spaces)
 * @param value - The numeric string to format
 * @param allowDecimals - Whether to allow decimal point
 * @returns Formatted string with spaces as thousand separators
 */
const formatPriceForInput = (value: string, allowDecimals: boolean = false): string => {
  if (!value || value === '') return '';
  
  // Remove all non-numeric characters except decimal point if allowed
  const numericValue = allowDecimals 
    ? value.replace(/[^\d.,]/g, '').replace(',', '.') // Support both comma and dot
    : value.replace(/[^\d]/g, '');
  
  if (!numericValue) return '';
  
  // Split into integer and decimal parts
  const parts = numericValue.split('.');
  const integerPart = parts[0] || '';
  const decimalPart = parts[1] || '';
  
  // Format integer part with thousand separators (French format: spaces)
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  
  // Combine with decimal part if exists
  if (allowDecimals && decimalPart) {
    return `${formattedInteger}.${decimalPart}`;
  }
  
  return formattedInteger;
};

/**
 * Parse formatted price string to numeric string (remove formatting)
 * @param value - The formatted string
 * @param allowDecimals - Whether to allow decimal point
 * @returns Numeric string without formatting
 */
const parsePriceFromInput = (value: string, allowDecimals: boolean = false): string => {
  if (!value || value === '') return '';
  
  if (allowDecimals) {
    // Remove all spaces, keep digits and one decimal point
    const cleaned = value.replace(/\s/g, '').replace(',', '.');
    // Ensure only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    return cleaned;
  }
  
  // Remove all non-numeric characters
  return value.replace(/\s/g, '').replace(/[^\d]/g, '');
};

/**
 * Calculate new cursor position after formatting
 * @param oldValue - Value before formatting
 * @param newValue - Value after formatting
 * @param oldCursor - Cursor position before formatting
 * @returns New cursor position
 */
const getCaretPosition = (oldValue: string, newValue: string, oldCursor: number): number => {
  // Count spaces before cursor in old value
  const beforeCursor = oldValue.substring(0, oldCursor);
  const spacesBefore = (beforeCursor.match(/\s/g) || []).length;
  
  // Count spaces before cursor in new value
  const newBeforeCursor = newValue.substring(0, Math.min(oldCursor + (newValue.length - oldValue.length), newValue.length));
  const newSpacesBefore = (newBeforeCursor.match(/\s/g) || []).length;
  
  // Adjust cursor position based on space difference
  const spaceDiff = newSpacesBefore - spacesBefore;
  const newCursor = oldCursor + spaceDiff;
  
  return Math.max(0, Math.min(newCursor, newValue.length));
};

const PriceInput = forwardRef<HTMLInputElement, PriceInputProps>(
  ({ 
    label, 
    error, 
    helpText, 
    className = '', 
    value, 
    onChange, 
    allowDecimals = false,
    name,
    ...props 
  }, ref) => {
    const [displayValue, setDisplayValue] = useState<string>('');
    const [showPassword, setShowPassword] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const caretPositionRef = useRef<number>(0);
    
    // Use forwarded ref or internal ref
    const actualRef = ref || inputRef;
    
    // Convert value to string and format for display
    useEffect(() => {
      const stringValue = value === null || value === undefined ? '' : String(value);
      const numericValue = parsePriceFromInput(stringValue, allowDecimals);
      const formatted = formatPriceForInput(numericValue, allowDecimals);
      setDisplayValue(formatted);
    }, [value, allowDecimals]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const cursorPosition = e.target.selectionStart || 0;
      
      // Store cursor position
      caretPositionRef.current = cursorPosition;
      
      // Parse to get numeric value
      const numericValue = parsePriceFromInput(inputValue, allowDecimals);
      
      // Format for display
      const formatted = formatPriceForInput(numericValue, allowDecimals);
      
      // Update display
      setDisplayValue(formatted);
      
      // Call parent onChange with numeric value
      onChange({
        target: {
          name,
          value: numericValue
        }
      });
      
      // Restore cursor position after formatting
      setTimeout(() => {
        const input = typeof actualRef === 'object' && actualRef?.current 
          ? actualRef.current 
          : (e.target as HTMLInputElement);
        
        if (input) {
          const newCursor = getCaretPosition(inputValue, formatted, cursorPosition);
          input.setSelectionRange(newCursor, newCursor);
        }
      }, 0);
    };
    
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Select all on focus for easier editing
      if (props.onFocus) {
        props.onFocus(e);
      }
    };
    
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Ensure value is properly formatted on blur
      const numericValue = parsePriceFromInput(displayValue, allowDecimals);
      const formatted = formatPriceForInput(numericValue, allowDecimals);
      setDisplayValue(formatted);
      
      if (props.onBlur) {
        props.onBlur(e);
      }
    };
    
    // Password type handling (if needed, though unlikely for price inputs)
    // Note: type is omitted from props, so we default to 'text' for price inputs
    const isPassword = false; // Price inputs don't use password type
    const inputType = 'text';
    
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={actualRef}
            type={inputType}
            name={name}
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={`w-full rounded-md border ${
              error ? 'border-red-300' : 'border-gray-300'
            } shadow-sm px-3 py-2 focus:outline-none focus:ring-1 ${
              error ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-indigo-500 focus:border-indigo-500'
            } ${isPassword ? 'pr-10' : ''} ${className}`}
            inputMode="numeric"
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-500"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        {helpText && !error && <p className="mt-1 text-sm text-gray-500">{helpText}</p>}
      </div>
    );
  }
);

PriceInput.displayName = 'PriceInput';

export default PriceInput;

