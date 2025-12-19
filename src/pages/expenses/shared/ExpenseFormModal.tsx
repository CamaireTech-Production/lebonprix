// src/pages/expenses/shared/ExpenseFormModal.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@contexts/AuthContext';
import { Modal, ModalFooter, Input, PriceInput, CreatableSelect } from '@components/common';
import { createExpense, updateExpense } from '@services/firestore/expenses/expenseService';
import { syncFinanceEntryWithExpense } from '@services/firestore/finance/financeService';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import { logError, logWarning } from '@utils/core/logger';
import { useExpenseCategories } from '@hooks/business/useExpenseCategories';
import { getUserById } from '@services/utilities/userService';
import { getCurrentEmployeeRef } from '@utils/business/employeeUtils';
import type { Expense} from '../../../types/models';

interface ExpenseFormModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  expense?: Expense;
  onClose: () => void;
  onSuccess: (expense: Expense) => void;
}

const ExpenseFormModal = ({ isOpen, mode, expense, onClose, onSuccess }: ExpenseFormModalProps) => {
  const { t } = useTranslation();
  const { user, company, currentEmployee, isOwner } = useAuth();
  const { expenseTypes, expenseTypesList, createCategory, loadExpenseTypes } = useExpenseCategories();
  
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'transportation',
    date: new Date().toISOString().split('T')[0],
  });
  const [selectedType, setSelectedType] = useState<{ label: string; value: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load expense data when editing
  useEffect(() => {
    if (mode === 'edit' && expense) {
      // Convert date to string format for input
      let dateValue = new Date().toISOString().split('T')[0];
      if (expense.date?.seconds) {
        dateValue = new Date(expense.date.seconds * 1000).toISOString().split('T')[0];
      } else if (expense.createdAt?.seconds) {
        dateValue = new Date(expense.createdAt.seconds * 1000).toISOString().split('T')[0];
      }
      
      setFormData({
        description: expense.description,
        amount: expense.amount.toString(),
        category: expense.category,
        date: dateValue,
      });
      setSelectedType({ 
        label: t(`expenses.categories.${expense.category}`, expense.category), 
        value: expense.category 
      });
    } else {
      // Reset form for add mode
      setFormData({
        description: '',
        amount: '',
        category: 'transportation',
        date: new Date().toISOString().split('T')[0],
      });
      setSelectedType(null);
    }
  }, [mode, expense, t]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      description: '',
      amount: '',
      category: 'transportation',
      date: new Date().toISOString().split('T')[0],
    });
    setSelectedType(null);
  };

  const handleSubmit = async () => {
    if (!user || !company) {
      showErrorToast(t('errors.notAuthenticated'));
      return;
    }

    try {
      const typeValue = selectedType?.value || formData.category;
      
      // Validation
      if (!formData.description?.trim()) {
        showWarningToast(t('errors.fillAllFields') || 'Veuillez remplir tous les champs');
        return;
      }
      
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        showWarningToast('Le montant doit être un nombre positif');
        return;
      }
      
      if (!typeValue) {
        showWarningToast('Veuillez sélectionner une catégorie');
        return;
      }
      
      // Validate category exists
      const categoryExists = expenseTypesList.some(cat => cat.name === typeValue) ||
                             ['transportation', 'purchase', 'other'].includes(typeValue);
      if (!categoryExists) {
        showWarningToast('Catégorie invalide');
        return;
      }
      
      // Validate date
      if (!formData.date) {
        showWarningToast('Veuillez sélectionner une date');
        return;
      }
      
      const expenseDate = new Date(formData.date + 'T00:00:00');
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (expenseDate > today) {
        showWarningToast('La date ne peut pas être dans le futur');
        return;
      }

      setIsSubmitting(true);
      
      if (mode === 'add') {
        // Get createdBy employee reference
        let createdBy = null;
        if (user && company) {
          let userData = null;
          if (isOwner && !currentEmployee) {
            // If owner, fetch user data to create EmployeeRef
            try {
              userData = await getUserById(user.uid);
            } catch (error) {
              logError('Error fetching user data for createdBy', error);
            }
          }
          createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
          
          // Verify createdBy
          if (!createdBy) {
            logWarning('[ExpenseFormModal] createdBy is null');
          }
        }
        
        const newExpense = await createExpense({
          description: formData.description.trim(),
          amount: amount,
          category: typeValue,
          userId: user.uid,
          companyId: company.id,
          date: expenseDate as any,
        }, company.id, createdBy);
        
        // Verify createdBy is in the returned expense
        if (newExpense.createdBy) {
          console.log('[ExpenseFormModal] Expense created with createdBy:', newExpense.createdBy);
        } else {
          logWarning('[ExpenseFormModal] Expense created but createdBy is missing in returned object');
        }
        
        await syncFinanceEntryWithExpense(newExpense);
        onSuccess(newExpense);
        resetForm();
        showSuccessToast(t('expenses.messages.addSuccess'));
      } else {
        // Edit mode
        if (!expense) return;
        
        const transactionDate = expenseDate;
        
        try {
          await updateExpense(expense.id, {
            description: formData.description.trim(),
            amount: amount,
            category: typeValue,
            userId: user.uid,
            date: transactionDate as any,
          }, company.id);
          
          // Construct updated expense for optimistic update
          const updatedExpense: Expense = {
            ...expense,
            description: formData.description.trim(),
            amount: amount,
            category: typeValue,
            date: expense.date || expense.createdAt, // Keep existing date or createdAt
            updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
          };
          
          onSuccess(updatedExpense);
          showSuccessToast(t('expenses.messages.updateSuccess'));
        } catch (error) {
          // Rollback would be handled by parent component
          throw error;
        }
      }
      
      onClose();
    } catch (err) {
      logError(`Failed to ${mode} expense`, err);
      showErrorToast(
        mode === 'add' 
          ? t('expenses.messages.addError')
          : t('expenses.messages.updateError')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'add' ? t('expenses.modals.add.title') : t('expenses.modals.edit.title')}
      footer={
        <ModalFooter 
          onCancel={onClose}
          onConfirm={handleSubmit}
          confirmText={mode === 'add' ? t('expenses.modals.add.confirm') : t('expenses.modals.edit.confirm')}
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
        
        <PriceInput
          label={t('expenses.form.amount')}
          name="amount"
          value={formData.amount}
          onChange={(e: { target: { name: string; value: string } }) => {
            setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
          }}
          required
        />
        
        <Input
          label={t('expenses.form.date') || 'Date'}
          name="date"
          type="date"
          value={formData.date}
          onChange={handleInputChange}
          required
          max={new Date().toISOString().split('T')[0]}
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
              if (!user || !company) return { label: name, value: name };
              const created = await createCategory(name);
              const option = { label: created.name, value: created.name };
              await loadExpenseTypes();
              return option;
            }}
            placeholder={t('expenses.form.category')}
          />
        </div>
      </div>
    </Modal>
  );
};

export default ExpenseFormModal;



