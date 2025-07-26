import { useState } from 'react';
import { DateRange, DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import {
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  format,
} from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon } from 'lucide-react';

import Select from './Select';
import Button from './Button';
import Modal from './Modal';

type Period =
  | 'all_time'
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_7_days'
  | 'this_month'
  | 'last_30_days'
  | 'this_year'
  | 'custom'
  | 'last_week'
  | 'last_month'
  | 'last_year';

interface DateRangePickerProps {
  onChange: (range: { from: Date; to: Date }) => void;
  className?: string;
}

const DateRangePicker = ({ onChange, className }: DateRangePickerProps) => {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>('all_time');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<{ from: Date; to: Date } | null>(null);

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(2000, 0, 1),
    to: new Date(2100, 0, 1),
  });

  const endOfDay = (date: Date) => {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
  };
  const startOfDay = (date: Date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPeriod = e.target.value as Period;
    setPeriod(newPeriod);
    const now = new Date();
    let from: Date, to: Date;

    switch (newPeriod) {
      case 'all_time':
        from = new Date(2000, 0, 1);
        to = new Date(2100, 0, 1);
        break;
      case 'today':
        from = startOfDay(now);
        to = endOfDay(now);
        break;
      case 'yesterday':
        const yesterday = subDays(now, 1);
        from = startOfDay(yesterday);
        to = endOfDay(yesterday);
        break;
      case 'last_week': {
        const lastWeekStart = startOfWeek(subDays(now, 7));
        const lastWeekEnd = endOfWeek(subDays(now, 7));
        from = startOfDay(lastWeekStart);
        to = endOfDay(lastWeekEnd);
        break;
      }
      case 'this_week':
        from = startOfWeek(now);
        to = endOfWeek(now);
        break;
      case 'last_7_days':
        from = startOfDay(subDays(now, 6));
        to = endOfDay(now);
        break;
      case 'last_month': {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        from = startOfMonth(lastMonth);
        to = endOfMonth(lastMonth);
        break;
      }
      case 'this_month':
        from = startOfMonth(now);
        to = endOfMonth(now);
        break;
      case 'last_30_days':
        from = startOfDay(subDays(now, 29));
        to = endOfDay(now);
        break;
      case 'last_year': {
        const lastYear = now.getFullYear() - 1;
        from = startOfYear(new Date(lastYear, 0, 1));
        to = endOfYear(new Date(lastYear, 0, 1));
        break;
      }
      case 'this_year':
        from = startOfYear(now);
        to = endOfYear(now);
        break;
      case 'custom':
        setPendingRange(dateRange); // prefill with current range
        setIsModalOpen(true);
        return;
      default:
        from = startOfMonth(now);
        to = endOfMonth(now);
    }
    const range = { from, to };
    setDateRange(range);
    onChange(range);
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setPendingRange({ from: startOfDay(range.from), to: endOfDay(range.to) });
    } else if (range?.from) {
      setPendingRange({ from: startOfDay(range.from), to: endOfDay(range.from) });
    }
  };

  // Show the selected range as a styled pill
  const renderRangeLabel = () => {
    if (!dateRange.from || !dateRange.to) return null;
    if (period === 'all_time') {
      return (
        <span
          className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-gray-100 border border-gray-200 text-gray-700 text-sm font-medium"
        >
          <CalendarIcon className="h-4 w-4 mr-1 text-emerald-500" />
          {t('dateRanges.allTime', 'All time')}
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-gray-100 border border-gray-200 text-gray-700 text-sm font-medium cursor-pointer hover:bg-gray-200 transition"
        onClick={() => {
          if (period === 'custom') setIsModalOpen(true);
        }}
        title={t('dateRanges.pickDate')}
      >
        <CalendarIcon className="h-4 w-4 mr-1 text-emerald-500" />
        {format(dateRange.from, 'dd/MM/yyyy')} - {format(dateRange.to, 'dd/MM/yyyy')}
      </span>
    );
  };

  const periodOptions = [
    { value: 'all_time', label: t('dateRanges.allTime', 'All time') },
    { value: 'today', label: t('dateRanges.today') },
    { value: 'yesterday', label: t('dateRanges.yesterday') },
    { value: 'last_week', label: t('dateRanges.lastWeek') },
    { value: 'this_week', label: t('dateRanges.thisWeek') },
    { value: 'last_7_days', label: t('dateRanges.last7Days') },
    { value: 'last_month', label: t('dateRanges.lastMonth') },
    { value: 'this_month', label: t('dateRanges.thisMonth') },
    { value: 'last_30_days', label: t('dateRanges.last30Days') },
    { value: 'last_year', label: t('dateRanges.lastYear') },
    { value: 'this_year', label: t('dateRanges.thisYear') },
    { value: 'custom', label: t('dateRanges.custom') },
  ];

  return (
    <div className={className}>
      <div className="mb-1">
        <span className="block text-sm font-semibold text-gray-800">{t('dateRanges.filterTitle') || 'Filtrer par période'}</span>
      </div>
      <div className="flex flex-row flex-wrap items-center gap-2 sm:gap-2">
        <Select
          options={periodOptions}
          value={period}
          onChange={handlePeriodChange}
          fullWidth={false}
          className="flex-none px-2 py-2 rounded-md border border-gray-300 bg-white focus:border-emerald-500 focus:ring-emerald-500 text-gray-800 w-40"
        />
        {renderRangeLabel()}
      </div>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('dateRanges.selectCustomRange')}>
        <div className="flex flex-col items-center gap-4">
          <DayPicker
            className="rounded-lg border border-gray-200 shadow-sm"
            initialFocus
            mode="range"
            defaultMonth={pendingRange?.from || dateRange.from}
            selected={pendingRange || undefined}
            onSelect={(range, selectedDay, modifiers, e) => {
              // If user clicks a selected date, clear selection
              if (
                range?.from && range?.to &&
                selectedDay &&
                ((range.from.getTime() === selectedDay.getTime()) || (range.to.getTime() === selectedDay.getTime())) &&
                modifiers.selected
              ) {
                setPendingRange(null);
                return;
              }
              if (selectedDay && modifiers.selected && !range?.to) {
                setPendingRange(null);
                return;
              }
              handleDateSelect(range);
            }}
            numberOfMonths={1}
            classNames={{
              day_selected: 'bg-emerald-600 text-white hover:bg-emerald-700',
              day_range_middle: 'bg-emerald-100 text-emerald-700',
              day_today: 'border border-emerald-500',
            }}
          />
          <Button
            variant="primary"
            className="mt-2"
            disabled={!(pendingRange && pendingRange.from)}
            onClick={() => {
              if (pendingRange && pendingRange.from) {
                setDateRange(pendingRange);
                onChange(pendingRange);
                setIsModalOpen(false);
              }
            }}
          >
            {t('common.save') || 'Valider'}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default DateRangePicker; 