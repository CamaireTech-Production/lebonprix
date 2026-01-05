import React, { useMemo } from 'react';
import { Button, ProgressBar } from '@components/common';
import { useObjectives } from '@hooks/business/useObjectives';
import { useTranslation } from 'react-i18next';
import { Plus, List } from 'lucide-react';
import { differenceInCalendarDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';

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

import { getLatestCostPrice } from '@utils/business/productUtils';

const ObjectivesBar: React.FC<ObjectivesBarProps> = ({ onAdd, onView, dateRange, applyDateFilter, onToggleFilter, sales, expenses, products, stockChanges }) => {
  const { t } = useTranslation();
  const { objectives } = useObjectives();

  const isOverlapping = (obj: any) => {
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
    if (!objFrom || !objTo) return true;
    return objFrom <= dateRange.to && objTo >= dateRange.from;
  };

  const getStatsForObjective = (obj: any) => {
    let from: Date, to: Date;
    if (obj.periodType === 'predefined') {
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
    const salesInPeriod = sales?.filter(sale => sale.createdAt?.seconds && new Date(sale.createdAt.seconds * 1000) >= from && new Date(sale.createdAt.seconds * 1000) <= to) || [];
    const expensesInPeriod = expenses?.filter(exp => {
      if (exp.isAvailable === false) return false;
      if (!exp.createdAt?.seconds) return false;
      const expDate = new Date(exp.createdAt.seconds * 1000);
      return expDate >= from && expDate <= to;
    }) || [];
    switch (obj.metric) {
      case 'profit': {
        const profit = salesInPeriod.reduce((sum: number, sale: any) => sum + sale.products.reduce((productSum: number, product: any) => {
          const sellingPrice = product.negotiatedPrice || product.basePrice || 0;
          const safeStockChanges = Array.isArray(stockChanges) ? stockChanges : [];
          const latestCost = getLatestCostPrice(product.productId, safeStockChanges);
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
    const active = objectives.filter(o => o.isAvailable !== false);
    if (!applyDateFilter) return active;
    return active.filter(isOverlapping);
  }, [objectives, dateRange, applyDateFilter, isOverlapping]);

  const objectivesWithProgress = useMemo(() => {
    return filteredObjectives.map(obj => {
      const current = getStatsForObjective(obj);
      const pct = obj.targetAmount ? Math.max(0, Math.min(100, (current / obj.targetAmount) * 100)) : 0;
      return { ...obj, progress: Math.round(pct), currentValue: current } as any;
    });
  }, [filteredObjectives, sales, expenses, products, stockChanges]);

  const averageProgress = useMemo(() => {
    if (!objectivesWithProgress.length) return 0;
    const sum = objectivesWithProgress.reduce((acc, obj: any) => acc + (obj.progress || 0), 0);
    return Math.round(sum / objectivesWithProgress.length);
  }, [objectivesWithProgress]);

  const previewObjectives = useMemo(() => {
    const today = new Date();
    const toJsDate = (d: any) => (d?.toDate ? d.toDate() : (d ? new Date(d) : null));

    // Identify "daily" objectives: custom period with duration <= 1 day that includes today
    const daily = objectivesWithProgress.filter((obj: any) => {
      if (obj.periodType !== 'predefined') {
        const s = toJsDate(obj.startAt);
        const e = toJsDate(obj.endAt);
        if (!s || !e) return false;
        const days = Math.abs(differenceInCalendarDays(endOfDay(e), startOfDay(s)));
        const includesToday = isWithinInterval(today, { start: startOfDay(s), end: endOfDay(e) });
        return days <= 1 && includesToday;
      }
      return false;
    });

    // Sort daily by most recent end date desc
    daily.sort((a: any, b: any) => {
      const ae = toJsDate(a.endAt)?.getTime() || 0;
      const be = toJsDate(b.endAt)?.getTime() || 0;
      return be - ae;
    });

    // If fewer than 3, fill with most recent others (by end date)
    if (daily.length >= 3) return daily.slice(0, 3);
    const others = objectivesWithProgress.filter((o: any) => !daily.includes(o));
    others.sort((a: any, b: any) => {
      const ae = toJsDate(a.endAt)?.getTime() || 0;
      const be = toJsDate(b.endAt)?.getTime() || 0;
      return be - ae;
    });
    return [...daily, ...others].slice(0, 3);
  }, [objectivesWithProgress]);

  return (
    <div className="bg-white border rounded-lg p-3 mb-4 flex flex-col md:flex-row items-start gap-3 shadow-sm">
      <div className="w-full md:flex-1 min-w-0 mr-2" style={{ flexBasis: '70%' }}>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-medium text-gray-900">
            {t('objectives.overallProgress', { pct: averageProgress })}
          </h3>
          <ProgressBar value={averageProgress} className="h-2" />
          <div className="mt-1">
            <label className="inline-flex items-center gap-1 text-xs text-gray-700">
              <input
                type="checkbox"
                className="form-checkbox text-emerald-600 h-3.5 w-3.5"
                checked={applyDateFilter}
                onChange={e => onToggleFilter(e.target.checked)}
              />
              {t('objectives.filterByRange')}
            </label>
          </div>

          <div className="mt-2 space-y-1.5">
            {previewObjectives.map((obj: any) => (
              <div key={obj.id} className="border rounded p-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-900 truncate mr-2">{obj.title}</span>
                  <span className="text-[10px] text-gray-600 min-w-[28px] text-right">{obj.progress}%</span>
                </div>
                <div className="mt-1 max-w-[70%]">
                  <ProgressBar value={obj.progress} className="h-1.5" />
                </div>
              </div>
            ))}
            {previewObjectives.length === 0 && (
              <div className="text-xs text-gray-500">{t('objectives.empty')}</div>
            )}
          </div>
        </div>
      </div>
      <div className="w-full md:w-auto flex flex-row flex-wrap gap-2 items-end justify-end mt-1 md:mt-0 min-w-0">
        <Button
          variant="outline"
          icon={<List size={14} />}
          onClick={onView}
          className="w-full md:w-auto text-xs px-2"
        >
          <span className="block md:hidden">{t('objectives.viewShort', 'View')}</span>
          <span className="hidden md:block">{t('objectives.view')} ({objectivesWithProgress.length})</span>
        </Button>
        <Button
          size="sm"
          icon={<Plus size={14} />}
          onClick={onAdd}
          className="w-full md:w-auto text-xs px-2"
        >
          <span className="block md:hidden">{t('objectives.addShort', 'Add')}</span>
          <span className="hidden md:block">{t('objectives.add')}</span>
        </Button>
      </div>
    </div>
  );
};

export default ObjectivesBar; 