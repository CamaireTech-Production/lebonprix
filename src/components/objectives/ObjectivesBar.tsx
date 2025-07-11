import React, { useMemo } from 'react';
import Button from '../common/Button';
import ProgressBar from '../common/ProgressBar';
import { useObjectives } from '../../hooks/useObjectives';
import { useTranslation } from 'react-i18next';
import { Plus, List } from 'lucide-react';
import { differenceInDays } from 'date-fns';

interface ObjectivesBarProps {
  onAdd: () => void;
  onView: () => void;
  stats: Record<string, number>;
  dateRange: { from: Date; to: Date };
  applyDateFilter: boolean;
  onToggleFilter: (val: boolean) => void;
  sales: any[];
  expenses: any[];
  products: any[];
}

const ObjectivesBar: React.FC<ObjectivesBarProps> = ({ onAdd, onView, stats, dateRange, applyDateFilter, onToggleFilter, sales, expenses, products }) => {
  const { t } = useTranslation();
  const { objectives } = useObjectives();

  const isOverlapping = (obj: any) => {
    if (obj.periodType === 'predefined') return true; // assume active
    if (!obj.startAt || !obj.endAt) return true;
    const start = obj.startAt.toDate ? obj.startAt.toDate() : new Date(obj.startAt);
    const end = obj.endAt.toDate ? obj.endAt.toDate() : new Date(obj.endAt);
    return start <= dateRange.to && end >= dateRange.from;
  };

  const getStatsForObjective = (obj: any) => {
    // Determine period
    let from: Date, to: Date;
    if (obj.periodType === 'predefined') {
      // Only support 'this_month' and 'this_year' for now
      const now = new Date();
      if (obj.predefined === 'this_year') {
        from = new Date(now.getFullYear(), 0, 1);
        to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      } else {
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      }
    } else {
      from = obj.startAt?.toDate ? obj.startAt.toDate() : new Date(obj.startAt);
      to = obj.endAt?.toDate ? obj.endAt.toDate() : new Date(obj.endAt);
    }
    // Filter data for this period
    const salesInPeriod = sales?.filter(sale => sale.createdAt?.seconds && new Date(sale.createdAt.seconds * 1000) >= from && new Date(sale.createdAt.seconds * 1000) <= to) || [];
    const expensesInPeriod = expenses?.filter(exp => exp.createdAt?.seconds && new Date(exp.createdAt.seconds * 1000) >= from && new Date(exp.createdAt.seconds * 1000) <= to) || [];
    // Calculate stats for this period
    switch (obj.metric) {
      case 'profit':
        return salesInPeriod.reduce((sum: number, sale: any) => sum + sale.products.reduce((productSum: any, product: any) => {
          const productData = products?.find((p: any) => p.id === product.productId);
          if (!productData) return productSum;
          const sellingPrice = product.negotiatedPrice || product.basePrice;
          return productSum + (sellingPrice - productData.costPrice) * product.quantity;
        }, 0), 0);
      case 'totalExpenses':
        return expensesInPeriod.reduce((sum, exp) => sum + exp.amount, 0);
      case 'totalOrders':
        return salesInPeriod.length;
      case 'deliveryExpenses':
        return expensesInPeriod.filter(e => e.category?.toLowerCase() === 'delivery').reduce((sum, e) => sum + e.amount, 0);
      case 'totalSalesAmount':
        return salesInPeriod.reduce((sum, sale) => sum + sale.totalAmount, 0);
      case 'totalSalesCount':
        return salesInPeriod.length;
      default:
        return 0;
    }
  };

  const isAllTime = dateRange.from.getFullYear() === 2000 && dateRange.from.getMonth() === 0 && dateRange.from.getDate() === 1 && dateRange.to.getFullYear() === 2100 && dateRange.to.getMonth() === 0 && dateRange.to.getDate() === 1;

  const filteredObjectives = useMemo(() => {
    if (!applyDateFilter || (applyDateFilter && isAllTime)) {
      return objectives;
    } else {
      return objectives.filter(isOverlapping);
    }
  }, [objectives, dateRange, applyDateFilter]);

  const objectivesWithProgress = useMemo(() => {
    return filteredObjectives.map(obj => {
      let current = getStatsForObjective(obj);
      const pct = obj.targetAmount ? Math.max(0, Math.min(100, (current / obj.targetAmount) * 100)) : 0;
      return { ...obj, progress: Math.round(pct) };
    });
  }, [filteredObjectives, sales, expenses, products]);

  const averageProgress = useMemo(() => {
    if (!objectivesWithProgress.length) return 0;
    const sum = objectivesWithProgress.reduce((acc, obj: any) => acc + (obj.progress || 0), 0);
    return Math.round(sum / objectivesWithProgress.length);
  }, [objectivesWithProgress]);

  return (
    <div className="bg-white border rounded-lg p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm">
      <div className="flex-1 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium text-gray-900 flex-1">
            {t('objectives.overallProgress', { pct: averageProgress })}
          </h3>
        </div>
        <ProgressBar value={averageProgress} />
      </div>
      <div className="flex gap-4 flex-none items-center">
        <label className="inline-flex items-center gap-1 text-sm text-gray-700">
          <input
            type="checkbox"
            className="form-checkbox text-emerald-600"
            checked={applyDateFilter}
            onChange={e => onToggleFilter(e.target.checked)}
          />
          {t('objectives.filterByRange')}
        </label>
        <Button variant="outline" icon={<List size={16} />} onClick={onView}>
          {t('objectives.view')} ({objectivesWithProgress.length})
        </Button>
        <Button icon={<Plus size={16} />} onClick={onAdd}>
          {t('objectives.add')}
        </Button>
      </div>
    </div>
  );
};

export default ObjectivesBar; 