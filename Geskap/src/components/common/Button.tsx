import { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2, Plus } from 'lucide-react';
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
  children: ReactNode;
}

const Button = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loadingText,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) => {
  const { company } = useAuth();

  // Get company colors with fallbacks - prioritize dashboard colors
  const getCompanyColors = () => {
    const colors = {
      primary: company?.dashboardColors?.primary || company?.primaryColor || '#183524',
      secondary: company?.dashboardColors?.secondary || company?.secondaryColor || '#e2b069',
      tertiary: company?.dashboardColors?.tertiary || company?.tertiaryColor || '#2a4a3a'
    };
    return colors;
  };
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const colors = getCompanyColors();
  
  const variantClasses = {
    primary: 'text-white',
    secondary: 'text-white',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
    outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
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

  // Get button style based on variant
  const getButtonStyle = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: colors.primary,
          '--tw-ring-color': colors.primary
        } as React.CSSProperties;
      case 'secondary':
        return {
          backgroundColor: colors.secondary,
          '--tw-ring-color': colors.secondary
        } as React.CSSProperties;
      default:
        return {};
    }
  };

  return (
    <button
      className={classes}
      style={getButtonStyle()}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span>{loadingText || children}</span>
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
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const { company } = useAuth();
  
  // Get dashboard colors
  const getDashboardColors = () => {
    const colors = {
      primary: company?.dashboardColors?.primary || company?.primaryColor || '#183524',
      secondary: company?.dashboardColors?.secondary || company?.secondaryColor || '#e2b069',
      tertiary: company?.dashboardColors?.tertiary || company?.tertiaryColor || '#2a4a3a'
    };
    return colors;
  };
  
  const colors = getDashboardColors();
  
  // Update button color when hover state changes - use direct style assignment
  React.useEffect(() => {
    if (buttonRef.current) {
      const newColor = hovered ? colors.secondary : colors.primary;
      // Direct assignment to ensure it applies to the entire button
      buttonRef.current.style.backgroundColor = newColor;
      // Also ensure all children inherit
      const icon = buttonRef.current.querySelector('svg');
      if (icon) {
        icon.style.color = 'white';
      }
    }
  }, [hovered, colors.secondary, colors.primary]);
  
  return (
    <div className="fixed bottom-20 right-6 z-50 flex flex-col items-end">
      {hovered && label && (
        <div className="mb-2 px-3 py-1 rounded bg-gray-900 text-white text-xs shadow-lg animate-fade-in">
          {label}
        </div>
      )}
      <button
        ref={buttonRef}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="text-white rounded-full shadow-lg w-16 h-16 flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 hover:scale-105"
        style={{
          backgroundColor: colors.primary,
          '--tw-ring-color': colors.primary
        } as React.CSSProperties & { backgroundColor: string }}
        aria-label={label || 'Add'}
        title={label || 'Add'}
      >
        <Plus size={32} className="pointer-events-none" style={{ color: 'inherit' }} />
      </button>
    </div>
  );
};

export default Button;