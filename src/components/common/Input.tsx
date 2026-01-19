import { InputHTMLAttributes, forwardRef, useState, useEffect, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helpText, className = '', type = 'text', ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    // Combine refs: support both forwarded ref and internal ref
    useEffect(() => {
      if (typeof ref === 'function') {
        ref(inputRef.current);
      } else if (ref) {
        ref.current = inputRef.current;
      }
    }, [ref]);

    // Prevent wheel event from changing number input values
    // Use non-passive event listener to allow preventDefault
    useEffect(() => {
      const input = inputRef.current;
      if (!input || type !== 'number') return;

      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        // Blur the input to prevent accidental value changes
        input.blur();
      };

      // Add event listener with { passive: false } to allow preventDefault
      input.addEventListener('wheel', handleWheel, { passive: false });

      return () => {
        input.removeEventListener('wheel', handleWheel);
      };
    }, [type]);

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={inputRef}
            type={inputType}
            className={`w-full rounded-md border ${
              error ? 'border-red-300' : 'border-gray-300'
            } shadow-sm px-3 py-2 focus:outline-none focus:ring-1 ${
              error ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-indigo-500 focus:border-indigo-500'
            } ${isPassword ? 'pr-10' : ''} ${className}`}
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

Input.displayName = 'Input';

export default Input;