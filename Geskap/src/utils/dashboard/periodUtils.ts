import { format, startOfMonth, endOfDay } from 'date-fns';
import { TFunction } from 'i18next';

export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Get a human-readable period label based on date range
 */
export const getPeriodLabel = (dateRange: DateRange, t: TFunction): string => {
  const today = endOfDay(new Date());
  const monthStart = startOfMonth(new Date());
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const last30Days = new Date(today);
  last30Days.setDate(last30Days.getDate() - 30);
  last30Days.setHours(0, 0, 0, 0);
  
  if (dateRange.from.getTime() === monthStart.getTime() && dateRange.to.getTime() === today.getTime()) {
    return t('dashboard.period.thisMonth', { defaultValue: 'Ce mois' });
  } else if (dateRange.from.getTime() === yearStart.getTime() && dateRange.to.getTime() === today.getTime()) {
    return t('dashboard.period.thisYear', { defaultValue: 'Cette année' });
  } else if (dateRange.from.getTime() === last30Days.getTime() && dateRange.to.getTime() === today.getTime()) {
    return t('dashboard.period.last30Days', { defaultValue: '30 derniers jours' });
  } else {
    return `${format(dateRange.from, 'dd MMM')} - ${format(dateRange.to, 'dd MMM yyyy')}`;
  }
};

