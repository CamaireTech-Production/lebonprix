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
  onAfterAdd?: () => void; // optional callback to run after objective add
  stockChanges?: any[];
}

import { getLatestCostPrice } from '../../utils/productUtils';

const ObjectivesModal: React.FC<ObjectivesModalProps> = ({ isOpen, onClose, stats, dateRange, metricsOptions, applyDateFilter, sales, expenses, products, onAfterAdd, stockChanges = [] }) => {
  const { t } = useTranslation();
  const { objectives, deleteObjective } = useObjectives();
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [openObjectiveId, setOpenObjectiveId] = useState<string | null>(null);

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
    const salesInPeriod = (sales || []).filter(sale => sale.createdAt?.seconds && new Date(sale.createdAt.seconds * 1000) >= from && new Date(sale.createdAt.seconds * 1000) <= to);
    const expensesInPeriod = (expenses || []).filter(exp => exp.createdAt?.seconds && new Date(exp.createdAt.seconds * 1000) >= from && new Date(exp.createdAt.seconds * 1000) <= to);
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

  const objsWithProgress = useMemo(() => {
    return filteredObjectives.map(o => {
      const current = getStatsForObjective(o);
      const pct = o.targetAmount ? Math.max(0, Math.min(100, (current / o.targetAmount) * 100)) : 0;
      return { ...o, progress: Math.round(pct), currentValue: current } as Objective & { progress: number; currentValue: number };
    });
  }, [filteredObjectives, sales, expenses, products]);

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
          onAfterAdd={onAfterAdd}
        />
      )}
    </>
  );
};

export default ObjectivesModal; 