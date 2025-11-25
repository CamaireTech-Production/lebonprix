import React, { useState, useMemo, useEffect } from 'react';
import Button from '../components/common/Button';
import { useFinanceEntries, useProducts, useSales, useExpenses, useCustomers, useStockChanges, useSuppliers } from '../hooks/useFirestore';
// Removed useFinancialData import - back to direct calculations
import { useObjectives } from '../hooks/useObjectives';
import { format } from 'date-fns';
import Modal, { ModalFooter } from '../components/common/Modal';
import CreatableSelect from '../components/common/CreatableSelect';
import { getFinanceEntryTypes, createFinanceEntryType, createFinanceEntry, updateFinanceEntry, softDeleteFinanceEntry, softDeleteFinanceEntryWithCascade } from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';
import LoadingScreen from '../components/common/LoadingScreen';
import { Edit2, Trash2, BarChart2, Receipt, DollarSign, ShoppingCart, Info, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Loader2} from 'lucide-react';
import DateRangePicker from '../components/common/DateRangePicker';
import { useTranslation } from 'react-i18next';
import ObjectivesBar from '../components/objectives/ObjectivesBar';
import ObjectivesModal from '../components/objectives/ObjectivesModal';
import { showSuccessToast, showErrorToast } from '../utils/toast';
import type { FinanceEntry } from '../types/models';
import { getLatestCostPrice } from '../utils/productUtils';
// Removed skeleton loaders and sync indicator imports - back to original approach

type CustomerDebt = {
  phone: string;
  name: string;
  debt: number;
  entries: FinanceEntry[];
};

const Finance: React.FC = () => {
  const { t } = useTranslation();
  const { entries, loading, refresh } = useFinanceEntries();
  
  // Debug: Log when entries change to verify real-time updates
  const prevEntriesLengthRef = React.useRef(entries.length);
  const { sales, loading: salesLoading } = useSales();
  const { expenses, loading: expensesLoading } = useExpenses();
  const { products, loading: productsLoading } = useProducts();
  const { stockChanges } = useStockChanges();
  const { suppliers } = useSuppliers();
  
  // Date range filter (default: from beginning of 2025 to current date) - MOVED UP
  const [dateRange, setDateRange] = useState({
    from: new Date(2025, 0, 1), // January 1st, 2025
    to: new Date(), // Current date
  });
  
  // 🚀 REVERTED: Back to direct calculations without localStorage

  useCustomers(); // Only call the hook for side effects if needed, but don't destructure unused values
  const { user, company } = useAuth();
  useObjectives();
  
  // Add Entry Form (for deposits, loans, refunds, etc.)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [entryTypes, setEntryTypes] = useState<{ label: string; value: string; id?: string }[]>([]);
  const [form, setForm] = useState({
    id: '',
    type: null as { label: string; value: string } | null,
    amount: '',
    description: '',
    date: '',
    isEdit: false,
    refundedDebtId: '',
  });
  
  // Remove Money Form (dedicated form for withdrawals)
  const [removeMoneyModalOpen, setRemoveMoneyModalOpen] = useState(false);
  const [removeMoneyModalLoading, setRemoveMoneyModalLoading] = useState(false);
  const [removeMoneyEntryTypes, setRemoveMoneyEntryTypes] = useState<{ label: string; value: string; id?: string }[]>([]);
  const [removeMoneyForm, setRemoveMoneyForm] = useState({
    id: '',
    type: null as { label: string; value: string } | null,
    amount: '',
    description: '',
    date: '',
    isEdit: false,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; entryId: string | null; entryType?: string; sourceType?: string } | null>({ open: false, entryId: null });
  // Other filters
  const [filterType, setFilterType] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState('');
  // Calculations modal and objectives
  const [showCalculationsModal, setShowCalculationsModal] = useState(false);
  const [showObjectivesModal, setShowObjectivesModal] = useState(false);
  const [applyDateFilter, setApplyDateFilter] = useState(true);
  const [] = useState<CustomerDebt | null>(null);
  const [showDebtHistoryModal, setShowDebtHistoryModal] = useState(false);
  // Add openDebtId state at the top of the component
  const [openDebtId, setOpenDebtId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
  // Filter out soft-deleted expenses and apply date range filter
  const filteredExpenses = useMemo(() => expenses.filter(exp => {
    // First filter out soft-deleted expenses
    if (exp.isAvailable === false) return false;
    // Then apply date range filter
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

  // Use Firestore entries directly - real-time updates via onSnapshot
  const effectiveEntries = entries;

  // Filter finance entries by date range and not soft deleted (including supplier entries)
  const filteredFinanceEntries = useMemo(() => {
    const filtered = effectiveEntries.filter(entry => {
      // Skip deleted entries
      if (entry.isDeleted === true) return false;
      
      // Handle createdAt timestamp - support multiple formats
      let entryDate: Date | null = null;
      if (entry.createdAt) {
        if (entry.createdAt.seconds) {
          // Firestore Timestamp with seconds property
          entryDate = new Date(entry.createdAt.seconds * 1000);
        } else if (typeof entry.createdAt === 'object' && 'seconds' in entry.createdAt) {
          // Firestore Timestamp object
          entryDate = new Date((entry.createdAt as any).seconds * 1000);
        } else if (typeof entry.createdAt === 'number') {
          // Unix timestamp in seconds
          entryDate = new Date(entry.createdAt * 1000);
        } else if (entry.createdAt instanceof Date) {
          // Already a Date object
          entryDate = entry.createdAt;
        }
      }
      
      // If no date found, include entry anyway (don't filter out entries without dates)
      if (!entryDate) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Finance] ⚠️ Entry ${entry.id} has no date, including anyway`);
        }
        return true;
      }
      
      // Check date range
      const inRange = entryDate >= dateRange.from && entryDate <= dateRange.to;
      if (!inRange && process.env.NODE_ENV === 'development') {
        console.log(`[Finance] ⚠️ Entry ${entry.id} filtered out by date range:`, {
          entryDate: entryDate.toISOString(),
          from: dateRange.from.toISOString(),
          to: dateRange.to.toISOString(),
          inRange
        });
      }
      return inRange;
    });
    
    if (process.env.NODE_ENV === 'development' && filtered.length !== effectiveEntries.length) {
      console.log(`[Finance] 📊 Filtered entries: ${filtered.length} of ${effectiveEntries.length} entries`);
    }
    
    return filtered;
  }, [effectiveEntries, dateRange]);

  // Group all debt and refund entries (including supplier debts) for the current user.
  const userDebt = useMemo<{
    debtEntries: FinanceEntry[];
    refundEntries: FinanceEntry[];
  }>(() => {
    let debtEntries: FinanceEntry[] = [];
    let refundEntries: FinanceEntry[] = [];
    effectiveEntries.forEach((entry: FinanceEntry) => {
      if (entry.type === 'debt' || entry.type === 'supplier_debt') {
        debtEntries.push(entry);
      } else if (entry.type === 'refund' || entry.type === 'supplier_refund') {
        refundEntries.push(entry);
      }
    });
    return {
      debtEntries,
      refundEntries
    };
  }, [effectiveEntries]);

  // Calculate total remaining debt (sum of each debt minus its refunds)
  const totalDebt = useMemo<number>(() => {
    return userDebt.debtEntries.reduce((sum: number, debt: FinanceEntry) => {
      const linkedRefunds = userDebt.refundEntries.filter(
        (refund: FinanceEntry) => {
          const match = refund.refundedDebtId && String(refund.refundedDebtId) === String(debt.id);
          return match;
        }
      );
      const refundedAmount = linkedRefunds.reduce((s: number, r: FinanceEntry) => s + r.amount, 0);
      return sum + Math.max(0, debt.amount - refundedAmount);
    }, 0);
  }, [userDebt.debtEntries, userDebt.refundEntries]);

  // Calculate solde: sum of all non-debt/refund/supplier_debt/supplier_refund entries plus only customer debt (excluding supplier debt)
  const solde = useMemo<number>(() => {
    const activeEntries = effectiveEntries.filter((entry: FinanceEntry) => entry.isDeleted !== true);
    const nonDebtEntries = activeEntries.filter(
      (entry: FinanceEntry) => entry.type !== 'debt' && entry.type !== 'refund' && entry.type !== 'supplier_debt' && entry.type !== 'supplier_refund'
    );
    const nonDebtSum = nonDebtEntries.reduce((sum: number, entry: FinanceEntry) => sum + entry.amount, 0);
    
    // Calculate only customer debt (excluding supplier debt)
    const customerDebt = userDebt.debtEntries
      .filter(debt => debt.type === 'debt') // Only customer debts, not supplier debts
      .reduce((sum: number, debt: FinanceEntry) => {
        const linkedRefunds = userDebt.refundEntries.filter(
          (refund: FinanceEntry) => {
            const match = refund.refundedDebtId && String(refund.refundedDebtId) === String(debt.id);
            return match;
          }
        );
        const refundedAmount = linkedRefunds.reduce((s: number, r: FinanceEntry) => s + r.amount, 0);
        return sum + Math.max(0, debt.amount - refundedAmount);
      }, 0);
    
    return nonDebtSum + customerDebt;
  }, [effectiveEntries, userDebt.debtEntries, userDebt.refundEntries]);

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

  // Debug: Log when entries change and reset to page 1 when new entries are added
  useEffect(() => {
    const prevLength = prevEntriesLengthRef.current;
    const currentLength = entries.length;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Finance] 🔄 Entries changed: ${currentLength} total entries (was ${prevLength})`);
      if (currentLength > prevLength) {
        console.log(`[Finance] ➕ ${currentLength - prevLength} new entry/entries added!`);
      }
      if (entries.length > 0) {
        const latestEntry = entries[0]; // Should be most recent
        console.log(`[Finance] 📊 Latest entry:`, {
          id: latestEntry.id,
          type: latestEntry.type,
          amount: latestEntry.amount,
          createdAt: latestEntry.createdAt,
          hasCreatedAt: !!latestEntry.createdAt
        });
      }
    }
    
    // Reset to page 1 when new entries are added
    if (currentLength > prevLength && currentPage !== 1) {
      console.log(`[Finance] 🔄 Resetting to page 1 because new entries were added`);
        setCurrentPage(1);
    }
    
    prevEntriesLengthRef.current = currentLength;
  }, [entries, currentPage]);


  // 🚀 REVERTED: Direct financial calculations (as they were working before) - MOVED BEFORE EARLY RETURN
  const profit = useMemo<number>(() => {
    return filteredSales.reduce((sum, sale) => {
      return sum + sale.products.reduce((productSum, product) => {
        const productData = products.find(p => p.id === product.productId);
        if (!productData) return productSum;
        const sellingPrice = product.negotiatedPrice || product.basePrice;
        const safeStockChanges = Array.isArray(stockChanges) ? stockChanges : [];
        const costPrice = getLatestCostPrice(productData.id, safeStockChanges);
        if (costPrice === undefined) return productSum;
        return productSum + (sellingPrice - costPrice) * product.quantity;
      }, 0);
    }, 0);
  }, [filteredSales, products, stockChanges]);

  const totalExpenses = useMemo<number>(() => {
    return filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0) + 
      filteredManualEntries.filter(e => e.amount < 0).reduce((sum, e) => sum + Math.abs(e.amount), 0);
  }, [filteredExpenses, filteredManualEntries]);

  const totalOrders = filteredSales.length;
  const totalDeliveryFee = filteredSales.reduce((sum, sale) => sum + (sale.deliveryFee || 0), 0);
  const totalSalesAmount = filteredSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalProductsSold = filteredSales.reduce((sum, sale) => sum + sale.products.reduce((pSum, p) => pSum + p.quantity, 0), 0);

  const totalPurchasePrice = useMemo<number>(() => {
    return products.reduce((sum, product) => {
      const safeStockChanges = Array.isArray(stockChanges) ? stockChanges : [];
      const costPrice = getLatestCostPrice(product.id, safeStockChanges);
      if (costPrice === undefined) return sum;
      return sum + (costPrice * product.stock);
    }, 0);
  }, [products, stockChanges]);

  // 🚀 HYBRID APPROACH: Only show loading screen if essential data is loading
  if (loading || productsLoading || salesLoading || expensesLoading) {
    return <LoadingScreen />;
  }

  // Stat cards with direct calculations
  const statCards = [
    { 
      title: t('dashboard.stats.profit'), 
      value: `${profit.toLocaleString()} XAF`, 
      icon: <BarChart2 size={20} />, 
      tooltipKey: 'profit', 
      type: 'profit'
    },
    { 
      title: t('dashboard.stats.totalExpenses'), 
      value: `${totalExpenses.toLocaleString()} XAF`, 
      icon: <Receipt size={20} />, 
      tooltipKey: 'totalExpenses', 
      type: 'expenses'
    },
    { 
      title: t('dashboard.stats.deliveryFee'), 
      value: `${totalDeliveryFee.toLocaleString()} XAF`, 
      icon: <DollarSign size={20} />, 
      tooltipKey: 'deliveryFee', 
      type: 'delivery'
    },
    { 
      title: t('dashboard.stats.totalSalesAmount'), 
      value: `${totalSalesAmount.toLocaleString()} XAF`, 
      icon: <ShoppingCart size={20} />, 
      tooltipKey: 'totalSalesAmount', 
      type: 'sales'
    },
    { 
      title: t('dashboard.stats.totalSalesCount'), 
      value: totalOrders, 
      icon: <ShoppingCart size={20} />, 
      tooltipKey: 'totalSalesCount', 
      type: 'sales'
    },
    { 
      title: t('dashboard.stats.totalPurchasePrice'), 
      value: `${totalPurchasePrice.toLocaleString()} XAF`, 
      icon: <DollarSign size={20} />, 
      tooltipKey: 'totalPurchasePrice', 
      type: 'products'
    },
  ];

  // Metrics options for objectives
  const metricsOptions = [
    { value: 'profit', label: t('dashboard.stats.profit') },
    { value: 'totalExpenses', label: t('dashboard.stats.totalExpenses') },
    { value: 'totalProductsSold', label: t('dashboard.stats.totalProductsSold') },
    { value: 'deliveryFee', label: t('dashboard.stats.deliveryFee') },
    { value: 'totalSalesAmount', label: t('dashboard.stats.totalSalesAmount') },
    { value: 'totalSalesCount', label: t('dashboard.stats.totalSalesCount') },
  ];
  const statsMap = {
    profit,
    totalExpenses,
    totalProductsSold,
    deliveryFee: totalDeliveryFee,
    totalSalesAmount,
    totalSalesCount: totalOrders,
  };

  // Helper function to get supplier name
  const getSupplierName = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier ? supplier.name : 'Unknown Supplier';
  };

  // Fetch entry types on modal open
  const handleOpenModal = async (editEntry?: any) => {
    if (!user) return;
    setModalOpen(true);
    setModalLoading(true);
    
    // 🚀 REVERTED: Back to direct fetch of entry types
    const types = await getFinanceEntryTypes(user.uid);
    
    // Deduplicate entry types by name to avoid duplicate keys in React
    const uniqueTypesMap = new Map<string, { label: string; value: string; id?: string }>();
    types.forEach(typeObj => {
      const value = typeObj.name;
      if (!uniqueTypesMap.has(value)) {
        uniqueTypesMap.set(value, {
          label: t(`finance.types.${typeObj.name}`, typeObj.name),
          value: value,
          id: typeObj.id
        });
      }
    });
    
    // Convert map to array and filter out 'sortie' (handled by separate Remove Money form)
    const uniqueEntryTypes = Array.from(uniqueTypesMap.values()).filter(opt => opt.value !== 'sortie');
    setEntryTypes(uniqueEntryTypes);
    if (editEntry) {
      if (editEntry.id) {
        // Editing existing entry - redirect sortie to Remove Money form
        if (editEntry.type === 'sortie') {
          setModalOpen(false);
          setModalLoading(false);
          handleOpenRemoveMoneyModal(editEntry);
          return;
        }
        
        // Editing existing entry (non-sortie)
      setForm({
        id: editEntry.id,
        type: { label: editEntry.type, value: editEntry.type },
        amount: editEntry.amount.toString(),
        description: editEntry.description || '',
        date: editEntry.date?.seconds ? format(new Date(editEntry.date.seconds * 1000), 'yyyy-MM-dd') : '',
        isEdit: true,
          refundedDebtId: editEntry.refundedDebtId || '',
        });
      } else {
        // New entry with pre-selected type (removed sortie - use Remove Money form instead)
        setForm({
          id: '',
          type: editEntry.type && editEntry.type !== 'sortie' ? { label: t(`finance.types.${editEntry.type}`, editEntry.type), value: editEntry.type } : null,
          amount: '',
          description: '',
          date: '',
          isEdit: false,
          refundedDebtId: '',
        });
      }
    } else {
      setForm({ id: '', type: null, amount: '', description: '', date: '', isEdit: false, refundedDebtId: '' });
    }
    setModalLoading(false);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setForm({ id: '', type: null, amount: '', description: '', date: '', isEdit: false, refundedDebtId: '' });
  };

  // Remove Money Handlers (separate form)
  const handleOpenRemoveMoneyModal = async (editEntry?: any) => {
    if (!user) return;
    setRemoveMoneyModalOpen(true);
    setRemoveMoneyModalLoading(true);
    
    // Load entry types for the dropdown
    const types = await getFinanceEntryTypes(user.uid);
    const uniqueTypesMap = new Map<string, { label: string; value: string; id?: string }>();
    types.forEach(typeObj => {
      const value = typeObj.name;
      if (!uniqueTypesMap.has(value)) {
        uniqueTypesMap.set(value, {
          label: t(`finance.types.${typeObj.name}`, typeObj.name),
          value: value,
          id: typeObj.id
        });
      }
    });
    
    // Set all entry types for Remove Money form (user can choose any type)
    const allEntryTypes = Array.from(uniqueTypesMap.values());
    setRemoveMoneyEntryTypes(allEntryTypes);
    
    // Default to sortie type for Remove Money form
    const sortieType = allEntryTypes.find(opt => opt.value === 'sortie') || { label: t(`finance.types.sortie`, 'sortie'), value: 'sortie' };
    
    if (editEntry?.id) {
      // Editing existing sortie entry
      const entryType = allEntryTypes.find(opt => opt.value === editEntry.type) || { label: editEntry.type, value: editEntry.type };
      setRemoveMoneyForm({
        id: editEntry.id,
        type: entryType,
        amount: Math.abs(editEntry.amount).toString(), // Display positive value
        description: editEntry.description || '',
        date: editEntry.date?.seconds ? format(new Date(editEntry.date.seconds * 1000), 'yyyy-MM-dd') : '',
        isEdit: true,
      });
    } else {
      // New remove money entry - default to sortie type
      setRemoveMoneyForm({
        id: '',
        type: sortieType,
        amount: '',
        description: '',
        date: '',
        isEdit: false,
      });
    }
    setRemoveMoneyModalLoading(false);
  };

  const handleCloseRemoveMoneyModal = () => {
    setRemoveMoneyModalOpen(false);
    setRemoveMoneyForm({ id: '', type: null, amount: '', description: '', date: '', isEdit: false });
    setRemoveMoneyEntryTypes([]);
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

  // Remove Money Submit Handler (dedicated for withdrawals)
  const handleSubmitRemoveMoney = async () => {
    if (!user || !company || !removeMoneyForm.type || !removeMoneyForm.amount || !removeMoneyForm.description.trim()) return;
    setRemoveMoneyModalLoading(true);
    
    const rawAmount = parseFloat(removeMoneyForm.amount);
    
    // ALWAYS store as negative value in Firebase
    // If user enters 1000, it MUST be saved as -1000
    const normalizedAmount = -Math.abs(rawAmount);
    
    const entryData = {
      userId: user.uid,
      companyId: company.id,
      sourceType: 'manual' as const,
      type: removeMoneyForm.type?.value || 'sortie', // Use selected type or default to sortie
      amount: normalizedAmount, // Always negative
      description: removeMoneyForm.description,
      date: removeMoneyForm.date ? Timestamp.fromDate(new Date(removeMoneyForm.date)) : Timestamp.now(),
      isDeleted: false, // Explicitly set to false - this ensures query matches
      // createdAt will be set by createFinanceEntry using serverTimestamp
      // updatedAt will be set by createFinanceEntry using serverTimestamp
    };
    
    try {
      if (removeMoneyForm.isEdit && removeMoneyForm.id) {
        await updateFinanceEntry(removeMoneyForm.id, entryData);
        showSuccessToast(t('finance.messages.updateSuccess'));
      } else {
        // Create the entry in database
        await createFinanceEntry(entryData);
        showSuccessToast(t('finance.messages.addSuccess'));
      }
      handleCloseRemoveMoneyModal();
    } catch (err) {
      showErrorToast(t('finance.messages.operationError'));
    } finally {
      setRemoveMoneyModalLoading(false);
    }
  };

  // Add Entry Submit Handler (for deposits, loans, refunds, etc.)
  const handleSubmit = async () => {
    if (!user || !company || !form.type || !form.amount) return;
    if (form.type.value === 'refund' && (!form.refundedDebtId || userDebt.debtEntries.length === 0)) return;
    setModalLoading(true);
    const rawAmount = parseFloat(form.amount);
    const normalizedAmount = rawAmount; // No negative conversion for add entry
    
    const entryData = {
      userId: user.uid,
      companyId: company.id, // Ensure companyId is set so entry is visible in query
      sourceType: 'manual' as const,
      type: form.type.value,
      amount: normalizedAmount,
      description: form.description,
      date: Timestamp.now(),
      isDeleted: false, // Explicitly set to false - this ensures query matches
      // createdAt will be set by createFinanceEntry using serverTimestamp
      // updatedAt will be set by createFinanceEntry using serverTimestamp
      ...(form.type.value === 'refund' && form.refundedDebtId ? { refundedDebtId: form.refundedDebtId } : {}),
    };
    try {
      if (form.isEdit && form.id) {
        await updateFinanceEntry(form.id, entryData);
        showSuccessToast(t('finance.messages.updateSuccess'));
      } else {
        // Create the entry in database
        await createFinanceEntry(entryData);
        
        // Simple solution: Manually refresh the table data after create
        setTimeout(() => {
          refresh();
        }, 500); // Small delay to ensure Firestore has processed the write
        
        showSuccessToast(t('finance.messages.addSuccess'));
      }
      handleCloseModal();
    } catch (err) {
      showErrorToast(t('finance.messages.operationError'));
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteClick = (entry: any) => {
    setDeleteConfirm({ open: true, entryId: entry.id, entryType: entry.type, sourceType: entry.sourceType });
  };

  // Helper to get entity label for cascade delete modal
  const getCascadeEntityLabel = (entry: any) => {
    if (!entry) return t('finance.types.other', 'entrée associée');
    if (entry.sourceType === 'sale') return t('finance.types.sale', 'vente');
    if (entry.sourceType === 'expense') return t('finance.types.expense', 'dépense');
    if (entry.type === 'debt') return t('finance.types.debt', 'dette');
    if (entry.type === 'refund') return t('finance.types.refund', 'remboursement');
    return t('finance.types.other', 'entrée associée');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm?.entryId) return;
    setDeleteLoading(true);
    try {
      // Firestore onSnapshot will automatically update when entry is deleted
      if (deleteConfirm.sourceType === 'manual') {
        await softDeleteFinanceEntry(deleteConfirm.entryId);
      } else if (deleteConfirm.sourceType === 'sale' || deleteConfirm.sourceType === 'expense') {
        await softDeleteFinanceEntryWithCascade(deleteConfirm.entryId);
      } else {
        await softDeleteFinanceEntry(deleteConfirm.entryId);
      }
      showSuccessToast(t('finance.messages.deleteSuccess'));
    } catch (err) {
      showErrorToast(t('finance.messages.operationError'));
    }
    setDeleteLoading(false);
    setDeleteConfirm({ open: false, entryId: null });
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ open: false, entryId: null });
  };

  // Calculate remaining amount for selected debt when refunding
  const selectedDebt = form.type?.value === 'refund' && form.refundedDebtId
    ? userDebt.debtEntries.find(d => d.id === form.refundedDebtId)
    : null;
  const refundedSoFar = form.type?.value === 'refund' && form.refundedDebtId
    ? userDebt.refundEntries.filter(r => r.refundedDebtId === form.refundedDebtId).reduce((sum, r) => sum + r.amount, 0)
    : 0;
  const remainingDebt = selectedDebt ? Math.max(0, selectedDebt.amount - refundedSoFar) : 0;
  const refundAmount = parseFloat(form.amount) || 0;
  const refundExceeds = form.type?.value === 'refund' && form.refundedDebtId && refundAmount > remainingDebt;

  return (
    <>
      <div className="px-4 py-6 w-full mx-auto">
        {/* Mobile-first: Key metrics at top */}
        <div className="mb-6 mt-6">
          {/* Primary metrics - full width on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Balance - most important */}
            <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <DollarSign size={20} className="text-green-600" />
                  <span className="font-semibold text-green-800">{t('dashboard.stats.solde')}</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl md:text-3xl font-bold text-green-900">
                    {solde.toLocaleString()} XAF
                  </div>
                </div>
              </div>
            </div>
            
            {/* Debt - second most important */}
            <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Receipt size={20} className="text-red-600" />
                  <span className="font-semibold text-red-800">{t('finance.debtCardTitle', 'Outstanding Debt')}</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl md:text-3xl font-bold text-red-900">
                    {totalDebt.toLocaleString()} XAF
                  </div>
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowDebtHistoryModal(true)} 
                className="w-full text-xs px-3 py-1 mt-2 border-red-300 text-red-700 hover:bg-red-50"
              >
                {t('finance.viewHistory', 'View History')}
              </Button>
            </div>
          </div>

          {/* Objectives - collapsible on mobile */}
          <div className="mb-4">
            <ObjectivesBar
              onAdd={() => setShowObjectivesModal(true)}
              onView={() => setShowObjectivesModal(true)}
              stats={statsMap}
              dateRange={dateRange}
              applyDateFilter={applyDateFilter}
              onToggleFilter={setApplyDateFilter}
              sales={sales}
              expenses={expenses}
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
                sales={sales}
                expenses={expenses}
                products={products}
              />
            )}
          </div>
        </div>
        {/* Date filter and info - same row */}
        <div className="mb-6">
          <div className="flex flex-row gap-3 items-center justify-between">
            <div className="flex-1">
              <DateRangePicker onChange={setDateRange} className="w-full" />
            </div>
            <Button
              variant="outline"
              icon={<Info size={16} />}
              onClick={() => setShowCalculationsModal(true)}
              className="text-sm whitespace-nowrap"
            >
              {t('dashboard.howCalculated')}
            </Button>
          </div>
          
          {/* Removed Sync Indicator - back to original approach */}
        </div>
        {/* Additional stats - collapsible on mobile */}
        <div className="mb-6">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BarChart2 size={20} />
                {t('finance.additionalStats', 'Additional Statistics')}
              </h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {statCards.map((stat) => (
                  <div key={stat.title} className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center mb-1">
                      {stat.icon}
                    </div>
                    <div className="text-xs text-gray-600 mb-1">{stat.title}</div>
                    <div className="text-sm font-semibold text-gray-900 break-words">
                      {typeof stat.value === 'string' ? stat.value : String(stat.value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Mobile-optimized controls */}
        <div className="mb-4 space-y-3">
          {/* Search and filters - stacked on mobile */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder={t('common.search')}
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
            />
            <div className="grid grid-cols-2 gap-2">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
            >
              <option value="">{t('common.allTypes')}</option>
              {entryTypes.map((opt, index) => (
                <option key={opt.id || `${opt.value}-${index}`} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={filterSource}
              onChange={e => setFilterSource(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
            >
              <option value="">{t('common.allSources')}</option>
              <option value="manual">{t('finance.sourceType.manual')}</option>
              <option value="sale">{t('finance.sourceType.sale')}</option>
              <option value="expense">{t('finance.sourceType.expense')}</option>
              <option value="supplier">{t('finance.sourceType.supplier')}</option>
            </select>
          </div>
          </div>
          
          {/* Actions row */}
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">{t('common.itemsPerPage')}</label>
            <select
              value={itemsPerPage}
              onChange={e => setItemsPerPage(Number(e.target.value))}
                className="border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
            >
              {[10, 25, 50, 100].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => handleOpenRemoveMoneyModal()}
                className="flex-1 sm:flex-none text-red-600 border-red-300 hover:bg-red-50"
              >
                {t('finance.removeMoney', 'Remove Money')}
              </Button>
            <Button
              variant="primary"
              onClick={() => handleOpenModal()}
                className="flex-1 sm:flex-none"
            >
              {t('finance.addEntry')}
            </Button>
          </div>
        </div>
        </div>
        {/* Finance entries - mobile card layout, desktop table */}
        {paginatedEntries.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="text-gray-400 text-center py-8">{t('finance.noEntries')}</div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
              <thead>
                    <tr className="text-left border-b bg-gray-50">
                      <th className="py-3 px-4 cursor-pointer select-none" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                    {t('common.date')}
                    <span className="ml-1 align-middle inline-block">
                      {sortOrder === 'asc' ? <ChevronUp size={16} className="inline" /> : <ChevronDown size={16} className="inline" />}
                    </span>
                  </th>
                      <th className="py-3 px-4">{t('common.type')}</th>
                      <th className="py-3 px-4">{t('common.description')}</th>
                      <th className="py-3 px-4">{t('common.amount')}</th>
                      <th className="py-3 px-4">{t('common.source')}</th>
                      <th className="py-3 px-4">{t('suppliers.title')}</th>
                      <th className="py-3 px-4">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEntries.map(entry => (
                  <tr key={entry.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">{entry.createdAt?.seconds ? format(new Date(entry.createdAt.seconds * 1000), 'dd/MM/yyyy') : ''}</td>
                        <td className="py-3 px-4 capitalize">{t(`finance.types.${entry.type}`, entry.type)}</td>
                        <td className="py-3 px-4">{entry.description || '-'}</td>
                        <td className={`py-3 px-4 font-semibold ${ entry.amount < 0 ? 'text-red-500' : 'text-green-600' }`}>
                      {entry.amount.toLocaleString()} XAF
                    </td>
                        <td className="py-3 px-4 capitalize">{t(`finance.sourceType.${entry.sourceType}`)}</td>
                        <td className="py-3 px-4">
                      {entry.supplierId ? getSupplierName(entry.supplierId) : '-'}
                    </td>
                        <td className="py-3 px-4 flex gap-2">
                      {entry.sourceType === 'manual' && (
                        <button
                          onClick={() => entry.type === 'sortie' ? handleOpenRemoveMoneyModal(entry) : handleOpenModal(entry)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title={t('common.edit')}
                          aria-label={t('common.edit')}
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteClick(entry)}
                        className="text-red-600 hover:text-red-900 flex items-center"
                        title={t('common.delete')}
                        aria-label={t('common.delete')}
                        disabled={deleteLoading && deleteConfirm?.entryId === entry.id}
                      >
                        {deleteLoading && deleteConfirm?.entryId === entry.id ? (
                          <Loader2 size={16} className="animate-spin mr-1" />
                        ) : null}
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
              </div>

              {/* Mobile card view */}
              <div className="md:hidden">
                {paginatedEntries.map(entry => (
                  <div key={entry.id} className="border-b border-gray-100 p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {entry.createdAt?.seconds ? format(new Date(entry.createdAt.seconds * 1000), 'dd/MM/yyyy') : ''}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                            {t(`finance.sourceType.${entry.sourceType}`)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 capitalize mb-1">
                          {t(`finance.types.${entry.type}`, entry.type)}
                        </div>
                        {entry.description && (
                          <div className="text-sm text-gray-700 mb-2">
                            {entry.description}
                          </div>
                        )}
                        {entry.supplierId && (
                          <div className="text-xs text-gray-500">
                            {t('suppliers.title')}: {getSupplierName(entry.supplierId)}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div className={`text-lg font-bold ${ entry.amount < 0 ? 'text-red-500' : 'text-green-600' }`}>
                          {entry.amount.toLocaleString()} XAF
                        </div>
                        <div className="flex gap-2 mt-2">
                          {entry.sourceType === 'manual' && (
                            <button
                            onClick={() => entry.type === 'sortie' ? handleOpenRemoveMoneyModal(entry) : handleOpenModal(entry)}
                              className="text-indigo-600 hover:text-indigo-900 p-1"
                              title={t('common.edit')}
                              aria-label={t('common.edit')}
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteClick(entry)}
                            className="text-red-600 hover:text-red-900 p-1"
                            title={t('common.delete')}
                            aria-label={t('common.delete')}
                            disabled={deleteLoading && deleteConfirm?.entryId === entry.id}
                          >
                            {deleteLoading && deleteConfirm?.entryId === entry.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          </div>
        )}
        
        {/* Mobile-optimized pagination */}
          {totalPages > 1 && (
            <div className="border-t border-gray-100 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-gray-600 text-center sm:text-left">
                {t('common.page')} {currentPage} {t('common.of')} {totalPages}
              </div>
                <div className="flex gap-1 items-center justify-center">
                <button
                    className="px-3 py-2 border rounded-lg disabled:opacity-50 flex items-center text-sm hover:bg-gray-50"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label={t('common.prev')}
                >
                  <ChevronLeft size={16} />
                    <span className="ml-1 hidden sm:inline">{t('common.prev')}</span>
                </button>
                  
                  {/* Show page numbers with ellipsis for mobile */}
                  <div className="flex gap-1">
                    {totalPages <= 5 ? (
                      Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                          className={`px-3 py-2 border rounded-lg text-sm ${
                            page === currentPage 
                              ? 'bg-indigo-100 border-indigo-400 text-indigo-700' 
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      ))
                    ) : (
                      <>
                        {currentPage > 2 && (
                          <>
                            <button
                              className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
                              onClick={() => setCurrentPage(1)}
                            >
                              1
                            </button>
                            {currentPage > 3 && <span className="px-2 py-2 text-gray-500">...</span>}
                          </>
                        )}
                        
                        {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                          const start = Math.max(1, Math.min(currentPage - 1, totalPages - 2));
                          return start + i;
                        }).map(page => (
                          <button
                            key={page}
                            className={`px-3 py-2 border rounded-lg text-sm ${
                              page === currentPage 
                                ? 'bg-indigo-100 border-indigo-400 text-indigo-700' 
                                : 'hover:bg-gray-50'
                            }`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                        
                        {currentPage < totalPages - 1 && (
                          <>
                            {currentPage < totalPages - 2 && <span className="px-2 py-2 text-gray-500">...</span>}
                <button
                              className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
                              onClick={() => setCurrentPage(totalPages)}
                            >
                              {totalPages}
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  
                  <button
                    className="px-3 py-2 border rounded-lg disabled:opacity-50 flex items-center text-sm hover:bg-gray-50"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  aria-label={t('common.next')}
                >
                    <span className="mr-1 hidden sm:inline">{t('common.next')}</span>
                  <ChevronRight size={16} />
                </button>
                </div>
              </div>
            </div>
          )}
        </div>
      {/* Mobile spacing for floating action button */}
      <div className="h-20 md:hidden"></div>
      {/* Add/Edit Finance Entry Modal, Delete Confirmation Modal, Calculations Modal (unchanged) */}
      <Modal isOpen={modalOpen} onClose={handleCloseModal} title={form.isEdit ? t('finance.editEntry') : t('finance.addEntry')} size="md"
        footer={<ModalFooter onCancel={handleCloseModal} onConfirm={handleSubmit} isLoading={modalLoading} confirmText={t('common.save')} disabled={!!refundExceeds} />}
      >
          <form className="space-y-4 pt-12" onSubmit={e => { e.preventDefault(); handleSubmit(); }}>
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
          {form.type?.value === 'refund' && (
            <div>
              <label className="block text-sm font-medium mb-1">{t('finance.selectDebtToRefund', 'Select Debt to Refund')}</label>
              {userDebt.debtEntries.length > 0 ? (
                <>
                  <select
                    value={form.refundedDebtId}
                    onChange={e => setForm(f => ({ ...f, refundedDebtId: e.target.value }))}
                    className="w-full border rounded px-3 py-2"
                    required
                  >
                    <option value="">{t('finance.selectDebt', 'Select a debt')}</option>
                    {userDebt.debtEntries.map(debt => (
                      <option key={debt.id} value={debt.id}>
                        {debt.amount.toLocaleString()} XAF - {debt.description || t('finance.debtEntry', 'Debt')}
                      </option>
                    ))}
                  </select>
                  {selectedDebt && (
                    <div className="text-xs text-gray-600 mt-1">
                      {t('finance.remaining', 'Remaining')}: {remainingDebt.toLocaleString()} XAF
                    </div>
                  )}
                  {refundExceeds && (
                    <div className="text-xs text-yellow-600 mt-1">{t('finance.refundExceeds', 'Refund amount exceeds remaining debt!')}</div>
                  )}
                </>
              ) : (
                <div className="text-sm text-red-500 mt-1">{t('finance.noDebtsToRefund', 'No debts available to refund.')}</div>
              )}
            </div>
          )}
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
              {...(form.type?.value === 'refund' && form.refundedDebtId ? {
                max: remainingDebt || undefined
              } : {})}
              disabled={form.type?.value === 'refund' && userDebt.debtEntries.length === 0}
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
              disabled={form.type?.value === 'refund' && userDebt.debtEntries.length === 0}
              />
                </div>
          </form>
      </Modal>
      
      {/* Remove Money Modal (dedicated form for withdrawals) */}
      <Modal 
        isOpen={removeMoneyModalOpen} 
        onClose={handleCloseRemoveMoneyModal} 
        title={removeMoneyForm.isEdit ? t('finance.editEntry') : t('finance.removeMoney', 'Remove Money')} 
        size="md"
        footer={
          <ModalFooter 
            onCancel={handleCloseRemoveMoneyModal} 
            onConfirm={handleSubmitRemoveMoney} 
            isLoading={removeMoneyModalLoading} 
            confirmText={t('common.save')} 
            disabled={!removeMoneyForm.amount || !removeMoneyForm.description.trim()} 
          />
        }
      >
        <form className="space-y-4 pt-12" onSubmit={e => { e.preventDefault(); handleSubmitRemoveMoney(); }}>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-800">
              {t('finance.youAreAboutToRemoveMoney', 'You are about to remove money from your balance.')}
            </p>
            </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">{t('common.type')}</label>
            <CreatableSelect
              value={removeMoneyForm.type}
              onChange={(option) => setRemoveMoneyForm(f => ({ ...f, type: option }))}
              options={removeMoneyEntryTypes}
              onCreate={handleTypeCreate}
              placeholder={t('common.type')}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">{t('common.amount')} <span className="text-gray-500">({t('finance.enterPositive', 'Enter positive amount')})</span></label>
            <input
              type="number"
              step="0.01"
              min="0"
              name="amount"
              value={removeMoneyForm.amount}
              onChange={(e) => setRemoveMoneyForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full border rounded px-3 py-2"
              placeholder="0"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('finance.willBeStoredAsNegative', 'This will be stored as a negative amount automatically')}
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">{t('common.description')} <span className="text-red-500">*</span></label>
            <textarea
              name="description"
              value={removeMoneyForm.description}
              onChange={(e) => setRemoveMoneyForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border rounded px-3 py-2"
              placeholder={t('finance.removeMoneyDescriptionPlaceholder', 'Describe why this money is being removed (required)')}
              rows={3}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('finance.descriptionRequiredForSortie', 'Description is required for remove money entries')}
            </p>
          </div>
          
          {removeMoneyForm.isEdit && (
            <div>
              <label className="block text-sm font-medium mb-1">{t('common.date')}</label>
              <input
                type="date"
                name="date"
                value={removeMoneyForm.date}
                onChange={(e) => setRemoveMoneyForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          )}
          </form>
      </Modal>
      <Modal isOpen={!!deleteConfirm?.open} onClose={handleDeleteCancel} title={t('common.delete')} size="sm"
        footer={<ModalFooter onCancel={handleDeleteCancel} onConfirm={handleDeleteConfirm} confirmText={t('common.delete')} isDanger isLoading={deleteLoading} />}
      >
        <div className="text-center text-gray-700">
          {deleteConfirm?.sourceType === 'manual' ? (
            t('finance.deleteConfirm', 'Are you sure you want to delete this entry?')
          ) : (
            <>
              <div>{t('finance.deleteCascadeConfirm', {
                entity: getCascadeEntityLabel(deleteConfirm)
              })}</div>
              <div className="text-sm text-red-600 mt-2">
                {deleteConfirm?.entryType === 'debt'
                  ? t('finance.deleteDebtCascadeWarning', 'Deleting this debt will also delete all associated refunds. This action cannot be undone.')
                  : t('finance.deleteCascadeWarning', 'This action cannot be undone and will affect related records.')}
              </div>
            </>
          )}
        </div>
      </Modal>
      <Modal
        isOpen={showCalculationsModal}
        onClose={() => setShowCalculationsModal(false)}
        title={t('dashboard.calculations.title')}
        size="lg"
      >
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.profit.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.profit.description')}<br /><br />
              <b>Profit = (Sum of all sales prices) - (Sum of all purchase prices for sold products)</b><br /><br />
              {t('dashboard.calculations.profit.example')}
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
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.balance.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.balance.description')}<br /><br />
              <b>{t('dashboard.calculations.balance.formula')}</b><br /><br />
              {t('dashboard.calculations.balance.note')}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.totalDebt.title')}</h3>
            <p className="text-gray-600">
              {t('dashboard.calculations.totalDebt.description')}<br /><br />
              <b>{t('dashboard.calculations.totalDebt.formula')}</b><br /><br />
              {t('dashboard.calculations.totalDebt.note')}
            </p>
          </div>
        </div>
      </Modal>
      <Modal isOpen={showDebtHistoryModal} onClose={() => setShowDebtHistoryModal(false)} title={t('finance.debtHistory', 'Debt/Refund History')} size="md">
        <div>
          <div className="mb-2 font-semibold text-red-800">{t('finance.debtHistory')}</div>
          <ul className="divide-y divide-gray-200">
            {userDebt.debtEntries.map((debt, idx) => {
              const linkedRefunds = userDebt.refundEntries.filter(refund => {
                const match = refund.refundedDebtId && String(refund.refundedDebtId) === String(debt.id);
                return match;
              });
              const refundedAmount = linkedRefunds.reduce((sum, r) => sum + r.amount, 0);
              const remaining = Math.max(0, debt.amount - refundedAmount);
              const isOpen = openDebtId === debt.id;
              return (
                <li key={debt.id || idx} className="py-2">
                  <div className="flex justify-between items-center cursor-pointer" onClick={() => setOpenDebtId(isOpen ? null : debt.id)}>
                    <div>
                      <span className="capitalize font-semibold">{t('finance.debtEntry', 'Debt')}</span>
                      <span className="ml-2 text-xs text-gray-500">{debt.createdAt?.seconds ? format(new Date(debt.createdAt.seconds * 1000), 'dd/MM/yyyy') : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-red-600 font-bold">{debt.amount.toLocaleString()} XAF</span>
                      <span className="text-xs text-gray-600">{t('finance.remaining', 'Remaining')}: <span className="font-bold">{remaining.toLocaleString()} XAF</span></span>
                      <button className="ml-2 text-gray-500 focus:outline-none" aria-label={t('finance.toggleRefunds', 'Toggle refunds')}>
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <ul className="ml-4 mt-2 bg-gray-50 rounded p-2">
                      {linkedRefunds.length === 0 ? (
                        <li className="text-xs text-gray-500">{t('finance.noRefunds', 'No refunds for this debt.')}</li>
                      ) : (
                        linkedRefunds.map((refund, rIdx) => (
                          <li key={refund.id || rIdx} className="flex justify-between items-center text-green-700 py-1">
                            <span>{t('finance.refundEntry', 'Refund')}</span>
                            <span>-{refund.amount.toLocaleString()} XAF</span>
                            <span className="text-xs text-gray-500">{refund.createdAt?.seconds ? format(new Date(refund.createdAt.seconds * 1000), 'dd/MM/yyyy') : ''}</span>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </Modal>
      {/* Mobile spacing for floating action button */}
      <div className="h-20 md:hidden"></div>
    </>
  );
};

export default Finance;
