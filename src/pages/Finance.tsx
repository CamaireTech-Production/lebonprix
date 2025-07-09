import React, { useState, useMemo } from 'react';
import StatCard from '../components/dashboard/StatCard';
import Button from '../components/common/Button';
import { useFinanceEntries, useProducts, useSales, useExpenses } from '../hooks/useFirestore';
import { format, startOfYear, endOfYear } from 'date-fns';
import Modal, { ModalFooter } from '../components/common/Modal';
import CreatableSelect from '../components/common/CreatableSelect';
import { getFinanceEntryTypes, createFinanceEntryType, createFinanceEntry, updateFinanceEntry, softDeleteFinanceEntry } from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';
import LoadingScreen from '../components/common/LoadingScreen';
import { Edit2, Trash2, BarChart2, TrendingUp, Receipt, Package2, DollarSign, ShoppingCart, Info, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import DateRangePicker from '../components/common/DateRangePicker';
import { useTranslation } from 'react-i18next';
import ObjectivesBar from '../components/objectives/ObjectivesBar';
import ObjectivesModal from '../components/objectives/ObjectivesModal';

const Finance: React.FC = () => {
  const { t } = useTranslation();
  const { entries, loading } = useFinanceEntries();
  const { sales, loading: salesLoading } = useSales();
  const { expenses, loading: expensesLoading } = useExpenses();
  const { products, loading: productsLoading } = useProducts();
  const { user } = useAuth();
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

  // Solde: sum of all active finance entries in the selected period
  const solde = filteredFinanceEntries.reduce((sum, entry) => sum + entry.amount, 0);

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
  // Calculate gross profit (selling price - purchase price) * quantity for all sales
  const grossProfit = filteredSales.reduce((sum, sale) => {
    return sum + sale.products.reduce((productSum, product) => {
      const productData = products.find(p => p.id === product.productId);
      if (!productData) return productSum;
      const sellingPrice = product.negotiatedPrice || product.basePrice;
      return productSum + (sellingPrice - productData.costPrice) * product.quantity;
    }, 0);
  }, 0);
  // Calculate net profit (gross profit - total expenses)
  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0) + filteredManualEntries.filter(e => e.amount < 0).reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const netProfit = grossProfit - totalExpenses;
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
  const totalPurchasePrice = products.reduce((sum, product) => {
    // Optionally, use stock at date logic from Dashboard
    return sum + (product.costPrice * product.stock);
  }, 0);

  // Stat cards (dashboard style, now using dashboard logic)
  const statCards = [
    { title: t('dashboard.stats.grossProfit'), value: `${grossProfit.toLocaleString()} XAF`, icon: <BarChart2 size={20} />, tooltipKey: 'grossProfit', type: 'profit' },
    { title: t('dashboard.stats.netProfit'), value: `${netProfit.toLocaleString()} XAF`, icon: <TrendingUp size={20} />, tooltipKey: 'netProfit', type: 'profit' },
    { title: t('dashboard.stats.totalExpenses'), value: `${totalExpenses.toLocaleString()} XAF`, icon: <Receipt size={20} />, tooltipKey: 'totalExpenses', type: 'expenses' },
    { title: t('dashboard.stats.totalProductsSold'), value: totalProductsSold, icon: <Package2 size={20} />, tooltipKey: 'totalProductsSold', type: 'products' },
    { title: t('dashboard.stats.deliveryFee'), value: `${totalDeliveryFee.toLocaleString()} XAF`, icon: <DollarSign size={20} />, tooltipKey: 'deliveryFee', type: 'delivery' },
    { title: t('dashboard.stats.totalSalesAmount'), value: `${totalSalesAmount.toLocaleString()} XAF`, icon: <ShoppingCart size={20} />, tooltipKey: 'totalSalesAmount', type: 'sales' },
    { title: t('dashboard.stats.totalSalesCount'), value: totalOrders, icon: <ShoppingCart size={20} />, tooltipKey: 'totalSalesCount', type: 'sales' },
    { title: t('dashboard.stats.totalPurchasePrice'), value: `${totalPurchasePrice.toLocaleString()} XAF`, icon: <DollarSign size={20} />, tooltipKey: 'totalPurchasePrice', type: 'products' },
  ];

  // Metrics options for objectives
  const metricsOptions = [
    { value: 'grossProfit', label: t('dashboard.stats.grossProfit') },
    { value: 'netProfit', label: t('dashboard.stats.netProfit') },
    { value: 'totalExpenses', label: t('dashboard.stats.totalExpenses') },
    { value: 'totalProductsSold', label: t('dashboard.stats.totalProductsSold') },
    { value: 'deliveryFee', label: t('dashboard.stats.deliveryFee') },
    { value: 'totalSalesAmount', label: t('dashboard.stats.totalSalesAmount') },
    { value: 'totalSalesCount', label: t('dashboard.stats.totalSalesCount') },
  ];
  const statsMap = {
    grossProfit,
    netProfit,
    totalExpenses,
    totalProductsSold,
    deliveryFee: totalDeliveryFee,
    totalSalesAmount,
    totalSalesCount: totalOrders,
  };

  // Map finance entries to sales/expenses for objectives logic
  const salesForObjectives = filteredSales.map(sale => ({
    createdAt: sale.createdAt,
    totalAmount: sale.totalAmount,
    products: sale.products,
  }));
  const expensesForObjectives = filteredExpenses.map(exp => ({
    createdAt: exp.createdAt,
    amount: exp.amount,
    category: (exp as any).category || 'other',
  }));

  // Fetch entry types on modal open
  const handleOpenModal = async (editEntry?: any) => {
    if (!user) return;
    setModalOpen(true);
    setModalLoading(true);
    const types = await getFinanceEntryTypes(user.uid);
    setEntryTypes(types.map(t => ({ label: t.name, value: t.id })));
    if (editEntry) {
      setForm({
        id: editEntry.id,
        type: { label: editEntry.type, value: editEntry.type },
        amount: editEntry.amount.toString(),
        description: editEntry.description || '',
        date: editEntry.date?.seconds ? format(new Date(editEntry.date.seconds * 1000), 'yyyy-MM-dd') : '',
        isEdit: true,
      });
    } else {
      setForm({ id: '', type: null, amount: '', description: '', date: '', isEdit: false });
    }
    setModalLoading(false);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setForm({ id: '', type: null, amount: '', description: '', date: '', isEdit: false });
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
    setModalLoading(true);
    const entryData = {
      userId: user.uid,
      sourceType: 'manual' as const,
      type: form.type.label,
      amount: parseFloat(form.amount),
      description: form.description,
      date: Timestamp.now(),
      isDeleted: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    try {
      if (form.isEdit && form.id) {
        await updateFinanceEntry(form.id, entryData);
      } else {
        await createFinanceEntry(entryData);
      }
      handleCloseModal();
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteClick = (entry: any) => {
    setDeleteConfirm({ open: true, entryId: entry.id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.entryId) return;
    await softDeleteFinanceEntry(deleteConfirm.entryId);
    setDeleteConfirm({ open: false, entryId: null });
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ open: false, entryId: null });
  };

  return (
    <>
      <div className="px-4 py-6 max-w-7xl mx-auto">
        {/* First row: Solde (left), Objectives (right) */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-6 mt-6">
          {/* Solde card left */}
          <div className="md:w-1/4 w-full flex flex-col items-start justify-start">
            <StatCard
              title={t('dashboard.stats.solde')}
              value={`${solde.toLocaleString()} XAF`}
              icon={<DollarSign size={24} />}
              type="solde"
              className="ring-2 ring-green-400 shadow bg-green-50 text-green-900 border border-green-200 rounded-xl px-6 py-4 mb-2"
            />
          </div>
          {/* Objectives/progress right */}
          <div className="md:w-3/4 w-full flex flex-col items-end justify-start gap-2">
            <ObjectivesBar
              onAdd={() => setShowObjectivesModal(true)}
              onView={() => setShowObjectivesModal(true)}
              stats={statsMap}
              dateRange={dateRange}
              applyDateFilter={applyDateFilter}
              onToggleFilter={setApplyDateFilter}
              sales={filteredSales}
              expenses={expensesForObjectives}
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
                sales={filteredSales}
                expenses={expensesForObjectives}
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
        <div className="mb-8 flex justify-center">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-5xl">
            {statCards.map((stat) => (
              <StatCard
                key={stat.title}
                title={stat.title}
                value={stat.value}
                icon={stat.icon}
                tooltipKey={stat.tooltipKey}
                type={stat.type as any}
                className="rounded-xl border border-gray-100 bg-white shadow-sm px-4 py-4"
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
                  <th className="py-2 px-2 cursor-pointer select-none" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                    {t('common.date')}
                    <span className="ml-1 align-middle inline-block">
                      {sortOrder === 'asc' ? <ChevronUp size={16} className="inline" /> : <ChevronDown size={16} className="inline" />}
                    </span>
                  </th>
                  <th className="py-2 px-2">{t('common.type')}</th>
                  <th className="py-2 px-2">{t('common.description')}</th>
                  <th className="py-2 px-2">{t('common.amount')}</th>
                  <th className="py-2 px-2">{t('common.source')}</th>
                  <th className="py-2 px-2">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEntries.map(entry => (
                  <tr key={entry.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">{entry.createdAt?.seconds ? format(new Date(entry.createdAt.seconds * 1000), 'dd/MM/yyyy') : ''}</td>
                    <td className="py-2 px-2 capitalize">{entry.type}</td>
                    <td className="py-2 px-2">{entry.description || '-'}</td>
                    <td className={`py-2 px-2 font-semibold ${entry.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>{entry.amount.toLocaleString()}</td>
                    <td className="py-2 px-2 capitalize">{t(`finance.sourceType.${entry.sourceType}`)}</td>
                    <td className="py-2 px-2 flex gap-2">
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
        footer={<ModalFooter onCancel={handleCloseModal} onConfirm={handleSubmit} isLoading={modalLoading} confirmText={t('common.save')} />}
      >
        {modalLoading ? (
          <div className="text-center text-gray-400">{t('common.loading')}</div>
        ) : (
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
              />
            </div>
          </form>
        )}
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.grossProfit.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.grossProfit.description')}<br /><br />
              {t('dashboard.calculations.grossProfit.formula')}<br /><br />
              {t('dashboard.calculations.grossProfit.example')}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.netProfit.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.netProfit.description')}<br /><br />
              {t('dashboard.calculations.netProfit.formula')}<br /><br />
              {t('dashboard.calculations.netProfit.example')}
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
    </>
  );
};

export default Finance;
