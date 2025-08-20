import React, { useMemo } from 'react';
import Button from '../common/Button';
import ProgressBar from '../common/ProgressBar';
import { useObjectives } from '../../hooks/useObjectives';
import { useTranslation } from 'react-i18next';
import { Plus, List } from 'lucide-react';

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
  stockChanges: any[];
}

import { getLatestCostPrice } from '../../utils/productUtils';

const ObjectivesBar: React.FC<ObjectivesBarProps> = ({ onAdd, onView, dateRange, applyDateFilter, onToggleFilter, sales, expenses, products, stockChanges }) => {
  const { t } = useTranslation();
  const { objectives } = useObjectives();

  const isOverlapping = (obj: any) => {
    // Compute the objective's active window
    let objFrom: Date | null = null;
    let objTo: Date | null = null;
    if (obj.periodType === 'predefined') {
      const now = new Date();
      if (obj.predefined === 'this_year') {
        objFrom = new Date(now.getFullYear(), 0, 1);
        objTo = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      } else {
        objFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        objTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      }
    } else {
      objFrom = obj.startAt?.toDate ? obj.startAt.toDate() : (obj.startAt ? new Date(obj.startAt) : null);
      objTo = obj.endAt?.toDate ? obj.endAt.toDate() : (obj.endAt ? new Date(obj.endAt) : null);
    }
    if (!objFrom || !objTo) return true; // if invalid dates, keep visible
    // Overlap with selected dashboard range
    return objFrom <= dateRange.to && objTo >= dateRange.from;
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
    // Filter out soft-deleted expenses and apply date range filter
    const expensesInPeriod = expenses?.filter(exp => {
      // First filter out soft-deleted expenses
      if (exp.isAvailable === false) return false;
      // Then apply date range filter
      if (!exp.createdAt?.seconds) return false;
      const expDate = new Date(exp.createdAt.seconds * 1000);
      return expDate >= from && expDate <= to;
    }) || [];
    // Calculate stats for this period
    switch (obj.metric) {
      case 'profit': {
        const profit = salesInPeriod.reduce((sum: number, sale: any) => sum + sale.products.reduce((productSum: number, product: any) => {
          const sellingPrice = product.negotiatedPrice || product.basePrice || 0;
          const latestCost = getLatestCostPrice(product.productId, stockChanges);
          const costPrice = latestCost ?? 0;
          return productSum + (sellingPrice - costPrice) * (product.quantity || 0);
        }, 0), 0);
        return Number.isFinite(profit) ? profit : 0;
      }
      case 'totalExpenses':
        return expensesInPeriod.reduce((sum, exp) => sum + (exp.amount || 0), 0);
      case 'totalOrders':
      case 'totalSalesCount':
        return salesInPeriod.length;
      case 'totalProductsSold':
        return salesInPeriod.reduce((sum, sale) => sum + sale.products.reduce((acc: number, p: any) => acc + (p.quantity || 0), 0), 0);
      case 'deliveryFee':
        return salesInPeriod.reduce((sum, sale) => sum + (sale.deliveryFee || 0), 0);
      case 'deliveryExpenses':
        return expensesInPeriod.filter(e => (e.category || '').toLowerCase() === 'delivery').reduce((sum, e) => sum + (e.amount || 0), 0);
      case 'totalSalesAmount':
        return salesInPeriod.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
      default:
        return 0;
    }
  };

  const filteredObjectives = useMemo(() => {
    if (!applyDateFilter) return objectives;
    return objectives.filter(isOverlapping);
  }, [objectives, dateRange, applyDateFilter]);

  const objectivesWithProgress = useMemo(() => {
    return filteredObjectives.map(obj => {
      const current = getStatsForObjective(obj);
      const pct = obj.targetAmount ? Math.max(0, Math.min(100, (current / obj.targetAmount) * 100)) : 0;
      return { ...obj, progress: Math.round(pct), currentValue: current } as any;
    });
  }, [filteredObjectives, sales, expenses, products]);

  const averageProgress = useMemo(() => {
    if (!objectivesWithProgress.length) return 0;
    const sum = objectivesWithProgress.reduce((acc, obj: any) => acc + (obj.progress || 0), 0);
    return Math.round(sum / objectivesWithProgress.length);
  }, [objectivesWithProgress]);

  return (
    <div className="bg-white border rounded-lg p-4 mb-6 flex flex-col md:flex-row items-start gap-4 shadow-sm">
      {/* Left: Progress, title, and filter (100% on mobile, 90% on desktop) */}
      <div className="w-full md:flex-1 min-w-0 mr-4" style={{ flexBasis: '70%' }}>
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-medium text-gray-900">
            {t('objectives.overallProgress', { pct: averageProgress })}
          </h3>
          <ProgressBar value={averageProgress} />
          <div className="mt-2">
            <label className="inline-flex items-center gap-1 text-sm text-gray-700">
              <input
                type="checkbox"
                className="form-checkbox text-emerald-600"
                checked={applyDateFilter}
                onChange={e => onToggleFilter(e.target.checked)}
              />
              {t('objectives.filterByRange')}
            </label>
          </div>
        </div>
      </div>
      {/* Right: Buttons (row on mobile, column on desktop) */}
      <div className="w-full md:w-auto flex flex-row flex-wrap gap-2 items-end justify-end mt-2 md:mt-0 min-w-0">
        <Button
          variant="outline"
          icon={<List size={16} />}
          onClick={onView}
          className="w-full md:w-auto text-xs md:text-base px-2 md:px-4"
        >
          <span className="block md:hidden">{t('objectives.viewShort', 'View')}</span>
          <span className="hidden md:block">{t('objectives.view')} ({objectivesWithProgress.length})</span>
        </Button>
        <Button
          icon={<Plus size={16} />}
          onClick={onAdd}
          className="w-full md:w-auto text-xs md:text-base px-2 md:px-4"
        >
          <span className="block md:hidden">{t('objectives.addShort', 'Add')}</span>
          <span className="hidden md:block">{t('objectives.add')}</span>
        </Button>
      </div>
    </div>
  );
};

export default ObjectivesBar; 