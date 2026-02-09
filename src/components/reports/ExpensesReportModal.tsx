import React, { useState, useEffect } from 'react';
import { Eye, Download } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import DateRangePicker from './DateRangePicker';
import FieldSelector from './FieldSelector';
import { Expense, Category } from '../../types/models';
import {
  ExpenseReportConfig,
  ExpenseReportData,
  ReportFormat,
  DateRangeFilter
} from '../../types/reports';
import { useCurrency } from '@hooks/useCurrency';
import {
  EXPENSE_REPORT_FIELDS,
  transformExpensesToReportData,
  filterExpenseReportData,
  generateExpenseReport
} from '../../services/reports/expenseReportService';
import { useAuth } from '@contexts/AuthContext';

interface ExpensesReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: Expense[];
  categories: Category[];
  companyName?: string;
  companyLogo?: string;
}

const ExpensesReportModal: React.FC<ExpensesReportModalProps> = ({
  isOpen,
  onClose,
  expenses,
  categories,
  companyName = '',
  companyLogo = ''
}) => {
  const { format: formatCurrency } = useCurrency();
  const { company } = useAuth();
  const currencyCode = company?.currency || 'XAF';

  // Report configuration state
  const [reportFormat, setReportFormat] = useState<ReportFormat>('csv');
  const [periodType, setPeriodType] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('all');
  const [dateRange, setDateRange] = useState<DateRangeFilter>({
    startDate: null,
    endDate: null
  });
  const [selectedFields, setSelectedFields] = useState<string[]>(
    EXPENSE_REPORT_FIELDS.filter(f => f.defaultSelected).map(f => f.key)
  );

  // Filter state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [amountMin, setAmountMin] = useState<number | undefined>(undefined);
  const [amountMax, setAmountMax] = useState<number | undefined>(undefined);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<ExpenseReportData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Get unique category names (only expense categories)
  const categoryNames = categories
    .filter(c => c.type === 'product' && !c.isActive === false)
    .map(c => c.name);

  // Update preview when filters change
  useEffect(() => {
    if (showPreview) {
      updatePreview();
    }
  }, [dateRange, selectedCategories, amountMin, amountMax, expenses, categories]);

  const updatePreview = () => {
    const config: ExpenseReportConfig = {
      title: 'Rapport des Dépenses',
      format: reportFormat,
      dateRange,
      selectedFields,
      includeHeaders: true,
      filters: {
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        amountMin,
        amountMax
      }
    };

    // Filter expenses (only non-deleted)
    const activeExpenses = expenses.filter(e => e.isAvailable !== false);

    const reportData = transformExpensesToReportData(activeExpenses, categories);
    const filteredData = filterExpenseReportData(reportData, config);
    setPreviewData(filteredData);
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);

    try {
      const config: ExpenseReportConfig = {
        title: 'Rapport des Dépenses',
        format: reportFormat,
        dateRange,
        selectedFields,
        includeHeaders: true,
        filters: {
          categories: selectedCategories.length > 0 ? selectedCategories : undefined,
          amountMin,
          amountMax
        }
      };

      // Filter expenses (only non-deleted)
      const activeExpenses = expenses.filter(e => e.isAvailable !== false);

      const result = generateExpenseReport(
        activeExpenses,
        categories,
        config,
        {
          filename: `rapport_depenses_${new Date().toISOString().split('T')[0]}`,
          companyName,
          companyLogo,
          currencyCode: currencyCode, // Use currency code for PDF compatibility
          includeTimestamp: true
        }
      );

      if (!result.success) {
        alert(result.error || 'Erreur lors de la génération du rapport');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Une erreur est survenue lors de la génération du rapport');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTogglePreview = () => {
    if (!showPreview) {
      updatePreview();
    }
    setShowPreview(!showPreview);
  };

  const handlePeriodChange = (period: 'all' | 'today' | 'week' | 'month' | 'year' | 'custom') => {
    setPeriodType(period);

    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'week':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        startDate = startOfWeek;
        endDate = new Date();
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date();
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date();
        break;
      case 'all':
      case 'custom':
        startDate = null;
        endDate = null;
        break;
    }

    setDateRange({ startDate, endDate });
  };

  const resetFilters = () => {
    setPeriodType('all');
    setDateRange({ startDate: null, endDate: null });
    setSelectedCategories([]);
    setAmountMin(undefined);
    setAmountMax(undefined);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Générer un rapport des dépenses"
      size="xl"
    >
      <div className="space-y-5">
        {/* Format Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Format d'export
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setReportFormat('csv')}
              className={`px-4 py-2.5 rounded-md border text-sm font-medium transition-colors ${reportFormat === 'csv'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
            >
              CSV
            </button>
            <button
              onClick={() => setReportFormat('pdf')}
              className={`px-4 py-2.5 rounded-md border text-sm font-medium transition-colors ${reportFormat === 'pdf'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
            >
              PDF
            </button>
          </div>
        </div>

        {/* Period Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Période
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
            {[
              { value: 'all', label: 'Tout' },
              { value: 'today', label: 'Aujourd\'hui' },
              { value: 'week', label: 'Cette semaine' },
              { value: 'month', label: 'Ce mois' },
              { value: 'year', label: 'Cette année' },
              { value: 'custom', label: 'Personnalisé' }
            ].map(period => (
              <button
                key={period.value}
                onClick={() => handlePeriodChange(period.value as any)}
                className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${periodType === period.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
              >
                {period.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range */}
          {periodType === 'custom' && (
            <DateRangePicker
              dateRange={dateRange}
              onChange={setDateRange}
              label=""
            />
          )}
        </div>

        {/* Advanced Filters Section */}
        <div className="border border-gray-200 rounded-md bg-gray-50">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100 transition-colors"
          >
            <h4 className="text-sm font-medium text-gray-700">
              Filtres avancés
            </h4>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showAdvancedFilters ? 'rotate-180' : ''
                }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showAdvancedFilters && (
            <div className="px-4 pb-4 space-y-4 border-t border-gray-200">
              <div className="flex justify-end pt-3">
                <button
                  onClick={resetFilters}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Réinitialiser
                </button>
              </div>

              {/* Category Filter */}
              {categoryNames.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Catégories
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {categoryNames.map(cat => (
                      <button
                        key={cat}
                        onClick={() => {
                          setSelectedCategories(prev =>
                            prev.includes(cat)
                              ? prev.filter(c => c !== cat)
                              : [...prev, cat]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${selectedCategories.includes(cat)
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Amount Range Filter */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Montant minimum
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={amountMin ?? ''}
                    onChange={e => setAmountMin(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white
                         focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Montant maximum
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={amountMax ?? ''}
                    onChange={e => setAmountMax(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white
                         focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                    placeholder="∞"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Field Selection */}
        <FieldSelector
          fields={EXPENSE_REPORT_FIELDS}
          selectedFields={selectedFields}
          onChange={setSelectedFields}
        />

        {/* Preview Section */}
        {showPreview && (
          <div className="border border-gray-200 rounded-md p-4 bg-white">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Aperçu ({previewData.length} dépenses trouvées)
            </h4>
            <div className="overflow-x-auto max-h-60 overflow-y-auto border border-gray-200 rounded">
              <table className="min-w-full text-xs divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {EXPENSE_REPORT_FIELDS.filter(f => selectedFields.includes(f.key)).map(field => (
                      <th key={field.key} className="px-3 py-2 text-left font-medium text-gray-700">{field.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.slice(0, 5).map((item, idx) => (
                    <tr key={idx}>
                      {EXPENSE_REPORT_FIELDS.filter(f => selectedFields.includes(f.key)).map(field => (
                        <td key={field.key} className="px-3 py-2 text-gray-600">
                          {field.type === 'currency'
                            ? formatCurrency(Number(item[field.key as keyof ExpenseReportData]))
                            : field.type === 'date' && item[field.key as keyof ExpenseReportData]
                              ? new Date(item[field.key as keyof ExpenseReportData] as Date).toLocaleDateString('fr-FR')
                              : String(item[field.key as keyof ExpenseReportData] ?? '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <Button
            onClick={handleTogglePreview}
            variant="outline"
            icon={<Eye className="w-4 h-4" />}
          >
            {showPreview ? 'Masquer l\'aperçu' : 'Aperçu'}
          </Button>

          <div className="flex gap-2">
            <Button
              onClick={onClose}
              variant="outline"
            >
              Annuler
            </Button>
            <Button
              onClick={handleGenerateReport}
              disabled={selectedFields.length === 0}
              isLoading={isGenerating}
              loadingText="Génération..."
              icon={<Download className="w-4 h-4" />}
            >
              Générer
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ExpensesReportModal;
