import { useState } from 'react';
import { Modal, Button } from '@components/common';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import type { ProfitPeriodType } from '../../types/models';
import { getPeriodStartDate, getPeriodLabel } from '@utils/calculations/profitPeriodUtils';

interface ProfitPeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPeriodType?: ProfitPeriodType;
  currentCustomDate?: Date | null;
  onSetPeriod: (periodType: ProfitPeriodType, customDate?: Date | null) => Promise<void>;
  onClearPeriod: () => Promise<void>;
}

const ProfitPeriodModal: React.FC<ProfitPeriodModalProps> = ({
  isOpen,
  onClose,
  currentPeriodType,
  currentCustomDate,
  onSetPeriod,
  onClearPeriod,
}) => {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<ProfitPeriodType>(
    currentPeriodType || 'all_time'
  );
  const [customDate, setCustomDate] = useState<string>(
    currentCustomDate
      ? format(currentCustomDate, 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd')
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (selectedType === 'custom') {
        const date = new Date(customDate);
        await onSetPeriod(selectedType, date);
      } else {
        await onSetPeriod(selectedType);
      }
      onClose();
    } catch (error) {
      console.error('Error saving profit period:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await onClearPeriod();
      setSelectedType('all_time');
      onClose();
    } catch (error) {
      console.error('Error clearing profit period:', error);
    } finally {
      setSaving(false);
    }
  };

  // Predefined period options
  const periodOptions: { value: ProfitPeriodType; labelKey: string }[] = [
    { value: 'custom', labelKey: 'customDate' },
    { value: 'this_month', labelKey: 'thisMonth' },
    { value: 'last_30_days', labelKey: 'last30Days' },
    { value: 'last_2_months', labelKey: 'last2Months' },
    { value: 'last_3_months', labelKey: 'last3Months' },
    { value: 'this_quarter', labelKey: 'thisQuarter' },
    { value: 'this_year', labelKey: 'thisYear' },
    { value: 'all_time', labelKey: 'allTime' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('dashboard.profit.periodSettings', { defaultValue: 'Profit Period Settings' })}
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Set a period to calculate dashboard profit. Finance page will continue to show all-time profit.
        </p>

        {/* Period Options */}
        <div className="space-y-2">
          {periodOptions.map((option) => (
            <div key={option.value}>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="periodType"
                  value={option.value}
                  checked={selectedType === option.value}
                  onChange={(e) => setSelectedType(e.target.value as ProfitPeriodType)}
                  className="w-4 h-4 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  {t(`dashboard.profit.${option.labelKey}`, {
                    defaultValue: getPeriodLabel(option.value, null, option.value !== 'custom' && option.value !== 'last_30_days' && option.value !== 'all_time')
                  })}
                </span>
              </label>
              
              {/* Show date picker for custom option */}
              {option.value === 'custom' && selectedType === 'custom' && (
                <div className="ml-6 mt-2">
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Current Period Info */}
        {currentPeriodType && currentPeriodType !== 'all_time' && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Current Period:</strong>{' '}
              {getPeriodLabel(currentPeriodType, currentCustomDate)}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1"
          >
            {saving ? 'Saving...' : t('dashboard.profit.save', { defaultValue: 'Save' })}
          </Button>
          {currentPeriodType && currentPeriodType !== 'all_time' && (
            <Button
              onClick={handleClear}
              disabled={saving}
              variant="outline"
            >
              {t('dashboard.profit.clearPeriod', { defaultValue: 'Clear' })}
            </Button>
          )}
          <Button onClick={onClose} variant="outline">
            {t('dashboard.profit.cancel', { defaultValue: 'Cancel' })}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ProfitPeriodModal;
