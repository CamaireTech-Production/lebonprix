import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import Card from '../common/Card';

// KPICard component for displaying key performance indicators

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  status?: 'good' | 'warning' | 'bad';
  description?: string;
}

const KPICard = ({ 
  title, 
  value, 
  unit = '', 
  trend, 
  status,
  description 
}: KPICardProps) => {
  const statusConfig = {
    good: { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle2 },
    warning: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertCircle },
    bad: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: XCircle },
  };

  const config = status ? statusConfig[status] : null;
  const StatusIcon = config?.icon;

  return (
    <Card className={`${config?.bg || 'bg-white'} ${config?.border || 'border-gray-200'} border`}>
      <div className="text-center">
        <div className="flex items-center justify-center space-x-2 mb-2">
          <p className="text-sm font-medium text-gray-700">{title}</p>
          {StatusIcon && (
            <StatusIcon size={16} className={config.color} />
          )}
        </div>
        <p className="text-2xl font-semibold text-gray-900">
          {typeof value === 'number' ? value.toLocaleString() : value} {unit}
        </p>
        {trend && (
          <p className={`mt-1 text-xs ${trend.isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend.isPositive ? '+' : ''}{trend.value.toFixed(1)}% vs previous period
          </p>
        )}
        {description && (
          <p className="mt-1 text-xs text-gray-500">{description}</p>
        )}
      </div>
    </Card>
  );
};

export default KPICard;
export { KPICard };

