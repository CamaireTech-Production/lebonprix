import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ComparisonIndicatorProps {
  current: number;
  previous: number;
  label?: string;
  formatValue?: (value: number) => string;
}

const ComparisonIndicator = ({ 
  current, 
  previous, 
  label,
  formatValue = (v) => v.toLocaleString()
}: ComparisonIndicatorProps) => {
  if (previous === 0) {
    return (
      <div className="mt-1 text-xs text-gray-500">
        {label && `${label}: `}No previous data
      </div>
    );
  }

  const absoluteChange = current - previous;
  const percentageChange = ((absoluteChange / previous) * 100);
  const isPositive = absoluteChange > 0;
  const isNeutral = absoluteChange === 0;

  const colorClass = isNeutral 
    ? 'text-gray-500' 
    : isPositive 
      ? 'text-emerald-600' 
      : 'text-red-600';

  const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  const sign = isPositive ? '+' : '';

  return (
    <div className={`mt-1 text-xs flex items-center space-x-1 ${colorClass}`}>
      <Icon size={12} />
      <span>
        {label && `${label}: `}
        {sign}{percentageChange.toFixed(1)}% ({sign}{formatValue(absoluteChange)})
      </span>
    </div>
  );
};

export default ComparisonIndicator;


