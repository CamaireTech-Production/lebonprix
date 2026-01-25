// Charges management page
import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Loader2, Search, Filter, X } from 'lucide-react';
import { Button, LoadingScreen, Input, Badge, Card } from '@components/common';
import { useCharges, useFixedCharges, useCustomCharges } from '@hooks/data/useFirestore';
import { formatPrice } from '@utils/formatting/formatPrice';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import { formatCreatorName } from '@utils/business/employeeUtils';
import { usePermissionCheck } from '@components/permissions';
import { RESOURCES } from '@constants/resources';
import ChargeFormModal from '@components/productions/ChargeFormModal';
import type { Charge } from '../../types/models';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';

const CHARGE_CATEGORY_LABELS: Record<string, string> = {
  main_oeuvre: 'Main d\'œuvre',
  overhead: 'Frais généraux',
  transport: 'Transport',
  packaging: 'Emballage',
  utilities: 'Services publics',
  equipment: 'Équipement',
  other: 'Autre'
};

const Charges: React.FC = () => {
  const location = useLocation();
  const { company } = useAuth();
  const { canDelete } = usePermissionCheck(RESOURCES.PRODUCTIONS);

  // Extract companyId from URL if in company route
  const isCompanyRoute = location.pathname.startsWith('/company/');
  const urlCompanyId = isCompanyRoute ? location.pathname.split('/')[2] : null;
  const companyId = urlCompanyId || company?.id || null;

  // Fetch all charges
  const { charges: allCharges, loading: allChargesLoading, deleteCharge: deleteChargeData } = useCharges();
  const { charges: fixedCharges, loading: fixedLoading } = useFixedCharges();
  const { charges: customCharges, loading: customLoading } = useCustomCharges();

  const [activeTab, setActiveTab] = useState<'all' | 'fixed' | 'custom'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentCharge, setCurrentCharge] = useState<Charge | null>(null);
  const [deletingChargeId, setDeletingChargeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const loading = allChargesLoading || fixedLoading || customLoading;

  // Get charges based on active tab
  const displayedCharges = useMemo(() => {
    if (activeTab === 'fixed') return fixedCharges;
    if (activeTab === 'custom') return customCharges;
    return allCharges;
  }, [activeTab, fixedCharges, customCharges, allCharges]);

  // Filter charges
  const filteredCharges = useMemo(() => {
    return displayedCharges.filter(charge => {
      // Filter by search query
      const searchMatch = !searchQuery || 
        charge.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        charge.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Filter by category
      const categoryMatch = selectedCategory === 'all' || charge.category === selectedCategory;
      
      return searchMatch && categoryMatch;
    });
  }, [displayedCharges, searchQuery, selectedCategory]);

  // Calculate totals
  const totalAmount = useMemo(() => {
    return filteredCharges.reduce((sum, charge) => sum + charge.amount, 0);
  }, [filteredCharges]);

  const fixedTotal = useMemo(() => {
    return fixedCharges.reduce((sum, charge) => sum + charge.amount, 0);
  }, [fixedCharges]);

  const customTotal = useMemo(() => {
    return customCharges.reduce((sum, charge) => sum + charge.amount, 0);
  }, [customCharges]);

  const handleAdd = () => {
    setCurrentCharge(null);
    setIsAddModalOpen(true);
  };

  const handleEdit = (charge: Charge) => {
    setCurrentCharge(charge);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (charge: Charge) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer la charge "${charge.name || charge.description}" ?`)) {
      return;
    }

    setDeletingChargeId(charge.id);
    try {
      await deleteChargeData(charge.id);
      showSuccessToast('Charge supprimée avec succès');
    } catch (error: any) {
      showErrorToast(error.message || 'Erreur lors de la suppression');
    } finally {
      setDeletingChargeId(null);
    }
  };

  const handleAddSuccess = () => {
    setIsAddModalOpen(false);
    setCurrentCharge(null);
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    setCurrentCharge(null);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="pb-16 md:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Charges</h1>
          <p className="text-gray-600">Gérez les charges fixes et personnalisées pour vos productions</p>
        </div>
        
        <div className="flex gap-2 mt-4 md:mt-0">
          <Button 
            icon={<Plus size={16} />}
            onClick={handleAdd}
          >
            Ajouter une charge
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-1">Total charges</div>
          <div className="text-2xl font-bold text-gray-900">{formatPrice(totalAmount)}</div>
          <div className="text-xs text-gray-500 mt-1">{filteredCharges.length} charge(s)</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-1">Charges fixes</div>
          <div className="text-2xl font-bold text-blue-600">{formatPrice(fixedTotal)}</div>
          <div className="text-xs text-gray-500 mt-1">{fixedCharges.length} charge(s) fixe(s)</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-1">Charges personnalisées</div>
          <div className="text-2xl font-bold text-purple-600">{formatPrice(customTotal)}</div>
          <div className="text-xs text-gray-500 mt-1">{customCharges.length} charge(s) personnalisée(s)</div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {(['all', 'fixed', 'custom'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'all' && `Toutes (${allCharges.length})`}
              {tab === 'fixed' && `Fixes (${fixedCharges.length})`}
              {tab === 'custom' && `Personnalisées (${customCharges.length})`}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <Input
            type="text"
            placeholder="Rechercher par nom ou description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Toutes les catégories</option>
            {Object.entries(CHARGE_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Charges Table */}
      <Card>
        {filteredCharges.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-2">Aucune charge trouvée</p>
            <p className="text-sm text-gray-400">
              {activeTab === 'fixed' && "Créez une charge fixe pour la réutiliser dans vos productions"}
              {activeTab === 'custom' && "Créez une charge personnalisée pour un contexte spécifique"}
              {activeTab === 'all' && "Créez votre première charge"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom / Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Catégorie
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Créé par
                  </th>
                  {activeTab === 'fixed' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                  )}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCharges.map((charge) => {
                  const chargeDate = charge.date
                    ? (charge.date instanceof Date
                        ? charge.date
                        : charge.date.seconds
                        ? new Date(charge.date.seconds * 1000)
                        : new Date())
                    : new Date();
                  
                  return (
                    <tr key={charge.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={charge.type === 'fixed' ? 'info' : 'warning'}>
                          {charge.type === 'fixed' ? 'Fixe' : 'Personnalisée'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {charge.name || charge.description}
                        </div>
                        {charge.name && charge.description && charge.name !== charge.description && (
                          <div className="text-sm text-gray-500">{charge.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">
                          {charge.category ? (CHARGE_CATEGORY_LABELS[charge.category] || charge.category) : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {formatPrice(charge.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {chargeDate.toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCreatorName(charge.createdBy)}
                      </td>
                      {activeTab === 'fixed' && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant={charge.isActive !== false ? 'success' : 'secondary'}>
                            {charge.isActive !== false ? 'Actif' : 'Inactif'}
                          </Badge>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(charge)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Modifier"
                          >
                            <Edit2 size={16} />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(charge)}
                              className="text-red-600 hover:text-red-900"
                              title="Supprimer"
                              disabled={deletingChargeId === charge.id}
                            >
                              {deletingChargeId === charge.id ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={activeTab === 'fixed' ? 7 : 6} className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                    Total:
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    {formatPrice(totalAmount)}
                  </td>
                  <td className="px-6 py-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Mobile spacing */}
      <div className="h-20 md:hidden"></div>

      {/* Modals */}
      <ChargeFormModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setCurrentCharge(null);
        }}
        onSuccess={handleAddSuccess}
      />

      <ChargeFormModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setCurrentCharge(null);
        }}
        charge={currentCharge}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
};

export default Charges;

