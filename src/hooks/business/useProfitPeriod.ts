import { useState, useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import type { ProfitPeriodPreference, ProfitPeriodType } from '../../types/models';
import {
  saveProfitPeriodPreference,
  clearProfitPeriodPreference,
  subscribeToProfitPeriodPreference
} from '@services/firestore/finance/profitPeriodService';
import { Timestamp } from 'firebase/firestore';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';

interface UseProfitPeriodReturn {
  preference: ProfitPeriodPreference | null;
  loading: boolean;
  error: Error | null;
  setPeriod: (periodType: ProfitPeriodType, customDate?: Date | null) => Promise<void>;
  clearPeriod: () => Promise<void>;
}

/**
 * Custom hook for managing profit period preferences
 * 
 * Provides real-time subscription to profit period preference and
 * functions to set or clear the period start date.
 */
export const useProfitPeriod = (): UseProfitPeriodReturn => {
  const { company, user } = useAuth();
  const [preference, setPreference] = useState<ProfitPeriodPreference | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to preference changes
  useEffect(() => {
    if (!company) {
      setPreference(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Subscribe to real-time updates
    const unsubscribe = subscribeToProfitPeriodPreference(company.id, (pref) => {
      setPreference(pref);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [company]);

  /**
   * Set profit period
   * 
   * @param periodType - Type of period (custom, this_month, etc.)
   * @param customDate - Custom date (only used if periodType is 'custom')
   */
  const setPeriod = async (periodType: ProfitPeriodType, customDate?: Date | null): Promise<void> => {
    if (!company || !user) {
      showErrorToast('Unable to set profit period. Please try again.');
      return;
    }

    try {
      setError(null);

      // Convert custom date to Firestore Timestamp if provided
      const timestampDate = (periodType === 'custom' && customDate)
        ? Timestamp.fromDate(customDate)
        : null;

      await saveProfitPeriodPreference(company.id, user.uid, {
        periodType,
        periodStartDate: timestampDate,
        isActive: periodType !== 'all_time',
      });

      showSuccessToast(
        periodType === 'all_time'
          ? 'Profit period cleared successfully'
          : 'Profit period set successfully'
      );
    } catch (err) {
      const error = err as Error;
      setError(error);
      showErrorToast('Failed to set profit period. Please try again.');
      console.error('Error setting profit period:', error);
    }
  };

  /**
   * Clear profit period (set to all-time)
   */
  const clearPeriod = async (): Promise<void> => {
    if (!company || !user) {
      showErrorToast('Unable to clear profit period. Please try again.');
      return;
    }

    try {
      setError(null);
      await clearProfitPeriodPreference(company.id, user.uid);
      showSuccessToast('Profit period cleared. Showing all-time profit.');
    } catch (err) {
      const error = err as Error;
      setError(error);
      showErrorToast('Failed to clear profit period. Please try again.');
      console.error('Error clearing profit period:', error);
    }
  };

  return {
    preference,
    loading,
    error,
    setPeriod,
    clearPeriod,
  };
};

