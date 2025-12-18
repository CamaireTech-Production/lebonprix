import React, { useState } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import PriceInput from '../common/PriceInput';
import Textarea from '../common/Textarea';
import Select from '../common/Select';
import Button from '../common/Button';
import DateRangePicker from '../common/DateRangePicker';
import { useTranslation } from 'react-i18next';
import { Objective } from '../../types/models';
import { useObjectives } from '../../hooks/useObjectives';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

interface ObjectiveFormProps {
  isOpen: boolean;
  onClose: () => void;
  objective?: Objective | null;
  metricsOptions: { value: string; label: string }[];
  onAfterAdd?: () => void; // optional callback to execute after successful add
}

const ObjectiveForm: React.FC<ObjectiveFormProps> = ({ isOpen, onClose, objective, metricsOptions, onAfterAdd }) => {
  const { t } = useTranslation();
  const { addObjective, updateObjective } = useObjectives();
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState<{ [key: string]: any }>({
    title: objective?.title || '',
    description: objective?.description || '',
    metric: objective?.metric || metricsOptions[0]?.value || '',
    targetAmount: objective?.targetAmount?.toString() || '',
    periodType: objective?.periodType || 'predefined',
    predefined: objective?.predefined || 'this_month',
    customRange: objective?.startAt ? { from: objective.startAt.toDate(), to: objective.endAt.toDate() } : null,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.title.trim()) {
      showErrorToast(t('objectives.messages.titleRequired'));
      return;
    }
    if (!formData.targetAmount || parseFloat(formData.targetAmount) <= 0) {
      showErrorToast(t('objectives.messages.targetRequired'));
      return;
    }
    if (!formData.metric) {
      showErrorToast(t('objectives.messages.metricRequired'));
      return;
    }

    setIsLoading(true);
    
    try {
      const payload: any = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        metric: formData.metric,
        targetAmount: parseFloat(formData.targetAmount),
        periodType: formData.periodType,
      };
      
      if (formData.periodType === 'predefined') {
        payload.predefined = formData.predefined;
      } else if (formData.customRange) {
        payload.startAt = formData.customRange.from;
        payload.endAt = formData.customRange.to;
      }

      if (objective) {
        await updateObjective(objective.id!, payload);
        showSuccessToast(t('objectives.messages.updateSuccess'));
      } else {
        await addObjective(payload);
        showSuccessToast(t('objectives.messages.addSuccess'));
        if (onAfterAdd) onAfterAdd();
      }
      onClose();
    } catch (err) {
      console.error('Objective operation error:', err);
      showErrorToast(t('objectives.messages.operationError'));
    } finally {
      setIsLoading(false);
    }
  };

  const metricOptions = [
    { value: 'profit', label: t('dashboard.stats.profit') },
    { value: 'totalExpenses', label: t('dashboard.stats.totalExpenses') },
    { value: 'totalProductsSold', label: t('dashboard.stats.totalProductsSold') },
    { value: 'deliveryFee', label: t('dashboard.stats.deliveryFee') },
    { value: 'totalSalesAmount', label: t('dashboard.stats.totalSalesAmount') },
    { value: 'totalSalesCount', label: t('dashboard.stats.totalSalesCount') },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={objective ? t('objectives.edit') : t('objectives.add')} size="md">
      <div className="space-y-5">
        <Input label={t('objectives.title')} name="title" value={formData.title} onChange={handleChange} required />
        <Textarea label={t('objectives.description')} name="description" value={formData.description} onChange={handleChange} />
        <PriceInput label={t('objectives.target')} name="targetAmount" value={formData.targetAmount} onChange={handleChange} required />
        <div className="space-y-4">
          <Select
            label={t('objectives.metric')}
            options={metricOptions}
            value={formData.metric}
            onChange={(e) => handleSelectChange('metric', e.target.value)}
            fullWidth={true}
            className="px-3 py-2 border border-gray-300 rounded-md focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
          <Select
            label={t('objectives.periodType')}
            options={[
              { value: 'predefined', label: t('objectives.predefined') },
              { value: 'custom', label: t('objectives.custom') },
            ]}
            value={formData.periodType}
            onChange={(e) => handleSelectChange('periodType', e.target.value)}
            fullWidth={true}
            className="px-3 py-2 border border-gray-300 rounded-md focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
          {formData.periodType === 'predefined' ? (
            <Select
              label={t('objectives.predefined')}
              options={[
                { value: 'this_month', label: t('dateRanges.thisMonth') },
                { value: 'this_year', label: t('dateRanges.thisYear') },
              ]}
              value={formData.predefined}
              onChange={(e) => handleSelectChange('predefined', e.target.value)}
              fullWidth={true}
              className="px-3 py-2 border border-gray-300 rounded-md focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          ) : (
            <DateRangePicker
              className="mt-2"
              onChange={(range) => setFormData({ ...formData, customRange: range })}
            />
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} isLoading={isLoading} disabled={isLoading}>
            {objective ? t('common.update') : t('common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ObjectiveForm; 