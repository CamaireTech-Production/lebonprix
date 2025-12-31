import { 
  startOfMonth, 
  startOfQuarter, 
  startOfYear, 
  subDays, 
  subMonths,
  format
} from 'date-fns';
import type { ProfitPeriodType } from '../../types/models';

/**
 * Calculate the start date for a profit period based on its type
 * 
 * @param periodType - Type of period (custom, this_month, etc.)
 * @param customDate - Custom date (only used if periodType is 'custom')
 * @returns Start date for the period, or null for 'all_time'
 */
export function getPeriodStartDate(
  periodType: ProfitPeriodType,
  customDate?: Date | null
): Date | null {
  const now = new Date();
  
  switch(periodType) {
    case 'custom':
      return customDate || null;
    case 'this_month':
      return startOfMonth(now);
    case 'last_30_days':
      return subDays(now, 30);
    case 'last_2_months':
      return startOfMonth(subMonths(now, 2));
    case 'last_3_months':
      return startOfMonth(subMonths(now, 3));
    case 'this_quarter':
      return startOfQuarter(now);
    case 'this_year':
      return startOfYear(now);
    case 'all_time':
      return null;
    default:
      return null;
  }
}

/**
 * Get a human-readable label for a profit period
 * 
 * @param periodType - Type of period
 * @param customDate - Custom date (only used if periodType is 'custom')
 * @param includeDate - Whether to include the calculated date in the label
 * @returns Human-readable label
 */
export function getPeriodLabel(
  periodType: ProfitPeriodType,
  customDate?: Date | null,
  includeDate: boolean = true
): string {
  const startDate = getPeriodStartDate(periodType, customDate);
  
  switch(periodType) {
    case 'custom':
      return startDate 
        ? `Since ${format(startDate, 'MMM d, yyyy')}`
        : 'Custom Date';
    case 'this_month':
      return includeDate && startDate
        ? `This Month (${format(startDate, 'MMM d, yyyy')})`
        : 'This Month';
    case 'last_30_days':
      return 'Last 30 Days';
    case 'last_2_months':
      return includeDate && startDate
        ? `Last 2 Months (${format(startDate, 'MMM d, yyyy')})`
        : 'Last 2 Months';
    case 'last_3_months':
      return includeDate && startDate
        ? `Last 3 Months (${format(startDate, 'MMM d, yyyy')})`
        : 'Last 3 Months';
    case 'this_quarter':
      return includeDate && startDate
        ? `This Quarter (${format(startDate, 'MMM d, yyyy')})`
        : 'This Quarter';
    case 'this_year':
      return includeDate && startDate
        ? `This Year (${format(startDate, 'MMM d, yyyy')})`
        : 'This Year';
    case 'all_time':
      return 'All Time';
    default:
      return 'All Time';
  }
}

/**
 * Get the short label for StatCard display
 * 
 * @param periodType - Type of period
 * @param customDate - Custom date (only used if periodType is 'custom')
 * @returns Short label for display
 */
export function getPeriodShortLabel(
  periodType: ProfitPeriodType,
  customDate?: Date | null
): string {
  const startDate = getPeriodStartDate(periodType, customDate);
  
  if (periodType === 'all_time') {
    return 'All Time';
  }
  
  if (!startDate) {
    return 'All Time';
  }
  
  return `Since ${format(startDate, 'MMM d, yyyy')}`;
}

