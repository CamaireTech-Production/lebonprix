import { useState } from 'react';
import { Plus, FileDown, Edit2, Trash2, Loader2 } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Table from '../components/common/Table';
import Badge from '../components/common/Badge';
import Modal, { ModalFooter } from '../components/common/Modal';
import Input from '../components/common/Input';
import { useInfiniteExpenses } from '../hooks/useInfiniteExpenses';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import CreatableSelect from '../components/common/CreatableSelect';
import { getExpenseTypes, createExpenseType } from '../services/firestore';
import { softDeleteExpense } from '../services/firestore';
import LoadingScreen from '../components/common/LoadingScreen';
import SyncIndicator from '../components/common/SyncIndicator';
import { showSuccessToast, showErrorToast, showWarningToast } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import type { Expense } from '../types/models';

type CategoryKey = 'transportation' | 'purchase' | 'other';

const Expenses = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { 
    expenses, 
    loading, 
    loadingMore: expensesLoadingMore,
    syncing: expensesSyncing,
    hasMore: expensesHasMore,
    error, 
    loadMore: loadMoreExpenses,
    refresh: refreshExpenses
  } = useInfiniteExpenses();
  
  // Infinite scroll for expenses
  useInfiniteScroll({
    hasMore: expensesHasMore,
    loading: expensesLoadingMore,
    onLoadMore: loadMoreExpenses,
    threshold: 300 // Load more when 300px from bottom
  });
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentExpense, setCurrentExpense] = useState<Expense | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'transportation',
  });
  const [expenseTypes, setExpenseTypes] = useState<{ label: string; value: string }[]>([]);
  const [selectedType, setSelectedType] = useState<{ label: string; value: string } | null>(null);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const resetForm = () => {
    setFormData({
      description: '',
      amount: '',
      category: 'transportation',
    });
    setSelectedType(null);
  };

  const loadExpenseTypes = async () => {
    if (!user) return;
    const types = await getExpenseTypes(user.uid);
    // Map fetched types using translations when keys match known categories
    const options = types.map(tDoc => {
      const key = tDoc.name;
      const label = t(`expenses.categories.${key}`, key);
      return { label, value: key };
    });
    // Ensure legacy defaults visible even before migration
    const legacyDefaults = ['transportation', 'purchase', 'other'];
    legacyDefaults.forEach(name => {
      if (!options.find(o => o.value === name)) options.push({ label: t(`expenses.categories.${name}`, name), value: name });
    });
    setExpenseTypes(options);
  };
  
  const handleAddExpense = async () => {
    if (!user) {
      showErrorToast(t('errors.notAuthenticated'));
      return;
    }

    try {
      const typeValue = selectedType?.value || formData.category;
      if (!formData.description || !formData.amount || !typeValue) {
        showWarningToast(t('errors.fillAllFields'));
        return;
      }

      setIsSubmitting(true);
      await addExpense({
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: typeValue,
        userId: user.uid,
      });
      
      setIsAddModalOpen(false);
      resetForm();
      showSuccessToast(t('expenses.messages.addSuccess'));
    } catch (err) {
      console.error('Failed to add expense:', err);
      showErrorToast(t('expenses.messages.addError'));
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleEditExpense = async () => {
    if (!user) {
      showErrorToast(t('errors.notAuthenticated'));
      return;
    }

    if (!currentExpense) return;
    
    try {
      const typeValue = selectedType?.value || formData.category;
      if (!formData.description || !formData.amount || !typeValue) {
        showWarningToast(t('errors.fillAllFields'));
        return;
      }

      setIsSubmitting(true);
      await updateExpense(currentExpense.id, {
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: typeValue,
      });
      
      setIsEditModalOpen(false);
      resetForm();
      showSuccessToast(t('expenses.messages.updateSuccess'));
    } catch (err) {
      console.error('Failed to update expense:', err);
      showErrorToast(t('expenses.messages.updateError'));
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const openEditModal = (expense: Expense) => {
    setCurrentExpense(expense);
    setFormData({
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category,
    });
    setSelectedType({ label: t(`expenses.categories.${expense.category}`, expense.category), value: expense.category });
    setIsEditModalOpen(true);
  };
  
  const handleDeleteExpense = async () => {
    if (!expenseToDelete || !user?.uid) {
      return;
    }
    setDeleteLoading(true);
    try {
      await softDeleteExpense(expenseToDelete.id, user.uid);
      showSuccessToast(t('expenses.messages.deleteSuccess'));
      setIsDeleteModalOpen(false);
      setExpenseToDelete(null);
    } catch (err) {
      showErrorToast(t('expenses.messages.deleteError'));
    } finally {
      setDeleteLoading(false);
    }
  };
  
  const columns = [
    { 
      header: t('expenses.table.description'), 
      accessor: 'description' as const,
    },
    { 
      header: t('expenses.table.amount'), 
      accessor: (expense: Expense) => (
        <span>{expense.amount.toLocaleString()} XAF</span>
      ),
    },
    { 
      header: t('expenses.table.category'), 
      accessor: (expense: Expense) => {
        const defaultCategories = ['transportation', 'purchase', 'other'];
        const isDefault = defaultCategories.includes(expense.category);
        let variant: 'info' | 'error' | 'warning' = 'info';
        if (expense.category === 'purchase') variant = 'error';
        else if (expense.category === 'other') variant = 'warning';
        else if (expense.category === 'transportation') variant = 'info';
        const label = isDefault ? t(`expenses.categories.${expense.category}`) : expense.category;
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
    { 
      header: t('expenses.table.date'), 
      accessor: (expense: Expense) => {
        if (!expense.createdAt?.seconds) return 'N/A';
        return new Date(expense.createdAt.seconds * 1000).toLocaleDateString();
      },
    },
    { 
      header: t('expenses.table.actions'), 
      accessor: (expense: Expense) => (
        <div className="flex space-x-2">
          <button 
            onClick={() => openEditModal(expense)}
            className="text-indigo-600 hover:text-indigo-900"
          >
            <Edit2 size={16} />
          </button>
          {expense.isAvailable !== false && (
            <button
              onClick={() => { setExpenseToDelete(expense); setIsDeleteModalOpen(true); }}
              className="text-red-600 hover:text-red-900 flex items-center"
              title={t('expenses.actions.delete')}
              disabled={deleteLoading && expenseToDelete?.id === expense.id}
            >
              {deleteLoading && expenseToDelete?.id === expense.id ? (
                <Loader2 size={16} className="animate-spin mr-1" />
              ) : null}
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ),
      className: 'w-24',
    },
  ];

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    showErrorToast(t('expenses.messages.loadError'));
    return null;
  }

  // Filter out soft-deleted expenses everywhere
  const visibleExpenses = expenses.filter(exp => exp.isAvailable !== false);
  const summaryStats: Record<CategoryKey, number> = { transportation: 0, purchase: 0, other: 0 };
  visibleExpenses.forEach(expense => {
    let normalizedCategory: CategoryKey = 'other';
    if (expense.category === 'purchase') normalizedCategory = 'purchase';
    else if (expense.category === 'transportation') normalizedCategory = 'transportation';
    summaryStats[normalizedCategory] += expense.amount;
  });

  // Filter expenses by category
  const filteredExpenses = selectedCategory === 'All'
    ? visibleExpenses
    : visibleExpenses.filter(expense => expense.category === selectedCategory);

  return (
    <div className="pb-16 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('expenses.title')}</h1>
          <p className="text-gray-600">{t('expenses.subtitle')}</p>
        </div>
        
        {/* Sync Indicator */}
        <SyncIndicator 
          isSyncing={expensesSyncing} 
          message="Updating expenses..." 
          className="mb-4"
        />
        
        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <select
            className="rounded-md border border-gray-300 shadow-sm py-2 px-3 bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="All">{t('expenses.filters.allCategories')}</option>
            <option value="transportation">{t('expenses.categories.transportation')}</option>
            <option value="purchase">{t('expenses.categories.purchase')}</option>
            <option value="other">{t('expenses.categories.other')}</option>
          </select>
          
          <Button 
            variant="outline" 
            icon={<FileDown size={16} />}
          >
            {t('expenses.actions.export')}
          </Button>
          
          <Button 
            icon={<Plus size={16} />}
            onClick={async () => { await loadExpenseTypes(); setIsAddModalOpen(true); }}
          >
            {t('expenses.actions.add')}
          </Button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-sm font-medium text-blue-700">{t('expenses.summary.transportation')}</p>
          <p className="text-xl font-semibold text-gray-900">
            {summaryStats.transportation.toLocaleString()} XAF
          </p>
        </Card>
        
        <Card>
          <p className="text-sm font-medium text-red-700">{t('expenses.summary.purchase')}</p>
          <p className="text-xl font-semibold text-gray-900">
            {summaryStats.purchase.toLocaleString()} XAF
          </p>
        </Card>
        
        <Card>
          <p className="text-sm font-medium text-yellow-700">{t('expenses.summary.other')}</p>
          <p className="text-xl font-semibold text-gray-900">
            {summaryStats.other.toLocaleString()} XAF
          </p>
        </Card>
      </div>
      
      <Card>
        <Table
          data={filteredExpenses}
          columns={columns}
          keyExtractor={(expense) => expense.id}
          emptyMessage={t('expenses.messages.noExpenses')}
        />
        
        {/* Infinite Scroll Loading Indicator */}
        {expensesLoadingMore && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            <span className="ml-3 text-gray-600">Loading more expenses...</span>
          </div>
        )}
        {!expensesHasMore && expenses.length > 0 && (
          <div className="text-center py-6 text-gray-500">
            <p>✅ All expenses loaded ({expenses.length} total)</p>
          </div>
        )}
      </Card>
      {/* Mobile spacing for floating action button */}
      <div className="h-20 md:hidden"></div>
      
      {/* Add Expense Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={t('expenses.modals.add.title')}
        footer={
          <ModalFooter 
            onCancel={() => setIsAddModalOpen(false)}
            onConfirm={handleAddExpense}
            confirmText={t('expenses.modals.add.confirm')}
            isLoading={isSubmitting}
          />
        }
      >
        <div className="space-y-4">
          <Input
            label={t('expenses.form.description')}
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            required
          />
          
          <Input
            label={t('expenses.form.amount')}
            name="amount"
            type="number"
            value={formData.amount}
            onChange={handleInputChange}
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('expenses.form.category')}
            </label>
            <CreatableSelect
              value={selectedType}
              onChange={(opt: any) => setSelectedType(opt)}
              options={expenseTypes}
              onCreate={async (name: string) => {
                if (!user) return { label: name, value: name };
                const created = await createExpenseType({ name, isDefault: false, userId: user.uid } as any);
                const option = { label: created.name, value: created.name };
                setExpenseTypes(prev => [...prev, option]);
                return option;
              }}
              placeholder={t('expenses.form.category')}
            />
          </div>
        </div>
      </Modal>
      
      {/* Edit Expense Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={t('expenses.modals.edit.title')}
        footer={
          <ModalFooter 
            onCancel={() => setIsEditModalOpen(false)}
            onConfirm={handleEditExpense}
            confirmText={t('expenses.modals.edit.confirm')}
            isLoading={isSubmitting}
          />
        }
      >
        <div className="space-y-4">
          <Input
            label={t('expenses.form.description')}
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            required
          />
          
          <Input
            label={t('expenses.form.amount')}
            name="amount"
            type="number"
            value={formData.amount}
            onChange={handleInputChange}
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('expenses.form.category')}
            </label>
            <CreatableSelect
              value={selectedType}
              onChange={(opt: any) => setSelectedType(opt)}
              options={expenseTypes}
              onCreate={async (name: string) => {
                if (!user) return { label: name, value: name };
                const created = await createExpenseType({ name, isDefault: false, userId: user.uid } as any);
                const option = { label: created.name, value: created.name };
                setExpenseTypes(prev => [...prev, option]);
                return option;
              }}
              placeholder={t('expenses.form.category')}
            />
          </div>
        </div>
      </Modal>
      
      {/* Delete Expense Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setExpenseToDelete(null); }}
        title={t('expenses.modals.delete.title') || 'Delete Expense'}
        footer={
          <ModalFooter
            onCancel={() => { setIsDeleteModalOpen(false); setExpenseToDelete(null); }}
            onConfirm={handleDeleteExpense}
            confirmText={t('expenses.modals.delete.confirm') || 'Delete'}
            isDanger
            isLoading={deleteLoading}
          />
        }
      >
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            {t('expenses.messages.deleteConfirmation', { description: expenseToDelete?.description }) || `Are you sure you want to delete this expense?`}
          </p>
          <p className="text-sm text-red-600">
            {t('expenses.messages.deleteWarning') || 'This action cannot be undone.'}
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Expenses;