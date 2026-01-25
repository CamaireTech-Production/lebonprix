// src/hooks/useExpenseCategories.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { 
  getExpenseTypes, 
  createExpenseType, 
  updateExpenseType, 
  deleteExpenseType, 
  getExpenseCountByCategory 
} from '@services/firestore/expenses/expenseService';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import type { ExpenseType } from '../../types/models';

interface UseExpenseCategoriesReturn {
  // Data
  expenseTypes: { label: string; value: string }[];
  expenseTypesList: ExpenseType[];
  categoryUsageCounts: Record<string, number>;
  
  // Loading states
  loading: boolean;
  
  // Actions
  loadExpenseTypes: () => Promise<void>;
  loadExpenseTypesList: () => Promise<void>;
  loadCategoryUsageCounts: () => Promise<void>;
  createCategory: (name: string) => Promise<ExpenseType>;
  updateCategory: (categoryId: string, name: string) => Promise<void>;
  deleteCategory: (categoryId: string, companyId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useExpenseCategories = (): UseExpenseCategoriesReturn => {
  const { t } = useTranslation();
  const { user, company } = useAuth();
  const [expenseTypes, setExpenseTypes] = useState<{ label: string; value: string }[]>([]);
  const [expenseTypesList, setExpenseTypesList] = useState<ExpenseType[]>([]);
  const [categoryUsageCounts, setCategoryUsageCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

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
      setLoading(true);
      const types = await getExpenseTypes(company.id);
      setExpenseTypesList(types);
      await loadCategoryUsageCounts();
    } catch (error) {
      console.error('Error loading expense types list:', error);
    } finally {
      setLoading(false);
    }
  }, [company?.id, loadCategoryUsageCounts]);

  // Load expense types for select options
  const loadExpenseTypes = useCallback(async () => {
    if (!user || !company) return;
    try {
      const types = await getExpenseTypes(company.id);
      
      // Map fetched types using translations with additional deduplication by value
      const optionsMap = new Map<string, { label: string; value: string }>();
      
      types.forEach(tDoc => {
        const key = (tDoc.name || '').trim();
        if (key) {
          // Only add if not already in map (additional deduplication by name)
          const keyLower = key.toLowerCase();
          if (!optionsMap.has(keyLower)) {
            const label = t(`expenses.categories.${key}`, key);
            optionsMap.set(keyLower, { label, value: key });
          }
        }
      });
      
      // Convert map to array (ensures unique values)
      const uniqueOptions = Array.from(optionsMap.values());
      
      setExpenseTypes(uniqueOptions);
    } catch (error) {
      console.error('Error loading expense types:', error);
      // Empty array on error - no fallback defaults (company-specific only)
      setExpenseTypes([]);
    }
  }, [user, company, t]);

  // Create a new category
  const createCategory = useCallback(async (name: string): Promise<ExpenseType> => {
    if (!user || !company) {
      throw new Error('User or company not available');
    }
    
    const created = await createExpenseType({
      name: name.trim(),
      isDefault: false,
      userId: user.uid,
      companyId: company.id
    });
    
    // Refresh the lists
    await Promise.all([
      loadExpenseTypes(),
      loadExpenseTypesList()
    ]);
    
    return created;
  }, [user, company, loadExpenseTypes, loadExpenseTypesList]);

  // Update a category
  const updateCategory = useCallback(async (categoryId: string, name: string): Promise<void> => {
    if (!name.trim() || !company?.id) {
      throw new Error('Invalid category name or company');
    }
    
    await updateExpenseType(categoryId, { name: name.trim() });
    
    // Refresh the lists
    await Promise.all([
      loadExpenseTypes(),
      loadExpenseTypesList()
    ]);
  }, [company?.id, loadExpenseTypes, loadExpenseTypesList]);

  // Delete a category
  const deleteCategory = useCallback(async (categoryId: string, companyId: string): Promise<void> => {
    await deleteExpenseType(categoryId, companyId);
    
    // Refresh the lists
    await Promise.all([
      loadExpenseTypes(),
      loadExpenseTypesList()
    ]);
  }, [loadExpenseTypes, loadExpenseTypesList]);

  // Refresh all data
  const refresh = useCallback(async () => {
    await Promise.all([
      loadExpenseTypes(),
      loadExpenseTypesList()
    ]);
  }, [loadExpenseTypes, loadExpenseTypesList]);

  // Load expense types on mount
  useEffect(() => {
    if (user && company) {
      loadExpenseTypes();
      loadExpenseTypesList();
    }
  }, [user, company, loadExpenseTypes, loadExpenseTypesList]);

  return {
    expenseTypes,
    expenseTypesList,
    categoryUsageCounts,
    loading,
    loadExpenseTypes,
    loadExpenseTypesList,
    loadCategoryUsageCounts,
    createCategory,
    updateCategory,
    deleteCategory,
    refresh
  };
};



