import { ReactNode } from 'react';
import Card from '../common/Card';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

const StatCard = ({ title, value, icon, trend, className = '' }: StatCardProps) => {
  return (
    <Card className={`${className}`}>
      <div className="flex items-start">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
          
          {trend && (
            <div className="mt-1 flex items-center">
              <span 
                className={`text-sm font-medium ${
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-sm text-gray-500 ml-1">from last month</span>
            </div>
          )}
        </div>
        
        <div className={`
          p-2 rounded-md 
          ${title.includes('Sales') ? 'bg-emerald-100 text-emerald-600' : ''}
          ${title.includes('Expenses') ? 'bg-red-100 text-red-600' : ''}
          ${title.includes('Profit') ? 'bg-indigo-100 text-indigo-600' : ''}
          ${title.includes('Products') ? 'bg-blue-100 text-blue-600' : ''}
        `}>
          {icon}
        </div>
      </div>
    </Card>
  );
};

export default StatCard;