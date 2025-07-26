import { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2, Plus } from 'lucide-react';
import React from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const Button = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-500',
    secondary: 'bg-gray-700 text-white hover:bg-gray-800 focus:ring-gray-700',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
    outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-indigo-500'
  };
  
  const sizeClasses = {
    sm: 'text-sm px-3 py-2',
    md: 'text-base px-4 py-2',
    lg: 'text-lg px-6 py-3'
  };
  
  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    disabled || isLoading ? 'opacity-70 cursor-not-allowed' : '',
    className
  ].join(' ');

  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span>{children}</span>
        </>
      ) : (
        <>
          {icon && <span className="mr-2">{icon}</span>}
          <span>{children}</span>
        </>
      )}
    </button>
  );
};

export const FloatingActionButton: React.FC<{ onClick: () => void; label?: string }> = ({ onClick, label }) => {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div className="fixed bottom-20 right-6 z-50 flex flex-col items-end">
      {hovered && label && (
        <div className="mb-2 px-3 py-1 rounded bg-gray-900 text-white text-xs shadow-lg animate-fade-in">
          {label}
        </div>
      )}
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg w-16 h-16 flex items-center justify-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        aria-label={label || 'Add'}
        title={label || 'Add'}
      >
        <Plus size={32} />
      </button>
    </div>
  );
};

export default Button;