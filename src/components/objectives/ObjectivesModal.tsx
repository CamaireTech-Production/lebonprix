import React, { useMemo, useState } from 'react';
import Modal from '../common/Modal';
import ObjectiveItem from './ObjectiveItem';
import { useObjectives } from '../../hooks/useObjectives';
import { Objective } from '../../types/models';
import Button from '../common/Button';
import ObjectiveForm from './ObjectiveForm';
import { useTranslation } from 'react-i18next';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

interface ObjectivesModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: Record<string, number>;
  dateRange: { from: Date; to: Date };
  metricsOptions: { value: string; label: string }[];
  applyDateFilter: boolean;
  sales: any[];
  expenses: any[];
  products: any[];
}

const ObjectivesModal: React.FC<ObjectivesModalProps> = ({ isOpen, onClose, stats, dateRange, metricsOptions, applyDateFilter, sales, expenses, products }) => {
  const { t } = useTranslation();
  const { objectives, deleteObjective } = useObjectives();
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [openObjectiveId, setOpenObjectiveId] = useState<string | null>(null);

  const isOverlapping = (obj: any) => {
    if (obj.periodType === 'predefined') {
      const now = new Date();
      if (obj.predefined === 'this_year') {
        // Only show if dashboard filter is within this year
        return (
          dateRange.from.getFullYear() === now.getFullYear() &&
          dateRange.to.getFullYear() === now.getFullYear()
        );
      } else if (obj.predefined === 'this_month') {
        // Only show if dashboard filter is within this month
        return (
          dateRange.from.getFullYear() === now.getFullYear() &&
          dateRange.from.getMonth() === now.getMonth() &&
          dateRange.to.getFullYear() === now.getFullYear() &&
          dateRange.to.getMonth() === now.getMonth()
        );
      }
      return false;
    }
    if (!obj.startAt || !obj.endAt) return true;
    const start = obj.startAt.toDate ? obj.startAt.toDate() : new Date(obj.startAt);
    const end = obj.endAt.toDate ? obj.endAt.toDate() : new Date(obj.endAt);
    return start <= dateRange.to && end >= dateRange.from;
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
    const expensesInPeriod = expenses?.filter(exp => exp.createdAt?.seconds && new Date(exp.createdAt.seconds * 1000) >= from && new Date(exp.createdAt.seconds * 1000) <= to) || [];
    switch (obj.metric) {
      case 'grossProfit':
        return salesInPeriod.reduce((sum: number, sale: any) => sum + sale.products.reduce((productSum: any, product: any) => {
          const productData = products?.find((p: any) => p.id === product.productId);
          if (!productData) return productSum;
          const sellingPrice = product.negotiatedPrice || product.basePrice;
          return productSum + (sellingPrice - productData.costPrice) * product.quantity;
        }, 0), 0);
      case 'netProfit': {
        const gross = salesInPeriod.reduce((sum: number, sale: any) => sum + sale.products.reduce((productSum: any, product: any) => {
          const productData = products?.find((p: any) => p.id === product.productId);
          if (!productData) return productSum;
          const sellingPrice = product.negotiatedPrice || product.basePrice;
          return productSum + (sellingPrice - productData.costPrice) * product.quantity;
        }, 0), 0);
        const totalExp = expensesInPeriod.reduce((sum, exp) => sum + exp.amount, 0);
        return gross - totalExp;
      }
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

  const objsWithProgress = useMemo(() => {
    const list = applyDateFilter ? objectives.filter(isOverlapping) : objectives;
    return list.map(o => {
      let current = applyDateFilter ? (stats[o.metric] || 0) : getStatsForObjective(o);
      const pct = o.targetAmount ? Math.min(100, (current / o.targetAmount) * 100) : 0;
      return { ...o, progress: Math.round(pct) } as Objective & { progress: number };
    });
  }, [objectives, stats, dateRange, applyDateFilter, sales, expenses, products]);

  const handleDelete = async (obj: Objective) => {
    try {
      if (confirm(t('objectives.confirmDelete'))) {
        await deleteObjective(obj.id!);
        showSuccessToast(t('objectives.messages.deleteSuccess'));
      }
    } catch (err) {
      showErrorToast(t('objectives.messages.operationError'));
    }
  };

  return (
    <>
      <Modal isOpen={isOpen && !showForm} onClose={onClose} title={t('objectives.titleList')} size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {objsWithProgress.map(obj => (
            <ObjectiveItem
              key={obj.id}
              objective={obj}
              onEdit={(o) => { setEditingObjective(o); setShowForm(true); }}
              onDelete={handleDelete}
              open={openObjectiveId === obj.id}
              onToggle={() => setOpenObjectiveId(openObjectiveId === obj.id ? null : obj.id)}
            />
          ))}
          {objsWithProgress.length === 0 && (
            <p className="text-center text-sm text-gray-500">{t('objectives.empty')}</p>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => { setEditingObjective(null); setShowForm(true); }}>{t('objectives.add')}</Button>
        </div>
      </Modal>
      {showForm && (
        <ObjectiveForm
          isOpen={showForm}
          onClose={() => { setShowForm(false); onClose(); }}
          objective={editingObjective}
          metricsOptions={metricsOptions}
        />
      )}
    </>
  );
};

export default ObjectivesModal; 