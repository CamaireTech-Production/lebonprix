// src/pages/expenses/shared/ExpenseFilters.tsx
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Input from '../../../components/common/Input';
import DateRangePicker from '../../../components/common/DateRangePicker';

interface ExpenseFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dateRange: { from: Date; to: Date };
  onDateRangeChange: (range: { from: Date; to: Date }) => void;
  showDateRange?: boolean;
}

const ExpenseFilters = ({ 
  searchQuery, 
  onSearchChange, 
  dateRange, 
  onDateRangeChange,
  showDateRange = true 
}: ExpenseFiltersProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
        <div className="relative flex-1 sm:flex-initial sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <Input
            type="text"
            placeholder={t('expenses.search.placeholder') || 'Rechercher par description...'}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {showDateRange && (
          <DateRangePicker
            onChange={onDateRangeChange}
            className="w-full sm:w-auto"
          />
        )}
      </div>
    </div>
  );
};

export default ExpenseFilters;

