import React, { useState, useMemo } from 'react';
import StatCard from '../components/dashboard/StatCard';
import Button from '../components/common/Button';
import { useFinanceEntries, useProducts, useSales, useExpenses, useCustomers } from '../hooks/useFirestore';
import { useObjectives } from '../hooks/useObjectives';
import { format } from 'date-fns';
import Modal, { ModalFooter } from '../components/common/Modal';
import CreatableSelect from '../components/common/CreatableSelect';
import { getFinanceEntryTypes, createFinanceEntryType, createFinanceEntry, updateFinanceEntry, softDeleteFinanceEntry } from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';
import LoadingScreen from '../components/common/LoadingScreen';
import { Edit2, Trash2, BarChart2, Receipt, DollarSign, ShoppingCart, Info, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import DateRangePicker from '../components/common/DateRangePicker';
import { useTranslation } from 'react-i18next';
import ObjectivesBar from '../components/objectives/ObjectivesBar';
import ObjectivesModal from '../components/objectives/ObjectivesModal';
import { showSuccessToast, showErrorToast } from '../utils/toast';
import type { FinanceEntry } from '../types/models';

type CustomerDebt = {
  phone: string;
  name: string;
  debt: number;
  entries: FinanceEntry[];
};

const Finance: React.FC = () => {
  const { t } = useTranslation();
  const { entries, loading } = useFinanceEntries();
  const { sales, loading: salesLoading } = useSales();
  const { expenses, loading: expensesLoading } = useExpenses();
  const { products, loading: productsLoading } = useProducts();
  useCustomers(); // Only call the hook for side effects if needed, but don't destructure unused values
  const { user } = useAuth();
  useObjectives();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [entryTypes, setEntryTypes] = useState<{ label: string; value: string }[]>([]);
  const [form, setForm] = useState({
    id: '',
    type: null as { label: string; value: string } | null,
    amount: '',
    description: '',
    date: '',
    isEdit: false,
    refundedDebtId: '', // NEW
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; entryId: string | null }>({ open: false, entryId: null });
  // Date range filter (default: all time)
  const [dateRange, setDateRange] = useState({
    from: new Date(2000, 0, 1),
    to: new Date(2100, 0, 1),
  });
  // Other filters
  const [filterType, setFilterType] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState('');
  // Calculations modal and objectives
  const [showCalculationsModal, setShowCalculationsModal] = useState(false);
  const [showObjectivesModal, setShowObjectivesModal] = useState(false);
  const [applyDateFilter, setApplyDateFilter] = useState(true);
  const [] = useState<CustomerDebt | null>(null);
  const [showDebtHistoryModal, setShowDebtHistoryModal] = useState(false);
  // Add openDebtId state at the top of the component
  const [openDebtId, setOpenDebtId] = useState<string | null>(null);

  // Pagination, sorting, and filtering state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterSource, setFilterSource] = useState('');

  // Filtered sales/expenses/products by date range
  const filteredSales = useMemo(() => sales.filter(sale => {
    if (!sale.createdAt?.seconds) return false;
    const saleDate = new Date(sale.createdAt.seconds * 1000);
    return saleDate >= dateRange.from && saleDate <= dateRange.to;
  }), [sales, dateRange]);
  const filteredExpenses = useMemo(() => expenses.filter(exp => {
    if (!exp.createdAt?.seconds) return false;
    const expDate = new Date(exp.createdAt.seconds * 1000);
    return expDate >= dateRange.from && expDate <= dateRange.to;
  }), [expenses, dateRange]);
  // Filtered manual entries from finances
  const filteredManualEntries = useMemo(() => entries.filter(entry => {
    if (entry.sourceType !== 'manual') return false;
    if (entry.createdAt?.seconds) {
      const d = new Date(entry.createdAt.seconds * 1000);
      if (d < dateRange.from || d > dateRange.to) return false;
    }
    if (filterType && entry.type !== filterType) return false;
    if (filterSearch && !entry.description?.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  }), [entries, filterType, filterSearch, dateRange]);

  // Filter finance entries by date range and not soft deleted
  const filteredFinanceEntries = entries.filter(entry => !entry.isDeleted && entry.createdAt?.seconds && new Date(entry.createdAt.seconds * 1000) >= dateRange.from && new Date(entry.createdAt.seconds * 1000) <= dateRange.to);

  // Remove phone/description logic. Group all 'debt' and 'refund' entries for the current user.
  const userDebt = useMemo<{
    debtEntries: FinanceEntry[];
    refundEntries: FinanceEntry[];
  }>(() => {
    let debtEntries: FinanceEntry[] = [];
    let refundEntries: FinanceEntry[] = [];
    entries.forEach((entry: FinanceEntry) => {
      if (entry.type === 'debt') {
        debtEntries.push(entry);
      } else if (entry.type === 'refund') {
        refundEntries.push(entry);
      }
    });
    return {
      debtEntries,
      refundEntries
    };
  }, [entries]);

  // Calculate total remaining debt (sum of each debt minus its refunds)
  const totalDebt = useMemo<number>(() => {
    return userDebt.debtEntries.reduce((sum: number, debt: FinanceEntry) => {
      const linkedRefunds = userDebt.refundEntries.filter(
        (refund: FinanceEntry) => {
          const match = refund.refundedDebtId && String(refund.refundedDebtId) === String(debt.id);
          return match;
        }
      );
      const refundedAmount = linkedRefunds.reduce((s: number, r: FinanceEntry) => s + r.amount, 0);
      return sum + Math.max(0, debt.amount - refundedAmount);
    }, 0);
  }, [userDebt.debtEntries, userDebt.refundEntries]);

  // Calculate solde: sum of all non-debt/refund entries plus total remaining debt
  const solde = useMemo<number>(() => {
    const nonDebtEntries = filteredFinanceEntries.filter(
      (entry: FinanceEntry) => entry.type !== 'debt' && entry.type !== 'refund'
    );
    const nonDebtSum = nonDebtEntries.reduce((sum: number, entry: FinanceEntry) => sum + entry.amount, 0);
    return nonDebtSum + totalDebt;
  }, [filteredFinanceEntries, totalDebt]);

  // Filtering logic
  const filteredAndSearchedEntries = useMemo(() => {
    return filteredFinanceEntries.filter(entry => {
      if (filterType && entry.type !== filterType) return false;
      if (filterSource && entry.sourceType !== filterSource) return false;
      if (filterSearch && !entry.description?.toLowerCase().includes(filterSearch.toLowerCase())) return false;
      return true;
    });
  }, [filteredFinanceEntries, filterType, filterSource, filterSearch]);

  // Sorting logic
  const sortedEntries = useMemo(() => {
    return [...filteredAndSearchedEntries].sort((a, b) => {
      const aDate = a.createdAt?.seconds || 0;
      const bDate = b.createdAt?.seconds || 0;
      return sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
    });
  }, [filteredAndSearchedEntries, sortOrder]);

  // Pagination logic
  const totalPages = Math.ceil(sortedEntries.length / itemsPerPage);
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedEntries.slice(start, start + itemsPerPage);
  }, [sortedEntries, currentPage, itemsPerPage]);

  // Reset page when filters change
  React.useEffect(() => { setCurrentPage(1); }, [filterType, filterSource, filterSearch, dateRange, itemsPerPage]);

  if (loading || productsLoading || salesLoading || expensesLoading) {
    return <LoadingScreen />;
  }

  // --- Stat calculations (copied from Dashboard) ---
  // Calculate profit (gross profit: selling price - purchase price) * quantity for all sales
  const profit = filteredSales.reduce((sum, sale) => {
    return sum + sale.products.reduce((productSum, product) => {
      const productData = products.find(p => p.id === product.productId);
      if (!productData) return productSum;
      const sellingPrice = product.negotiatedPrice || product.basePrice;
      return productSum + (sellingPrice - productData.costPrice) * product.quantity;
    }, 0);
  }, 0);
  // Calculate total expenses
  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0) + filteredManualEntries.filter(e => e.amount < 0).reduce((sum, e) => sum + Math.abs(e.amount), 0);
  // Total orders
  const totalOrders = filteredSales.length;
  // Total delivery fee (from sales)
  const totalDeliveryFee = filteredSales.reduce((sum, sale) => sum + (sale.deliveryFee || 0), 0);
  // Total sales amount
  const totalSalesAmount = filteredSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  // Total products sold (sum of all product quantities in filteredSales)
  const totalProductsSold = filteredSales.reduce((sum, sale) => sum + sale.products.reduce((pSum, p) => pSum + p.quantity, 0), 0);
  // Calculate total purchase price for all products in stock as of the end of the selected period
  // (Optional: can use stock changes if needed, for now use Dashboard logic)
  const availableProducts = products.filter(product => typeof product.isAvailable === 'undefined' || product.isAvailable !== false);
  const totalPurchasePrice = availableProducts.reduce((sum, product) => sum + (product.costPrice * product.stock), 0);

  // Stat cards (dashboard style, now using dashboard logic)
  const statCards = [
    { title: t('dashboard.stats.profit'), value: `${profit.toLocaleString()} XAF`, icon: <BarChart2 size={20} />, tooltipKey: 'profit', type: 'profit' },
    { title: t('dashboard.stats.totalExpenses'), value: `${totalExpenses.toLocaleString()} XAF`, icon: <Receipt size={20} />, tooltipKey: 'totalExpenses', type: 'expenses' },
    { title: t('dashboard.stats.deliveryFee'), value: `${totalDeliveryFee.toLocaleString()} XAF`, icon: <DollarSign size={20} />, tooltipKey: 'deliveryFee', type: 'delivery' },
    { title: t('dashboard.stats.totalSalesAmount'), value: `${totalSalesAmount.toLocaleString()} XAF`, icon: <ShoppingCart size={20} />, tooltipKey: 'totalSalesAmount', type: 'sales' },
    { title: t('dashboard.stats.totalSalesCount'), value: totalOrders, icon: <ShoppingCart size={20} />, tooltipKey: 'totalSalesCount', type: 'sales' },
    { title: t('dashboard.stats.totalPurchasePrice'), value: `${totalPurchasePrice.toLocaleString()} XAF`, icon: <DollarSign size={20} />, tooltipKey: 'totalPurchasePrice', type: 'products' },
  ];

  // Metrics options for objectives
  const metricsOptions = [
    { value: 'profit', label: t('dashboard.stats.profit') },
    { value: 'totalExpenses', label: t('dashboard.stats.totalExpenses') },
    { value: 'totalProductsSold', label: t('dashboard.stats.totalProductsSold') },
    { value: 'deliveryFee', label: t('dashboard.stats.deliveryFee') },
    { value: 'totalSalesAmount', label: t('dashboard.stats.totalSalesAmount') },
    { value: 'totalSalesCount', label: t('dashboard.stats.totalSalesCount') },
  ];
  const statsMap = {
    profit,
    totalExpenses,
    totalProductsSold,
    deliveryFee: totalDeliveryFee,
    totalSalesAmount,
    totalSalesCount: totalOrders,
  };

  // Fetch entry types on modal open
  const handleOpenModal = async (editEntry?: any) => {
    if (!user) return;
    setModalOpen(true);
    setModalLoading(true);
    const types = await getFinanceEntryTypes(user.uid);
    setEntryTypes(types.map(typeObj => ({ label: t(`finance.types.${typeObj.name}`, typeObj.name), value: typeObj.name })));
    if (editEntry) {
      setForm({
        id: editEntry.id,
        type: { label: editEntry.type, value: editEntry.type },
        amount: editEntry.amount.toString(),
        description: editEntry.description || '',
        date: editEntry.date?.seconds ? format(new Date(editEntry.date.seconds * 1000), 'yyyy-MM-dd') : '',
        isEdit: true,
        refundedDebtId: editEntry.refundedDebtId || '', // Populate refundedDebtId for refunds
      });
    } else {
      setForm({ id: '', type: null, amount: '', description: '', date: '', isEdit: false, refundedDebtId: '' });
    }
    setModalLoading(false);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setForm({ id: '', type: null, amount: '', description: '', date: '', isEdit: false, refundedDebtId: '' });
  };

  const handleTypeCreate = async (name: string) => {
    if (!user) return;
    const newType = await createFinanceEntryType({ name, isDefault: false, userId: user.uid });
    const option = { label: newType.name, value: newType.id };
    setEntryTypes(prev => [...prev, option]);
    return option;
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleTypeChange = (option: any) => {
    setForm(f => ({ ...f, type: option }));
  };

  const handleSubmit = async () => {
    if (!user || !form.type || !form.amount) return;
    if (form.type.value === 'refund' && (!form.refundedDebtId || userDebt.debtEntries.length === 0)) return;
    setModalLoading(true);
    const entryData = {
      userId: user.uid,
      sourceType: 'manual' as const,
      type: form.type.value, // FIXED: use value, not label
      amount: parseFloat(form.amount),
      description: form.description,
      date: Timestamp.now(),
      isDeleted: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ...(form.type.value === 'refund' && form.refundedDebtId ? { refundedDebtId: form.refundedDebtId } : {}),
    };
    try {
      if (form.isEdit && form.id) {
        await updateFinanceEntry(form.id, entryData);
        showSuccessToast(t('finance.messages.updateSuccess'));
      } else {
        await createFinanceEntry(entryData);
        showSuccessToast(t('finance.messages.addSuccess'));
      }
      handleCloseModal();
    } catch (err) {
      showErrorToast(t('finance.messages.operationError'));
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteClick = (entry: any) => {
    setDeleteConfirm({ open: true, entryId: entry.id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.entryId) return;
    try {
      await softDeleteFinanceEntry(deleteConfirm.entryId);
      showSuccessToast(t('finance.messages.deleteSuccess'));
    } catch (err) {
      showErrorToast(t('finance.messages.operationError'));
    }
    setDeleteConfirm({ open: false, entryId: null });
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ open: false, entryId: null });
  };

  // Calculate remaining amount for selected debt when refunding
  const selectedDebt = form.type?.value === 'refund' && form.refundedDebtId
    ? userDebt.debtEntries.find(d => d.id === form.refundedDebtId)
    : null;
  const refundedSoFar = form.type?.value === 'refund' && form.refundedDebtId
    ? userDebt.refundEntries.filter(r => r.refundedDebtId === form.refundedDebtId).reduce((sum, r) => sum + r.amount, 0)
    : 0;
  const remainingDebt = selectedDebt ? Math.max(0, selectedDebt.amount - refundedSoFar) : 0;
  const refundAmount = parseFloat(form.amount) || 0;
  const refundExceeds = form.type?.value === 'refund' && form.refundedDebtId && refundAmount > remainingDebt;

  return (
    <>
      <div className="px-4 py-6 w-full mx-auto">
        {/* First row: Solde (left), Objectives (right) */}
        <div className="mb-6 mt-6">
          <div className="flex flex-row w-full gap-4 md:gap-6">
            {/* Balance card - 50% on mobile, 30% on desktop */}
            <div className="w-1/2 md:w-[25%] min-w-[140px] max-w-[320px]">
            <StatCard
              title={t('dashboard.stats.solde')}
                value={solde.toLocaleString() + ' XAF'}
              icon={<DollarSign size={24} />}
              type="solde"
                className="ring-2 ring-green-400 shadow bg-green-50 text-green-900 border border-green-200 rounded-xl py-2 mb-2 w-full text-base md:text-xl font-bold break-words"
              />
            </div>
            {/* Debt card - 50% on mobile, 30% on desktop */}
            <div className="w-1/2 md:w-[25%] min-w-[140px] max-w-[320px]">
              <div className="bg-red-50 border border-red-300 rounded-lg p-2 md:p-4 flex flex-col items-start shadow w-full">
                <div className="font-semibold text-sm md:text-lg text-red-800 mb-1 md:mb-2 truncate w-full">{t('finance.debtCardTitle', 'Outstanding Debt')}</div>
                <div className="text-base md:text-xl font-bold text-red-900 mb-1 md:mb-2 break-words w-full">{totalDebt.toLocaleString()} XAF</div>
                <Button variant="outline" onClick={() => { setShowDebtHistoryModal(true); }} className="w-full md:w-auto text-xs md:text-sm px-2 py-1">
                  {t('finance.viewHistory', 'View History')}
                </Button>
              </div>
            </div>
            {/* Objectives/progress - hidden on mobile, 40% on desktop */}
            <div className="hidden md:flex flex-col items-end justify-start gap-2 w-[50%] min-w-[200px] max-w-[600px]">
              <ObjectivesBar
                onAdd={() => setShowObjectivesModal(true)}
                onView={() => setShowObjectivesModal(true)}
                stats={statsMap}
                dateRange={dateRange}
                applyDateFilter={applyDateFilter}
                onToggleFilter={setApplyDateFilter}
                sales={sales}
                expenses={expenses}
                products={products}
              />
              {showObjectivesModal && (
                <ObjectivesModal
                  isOpen={showObjectivesModal}
                  onClose={() => setShowObjectivesModal(false)}
                  stats={statsMap}
                  dateRange={dateRange}
                  metricsOptions={metricsOptions}
                  applyDateFilter={applyDateFilter}
                  sales={sales}
                  expenses={expenses}
                  products={products}
                />
              )}
            </div>
          </div>
          {/* Objectives/progress - full width on mobile */}
          <div className="block md:hidden mt-2">
            <ObjectivesBar
              onAdd={() => setShowObjectivesModal(true)}
              onView={() => setShowObjectivesModal(true)}
              stats={statsMap}
              dateRange={dateRange}
              applyDateFilter={applyDateFilter}
              onToggleFilter={setApplyDateFilter}
              sales={sales}
              expenses={expenses}
              products={products}
            />
            {showObjectivesModal && (
              <ObjectivesModal
                isOpen={showObjectivesModal}
                onClose={() => setShowObjectivesModal(false)}
                stats={statsMap}
                dateRange={dateRange}
                metricsOptions={metricsOptions}
                applyDateFilter={applyDateFilter}
                sales={sales}
                expenses={expenses}
                products={products}
              />
            )}
          </div>
        </div>
        {/* Second row: Period filter (left), How it's calculated (right) */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="md:w-1/2 w-full flex flex-col items-start justify-center">
            <DateRangePicker onChange={setDateRange} className="w-full max-w-xs" />
          </div>
          <div className="md:w-1/2 w-full flex flex-col items-end justify-center">
            <Button
              variant="outline"
              icon={<Info size={16} />}
              onClick={() => setShowCalculationsModal(true)}
              className="mt-0"
            >
              {t('dashboard.howCalculated')}
            </Button>
          </div>
        </div>
        {/* Stat cards: compact, centered, max-w, clean design */}
        <div className="mb-8 w-full">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
            {statCards.map((stat) => (
              <StatCard
                key={stat.title}
                title={stat.title}
                value={typeof stat.value === 'string' ? stat.value : String(stat.value)}
                icon={stat.icon}
                tooltipKey={stat.tooltipKey}
                type={stat.type as any}
                className="rounded-xl border border-gray-100 bg-white shadow-sm py-2 text-base md:text-lg font-bold break-words"
              />
            ))}
          </div>
        </div>
        {/* Controls above table */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              placeholder={t('common.search')}
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
              style={{ minWidth: 160 }}
            />
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="border rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
            >
              <option value="">{t('common.allTypes')}</option>
              {entryTypes.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={filterSource}
              onChange={e => setFilterSource(e.target.value)}
              className="border rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
            >
              <option value="">{t('common.allSources')}</option>
              <option value="manual">{t('finance.sourceType.manual')}</option>
              <option value="sale">{t('finance.sourceType.sale')}</option>
              <option value="expense">{t('finance.sourceType.expense')}</option>
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-sm">{t('common.itemsPerPage')}</label>
            <select
              value={itemsPerPage}
              onChange={e => setItemsPerPage(Number(e.target.value))}
              className="border rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
            >
              {[10, 25, 50, 100].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            {/* Add Finance Button */}
            <Button
              variant="primary"
              onClick={() => handleOpenModal()}
              className="ml-2"
            >
              {t('finance.addEntry')}
            </Button>
          </div>
        </div>
        {/* Finance entries table with pagination and sorting */}
        <div className="bg-white rounded shadow p-4 min-h-[200px] overflow-x-auto custom-scrollbar">
          {loading ? (
            <div className="text-gray-400 text-center py-8">{t('common.loading')}</div>
          ) : paginatedEntries.length === 0 ? (
            <div className="text-gray-400 text-center py-8">{t('finance.noEntries')}</div>
          ) : (
            <table className="min-w-[600px] w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-3 px-2 cursor-pointer select-none" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                    {t('common.date')}
                    <span className="ml-1 align-middle inline-block">
                      {sortOrder === 'asc' ? <ChevronUp size={16} className="inline" /> : <ChevronDown size={16} className="inline" />}
                    </span>
                  </th>
                  <th className="py-3 px-2">{t('common.type')}</th>
                  <th className="py-3 px-2">{t('common.description')}</th>
                  <th className="py-3 px-2">{t('common.amount')}</th>
                  <th className="py-3 px-2">{t('common.source')}</th>
                  <th className="py-3 px-2">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEntries.map(entry => (
                  <tr key={entry.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-2">{entry.createdAt?.seconds ? format(new Date(entry.createdAt.seconds * 1000), 'dd/MM/yyyy') : ''}</td>
                    <td className="py-3 px-2 capitalize">{t(`finance.types.${entry.type}`, entry.type)}</td>
                    <td className="py-3 px-2">{entry.description || '-'}</td>
                    <td className={`py-3 px-2 font-semibold ${entry.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>{entry.amount.toLocaleString()}</td>
                    <td className="py-3 px-2 capitalize">{t(`finance.sourceType.${entry.sourceType}`)}</td>
                    <td className="py-3 px-2 flex gap-2">
                      {entry.sourceType === 'manual' ? (
                        <>
                          <button
                            onClick={() => handleOpenModal(entry)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title={t('common.edit')}
                            aria-label={t('common.edit')}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(entry)}
                            className="text-red-600 hover:text-red-900"
                            title={t('common.delete')}
                            aria-label={t('common.delete')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-gray-600">
                {t('common.page')} {currentPage} {t('common.of')} {totalPages}
              </div>
              <div className="flex gap-1 items-center">
                <button
                  className="px-2 py-1 border rounded disabled:opacity-50 flex items-center"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label={t('common.prev')}
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    className={`px-2 py-1 border rounded ${page === currentPage ? 'bg-indigo-100 border-indigo-400' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  className="px-2 py-1 border rounded disabled:opacity-50 flex items-center"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  aria-label={t('common.next')}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Add/Edit Finance Entry Modal, Delete Confirmation Modal, Calculations Modal (unchanged) */}
      <Modal isOpen={modalOpen} onClose={handleCloseModal} title={form.isEdit ? t('finance.editEntry') : t('finance.addEntry')} size="md"
        footer={<ModalFooter onCancel={handleCloseModal} onConfirm={handleSubmit} isLoading={modalLoading} confirmText={t('common.save')} disabled={!!refundExceeds} />}
      >
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSubmit(); }}>
            <div>
              <label className="block text-sm font-medium mb-1">{t('common.type')}</label>
              <CreatableSelect
                value={form.type}
                onChange={handleTypeChange}
                options={entryTypes}
                onCreate={handleTypeCreate}
                placeholder={t('common.type')}
              />
            </div>
          {form.type?.value === 'refund' && (
            <div>
              <label className="block text-sm font-medium mb-1">{t('finance.selectDebtToRefund', 'Select Debt to Refund')}</label>
              {userDebt.debtEntries.length > 0 ? (
                <>
                  <select
                    value={form.refundedDebtId}
                    onChange={e => setForm(f => ({ ...f, refundedDebtId: e.target.value }))}
                    className="w-full border rounded px-3 py-2"
                    required
                  >
                    <option value="">{t('finance.selectDebt', 'Select a debt')}</option>
                    {userDebt.debtEntries.map(debt => (
                      <option key={debt.id} value={debt.id}>
                        {debt.amount.toLocaleString()} XAF - {debt.description || t('finance.debtEntry', 'Debt')}
                      </option>
                    ))}
                  </select>
                  {selectedDebt && (
                    <div className="text-xs text-gray-600 mt-1">
                      {t('finance.remaining', 'Remaining')}: {remainingDebt.toLocaleString()} XAF
                    </div>
                  )}
                  {refundExceeds && (
                    <div className="text-xs text-yellow-600 mt-1">{t('finance.refundExceeds', 'Refund amount exceeds remaining debt!')}</div>
                  )}
                </>
              ) : (
                <div className="text-sm text-red-500 mt-1">{t('finance.noDebtsToRefund', 'No debts available to refund.')}</div>
              )}
            </div>
          )}
            <div>
              <label className="block text-sm font-medium mb-1">{t('common.amount')}</label>
              <input
                type="number"
                name="amount"
                value={form.amount}
                onChange={handleFormChange}
                className="w-full border rounded px-3 py-2"
                placeholder={t('common.amount')}
                required
              {...(form.type?.value === 'refund' && form.refundedDebtId ? {
                max: remainingDebt || undefined
              } : {})}
              disabled={form.type?.value === 'refund' && userDebt.debtEntries.length === 0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('common.description')}</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleFormChange}
                className="w-full border rounded px-3 py-2"
                placeholder={t('common.description')}
                rows={2}
              disabled={form.type?.value === 'refund' && userDebt.debtEntries.length === 0}
              />
            </div>
          </form>
      </Modal>
      <Modal isOpen={deleteConfirm.open} onClose={handleDeleteCancel} title={t('common.delete')} size="sm"
        footer={<ModalFooter onCancel={handleDeleteCancel} onConfirm={handleDeleteConfirm} confirmText={t('common.delete')} isDanger />}
      >
        <div className="text-center text-gray-700">{t('finance.deleteConfirm')}</div>
      </Modal>
      <Modal
        isOpen={showCalculationsModal}
        onClose={() => setShowCalculationsModal(false)}
        title={t('dashboard.calculations.title')}
        size="lg"
      >
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.profit.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.profit.description')}<br /><br />
              <b>Profit = (Sum of all sales prices) - (Sum of all purchase prices for sold products)</b><br /><br />
              {t('dashboard.calculations.profit.example')}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.totalExpenses.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.totalExpenses.description')}<br /><br />
              {t('dashboard.calculations.totalExpenses.formula')}<br /><br />
              {t('dashboard.calculations.totalExpenses.includes')}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.totalSalesAmount.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.totalSalesAmount.description')}<br /><br />
              {t('dashboard.calculations.totalSalesAmount.formula')}<br /><br />
              {t('dashboard.calculations.totalSalesAmount.note')}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.totalPurchasePrice.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.totalPurchasePrice.description')}<br /><br />
              {t('dashboard.calculations.totalPurchasePrice.formula')}<br /><br />
              {t('dashboard.calculations.totalPurchasePrice.example')}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.deliveryFee.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.deliveryFee.description')}<br /><br />
              {t('dashboard.calculations.deliveryFee.formula')}
            </p>
          </div>
        </div>
      </Modal>
      <Modal isOpen={showDebtHistoryModal} onClose={() => setShowDebtHistoryModal(false)} title={t('finance.debtHistory', 'Debt/Refund History')} size="md">
        <div>
          <div className="mb-2 font-semibold text-red-800">{t('finance.debtHistory')}</div>
          <ul className="divide-y divide-gray-200">
            {userDebt.debtEntries.map((debt, idx) => {
              const linkedRefunds = userDebt.refundEntries.filter(refund => {
                const match = refund.refundedDebtId && String(refund.refundedDebtId) === String(debt.id);
                return match;
              });
              const refundedAmount = linkedRefunds.reduce((sum, r) => sum + r.amount, 0);
              const remaining = Math.max(0, debt.amount - refundedAmount);
              const isOpen = openDebtId === debt.id;
              return (
                <li key={debt.id || idx} className="py-2">
                  <div className="flex justify-between items-center cursor-pointer" onClick={() => setOpenDebtId(isOpen ? null : debt.id)}>
                    <div>
                      <span className="capitalize font-semibold">{t('finance.debtEntry', 'Debt')}</span>
                      <span className="ml-2 text-xs text-gray-500">{debt.createdAt?.seconds ? format(new Date(debt.createdAt.seconds * 1000), 'dd/MM/yyyy') : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-red-600 font-bold">{debt.amount.toLocaleString()} XAF</span>
                      <span className="text-xs text-gray-600">{t('finance.remaining', 'Remaining')}: <span className="font-bold">{remaining.toLocaleString()} XAF</span></span>
                      <button className="ml-2 text-gray-500 focus:outline-none" aria-label={t('finance.toggleRefunds', 'Toggle refunds')}>
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <ul className="ml-4 mt-2 bg-gray-50 rounded p-2">
                      {linkedRefunds.length === 0 ? (
                        <li className="text-xs text-gray-500">{t('finance.noRefunds', 'No refunds for this debt.')}</li>
                      ) : (
                        linkedRefunds.map((refund, rIdx) => (
                          <li key={refund.id || rIdx} className="flex justify-between items-center text-green-700 py-1">
                            <span>{t('finance.refundEntry', 'Refund')}</span>
                            <span>-{refund.amount.toLocaleString()} XAF</span>
                            <span className="text-xs text-gray-500">{refund.createdAt?.seconds ? format(new Date(refund.createdAt.seconds * 1000), 'dd/MM/yyyy') : ''}</span>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </Modal>
    </>
  );
};

export default Finance;
