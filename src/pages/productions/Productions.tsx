// Productions list page
import React, { useState, useMemo } from 'react';
import { Plus, Eye, Loader2, Search, Filter, X } from 'lucide-react';
import { Button, LoadingScreen, Input, Badge } from '@components/common';
import { useProductions, useProductionFlows, useProductionCategories } from '@hooks/data/useFirestore';
import { formatPrice } from '@utils/formatting/formatPrice';
import CreateProductionModal from '@components/productions/CreateProductionModal';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Production } from '../../types/models';

const Productions: React.FC = () => {
  const { productions, loading } = useProductions();
  const { flows } = useProductionFlows();
  const { categories } = useProductionCategories();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract companyId from URL if in company route
  const isCompanyRoute = location.pathname.startsWith('/company/');
  const companyId = isCompanyRoute ? location.pathname.split('/')[2] : null;
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedFlow, setSelectedFlow] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [costRange, setCostRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [showFilters, setShowFilters] = useState(false);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-800' },
      in_progress: { label: 'En cours', className: 'bg-blue-100 text-blue-800' },
      ready: { label: 'Prêt', className: 'bg-green-100 text-green-800' },
      published: { label: 'Publié', className: 'bg-purple-100 text-purple-800' },
      cancelled: { label: 'Annulé', className: 'bg-red-100 text-red-800' },
      closed: { label: 'Fermé', className: 'bg-gray-100 text-gray-800' }
    };

    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getFlowName = (flowId: string) => {
    const flow = flows.find(f => f.id === flowId);
    return flow?.name || 'N/A';
  };

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return '-';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'N/A';
  };

  // Filter productions
  const filteredProductions = useMemo(() => {
    let filtered = productions;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.reference?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(p => p.status === selectedStatus);
    }

    // Flow filter
    if (selectedFlow !== 'all') {
      filtered = filtered.filter(p => p.flowId === selectedFlow);
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.categoryId === selectedCategory);
    }

    // Date range filter
    if (dateRange.start) {
      const startDate = new Date(dateRange.start);
      filtered = filtered.filter(p => {
        const createdAt = p.createdAt?.seconds
          ? new Date(p.createdAt.seconds * 1000)
          : null;
        return createdAt && createdAt >= startDate;
      });
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(p => {
        const createdAt = p.createdAt?.seconds
          ? new Date(p.createdAt.seconds * 1000)
          : null;
        return createdAt && createdAt <= endDate;
      });
    }

    // Cost range filter
    if (costRange.min) {
      const minCost = parseFloat(costRange.min);
      filtered = filtered.filter(p => (p.calculatedCostPrice || 0) >= minCost);
    }
    if (costRange.max) {
      const maxCost = parseFloat(costRange.max);
      filtered = filtered.filter(p => (p.calculatedCostPrice || 0) <= maxCost);
    }

    return filtered;
  }, [productions, searchQuery, selectedStatus, selectedFlow, selectedCategory, dateRange, costRange]);


  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedStatus !== 'all') count++;
    if (selectedFlow !== 'all') count++;
    if (selectedCategory !== 'all') count++;
    if (dateRange.start || dateRange.end) count++;
    if (costRange.min || costRange.max) count++;
    return count;
  }, [selectedStatus, selectedFlow, selectedCategory, dateRange, costRange]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedStatus('all');
    setSelectedFlow('all');
    setSelectedCategory('all');
    setDateRange({ start: '', end: '' });
    setCostRange({ min: '', max: '' });
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Productions</h1>
          <p className="text-gray-600">Gérez vos productions et leur évolution</p>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          <Button
            icon={<Plus size={16} />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Nouvelle Production
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <Input
                type="text"
                placeholder="Rechercher par nom, référence, description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Filter Toggle */}
          <Button
            variant="outline"
            icon={<Filter size={16} />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filtres {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </Button>

          {/* Clear Filters */}
          {activeFiltersCount > 0 && (
            <Button
              variant="secondary"
              icon={<X size={16} />}
              onClick={clearFilters}
            >
              Effacer
            </Button>
          )}
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="draft">Brouillon</option>
                <option value="in_progress">En cours</option>
                <option value="ready">Prêt</option>
                <option value="published">Publié</option>
                <option value="cancelled">Annulé</option>
                <option value="closed">Fermé</option>
              </select>
            </div>

            {/* Flow Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Flux
              </label>
              <select
                value={selectedFlow}
                onChange={(e) => setSelectedFlow(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous les flux</option>
                {flows.map(flow => (
                  <option key={flow.id} value={flow.id}>{flow.name}</option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catégorie
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Toutes les catégories</option>
                {categories.filter(c => c.isActive !== false).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de début
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de fin
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Cost Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Coût min (XAF)
              </label>
              <input
                type="number"
                value={costRange.min}
                onChange={(e) => setCostRange({ ...costRange, min: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Coût max (XAF)
              </label>
              <input
                type="number"
                value={costRange.max}
                onChange={(e) => setCostRange({ ...costRange, max: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="mb-4 text-sm text-gray-600">
        {filteredProductions.length} production(s) trouvée(s)
        {filteredProductions.length !== productions.length && ` sur ${productions.length}`}
      </div>

      {filteredProductions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 mb-4">
            {productions.length === 0
              ? 'Aucune production créée'
              : 'Aucune production ne correspond aux filtres'}
          </p>
          {productions.length === 0 ? (
            <Button onClick={() => setIsCreateModalOpen(true)}>
              Créer la première production
            </Button>
          ) : (
            <Button variant="secondary" onClick={clearFilters}>
              Effacer les filtres
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Catégorie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Flux
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Coût
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProductions.map((production) => (
                <tr key={production.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{production.name}</div>
                    {production.reference && (
                      <div className="text-sm text-gray-500">Ref: {production.reference}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{getCategoryName(production.categoryId)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{getFlowName(production.flowId)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(production.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatPrice(production.calculatedCostPrice || 0)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {production.createdAt?.seconds
                        ? new Date(production.createdAt.seconds * 1000).toLocaleDateString('fr-FR')
                        : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        if (companyId) {
                          navigate(`/company/${companyId}/productions/${production.id}`);
                        } else {
                          navigate(`/productions/${production.id}`);
                        }
                      }}
                      className="text-blue-600 hover:text-blue-900"
                      title="Voir les détails"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Production Modal */}
      <CreateProductionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          // Production created successfully
        }}
      />
    </div>
  );
};

export default Productions;

