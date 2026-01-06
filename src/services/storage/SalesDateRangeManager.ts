// src/services/storage/SalesDateRangeManager.ts
import LocalStorageService from '../localStorageService';

export type Period =
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

export interface SalesDateRangeData {
  dateRange: {
    from: string; // ISO string
    to: string; // ISO string
  };
  period: Period;
  timestamp: number;
}

class SalesDateRangeManager {
  private static readonly STORAGE_KEY_PREFIX = 'sales_dateRange_';
  // No TTL - persist indefinitely until user clears or changes company

  /**
   * Generate storage key for company's sales date range
   */
  static getKey(companyId: string): string {
    return `${this.STORAGE_KEY_PREFIX}${companyId}`;
  }

  /**
   * Save date range and period to localStorage
   */
  static save(
    companyId: string,
    dateRange: { from: Date; to: Date },
    period: Period
  ): void {
    const key = this.getKey(companyId);
    const data: SalesDateRangeData = {
      dateRange: {
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
      },
      period,
      timestamp: Date.now(),
    };
    // Use a long TTL (1 year) since this is user preference, not data cache
    LocalStorageService.set(key, data, 365 * 24 * 60 * 60 * 1000, companyId);
  }

  /**
   * Load date range and period from localStorage
   */
  static load(companyId: string): {
    dateRange: { from: Date; to: Date };
    period: Period;
  } | null {
    const key = this.getKey(companyId);
    const data = LocalStorageService.get<SalesDateRangeData>(key);
    
    if (!data) return null;

    try {
      return {
        dateRange: {
          from: new Date(data.dateRange.from),
          to: new Date(data.dateRange.to),
        },
        period: data.period,
      };
    } catch (error) {
      console.error('❌ Failed to parse date range from localStorage:', error);
      // Remove invalid data
      this.remove(companyId);
      return null;
    }
  }

  /**
   * Remove date range from localStorage
   */
  static remove(companyId: string): void {
    const key = this.getKey(companyId);
    LocalStorageService.remove(key);
  }

  /**
   * Check if date range exists in localStorage
   */
  static exists(companyId: string): boolean {
    const key = this.getKey(companyId);
    return LocalStorageService.has(key);
  }
}

export default SalesDateRangeManager;

