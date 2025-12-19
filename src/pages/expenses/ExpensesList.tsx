// src/pages/expenses/ExpensesList.tsx
import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, Button, SyncIndicator, LoadingScreen } from '@components/common';
import { useInfiniteExpenses } from '@hooks/data/useInfiniteExpenses';
import { useInfiniteScroll } from '@hooks/data/useInfiniteScroll';
import { useExpenseStats } from '@hooks/business/useExpenseStats';
import ExpenseFilters from './shared/ExpenseFilters';
import ExpenseTable from './shared/ExpenseTable';
import ExpenseFormModal from './shared/ExpenseFormModal';
import ExpenseDeleteModal from './shared/ExpenseDeleteModal';
import type { Expense } from '../../types/models';

const ExpensesList = () => {
  const { t } = useTranslation();
  const {
    expenses,
    loading,
    loadingMore: expensesLoadingMore,
    syncing: expensesSyncing,
    hasMore: expensesHasMore,
    loadMore: loadMoreExpenses,
    addExpense: addExpenseToState,
    removeExpense: removeExpenseFromState,
    updateExpense: updateExpenseInState
  } = useInfiniteExpenses();

  // Infinite scroll
  useInfiniteScroll({
    hasMore: expensesHasMore,
    loading: expensesLoadingMore,
    onLoadMore: loadMoreExpenses,
    threshold: 300
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentExpense, setCurrentExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(2025, 3, 1),
    to: new Date(2100, 0, 1),
  });

  // Filter expenses
  const visibleExpenses = expenses.filter(exp => exp.isAvailable !== false);
  
  const filteredExpenses = useMemo(() => {
    return visibleExpenses.filter(expense => {
      // Filter by search query
      const searchMatch = !searchQuery || 
        expense.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Filter by date range
      const timestamp = expense.date || expense.createdAt;
      let dateMatch = true;
      if (timestamp?.seconds) {
        const expenseDate = new Date(timestamp.seconds * 1000);
        dateMatch = expenseDate >= dateRange.from && expenseDate <= dateRange.to;
      }
      
      return searchMatch && dateMatch;
    });
  }, [visibleExpenses, searchQuery, dateRange]);

  // Calculate summary stats (only top 4 categories)
  const stats = useExpenseStats(visibleExpenses, { dateRange });
  const topCategories = stats.categoryBreakdown.slice(0, 4);

  const handleAddSuccess = (expense: Expense) => {
    addExpenseToState(expense);
    setIsAddModalOpen(false);
  };

  const handleEditSuccess = (expense: Expense) => {
    if (expense.id) {
      updateExpenseInState(expense.id, expense);
    }
    setIsEditModalOpen(false);
    setCurrentExpense(null);
  };

  const handleDeleteSuccess = () => {
    if (expenseToDelete) {
      removeExpenseFromState(expenseToDelete.id);
    }
    setIsDeleteModalOpen(false);
    setExpenseToDelete(null);
  };

  const handleEdit = (expense: Expense) => {
    setCurrentExpense(expense);
    setIsEditModalOpen(true);
  };

  const handleDelete = (expense: Expense) => {
    setExpenseToDelete(expense);
    setIsDeleteModalOpen(true);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="pb-16 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('expenses.title')}</h1>
          <p className="text-gray-600">{t('expenses.subtitle')}</p>
        </div>
        
        <Button 
          icon={<Plus size={16} />}
          onClick={() => setIsAddModalOpen(true)}
        >
          {t('expenses.actions.add')}
        </Button>
      </div>

      {/* Sync Indicator */}
      <SyncIndicator 
        isSyncing={expensesSyncing} 
        message="Mise à jour des dépenses..." 
        className="mb-4"
      />

      {/* Summary Cards - Top 4 categories only */}
      {topCategories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {topCategories.map((item, index) => {
            const defaultCategories = ['transportation', 'purchase', 'other'];
            const isDefault = defaultCategories.includes(item.category);
            const label = isDefault 
              ? t(`expenses.categories.${item.category}`, item.category)
              : item.category;
            
            const colorClasses = [
              'text-blue-700',
              'text-red-700',
              'text-yellow-700',
              'text-green-700',
            ];
            const colorClass = colorClasses[index % colorClasses.length] || 'text-gray-700';
            
            return (
              <Card key={item.category}>
                <p className={`text-sm font-medium ${colorClass}`}>{label}</p>
                <p className="text-xl font-semibold text-gray-900">
                  {item.totalAmount.toLocaleString()} XAF
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {item.count} {item.count === 1 ? 'dépense' : 'dépenses'}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6">
        <ExpenseFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          showDateRange={true}
        />
      </div>

      {/* Expenses Table */}
      <Card>
        <ExpenseTable
          expenses={filteredExpenses}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
        
        {/* Infinite Scroll Loading Indicator */}
        {expensesLoadingMore && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            <span className="ml-3 text-gray-600">Chargement de plus de dépenses...</span>
          </div>
        )}
        {!expensesHasMore && expenses.length > 0 && (
          <div className="text-center py-6 text-gray-500">
            <p>✅ Toutes les dépenses chargées ({expenses.length} au total)</p>
          </div>
        )}
      </Card>

      {/* Mobile spacing */}
      <div className="h-20 md:hidden"></div>

      {/* Modals */}
      <ExpenseFormModal
        isOpen={isAddModalOpen}
        mode="add"
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleAddSuccess}
      />

      <ExpenseFormModal
        isOpen={isEditModalOpen}
        mode="edit"
        expense={currentExpense || undefined}
        onClose={() => {
          setIsEditModalOpen(false);
          setCurrentExpense(null);
        }}
        onSuccess={handleEditSuccess}
      />

      <ExpenseDeleteModal
        isOpen={isDeleteModalOpen}
        expense={expenseToDelete}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setExpenseToDelete(null);
        }}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
};

export default ExpensesList;

