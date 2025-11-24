// src/pages/expenses/ExpensesReports.tsx
import { useState, useMemo } from 'react';
import { FileDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { useInfiniteExpenses } from '../../hooks/useInfiniteExpenses';
import { useExpenseCategories } from '../../hooks/useExpenseCategories';
import ExpenseFilters from './shared/ExpenseFilters';
import ExpenseTable from './shared/ExpenseTable';
import { showSuccessToast, showWarningToast } from '../../utils/toast';
import type { Expense } from '../../types/models';

const ExpensesReports = () => {
  const { t } = useTranslation();
  const { expenses, loading } = useInfiniteExpenses();
  const { expenseTypesList } = useExpenseCategories();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(2025, 3, 1),
    to: new Date(2100, 0, 1),
  });

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      if (expense.isAvailable === false) return false;
      
      // Filter by category
      const categoryMatch = selectedCategory === 'All' || expense.category === selectedCategory;
      
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
      
      return categoryMatch && searchMatch && dateMatch;
    });
  }, [expenses, selectedCategory, searchQuery, dateRange]);

  const handleExportExpenses = () => {
    if (filteredExpenses.length === 0) {
      showWarningToast('Aucune dépense à exporter');
      return;
    }

    // Create CSV content
    const headers = ['Date', 'Description', 'Montant (XAF)', 'Catégorie'];
    const rows = filteredExpenses.map(expense => {
      const timestamp = expense.date || expense.createdAt;
      const date = timestamp?.seconds 
        ? new Date(timestamp.seconds * 1000).toLocaleDateString('fr-FR')
        : 'N/A';
      
      // Escape commas and quotes in description
      const description = expense.description
        .replace(/"/g, '""')
        .replace(/,/g, ', ');
      
      const amount = expense.amount.toLocaleString('fr-FR');
      const category = expense.category;
      
      return `"${date}","${description}","${amount}","${category}"`;
    });

    const csvContent = [
      '\uFEFF', // UTF-8 BOM for Excel
      headers.join(','),
      ...rows
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Filename with date
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `expenses_${today}.csv`);
    
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showSuccessToast(`Export réussi: ${filteredExpenses.length} dépense(s) exportée(s)`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="pb-16 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Rapports et Exports</h1>
          <p className="text-gray-600">Exportez vos dépenses et générez des rapports personnalisés</p>
        </div>
        
        <Button 
          variant="primary" 
          icon={<FileDown size={16} />}
          onClick={handleExportExpenses}
          disabled={filteredExpenses.length === 0}
        >
          Exporter en CSV
        </Button>
      </div>

      <div className="space-y-4 mb-6">
        <ExpenseFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          showDateRange={true}
        />
        
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <select
            className="rounded-md border border-gray-300 shadow-sm py-2 px-3 bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="All">Toutes les catégories</option>
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
        </div>
      </div>

      <Card>
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            {filteredExpenses.length} dépense(s) trouvée(s) pour l'export
          </p>
        </div>
        
        <ExpenseTable
          expenses={filteredExpenses}
          onEdit={() => {}} // Not editable in reports view
          onDelete={() => {}} // Not deletable in reports view
        />
      </Card>
    </div>
  );
};

export default ExpensesReports;


