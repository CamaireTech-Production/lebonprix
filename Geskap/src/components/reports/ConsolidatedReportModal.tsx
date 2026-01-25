import React, { useState } from 'react';
import { Download, Package, DollarSign, ShoppingCart, Box } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import DateRangePicker from './DateRangePicker';
import {
  Product, Expense, Sale, Matiere, Category, Supplier, StockBatch
} from '../../types/models';
import { ReportFormat, DateRangeFilter } from '../../types/reports';
import { generateConsolidatedReport } from '../../services/reports/consolidatedReportService';

interface ConsolidatedReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  expenses: Expense[];
  sales: Sale[];
  matieres: Matiere[];
  categories: Category[];
  suppliers: Supplier[];
  productStockBatches: StockBatch[];
  matiereStockBatches: StockBatch[];
  companyName?: string;
  companyLogo?: string;
}

type ReportSection = 'products' | 'expenses' | 'sales' | 'matieres';

const ConsolidatedReportModal: React.FC<ConsolidatedReportModalProps> = ({
  isOpen,
  onClose,
  products,
  expenses,
  sales,
  matieres,
  categories,
  suppliers,
  productStockBatches,
  matiereStockBatches,
  companyName = '',
  companyLogo = ''
}) => {
  const [reportFormat, setReportFormat] = useState<ReportFormat>('pdf');
  const [selectedSections, setSelectedSections] = useState<ReportSection[]>(['products']);
  const [periodType, setPeriodType] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('all');
  const [dateRange, setDateRange] = useState<DateRangeFilter>({
    startDate: null,
    endDate: null
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const reportSections = [
    {
      id: 'products' as ReportSection,
      label: 'Produits',
      icon: Package,
      color: 'emerald',
      description: 'Inventaire des produits avec stocks et prix'
    },
    {
      id: 'matieres' as ReportSection,
      label: 'Matières Premières',
      icon: Box,
      color: 'amber',
      description: 'Inventaire des matières premières'
    },
    {
      id: 'sales' as ReportSection,
      label: 'Ventes',
      icon: ShoppingCart,
      color: 'indigo',
      description: 'Historique des ventes et profits'
    },
    {
      id: 'expenses' as ReportSection,
      label: 'Dépenses',
      icon: DollarSign,
      color: 'red',
      description: 'Suivi des dépenses par catégorie'
    }
  ];

  const toggleSection = (sectionId: ReportSection) => {
    setSelectedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(s => s !== sectionId)
        : [...prev, sectionId]
    );
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

  const handleGenerateReport = async () => {
    if (selectedSections.length === 0) {
      alert('Veuillez sélectionner au moins une section');
      return;
    }

    setIsGenerating(true);

    try {
      const result = await generateConsolidatedReport({
        sections: selectedSections,
        format: reportFormat,
        dateRange,
        data: {
          products,
          expenses,
          sales,
          matieres,
          categories,
          suppliers,
          productStockBatches,
          matiereStockBatches
        },
        companyName,
        companyLogo
      });

      if (!result.success) {
        alert(result.error || 'Erreur lors de la génération du rapport');
      }
    } catch (error) {
      console.error('Error generating consolidated report:', error);
      alert('Une erreur est survenue lors de la génération du rapport');
    } finally {
      setIsGenerating(false);
    }
  };

  const getColorClasses = (color: string, selected: boolean) => {
    const colors = {
      emerald: selected ? 'bg-emerald-100 border-emerald-500 text-emerald-700' : 'bg-emerald-50 border-emerald-200 text-emerald-600',
      amber: selected ? 'bg-amber-100 border-amber-500 text-amber-700' : 'bg-amber-50 border-amber-200 text-amber-600',
      indigo: selected ? 'bg-indigo-100 border-indigo-500 text-indigo-700' : 'bg-indigo-50 border-indigo-200 text-indigo-600',
      red: selected ? 'bg-red-100 border-red-500 text-red-700' : 'bg-red-50 border-red-200 text-red-600'
    };
    return colors[color as keyof typeof colors] || colors.emerald;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Générer un rapport consolidé"
      size="xl"
    >
      <div className="space-y-5">
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <p className="text-sm text-blue-700">
            Générez un rapport unique contenant plusieurs sections. Sélectionnez les données à inclure et appliquez des filtres communs.
          </p>
        </div>

        {/* Section Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Sélectionnez les sections à inclure (au moins une)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {reportSections.map(section => {
              const Icon = section.icon;
              const isSelected = selectedSections.includes(section.id);

              return (
                <button
                  key={section.id}
                  onClick={() => toggleSection(section.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    getColorClasses(section.color, isSelected)
                  } ${isSelected ? 'shadow-sm' : 'hover:shadow-sm'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg bg-white`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">{section.label}</h4>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-current flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <p className="text-xs mt-1 opacity-90">{section.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

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
              CSV (sections séparées)
            </button>
            <button
              onClick={() => setReportFormat('pdf')}
              className={`px-4 py-2.5 rounded-md border text-sm font-medium transition-colors ${
                reportFormat === 'pdf'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              PDF (document unique)
            </button>
          </div>
        </div>

        {/* Period Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Période (appliquée à toutes les sections)
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

        {/* Summary */}
        {selectedSections.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Résumé du rapport</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• <strong>{selectedSections.length}</strong> section(s) sélectionnée(s)</li>
              <li>• Format: <strong>{reportFormat.toUpperCase()}</strong></li>
              <li>• Période: <strong>{
                periodType === 'all' ? 'Toutes les données' :
                periodType === 'custom' ? 'Personnalisée' :
                { today: 'Aujourd\'hui', week: 'Cette semaine', month: 'Ce mois', year: 'Cette année' }[periodType]
              }</strong></li>
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
          <Button
            onClick={onClose}
            variant="outline"
          >
            Annuler
          </Button>
          <Button
            onClick={handleGenerateReport}
            disabled={selectedSections.length === 0}
            isLoading={isGenerating}
            loadingText="Génération..."
            icon={<Download className="w-4 h-4" />}
          >
            Générer le rapport
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConsolidatedReportModal;
