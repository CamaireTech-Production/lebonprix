// src/pages/expenses/shared/ExpenseTable.tsx
import { Edit2, Trash2, Loader2, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Table, Badge, ImageWithSkeleton } from '@components/common';
import { formatCreatorName } from '@utils/business/employeeUtils';
import type { Expense } from '../../../types/models';

interface ExpenseTableProps {
  expenses: Expense[];
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  loading?: boolean;
  deleteLoading?: boolean;
  deleteLoadingId?: string;
}

const ExpenseTable = ({ expenses, onEdit, onDelete, deleteLoading, deleteLoadingId }: ExpenseTableProps) => {
  const { t } = useTranslation();

  const columns = [
    { 
      header: 'Image', 
      accessor: (expense: Expense) => (
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
          {expense.image ? (
            <ImageWithSkeleton
              src={expense.image}
              alt={expense.description}
              className="w-full h-full object-cover"
              placeholder="Loading..."
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <FileText size={20} />
            </div>
          )}
        </div>
      ),
      className: 'w-16',
    },
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
        // Use date (transaction date) if available, otherwise createdAt (backward compatibility)
        const timestamp = expense.date || expense.createdAt;
        if (!timestamp?.seconds) return 'N/A';
        return new Date(timestamp.seconds * 1000).toLocaleDateString();
      },
    },
    { 
      header: 'Créé par', 
      accessor: (expense: Expense) => (
        <span className="text-gray-600">{formatCreatorName(expense.createdBy)}</span>
      ),
    },
    { 
      header: t('expenses.table.actions'), 
      accessor: (expense: Expense) => (
        <div className="flex space-x-2">
          <button 
            onClick={() => onEdit(expense)}
            className="text-indigo-600 hover:text-indigo-900"
            title={t('expenses.actions.edit')}
          >
            <Edit2 size={16} />
          </button>
          {expense.isAvailable !== false && (
            <button
              onClick={() => onDelete(expense)}
              className="text-red-600 hover:text-red-900 flex items-center"
              title={t('expenses.actions.delete')}
              disabled={deleteLoading && deleteLoadingId === expense.id}
            >
              {deleteLoading && deleteLoadingId === expense.id ? (
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

  return (
    <Table
      data={expenses}
      columns={columns}
      keyExtractor={(expense) => expense.id}
      emptyMessage={t('expenses.messages.noExpenses')}
    />
  );
};

export default ExpenseTable;

