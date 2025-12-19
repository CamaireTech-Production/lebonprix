import { useState, useEffect, useCallback } from 'react';
import { Plus, FileDown, Edit2, Trash2, Loader2, Settings, Tag, Search } from 'lucide-react';
import { Card, Button, Table, Badge, Modal, ModalFooter, Input, PriceInput, DateRangePicker, CreatableSelect, LoadingScreen, SyncIndicator } from '@components/common';
import { useInfiniteExpenses } from '@hooks/data/useInfiniteExpenses';
import { useInfiniteScroll } from '@hooks/data/useInfiniteScroll';
import { getExpenseTypes, createExpenseType, updateExpenseType, deleteExpenseType, getExpenseCountByCategory, createExpense, updateExpense, syncFinanceEntryWithExpense, softDeleteExpense } from '@services/firestore/expenses/expenseService';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import { useAuth } from '@contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { getCurrentEmployeeRef, formatCreatorName } from '@utils/business/employeeUtils';
import { getUserById } from '@services/utilities/userService';
import type { Expense, ExpenseType } from '../../types/models';

const Expenses = () => {
  const { t } = useTranslation();
  const { user, company, currentEmployee, isOwner } = useAuth();
  const { 
    expenses, 
    loading, 
    loadingMore: expensesLoadingMore,
    syncing: expensesSyncing,
    hasMore: expensesHasMore,
    error, 
    loadMore: loadMoreExpenses,
    refresh: refreshExpenses,
    addExpense: addExpenseToState,
    removeExpense: removeExpenseFromState,
    updateExpense: updateExpenseInState
  } = useInfiniteExpenses();
  
  // ... existing code ...
