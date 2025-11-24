// src/pages/expenses/shared/ExpenseDeleteModal.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/AuthContext';
import Modal, { ModalFooter } from '../../../components/common/Modal';
import { softDeleteExpense } from '../../../services/firestore';
import { showSuccessToast, showErrorToast } from '../../../utils/toast';
import type { Expense } from '../../../types/models';

interface ExpenseDeleteModalProps {
  isOpen: boolean;
  expense: Expense | null;
  onClose: () => void;
  onSuccess: () => void;
}

const ExpenseDeleteModal = ({ isOpen, expense, onClose, onSuccess }: ExpenseDeleteModalProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = async () => {
    if (!expense || !user?.uid) {
      return;
    }
    
    setDeleteLoading(true);
    try {
      await softDeleteExpense(expense.id, user.uid);
      showSuccessToast(t('expenses.messages.deleteSuccess'));
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to delete expense:', error);
      showErrorToast(t('expenses.messages.deleteError'));
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('expenses.modals.delete.title') || 'Delete Expense'}
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleDelete}
          confirmText={t('expenses.modals.delete.confirm') || 'Delete'}
          isDanger
          isLoading={deleteLoading}
        />
      }
    >
      <div className="text-center">
        <p className="text-gray-600 mb-4">
          {t('expenses.messages.deleteConfirmation', { description: expense?.description }) || 
           `Are you sure you want to delete this expense?`}
        </p>
        <p className="text-sm text-red-600">
          {t('expenses.messages.deleteWarning') || 'This action cannot be undone.'}
        </p>
      </div>
    </Modal>
  );
};

export default ExpenseDeleteModal;


