import { useState } from 'react';
import { Plus, FileDown, Edit2 } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Table from '../components/common/Table';
import Badge from '../components/common/Badge';
import Modal, { ModalFooter } from '../components/common/Modal';
import Input from '../components/common/Input';
import { useExpenses } from '../hooks/useFirestore';
import LoadingScreen from '../components/common/LoadingScreen';
import { showSuccessToast, showErrorToast, showWarningToast } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import type { Expense } from '../types/models';

const Expenses = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { expenses, loading, error, addExpense, updateExpense } = useExpenses();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentExpense, setCurrentExpense] = useState<Expense | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'Delivery',
  });
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const resetForm = () => {
    setFormData({
      description: '',
      amount: '',
      category: 'Delivery',
    });
  };
  
  const handleAddExpense = async () => {
    if (!user) {
      showErrorToast(t('errors.notAuthenticated'));
      return;
    }

    try {
      if (!formData.description || !formData.amount || !formData.category) {
        showWarningToast(t('errors.fillAllFields'));
        return;
      }

      setIsSubmitting(true);
      await addExpense({
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: formData.category.toLowerCase() as 'delivery' | 'purchase' | 'other',
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
      if (!formData.description || !formData.amount || !formData.category) {
        showWarningToast(t('errors.fillAllFields'));
        return;
      }

      setIsSubmitting(true);
      await updateExpense(currentExpense.id, {
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: formData.category.toLowerCase() as 'delivery' | 'purchase' | 'other',
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
    setIsEditModalOpen(true);
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
        let variant: 'info' | 'error' | 'warning' = 'info';
        if (expense.category === 'purchase') variant = 'error';
        if (expense.category === 'other') variant = 'warning';
        
        return <Badge variant={variant}>{t(`expenses.categories.${expense.category}`)}</Badge>;
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

  type CategoryKey = 'delivery' | 'purchase' | 'other';
  const summaryStats = expenses.reduce((acc: Record<CategoryKey, number>, expense) => {
    const normalizedCategory = expense.category.toLowerCase() as CategoryKey;
    if (acc[normalizedCategory] !== undefined) {
      acc[normalizedCategory] += expense.amount;
    }
    return acc;
  }, { delivery: 0, purchase: 0, other: 0 });

  // Filter expenses by category
  const filteredExpenses = selectedCategory === 'All'
    ? expenses
    : expenses.filter(expense => expense.category.toLowerCase() === selectedCategory.toLowerCase());

  return (
    <div className="pb-16 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('expenses.title')}</h1>
          <p className="text-gray-600">{t('expenses.subtitle')}</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <select
            className="rounded-md border border-gray-300 shadow-sm py-2 px-3 bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="All">{t('expenses.filters.allCategories')}</option>
            <option value="delivery">{t('expenses.categories.delivery')}</option>
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
            onClick={() => setIsAddModalOpen(true)}
          >
            {t('expenses.actions.add')}
          </Button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-sm font-medium text-blue-700">{t('expenses.summary.delivery')}</p>
          <p className="text-xl font-semibold text-gray-900">
            {summaryStats.delivery.toLocaleString()} XAF
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
      </Card>
      
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
            <select
              name="category"
              className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={formData.category}
              onChange={handleInputChange}
            >
              <option value="delivery">{t('expenses.categories.delivery')}</option>
              <option value="purchase">{t('expenses.categories.purchase')}</option>
              <option value="other">{t('expenses.categories.other')}</option>
            </select>
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
            <select
              name="category"
              className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={formData.category}
              onChange={handleInputChange}
            >
              <option value="delivery">{t('expenses.categories.delivery')}</option>
              <option value="purchase">{t('expenses.categories.purchase')}</option>
              <option value="other">{t('expenses.categories.other')}</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Expenses;