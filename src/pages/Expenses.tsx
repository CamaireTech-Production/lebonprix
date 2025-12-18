import { useState, useEffect, useCallback } from 'react';
import { Plus, FileDown, Edit2, Trash2, Loader2, Settings, Tag, Search } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Table from '../components/common/Table';
import Badge from '../components/common/Badge';
import Modal, { ModalFooter } from '../components/common/Modal';
import Input from '../components/common/Input';
import PriceInput from '../components/common/PriceInput';
import DateRangePicker from '../components/common/DateRangePicker';
import { useInfiniteExpenses } from '../hooks/useInfiniteExpenses';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import CreatableSelect from '../components/common/CreatableSelect';
import { getExpenseTypes, createExpenseType, updateExpenseType, deleteExpenseType, getExpenseCountByCategory, createExpense, updateExpense, syncFinanceEntryWithExpense } from '../services/firestore';
import { softDeleteExpense } from '../services/firestore';
import LoadingScreen from '../components/common/LoadingScreen';
import SyncIndicator from '../components/common/SyncIndicator';
import { showSuccessToast, showErrorToast, showWarningToast } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { getCurrentEmployeeRef, formatCreatorName } from '../utils/employeeUtils';
import { getUserById } from '../services/userService';
import type { Expense, ExpenseType } from '../types/models';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(2025, 3, 1), // 1er avril 2025 (début de l'app)
    to: new Date(2100, 0, 1), // Date future pour inclure toutes les dates
  });
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'description' | 'category'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Category management state
  const [activeView, setActiveView] = useState<'expenses' | 'categories'>('expenses');
  const [categoryUsageCounts, setCategoryUsageCounts] = useState<Record<string, number>>({});
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [isDeleteCategoryModalOpen, setIsDeleteCategoryModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<ExpenseType | null>(null);
  const [categoryEditName, setCategoryEditName] = useState('');
  const [categoryDeleteLoading, setCategoryDeleteLoading] = useState(false);
  const [categoryEditLoading, setCategoryEditLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'transportation',
    date: new Date().toISOString().split('T')[0], // Date par défaut = aujourd'hui
  });
  const [expenseTypes, setExpenseTypes] = useState<{ label: string; value: string }[]>([]);
  const [selectedType, setSelectedType] = useState<{ label: string; value: string } | null>(null);
  const [expenseTypesList, setExpenseTypesList] = useState<ExpenseType[]>([]);
  
  // Load category usage counts
  const loadCategoryUsageCounts = useCallback(async () => {
    if (!company?.id) return;
    try {
      const counts = await getExpenseCountByCategory(company.id);
      setCategoryUsageCounts(counts);
    } catch (error) {
      console.error('Error loading category usage counts:', error);
    }
  }, [company?.id]);
  
  // Load full expense types list (with IDs) for management
  const loadExpenseTypesList = useCallback(async () => {
    if (!company?.id) return;
    try {
      const types = await getExpenseTypes(company.id);
      setExpenseTypesList(types);
      await loadCategoryUsageCounts();
    } catch (error) {
      console.error('Error loading expense types list:', error);
    }
  }, [company?.id, loadCategoryUsageCounts]);
  
  const loadExpenseTypes = useCallback(async () => {
    if (!user || !company) return;
    try {
      console.log('Loading expense types for company:', company.id);
      const types = await getExpenseTypes(company.id);
      console.log('Fetched expense types:', types);
      
      // Map fetched types using translations when keys match known categories
      const options = types.map(tDoc => {
        const key = tDoc.name;
        const label = t(`expenses.categories.${key}`, key);
        return { label, value: key };
      });
      
      // Ensure legacy defaults visible even before migration
      const legacyDefaults = ['transportation', 'purchase', 'other'];
      legacyDefaults.forEach(name => {
        if (!options.find(o => o.value === name)) {
          options.push({ label: t(`expenses.categories.${name}`, name), value: name });
        }
      });
      
      console.log('Final expense type options:', options);
      setExpenseTypes(options);
    } catch (error) {
      console.error('Error loading expense types:', error);
      // Fallback to legacy defaults if there's an error
      const legacyDefaults = ['transportation', 'purchase', 'other'];
      const fallbackOptions = legacyDefaults.map(name => ({
        label: t(`expenses.categories.${name}`, name),
        value: name
      }));
      setExpenseTypes(fallbackOptions);
    }
      }, [user, company, t]);
  
  // Load expense types on component mount
  useEffect(() => {
    if (user) {
      loadExpenseTypes();
      loadExpenseTypesList();
    }
  }, [user, loadExpenseTypes, loadExpenseTypesList]);
  
  // Category management functions
  const handleEditCategory = (category: ExpenseType) => {
    setCurrentCategory(category);
    setCategoryEditName(category.name);
    setIsEditCategoryModalOpen(true);
  };
  
  const handleSaveCategoryEdit = async () => {
    if (!currentCategory || !categoryEditName.trim() || !company?.id) return;
    
    if (currentCategory.isDefault) {
      showErrorToast('Cannot edit default expense categories');
      setIsEditCategoryModalOpen(false);
      return;
    }
    
    setCategoryEditLoading(true);
    try {
      await updateExpenseType(currentCategory.id, { name: categoryEditName.trim() });
      await loadExpenseTypes();
      await loadExpenseTypesList();
      showSuccessToast('Category updated successfully');
      setIsEditCategoryModalOpen(false);
      setCurrentCategory(null);
      setCategoryEditName('');
    } catch (error: any) {
      console.error('Error updating category:', error);
      showErrorToast(error.message || 'Failed to update category');
    } finally {
      setCategoryEditLoading(false);
    }
  };
  
  const handleDeleteCategory = (category: ExpenseType) => {
    setCurrentCategory(category);
    setIsDeleteCategoryModalOpen(true);
  };
  
  const handleConfirmDeleteCategory = async () => {
    if (!currentCategory || !company?.id) return;
    
    setCategoryDeleteLoading(true);
    try {
      await deleteExpenseType(currentCategory.id, company.id);
      await loadExpenseTypes();
      await loadExpenseTypesList();
      showSuccessToast('Category deleted successfully');
      setIsDeleteCategoryModalOpen(false);
      setCurrentCategory(null);
    } catch (error: any) {
      console.error('Error deleting category:', error);
      showErrorToast(error.message || 'Failed to delete category');
    } finally {
      setCategoryDeleteLoading(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const resetForm = () => {
    setFormData({
      description: '',
      amount: '',
      category: 'transportation',
      date: new Date().toISOString().split('T')[0], // Réinitialiser à aujourd'hui
    });
    setSelectedType(null);
  };
  
  const handleAddExpense = async () => {
    if (!user) {
      showErrorToast(t('errors.notAuthenticated'));
      return;
    }

    try {
      const typeValue = selectedType?.value || formData.category;
      
      // Validation améliorée
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
      
      // Valider que la catégorie existe dans la liste
      const categoryExists = expenseTypesList.some(cat => cat.name === typeValue) ||
                             ['transportation', 'purchase', 'other'].includes(typeValue);
      if (!categoryExists) {
        showWarningToast('Catégorie invalide');
        return;
      }
      
      // Valider la date
      if (!formData.date) {
        showWarningToast('Veuillez sélectionner une date');
        return;
      }
      
      const expenseDate = new Date(formData.date + 'T00:00:00');
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Fin de la journée
      if (expenseDate > today) {
        showWarningToast('La date ne peut pas être dans le futur');
        return;
      }

      setIsSubmitting(true);
      
      // Get createdBy employee reference
      let createdBy = null;
      if (user && company) {
        let userData = null;
        if (isOwner && !currentEmployee) {
          // If owner, fetch user data to create EmployeeRef
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            console.error('Error fetching user data for createdBy:', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }
      
      const newExpense = await createExpense({
        description: formData.description.trim(),
        amount: amount,
        category: typeValue,
        userId: user.uid,
        companyId: company.id,
        date: expenseDate, // Inclure la date de transaction
      }, company.id, createdBy);
      
      // Sync finance entry for the expense
      await syncFinanceEntryWithExpense(newExpense);
      
      // Add the new expense to the local state immediately for instant UI update
      addExpenseToState(newExpense);
      
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
    if (!user || !company) {
      showErrorToast(t('errors.notAuthenticated'));
      return;
    }

    if (!currentExpense) return;
    
    try {
      const typeValue = selectedType?.value || formData.category;
      
      // Validation améliorée
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
      
      // Valider que la catégorie existe dans la liste
      const categoryExists = expenseTypesList.some(cat => cat.name === typeValue) ||
                             ['transportation', 'purchase', 'other'].includes(typeValue);
      if (!categoryExists) {
        showWarningToast('Catégorie invalide');
        return;
      }
      
      // Valider la date
      if (!formData.date) {
        showWarningToast('Veuillez sélectionner une date');
        return;
      }
      
      const expenseDate = new Date(formData.date + 'T00:00:00');
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Fin de la journée
      if (expenseDate > today) {
        showWarningToast('La date ne peut pas être dans le futur');
        return;
      }

      setIsSubmitting(true);
      
      // Store original expense for potential rollback
      const originalExpense = currentExpense;
      
      // Convertir la date string en Date object pour la transaction
      const transactionDate = expenseDate;
      
      // Prepare updated expense data
      // IMPORTANT: Préserver createdAt original
      const updatedExpenseData = {
        ...currentExpense,
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: typeValue,
        companyId: company.id,
        userId: user.uid,
        date: transactionDate, // Date de transaction (modifiable)
        createdAt: currentExpense.createdAt, // PRÉSERVER createdAt original
        updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
      };
      
      // Update local state and localStorage immediately (optimistic update)
      updateExpenseInState(currentExpense.id, updatedExpenseData);
      
      try {
        // Send update directly to Firebase
        await updateExpense(currentExpense.id, {
          description: formData.description.trim(),
          amount: amount,
          category: typeValue,
          userId: user.uid, // Include userId for authorization check
          date: transactionDate, // Date de transaction (modifiable)
          // NE PAS inclure createdAt - il ne doit pas être modifié
        }, company.id);
        
        // Note: updateExpense already handles finance entry sync internally
        
        setIsEditModalOpen(false);
        resetForm();
        showSuccessToast(t('expenses.messages.updateSuccess'));
      } catch (firebaseError) {
        // Rollback optimistic update if Firebase update fails
        updateExpenseInState(currentExpense.id, originalExpense);
        throw firebaseError; // Re-throw to be caught by outer catch
      }
    } catch (err) {
      console.error('Failed to update expense:', err);
      showErrorToast(t('expenses.messages.updateError'));
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const openEditModal = (expense: Expense) => {
    setCurrentExpense(expense);
    
    // Convertir date (date de transaction) en format string pour l'input
    // Si date n'existe pas, utiliser createdAt comme fallback (rétrocompatibilité)
    let dateValue = new Date().toISOString().split('T')[0];
    if (expense.date?.seconds) {
      // Utiliser date (date de transaction) si disponible
      dateValue = new Date(expense.date.seconds * 1000).toISOString().split('T')[0];
    } else if (expense.createdAt?.seconds) {
      // Fallback sur createdAt pour les anciennes dépenses
      dateValue = new Date(expense.createdAt.seconds * 1000).toISOString().split('T')[0];
    }
    
    setFormData({
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category,
      date: dateValue, // Date de transaction (modifiable)
    });
    
    // IMPORTANT: Ne pas modifier expense.createdAt - il reste inchangé
    setSelectedType({ label: t(`expenses.categories.${expense.category}`, expense.category), value: expense.category });
    setIsEditModalOpen(true);
  };
  
  const handleExportExpenses = () => {
    if (filteredExpenses.length === 0) {
      showWarningToast('Aucune dépense à exporter');
      return;
    }

    // Créer le contenu CSV
    const headers = ['Date', 'Description', 'Montant (XAF)', 'Catégorie'];
    const rows = filteredExpenses.map(expense => {
      const timestamp = expense.date || expense.createdAt;
      const date = timestamp?.seconds 
        ? new Date(timestamp.seconds * 1000).toLocaleDateString('fr-FR')
        : 'N/A';
      
      // Échapper les virgules et guillemets dans la description
      const description = expense.description
        .replace(/"/g, '""') // Échapper les guillemets doubles
        .replace(/,/g, ', '); // Échapper les virgules (ou les remplacer)
      
      const amount = expense.amount.toLocaleString('fr-FR');
      const category = expense.category;
      
      return `"${date}","${description}","${amount}","${category}"`;
    });

    const csvContent = [
      '\uFEFF', // BOM UTF-8 pour Excel
      headers.join(','),
      ...rows
    ].join('\n');

    // Créer le blob et télécharger
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Nom de fichier avec date
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `expenses_${today}.csv`);
    
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showSuccessToast(`Export réussi: ${filteredExpenses.length} dépense(s) exportée(s)`);
  };

  const handleDeleteExpense = async () => {
    if (!expenseToDelete || !user?.uid) {
      return;
    }
    setDeleteLoading(true);
    try {
      await softDeleteExpense(expenseToDelete.id, user.uid);
      
      // Remove the expense from the local state immediately for instant UI update
      removeExpenseFromState(expenseToDelete.id);
      
      showSuccessToast(t('expenses.messages.deleteSuccess'));
      setIsDeleteModalOpen(false);
      setExpenseToDelete(null);
    } catch (error) {
      console.error('Failed to delete expense:', error);
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
        // Utiliser date (date de transaction) si disponible, sinon createdAt (rétrocompatibilité)
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
  
  // Calculer les statistiques dynamiquement pour toutes les catégories
  const summaryStats: Record<string, number> = {};
  visibleExpenses.forEach(expense => {
    const category = expense.category;
    if (!summaryStats[category]) {
      summaryStats[category] = 0;
    }
    summaryStats[category] += expense.amount;
  });

  // Filter expenses by category, search query, and date range
  let filteredExpenses = visibleExpenses.filter(expense => {
    // Filtre par catégorie
    const categoryMatch = selectedCategory === 'All' || expense.category === selectedCategory;
    
    // Filtre par recherche (description)
    const searchMatch = !searchQuery || 
      expense.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filtre par période de dates
    const timestamp = expense.date || expense.createdAt;
    let dateMatch = true;
    if (timestamp?.seconds) {
      const expenseDate = new Date(timestamp.seconds * 1000);
      dateMatch = expenseDate >= dateRange.from && expenseDate <= dateRange.to;
    }
    
    return categoryMatch && searchMatch && dateMatch;
  });
  
  // Trier les dépenses selon les critères sélectionnés
  filteredExpenses = [...filteredExpenses].sort((a, b) => {
    let aValue: any;
    let bValue: any;
    
    switch (sortBy) {
      case 'date':
        const aTimestamp = a.date || a.createdAt;
        const bTimestamp = b.date || b.createdAt;
        aValue = aTimestamp?.seconds || 0;
        bValue = bTimestamp?.seconds || 0;
        break;
      case 'amount':
        aValue = a.amount;
        bValue = b.amount;
        break;
      case 'description':
        aValue = a.description.toLowerCase();
        bValue = b.description.toLowerCase();
        break;
      case 'category':
        aValue = a.category.toLowerCase();
        bValue = b.category.toLowerCase();
        break;
      default:
        return 0;
    }
    
    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="pb-16 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('expenses.title')}</h1>
          <p className="text-gray-600">{t('expenses.subtitle')}</p>
        </div>
        
        {/* View Toggle */}
        <div className="mt-4 md:mt-0 flex items-center space-x-2">
          <Button
            variant={activeView === 'expenses' ? 'primary' : 'outline'}
            onClick={() => setActiveView('expenses')}
            className="flex items-center space-x-2"
          >
            <Tag size={16} />
            <span>Expenses</span>
          </Button>
          <Button
            variant={activeView === 'categories' ? 'primary' : 'outline'}
            onClick={() => {
              setActiveView('categories');
              loadExpenseTypesList();
            }}
            className="flex items-center space-x-2"
          >
            <Settings size={16} />
            <span>Manage Categories</span>
          </Button>
        </div>
        
        {/* Sync Indicator */}
        {activeView === 'expenses' && (
          <SyncIndicator 
            isSyncing={expensesSyncing} 
            message="Updating expenses..." 
            className="mb-4"
          />
        )}
        
        {activeView === 'expenses' && (
        <div className="mt-4 md:mt-0 space-y-3">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <div className="relative flex-1 sm:flex-initial sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <Input
                type="text"
                placeholder={t('expenses.search.placeholder') || 'Rechercher par description...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <select
              className="rounded-md border border-gray-300 shadow-sm py-2 px-3 bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="All">{t('expenses.filters.allCategories')}</option>
              {expenseTypesList.map((category) => {
                const defaultCategories = ['transportation', 'purchase', 'other'];
                const isDefault = defaultCategories.includes(category.name);
                const label = isDefault 
                  ? t(`expenses.categories.${category.name}`, category.name)
                  : category.name;
                return (
                  <option key={category.id} value={category.name}>
                    {label}
                  </option>
                );
              })}
            </select>
            
            <Button 
              variant="outline" 
              icon={<FileDown size={16} />}
              onClick={handleExportExpenses}
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
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <DateRangePicker
              onChange={(range) => setDateRange(range)}
              className="w-full sm:w-auto"
            />
            
            <select
              className="rounded-md border border-gray-300 shadow-sm py-2 px-3 bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'amount' | 'description' | 'category')}
            >
              <option value="date">Trier par date</option>
              <option value="amount">Trier par montant</option>
              <option value="description">Trier par description</option>
              <option value="category">Trier par catégorie</option>
            </select>
            
            <select
              className="rounded-md border border-gray-300 shadow-sm py-2 px-3 bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
            >
              <option value="desc">Décroissant</option>
              <option value="asc">Croissant</option>
            </select>
          </div>
        </div>
        )}
      </div>
      
      {/* Categories Management View */}
      {activeView === 'categories' && (
        <Card>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Expense Categories</h2>
            <p className="text-gray-600 text-sm">Manage your expense categories. Default categories cannot be edited or deleted.</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usage Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expenseTypesList.map((category) => {
                  const usageCount = categoryUsageCounts[category.name] || 0;
                  return (
                    <tr key={category.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">{category.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={usageCount > 0 ? 'info' : 'warning'}>
                          {usageCount} {usageCount === 1 ? 'expense' : 'expenses'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={category.isDefault ? 'info' : 'warning'}>
                          {category.isDefault ? 'Default' : 'Custom'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleEditCategory(category)}
                            disabled={category.isDefault}
                            className={`text-indigo-600 hover:text-indigo-900 ${category.isDefault ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={category.isDefault ? 'Default categories cannot be edited' : 'Edit category'}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category)}
                            disabled={category.isDefault || usageCount > 0}
                            className={`text-red-600 hover:text-red-900 ${category.isDefault || usageCount > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={
                              category.isDefault
                                ? 'Default categories cannot be deleted'
                                : usageCount > 0
                                ? `Cannot delete: ${usageCount} expense(s) are using this category`
                                : 'Delete category'
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {expenseTypesList.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                      No categories found. Categories will appear here after you create them.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      
      {/* Expenses List View */}
      {activeView === 'expenses' && (
        <>
      {/* Summary Cards - Dynamiques pour toutes les catégories */}
      {Object.keys(summaryStats).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {Object.entries(summaryStats)
            .filter(([_, amount]) => amount > 0) // Afficher seulement les catégories avec montant > 0
            .map(([category, amount], index) => {
              const defaultCategories = ['transportation', 'purchase', 'other'];
              const isDefault = defaultCategories.includes(category);
              
              // Utiliser les traductions pour les catégories par défaut
              const label = isDefault 
                ? t(`expenses.categories.${category}`, category)
                : category;
              
              // Couleurs dynamiques basées sur l'index ou le type
              const colorClasses = [
                'text-blue-700',
                'text-red-700',
                'text-yellow-700',
                'text-green-700',
                'text-purple-700',
                'text-indigo-700',
              ];
              const colorClass = colorClasses[index % colorClasses.length] || 'text-gray-700';
              
              return (
                <Card key={category}>
                  <p className={`text-sm font-medium ${colorClass}`}>{label}</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {amount.toLocaleString()} XAF
                  </p>
                </Card>
              );
            })}
        </div>
      )}
      
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
      </>
      )}
      
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
          
          <PriceInput
            label={t('expenses.form.amount')}
            name="amount"
            value={formData.amount}
            onChange={handleInputChange}
            required
          />
          
          <Input
            label={t('expenses.form.date') || 'Date'}
            name="date"
            type="date"
            value={formData.date}
            onChange={handleInputChange}
            required
            max={new Date().toISOString().split('T')[0]} // Empêcher les dates futures
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
                const created = await createExpenseType({ name, isDefault: false, userId: user.uid, companyId: company.id } as any);
                const option = { label: created.name, value: created.name };
                setExpenseTypes(prev => [...prev, option]);
                await loadExpenseTypesList();
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
          
          <PriceInput
            label={t('expenses.form.amount')}
            name="amount"
            value={formData.amount}
            onChange={handleInputChange}
            required
          />
          
          <Input
            label={t('expenses.form.date') || 'Date'}
            name="date"
            type="date"
            value={formData.date}
            onChange={handleInputChange}
            required
            max={new Date().toISOString().split('T')[0]} // Empêcher les dates futures
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
                const created = await createExpenseType({ name, isDefault: false, userId: user.uid, companyId: company.id } as any);
                const option = { label: created.name, value: created.name };
                setExpenseTypes(prev => [...prev, option]);
                await loadExpenseTypesList();
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
      
      {/* Edit Category Modal */}
      <Modal
        isOpen={isEditCategoryModalOpen}
        onClose={() => {
          setIsEditCategoryModalOpen(false);
          setCurrentCategory(null);
          setCategoryEditName('');
        }}
        title="Edit Expense Category"
        footer={
          <ModalFooter
            onCancel={() => {
              setIsEditCategoryModalOpen(false);
              setCurrentCategory(null);
              setCategoryEditName('');
            }}
            onConfirm={handleSaveCategoryEdit}
            confirmText="Save"
            isLoading={categoryEditLoading}
          />
        }
      >
        <div className="space-y-4">
          <Input
            label="Category Name"
            name="categoryName"
            value={categoryEditName}
            onChange={(e) => setCategoryEditName(e.target.value)}
            required
            placeholder="Enter category name"
          />
          {currentCategory?.isDefault && (
            <p className="text-sm text-yellow-600">
              ⚠️ Note: Default categories cannot be edited.
            </p>
          )}
        </div>
      </Modal>
      
      {/* Delete Category Modal */}
      <Modal
        isOpen={isDeleteCategoryModalOpen}
        onClose={() => {
          setIsDeleteCategoryModalOpen(false);
          setCurrentCategory(null);
        }}
        title="Delete Expense Category"
        footer={
          <ModalFooter
            onCancel={() => {
              setIsDeleteCategoryModalOpen(false);
              setCurrentCategory(null);
            }}
            onConfirm={handleConfirmDeleteCategory}
            confirmText="Delete"
            isDanger
            isLoading={categoryDeleteLoading}
          />
        }
      >
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Are you sure you want to delete the category "{currentCategory?.name}"?
          </p>
          {currentCategory && categoryUsageCounts[currentCategory.name] > 0 && (
            <p className="text-sm text-red-600 mb-2">
              ⚠️ This category is used in {categoryUsageCounts[currentCategory.name]} expense(s). 
              You cannot delete it while it's in use.
            </p>
          )}
          {currentCategory?.isDefault && (
            <p className="text-sm text-yellow-600 mb-2">
              ⚠️ Default categories cannot be deleted.
            </p>
          )}
          <p className="text-sm text-red-600">
            This action cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Expenses;