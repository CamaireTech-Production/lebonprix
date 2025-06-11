import { ReactNode, useState, useRef, useEffect } from 'react';
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
  type: 'sales' | 'expenses' | 'profit' | 'products' | 'orders' | 'delivery';
  className?: string;
}

const StatCard = ({ title, value, icon, trend, tooltipKey, type, className = '' }: StatCardProps) => {
  const { t } = useTranslation();
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Handle tooltip positioning
  useEffect(() => {
    if (!showTooltip || !tooltipRef.current || !triggerRef.current) return;

    const tooltip = tooltipRef.current;
    const trigger = triggerRef.current;
    const rect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    // Calculate initial position (centered above the trigger)
    let top = rect.top - tooltipRect.height - 8; // 8px gap
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

    // Check if tooltip would go off the left edge
    if (left < 8) {
      left = 8;
    }

    // Check if tooltip would go off the right edge
    const rightEdge = left + tooltipRect.width;
    if (rightEdge > window.innerWidth - 8) {
      left = window.innerWidth - tooltipRect.width - 8;
    }

    // Check if tooltip would go off the top edge
    if (top < 8) {
      // Position below the trigger instead
      top = rect.bottom + 8;
      tooltip.classList.remove('bottom-full');
      tooltip.classList.add('top-full');
      // Move the arrow to the top
      const arrow = tooltip.querySelector('.tooltip-arrow');
      if (arrow) {
        arrow.classList.remove('bottom-0', 'translate-y-1/2', 'rotate-45');
        arrow.classList.add('top-0', '-translate-y-1/2', '-rotate-45');
      }
    } else {
      tooltip.classList.remove('top-full');
      tooltip.classList.add('bottom-full');
      // Move the arrow to the bottom
      const arrow = tooltip.querySelector('.tooltip-arrow');
      if (arrow) {
        arrow.classList.remove('top-0', '-translate-y-1/2', '-rotate-45');
        arrow.classList.add('bottom-0', 'translate-y-1/2', 'rotate-45');
      }
    }

    tooltip.style.position = 'fixed';
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
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

  return (
    <Card className={`${className}`}>
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
              >
                <Info size={12} className="text-gray-400 cursor-help hover:text-gray-600 flex-shrink-0" />
                {showTooltip && (
                  <div 
                    ref={tooltipRef}
                    className="fixed z-50 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg transition-opacity duration-200"
                  >
                    <div className="break-words whitespace-normal">
                      {t(`dashboard.stats.tooltips.${tooltipKey}`)}
                    </div>
                    <div className="tooltip-arrow absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                  </div>
                )}
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
    </Card>
  );
};

export default StatCard;