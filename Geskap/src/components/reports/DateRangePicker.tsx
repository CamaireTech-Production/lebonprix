import React from 'react';
import { Calendar } from 'lucide-react';
import { DateRangeFilter } from '../../types/reports';

interface DateRangePickerProps {
  dateRange: DateRangeFilter;
  onChange: (range: DateRangeFilter) => void;
  label?: string;
  className?: string;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  dateRange,
  onChange,
  label = 'Période',
  className = ''
}) => {
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onChange({
      ...dateRange,
      startDate: value ? new Date(value) : null
    });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onChange({
      ...dateRange,
      endDate: value ? new Date(value) : null
    });
  };

  const formatDateForInput = (date: Date | null): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Date de début
          </label>
          <input
            type="date"
            value={formatDateForInput(dateRange.startDate)}
            onChange={handleStartDateChange}
            max={dateRange.endDate ? formatDateForInput(dateRange.endDate) : undefined}
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white
                     focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Date de fin
          </label>
          <input
            type="date"
            value={formatDateForInput(dateRange.endDate)}
            onChange={handleEndDateChange}
            min={dateRange.startDate ? formatDateForInput(dateRange.startDate) : undefined}
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white
                     focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
          />
        </div>
      </div>

      {(dateRange.startDate || dateRange.endDate) && (
        <button
          onClick={() => onChange({ startDate: null, endDate: null })}
          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
        >
          Réinitialiser les dates
        </button>
      )}
    </div>
  );
};

export default DateRangePicker;
