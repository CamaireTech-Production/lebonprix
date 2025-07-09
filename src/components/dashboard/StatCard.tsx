import { ReactNode, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Card from '../common/Card';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  tooltipKey?: string;
  type: 'sales' | 'expenses' | 'profit' | 'products' | 'orders' | 'delivery' | 'solde';
  className?: string;
}

const StatCard = ({ title, value, icon, trend, tooltipKey, type, className = '' }: StatCardProps) => {
  const { t } = useTranslation();
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0, placement: 'top' as 'top' | 'bottom' });
  const triggerRef = useRef<HTMLDivElement>(null);

  // Handle tooltip positioning
  useEffect(() => {
    if (!showTooltip || !triggerRef.current) return;

    const trigger = triggerRef.current;
    const rect = trigger.getBoundingClientRect();
    
    // Tooltip dimensions (approximate)
    const tooltipWidth = 288; // w-72 = 18rem = 288px
    const tooltipHeight = 80; // Approximate height
    const gap = 2; // Minimal gap for very close positioning

    // Calculate position centered above the info icon
    const iconCenterX = rect.left + (rect.width / 2);
    let top = rect.top - tooltipHeight - gap;
    let left = iconCenterX - (tooltipWidth / 2);
    let placement: 'top' | 'bottom' = 'top';

    // Check if tooltip would go off the left edge
    if (left < 8) {
      left = 8;
    }

    // Check if tooltip would go off the right edge
    const rightEdge = left + tooltipWidth;
    if (rightEdge > window.innerWidth - 8) {
      left = window.innerWidth - tooltipWidth - 8;
    }

    // Check if tooltip would go off the top edge
    if (top < 8) {
      // Position below the trigger instead
      top = rect.bottom + gap;
      placement = 'bottom';
    }

    // Ensure tooltip doesn't go off the bottom edge
    const bottomEdge = top + tooltipHeight;
    if (bottomEdge > window.innerHeight - 8) {
      top = window.innerHeight - tooltipHeight - 8;
    }

    setTooltipPosition({ top, left, placement });
  }, [showTooltip]);

  // Determine icon color based on the type
  const getIconColor = (type: StatCardProps['type']) => {
    switch (type) {
      case 'sales':
        return 'bg-emerald-100 text-emerald-600';
      case 'expenses':
        return 'bg-red-100 text-red-600';
      case 'profit':
        return 'bg-indigo-100 text-indigo-600';
      case 'products':
        return 'bg-blue-100 text-blue-600';
      case 'orders':
        return 'bg-purple-100 text-purple-600';
      case 'delivery':
        return 'bg-orange-100 text-orange-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const renderTooltip = () => {
    if (!showTooltip || !tooltipKey) return null;

    // Get translation for the tooltip
    const translationKey = `dashboard.tooltips.${tooltipKey}`;
    const tooltipText = t(translationKey);

    return createPortal(
      <div 
        className="fixed z-[9999] w-64 sm:w-72 max-w-sm p-2 sm:p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700 transition-opacity duration-200"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          pointerEvents: 'none',
          maxWidth: 'calc(100vw - 16px)', // Ensure it doesn't overflow on mobile
        }}
      >
        <div className="break-words whitespace-normal leading-relaxed">
          {tooltipText}
        </div>
        <div 
          className={`absolute w-2 h-2 sm:w-3 sm:h-3 bg-gray-900 border-r border-b border-gray-700 transform rotate-45 ${
            tooltipPosition.placement === 'top' 
              ? 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2' 
              : 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2'
          }`}
        />
      </div>,
      document.body
    );
  };

  return (
    <Card className={`${className} relative`}>
      <div className="flex items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-sm font-medium text-gray-600 truncate">{title}</p>
            {tooltipKey && (
              <div 
                ref={triggerRef}
                className="relative inline-flex items-center"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onTouchStart={() => setShowTooltip(true)}
                onTouchEnd={() => setTimeout(() => setShowTooltip(false), 2000)}
              >
                <Info size={12} className="text-gray-400 cursor-help hover:text-gray-600 flex-shrink-0" />
              </div>
            )}
          </div>
          <p className="mt-1 text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 truncate">{value}</p>
          
          {trend && (
            <div className="mt-1 flex items-center">
              <span 
                className={`text-xs sm:text-sm font-medium ${
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs sm:text-sm text-gray-500 ml-1">
                {t('dashboard.stats.trend.fromLastMonth')}
              </span>
            </div>
          )}
        </div>
        
        <div className={`p-1.5 sm:p-2 rounded-md ${getIconColor(type)} ml-2 flex-shrink-0`}>
          <div className="w-5 h-5 sm:w-6 sm:h-6">{icon}</div>
        </div>
      </div>
      {renderTooltip()}
    </Card>
  );
};

export default StatCard;