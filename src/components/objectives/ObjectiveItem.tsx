import React, { useState } from 'react';
import ProgressBar from '../common/ProgressBar';
import Button from '../common/Button';
import { ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { Objective } from '../../types/models';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

interface ObjectiveItemProps {
  objective: Objective & { progress: number };
  onEdit: (obj: Objective) => void;
  onDelete: (obj: Objective) => void;
  open: boolean;
  onToggle: () => void;
}

const ObjectiveItem: React.FC<ObjectiveItemProps> = ({ objective, onEdit, onDelete, open, onToggle }) => {
  const { t } = useTranslation();

  // Determine translation key for metric
  const metricLabel = t(`dashboard.stats.${objective.metric}`);
  // Determine unit for target amount
  let targetUnit = '';
  if ([
    'grossProfit',
    'netProfit',
    'totalExpenses',
    'deliveryExpenses',
    'totalSalesAmount',
    'totalPurchasePrice',
  ].includes(objective.metric)) {
    targetUnit = ' XAF';
  } else if ([
    'totalSalesCount',
    'totalOrders',
  ].includes(objective.metric)) {
    targetUnit = ' sales';
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
      >
        <div className="flex flex-col gap-1 text-left">
          <span className="font-medium text-gray-900">{objective.title}</span>
          <ProgressBar value={objective.progress} className="h-2" />
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="p-4 space-y-3 border-t">
          {objective.description && <p className="text-sm text-gray-700">{objective.description}</p>}
          <div className="text-sm text-gray-600">
            {t('objectives.metric')}: <span className="font-medium text-gray-800">{metricLabel}</span>
          </div>
          <div className="text-sm text-gray-600">
            {t('objectives.target')}: <span className="font-medium text-gray-800">{objective.targetAmount.toLocaleString()}{targetUnit}</span>
          </div>
          <div className="text-sm text-gray-600">
            {t('objectives.progress')}: <span className="font-medium text-gray-800">{objective.progress}%</span>
          </div>
          <div className="text-sm text-gray-600">
            {t('objectives.period')}: <span className="font-medium text-gray-800">{
              objective.periodType === 'predefined'
                ? (objective.predefined === 'this_year'
                    ? t('dateRanges.thisYear')
                    : t('dateRanges.thisMonth'))
                : (objective.startAt && objective.endAt
                    ? `${format(objective.startAt.toDate ? objective.startAt.toDate() : new Date(objective.startAt), 'dd/MM/yyyy')} - ${format(objective.endAt.toDate ? objective.endAt.toDate() : new Date(objective.endAt), 'dd/MM/yyyy')}`
                    : t('objectives.noPeriod'))
            }</span>
          </div>
          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="outline" icon={<Pencil size={14} />} onClick={() => onEdit(objective)}>
              {t('common.edit')}
            </Button>
            <Button size="sm" variant="outline" icon={<Trash2 size={14} />} onClick={() => onDelete(objective)}>
              {t('common.delete')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ObjectiveItem; 