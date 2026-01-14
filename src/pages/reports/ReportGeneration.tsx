import React, { useState } from 'react';
import { FileText, Package, DollarSign, ShoppingCart, Factory, Box, TrendingUp } from 'lucide-react';
import { Card, Button } from '@components/common';
import ProductsReportModal from '../../components/reports/ProductsReportModal';
import { useProducts, useExpenses, useSuppliers, useCategories } from '@hooks/data/useFirestore';
import { useAllStockBatches } from '@hooks/business/useStockBatches';
import { useAuth } from '@contexts/AuthContext';

type ReportModule = 'products' | 'expenses' | 'production' | 'matiere' | 'stocks' | 'sales' | null;

const ReportGeneration = () => {
  const [activeModal, setActiveModal] = useState<ReportModule>(null);

  // Data hooks
  const { products } = useProducts();
  const { expenses } = useExpenses();
  const { suppliers } = useSuppliers();
  const { categories } = useCategories();
  const { batches: allStockBatches } = useAllStockBatches();
  const { company } = useAuth();

  const reportModules = [
    {
      id: 'products' as ReportModule,
      title: 'Rapport des Produits',
      description: 'Générer un rapport détaillé de tous les produits avec stock, prix et marges',
      icon: Package,
      color: 'emerald',
      available: true
    },
    {
      id: 'expenses' as ReportModule,
      title: 'Rapport des Dépenses',
      description: 'Exporter l\'historique des dépenses par catégorie et période',
      icon: DollarSign,
      color: 'red',
      available: false
    },
    {
      id: 'production' as ReportModule,
      title: 'Rapport de Production',
      description: 'Analyse de la production avec matières, articles et charges',
      icon: Factory,
      color: 'blue',
      available: false
    },
    {
      id: 'matiere' as ReportModule,
      title: 'Rapport des Matières Premières',
      description: 'État des stocks de matières premières et approvisionnement',
      icon: Box,
      color: 'amber',
      available: false
    },
    {
      id: 'stocks' as ReportModule,
      title: 'Rapport des Stocks',
      description: 'Inventaire détaillé par lots avec méthode FIFO/LIFO',
      icon: TrendingUp,
      color: 'purple',
      available: false
    },
    {
      id: 'sales' as ReportModule,
      title: 'Rapport des Ventes',
      description: 'Analyse des ventes avec profits, clients et tendances',
      icon: ShoppingCart,
      color: 'indigo',
      available: false
    }
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      emerald: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
      red: 'bg-red-50 border-red-200 hover:bg-red-100',
      blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
      amber: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
      purple: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
      indigo: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100'
    };
    return colors[color as keyof typeof colors] || colors.emerald;
  };

  const getIconColorClasses = (color: string) => {
    const colors = {
      emerald: 'text-emerald-600',
      red: 'text-red-600',
      blue: 'text-blue-600',
      amber: 'text-amber-600',
      purple: 'text-purple-600',
      indigo: 'text-indigo-600'
    };
    return colors[color as keyof typeof colors] || colors.emerald;
  };

  return (
    <div className="pb-16 md:pb-0">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6" />
          Génération de Rapports
        </h1>
        <p className="text-gray-600 mt-1">
          Générez et exportez des rapports personnalisés pour chaque section de votre activité
        </p>
      </div>

      {/* Report Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportModules.map(module => {
          const Icon = module.icon;

          return (
            <Card
              key={module.id}
              className={`${getColorClasses(module.color)} border-2 transition-all duration-200 ${
                module.available ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'
              }`}
              onClick={() => module.available && setActiveModal(module.id)}
            >
              <div className="p-6">
                {/* Icon */}
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg bg-white mb-4 ${getIconColorClasses(module.color)}`}>
                  <Icon className="w-6 h-6" />
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {module.title}
                  {!module.available && (
                    <span className="ml-2 text-xs font-normal text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                      Bientôt disponible
                    </span>
                  )}
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-600 mb-4">
                  {module.description}
                </p>

                {/* Button */}
                {module.available && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveModal(module.id);
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Générer le rapport
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Info Card */}
      <Card className="mt-6 bg-blue-50 border-blue-200">
        <div className="p-4 flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 text-lg">ℹ️</span>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-blue-900 mb-1">
              À propos des rapports
            </h4>
            <p className="text-sm text-blue-700">
              Chaque rapport peut être personnalisé avec des filtres (date, catégorie, etc.) et exporté en format CSV ou PDF.
              Les données en temps réel sont synchronisées automatiquement depuis votre base de données.
            </p>
          </div>
        </div>
      </Card>

      {/* Modals */}
      {activeModal === 'products' && (
        <ProductsReportModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          products={products}
          stockBatches={allStockBatches}
          stocks={[]}
          categories={categories}
          suppliers={suppliers}
          companyName={company?.name}
          companyLogo={company?.logo}
        />
      )}

      {/* TODO: Add other report modals when implemented */}
      {/* ExpensesReportModal, ProductionReportModal, etc. */}
    </div>
  );
};

export default ReportGeneration;
