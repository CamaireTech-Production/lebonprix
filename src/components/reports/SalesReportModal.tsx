import React, { useState, useEffect } from 'react';
import { Eye, Download } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import DateRangePicker from './DateRangePicker';
import FieldSelector from './FieldSelector';
import { Sale, Product } from '../../types/models';
import {
  SalesReportConfig,
  SalesReportData,
  ReportFormat,
  DateRangeFilter
} from '../../types/reports';
import {
  SALES_REPORT_FIELDS,
  transformSalesToReportData,
  filterSalesReportData,
  generateSalesReport
} from '../../services/reports/salesReportService';

interface SalesReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sales: Sale[];
  products: Product[];
  companyName?: string;
  companyLogo?: string;
}

const SalesReportModal: React.FC<SalesReportModalProps> = ({
  isOpen,
  onClose,
  sales,
  products,
  companyName = '',
  companyLogo = ''
}) => {
  // Report configuration state
  const [reportFormat, setReportFormat] = useState<ReportFormat>('csv');
  const [periodType, setPeriodType] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('all');
  const [dateRange, setDateRange] = useState<DateRangeFilter>({
    startDate: null,
    endDate: null
  });
  const [selectedFields, setSelectedFields] = useState<string[]>(
    SALES_REPORT_FIELDS.filter(f => f.defaultSelected).map(f => f.key)
  );

  // Filter state
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPaymentStatuses, setSelectedPaymentStatuses] = useState<string[]>([]);
  const [amountMin, setAmountMin] = useState<number | undefined>(undefined);
  const [amountMax, setAmountMax] = useState<number | undefined>(undefined);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<SalesReportData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const statuses = [
    { value: 'paid', label: 'Payée' },
    { value: 'commande', label: 'Commande' },
    { value: 'under_delivery', label: 'En livraison' },
    { value: 'draft', label: 'Brouillon' }
  ];

  const paymentStatuses = [
    { value: 'paid', label: 'Payé' },
    { value: 'pending', label: 'En attente' },
    { value: 'cancelled', label: 'Annulé' }
  ];

  // Update preview when filters change
  useEffect(() => {
    if (showPreview) {
      updatePreview();
    }
  }, [dateRange, selectedStatuses, selectedPaymentStatuses, amountMin, amountMax, sales, products]);

  const updatePreview = () => {
    const config: SalesReportConfig = {
      title: 'Rapport des Ventes',
      format: reportFormat,
      dateRange,
      selectedFields,
      includeHeaders: true,
      filters: {
        status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
        paymentStatus: selectedPaymentStatuses.length > 0 ? selectedPaymentStatuses : undefined,
        amountMin,
        amountMax
      }
    };

    // Filter sales (only non-deleted)
    const activeSales = sales.filter(s => s.isAvailable !== false);

    const reportData = transformSalesToReportData(activeSales, products);
    const filteredData = filterSalesReportData(reportData, config);
    setPreviewData(filteredData);
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);

    try {
      const config: SalesReportConfig = {
        title: 'Rapport des Ventes',
        format: reportFormat,
        dateRange,
        selectedFields,
        includeHeaders: true,
        filters: {
          status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
          paymentStatus: selectedPaymentStatuses.length > 0 ? selectedPaymentStatuses : undefined,
          amountMin,
          amountMax
        }
      };

      // Filter sales (only non-deleted)
      const activeSales = sales.filter(s => s.isAvailable !== false);

      const result = generateSalesReport(
        activeSales,
        products,
        config,
        {
          filename: `rapport_ventes_${new Date().toISOString().split('T')[0]}`,
          companyName,
          companyLogo,
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
    setSelectedStatuses([]);
    setSelectedPaymentStatuses([]);
    setAmountMin(undefined);
    setAmountMax(undefined);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Générer un rapport des ventes"
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
              className={`px-4 py-2.5 rounded-md border text-sm font-medium transition-colors ${
                reportFormat === 'csv'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              CSV
            </button>
            <button
              onClick={() => setReportFormat('pdf')}
              className={`px-4 py-2.5 rounded-md border text-sm font-medium transition-colors ${
                reportFormat === 'pdf'
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
                className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  periodType === period.value
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
              className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                showAdvancedFilters ? 'rotate-180' : ''
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

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  Statut de la vente
                </label>
                <div className="flex flex-wrap gap-2">
                  {statuses.map(status => (
                    <button
                      key={status.value}
                      onClick={() => {
                        setSelectedStatuses(prev =>
                          prev.includes(status.value)
                            ? prev.filter(s => s !== status.value)
                            : [...prev, status.value]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        selectedStatuses.includes(status.value)
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Status Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  Statut de paiement
                </label>
                <div className="flex flex-wrap gap-2">
                  {paymentStatuses.map(status => (
                    <button
                      key={status.value}
                      onClick={() => {
                        setSelectedPaymentStatuses(prev =>
                          prev.includes(status.value)
                            ? prev.filter(s => s !== status.value)
                            : [...prev, status.value]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        selectedPaymentStatuses.includes(status.value)
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

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
          fields={SALES_REPORT_FIELDS}
          selectedFields={selectedFields}
          onChange={setSelectedFields}
        />

        {/* Preview Section */}
        {showPreview && (
          <div className="border border-gray-200 rounded-md p-4 bg-white">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Aperçu ({previewData.length} ventes trouvées)
            </h4>
            <div className="overflow-x-auto max-h-60 overflow-y-auto border border-gray-200 rounded">
              <table className="min-w-full text-xs divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {SALES_REPORT_FIELDS.filter(f => selectedFields.includes(f.key)).map(field => (
                      <th key={field.key} className="px-3 py-2 text-left font-medium text-gray-700">{field.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.slice(0, 5).map((item, idx) => (
                    <tr key={idx}>
                      {SALES_REPORT_FIELDS.filter(f => selectedFields.includes(f.key)).map(field => (
                        <td key={field.key} className="px-3 py-2 text-gray-600">
                          {field.type === 'currency'
                            ? `${Number(item[field.key as keyof SalesReportData] || 0).toLocaleString('fr-FR')} F`
                            : field.type === 'date' && item[field.key as keyof SalesReportData]
                            ? new Date(item[field.key as keyof SalesReportData] as Date).toLocaleDateString('fr-FR')
                            : field.key === 'products'
                            ? Array.isArray(item.products) ? item.products.join(', ') : item.products
                            : String(item[field.key as keyof SalesReportData] ?? '-')}
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

export default SalesReportModal;
