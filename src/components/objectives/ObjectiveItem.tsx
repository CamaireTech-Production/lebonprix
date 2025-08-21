import React from 'react';
import ProgressBar from '../common/ProgressBar';
import Button from '../common/Button';
import { ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { Objective } from '../../types/models';
import { useTranslation } from 'react-i18next';
import { format, differenceInCalendarDays, endOfMonth, endOfYear } from 'date-fns';

interface ObjectiveItemProps {
  objective: Objective & { progress: number; currentValue?: number };
  onEdit: (obj: Objective) => void;
  onDelete: (obj: Objective) => void;
  open: boolean;
  onToggle: () => void;
  isDeleting?: boolean;
}

const ObjectiveItem: React.FC<ObjectiveItemProps> = ({ objective, onEdit, onDelete, open, onToggle, isDeleting = false }) => {
  const { t } = useTranslation();

  // Determine translation key for metric
  const metricLabel = t(`dashboard.stats.${objective.metric}`);
  // Determine unit for amounts (target/current)
  let amountUnit = '';
  if ([
    'profit',
    'grossProfit',
    'netProfit',
    'totalExpenses',
    'deliveryExpenses',
    'totalSalesAmount',
    'totalPurchasePrice',
  ].includes(objective.metric)) {
    amountUnit = ' XAF';
  } else if ([
    'totalSalesCount',
    'totalOrders',
    'totalProductsSold',
  ].includes(objective.metric)) {
    amountUnit = ' sales';
  }

  // Calculate remaining days until due date
  let dueDate: Date | null = null;
  if (objective.periodType === 'predefined') {
    if (objective.predefined === 'this_year') {
      dueDate = endOfYear(new Date());
    } else if (objective.predefined === 'this_month') {
      dueDate = endOfMonth(new Date());
    }
  } else if (objective.endAt) {
    dueDate = objective.endAt.toDate ? objective.endAt.toDate() : new Date(objective.endAt);
  }
  let remainingDays: number | null = null;
  if (dueDate) {
    remainingDays = differenceInCalendarDays(dueDate, new Date());
  }
  // Determine color for remaining days
  let remainingDaysColor = 'text-green-600';
  if (remainingDays !== null) {
    if (remainingDays < 0) {
      remainingDaysColor = 'text-red-600 font-bold';
    } else if (remainingDays <= 3) {
      remainingDaysColor = 'text-orange-500 font-semibold';
    } else if (remainingDays <= 7) {
      remainingDaysColor = 'text-yellow-600 font-semibold';
    }
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
      >
        <div className="flex flex-col gap-1 text-left w-full">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{objective.title}</span>
            {remainingDays !== null && (
              <span
                className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold inline-block ${remainingDays < 0 ? 'bg-red-100 text-red-700 border border-red-200' : remainingDays <= 3 ? 'bg-orange-100 text-orange-700 border border-orange-200' : remainingDays <= 7 ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : 'bg-green-100 text-green-700 border border-green-200'}`}
              >
                {remainingDays < 0 ? t('objectives.due') : t('objectives.remainingDays', { count: remainingDays })}
              </span>
            )}
          </div>
          <div className="flex items-center w-full">
            <div className="flex-grow">
              <ProgressBar value={objective.progress} className="h-2" />
            </div>
            <div className="ml-2 text-xs text-gray-500 font-medium min-w-[32px] text-right">{objective.progress}%</div>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="p-4 space-y-3 border-t">
          {objective.description && <p className="text-sm text-gray-700">{objective.description}</p>}
          <div className="text-sm text-gray-600">
            {t('objectives.metric')}: <span className="font-medium text-gray-800">{metricLabel}</span>
          </div>
          <div className="text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
            <span>
              {t('objectives.target')}: <span className="font-medium text-gray-800">{objective.targetAmount.toLocaleString()}{amountUnit}</span>
            </span>
            {typeof objective.currentValue === 'number' && (
              <span>
                {t('objectives.current')}: <span className="font-medium text-gray-800">{objective.currentValue.toLocaleString()}{amountUnit}</span>
              </span>
            )}
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
            <Button size="sm" variant="outline" icon={<Pencil size={14} />} onClick={() => onEdit(objective)} disabled={isDeleting}>
              {t('common.edit')}
            </Button>
            <Button size="sm" variant="outline" icon={<Trash2 size={14} />} onClick={() => onDelete(objective)} isLoading={isDeleting} disabled={isDeleting}>
              {t('common.delete')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ObjectiveItem; 