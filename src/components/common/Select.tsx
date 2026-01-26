import React from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  label?: string;
  error?: string;
  helpText?: string;
  fullWidth?: boolean;
}

const Select: React.FC<SelectProps> = ({
  options,
  label,
  error,
  helpText,
  className = '',
  fullWidth = true,
  ...props
}) => {
  return (
    <div className={`${fullWidth ? 'w-full' : 'inline-block w-auto'}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <select
        className={`
          block w-full px-4 py-3 rounded-md border border-gray-200 shadow-sm
          focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm
          bg-white text-gray-900
          ${error ? 'border-red-300' : ''}
          ${className}
        `}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {helpText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helpText}</p>
      )}
    </div>
  );
};

export default Select; 