import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, DollarSign, TrendingUp, Calendar, Tag } from 'lucide-react';
import { Card, Button, Modal, Table, LoadingSpinner, Badge, Input } from '../../../components/ui';
import ExpenseFormModal from '../../../components/expenses/ExpenseFormModal';
import { useExpenses } from '../../../hooks/business/useExpenses';
import { useExpenseCategories } from '../../../hooks/business/useExpenseCategories';
import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { t } from '../../../utils/i18n';
import { formatDateForInput, normalizeDate } from '../../../utils/dateUtils';
import type { Expense } from '../../../types/geskap';
import toast from 'react-hot-toast';

const ExpensesList = () => {
  const { currentUser, restaurant } = useAuth();
  const { language } = useLanguage();
  const restaurantId = restaurant?.id || currentUser?.uid || '';
  const userId = currentUser?.uid || '';

  const {
    expenses,
    loading: expensesLoading,
    error: expensesError,
    addExpense,
    updateExpense,
    deleteExpense,
    deleteExpenseWithImage
  } = useExpenses({ restaurantId, userId });

  const {
    categories,
    loading: categoriesLoading,
  } = useExpenseCategories({ restaurantId });

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form states
  const [currentExpense, setCurrentExpense] = useState<Expense | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');

  const loading = expensesLoading || categoriesLoading;

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      const matchesSearch = !searchQuery ||
        expense.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.category?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;

      // Date filtering
      let matchesDate = true;
      if (dateFromFilter || dateToFilter) {
        const expenseDate = normalizeDate(expense.date || expense.createdAt);
        if (expenseDate) {
          if (dateFromFilter) {
            const fromDate = new Date(dateFromFilter);
            fromDate.setHours(0, 0, 0, 0);
            if (expenseDate < fromDate) {
              matchesDate = false;
            }
          }
          if (dateToFilter && matchesDate) {
            const toDate = new Date(dateToFilter);
            toDate.setHours(23, 59, 59, 999);
            if (expenseDate > toDate) {
              matchesDate = false;
            }
          }
        } else {
          matchesDate = false;
        }
      }

      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [expenses, searchQuery, categoryFilter, dateFromFilter, dateToFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const thisMonth = expenses.filter(exp => {
      if (!exp.date) return false;
      let expDate: Date;
      if (exp.date.seconds) {
        expDate = new Date(exp.date.seconds * 1000);
      } else if (exp.date instanceof Date) {
        expDate = exp.date;
      } else {
        return false;
      }
      const now = new Date();
      return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
    });
    const monthTotal = thisMonth.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    // Category breakdown
    const categoryTotals: Record<string, number> = {};
    expenses.forEach(exp => {
      const cat = exp.category || 'Other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (exp.amount || 0);
    });

    const topCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return { total, monthTotal, topCategories, count: expenses.length };
  }, [expenses]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openAddModal = () => {
    setIsAddModalOpen(true);
  };

  const openEditModal = (expense: Expense) => {
    setCurrentExpense(expense);
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (expense: Expense) => {
    setCurrentExpense(expense);
    setIsDeleteModalOpen(true);
  };

  const handleExpenseSuccess = () => {
    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
    setCurrentExpense(null);
  };

  const handleDeleteExpense = async () => {
    if (!currentExpense?.id || !restaurantId) return;

    setIsSubmitting(true);
    try {
      await deleteExpense(currentExpense.id);
      setIsDeleteModalOpen(false);
      setCurrentExpense(null);
      toast.success(t('expenses_deleted', language));
    } catch (err) {
      toast.error(t('expenses_error', language));
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' XAF';
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    let date: Date;
    if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (expensesError) {
    return (
      <div className="text-center py-8 text-red-500">
        {t('error_loading', language)}: {expensesError}
      </div>
    );
  }

  const tableColumns = [
    { header: t('description', language), accessor: 'description' as const },
    { header: t('amount', language), accessor: 'amount' as const },
    { header: t('category', language), accessor: 'category' as const },
    { header: t('date', language), accessor: 'date' as const },
    { header: t('actions', language), accessor: 'actions' as const }
  ];

  const tableData = filteredExpenses.map(expense => ({
    id: expense.id || '',
    description: (
      <div className="flex items-center gap-2">
        {expense.image && (
          <img
            src={expense.image}
            alt={expense.description || 'Expense'}
            className="w-10 h-10 rounded object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <span>{expense.description || '-'}</span>
      </div>
    ),
    amount: formatAmount(expense.amount || 0),
    category: (
      <Badge variant="info">{expense.category || 'Other'}</Badge>
    ),
    date: formatDate(expense.date || expense.createdAt || undefined),
    actions: (
      <div className="flex space-x-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            openEditModal(expense);
          }}
          className="text-blue-600 hover:text-blue-900 p-1"
          title={t('edit', language)}
        >
          <Edit2 size={16} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            openDeleteModal(expense);
          }}
          className="text-red-600 hover:text-red-900 p-1"
          title={t('delete', language)}
        >
          <Trash2 size={16} />
        </button>
      </div>
    )
  }));

  return (
    <div className="pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t('expenses_list', language)}</h2>
          <p className="text-gray-600">{t('expenses_subtitle', language)}</p>
        </div>

        <div className="flex gap-2 mt-4 md:mt-0">
          <Button icon={<Plus size={16} />} onClick={openAddModal}>
            {t('add_expense', language)}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('total_expenses', language)}</p>
              <p className="text-2xl font-bold text-gray-900">{formatAmount(stats.total)}</p>
            </div>
            <DollarSign className="text-red-500" size={32} />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('expense_this_month', language)}</p>
              <p className="text-2xl font-bold text-gray-900">{formatAmount(stats.monthTotal)}</p>
            </div>
            <TrendingUp className="text-orange-500" size={32} />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('expense_count', language)}</p>
              <p className="text-2xl font-bold text-gray-900">{stats.count}</p>
            </div>
            <Calendar className="text-blue-500" size={32} />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('categories_count', language)}</p>
              <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
            </div>
            <Tag className="text-purple-500" size={32} />
          </div>
        </Card>
      </div>

      {/* Top Categories */}
      {stats.topCategories.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.topCategories.map(([category, amount], index) => {
            const colors = ['text-blue-700 bg-blue-50', 'text-red-700 bg-red-50', 'text-yellow-700 bg-yellow-50', 'text-green-700 bg-green-50'];
            const colorClass = colors[index % colors.length];
            return (
              <Card key={category} className={colorClass.split(' ')[1]}>
                <p className={`text-sm font-medium ${colorClass.split(' ')[0]}`}>{category}</p>
                <p className="text-lg font-semibold text-gray-900">{formatAmount(amount)}</p>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder={t('search_expenses', language)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">{t('expense_all_categories', language)}</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>
          
          {/* Date Range Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              label={t('from_date', language) || 'From Date'}
              type="date"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
              max={dateToFilter || new Date().toISOString().split('T')[0]}
            />
            <Input
              label={t('to_date', language) || 'To Date'}
              type="date"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
              min={dateFromFilter}
              max={new Date().toISOString().split('T')[0]}
            />
            {(dateFromFilter || dateToFilter) && (
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDateFromFilter('');
                    setDateToFilter('');
                  }}
                >
                  {t('clear_filters', language) || 'Clear'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Expenses Table */}
      <Card>
        <Table
          data={tableData}
          columns={tableColumns}
          keyExtractor={(item) => item.id}
          emptyMessage={t('no_expenses', language)}
        />
      </Card>

      {/* Add Expense Modal */}
      <ExpenseFormModal
        isOpen={isAddModalOpen}
        mode="add"
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleExpenseSuccess}
        restaurantId={restaurantId}
        userId={userId}
        addExpense={addExpense}
        updateExpense={updateExpense}
      />

      {/* Edit Expense Modal */}
      <ExpenseFormModal
        isOpen={isEditModalOpen}
        mode="edit"
        expense={currentExpense}
        onClose={() => {
          setIsEditModalOpen(false);
          setCurrentExpense(null);
        }}
        onSuccess={handleExpenseSuccess}
        restaurantId={restaurantId}
        userId={userId}
        addExpense={addExpense}
        updateExpense={updateExpense}
      />

      {/* Delete Expense Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setCurrentExpense(null);
        }}
        title={t('delete_expense', language)}
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            {t('delete_expense_confirm', language)}{' '}
            <strong>{currentExpense?.description}</strong>?
          </p>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setCurrentExpense(null);
              }}
            >
              {t('cancel', language)}
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteExpense}
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              {t('delete', language)}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ExpensesList;
