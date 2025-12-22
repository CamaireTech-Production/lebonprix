// Production Detail page
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button, LoadingScreen, Badge } from '@components/common';
import { useProductions, useProductionFlows, useProductionFlowSteps, useProductionCategories, useProductionCharges } from '@hooks/data/useFirestore';
import { useMatiereStocks } from '@hooks/business/useMatiereStocks';
import { formatPrice } from '@utils/formatting/formatPrice';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import ChargeFormModal from '@components/productions/ChargeFormModal';
import PublishProductionModal from '@components/productions/PublishProductionModal';
import type { Production, ProductionCharge } from '../../types/models';
import { Plus, Trash2, Edit2 as EditIcon, Package, Download, BarChart3 } from 'lucide-react';

const ProductionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { productions, loading: productionsLoading, changeState, updateProduction } = useProductions();
  const { flows } = useProductionFlows();
  const { flowSteps } = useProductionFlowSteps();
  const { categories } = useProductionCategories();
  const { matiereStocks } = useMatiereStocks();
  const { charges, loading: chargesLoading, addCharge, updateCharge, deleteCharge } = useProductionCharges(production?.id || null);

  const [activeTab, setActiveTab] = useState<'overview' | 'materials' | 'charges' | 'history'>('overview');
  const [isChangeStateModalOpen, setIsChangeStateModalOpen] = useState(false);
  const [newStepId, setNewStepId] = useState('');
  const [stateChangeNote, setStateChangeNote] = useState('');
  const [isChangingState, setIsChangingState] = useState(false);
  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
  const [editingCharge, setEditingCharge] = useState<ProductionCharge | null>(null);
  const [isValidatingCost, setIsValidatingCost] = useState(false);
  const [isValidatingCostLoading, setIsValidatingCostLoading] = useState(false);
  const [validatedCostPrice, setValidatedCostPrice] = useState('');
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [deletingChargeId, setDeletingChargeId] = useState<string | null>(null);

  const production = useMemo(() => {
    if (!id) return null;
    return productions.find(p => p.id === id) || null;
  }, [productions, id]);

  const productionFlow = useMemo(() => {
    if (!production) return null;
    return flows.find(f => f.id === production.flowId) || null;
  }, [flows, production]);

  const availableSteps = useMemo(() => {
    if (!productionFlow) return [];
    return productionFlow.stepIds
      .map(stepId => flowSteps.find(s => s.id === stepId))
      .filter(Boolean);
  }, [productionFlow, flowSteps]);

  const currentStep = useMemo(() => {
    if (!production) return null;
    return flowSteps.find(s => s.id === production.currentStepId) || null;
  }, [flowSteps, production]);

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
      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const handleChangeState = async () => {
    if (!production || !newStepId) return;

    setIsChangingState(true);
    try {
      await changeState(production.id, newStepId, stateChangeNote || undefined);
      showSuccessToast('État de la production mis à jour');
      setIsChangeStateModalOpen(false);
      setNewStepId('');
      setStateChangeNote('');
    } catch (error: any) {
      showErrorToast(error.message || 'Erreur lors du changement d\'état');
    } finally {
      setIsChangingState(false);
    }
  };

  if (productionsLoading) {
    return <LoadingScreen />;
  }

  if (!production) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Production introuvable</p>
          <Button onClick={() => navigate('/productions')} className="mt-4">
            Retour à la liste
          </Button>
        </div>
      </div>
    );
  }

  const isClosed = production.isClosed;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="secondary"
          icon={<ArrowLeft size={16} />}
          onClick={() => navigate('/productions')}
          className="mb-4"
        >
          Retour
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{production.name}</h1>
            {production.reference && (
              <p className="text-gray-600 mt-1">Réf: {production.reference}</p>
            )}
            <div className="flex items-center gap-4 mt-2">
              {getStatusBadge(production.status)}
              {isClosed && (
                <Badge variant="secondary">Fermé</Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isClosed && (
              <>
                <Button
                  variant="secondary"
                  icon={<Edit2 size={16} />}
                  onClick={() => setIsChangeStateModalOpen(true)}
                >
                  Changer l'état
                </Button>
                {production.isCostValidated && (
                  <Button
                    icon={<Package size={16} />}
                    onClick={() => setIsPublishModalOpen(true)}
                  >
                    Publier
                  </Button>
                )}
              </>
            )}
            <Button
              variant="secondary"
              icon={<Download size={16} />}
              onClick={() => {
                // Export production detail
                const escapeCSV = (value: any): string => {
                  const str = String(value || '');
                  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                  }
                  return str;
                };

                const rows: string[] = [];
                
                // Basic info
                rows.push('Informations Générales');
                rows.push('Nom,' + escapeCSV(production.name));
                rows.push('Référence,' + escapeCSV(production.reference || ''));
                rows.push('Description,' + escapeCSV(production.description || ''));
                rows.push('Catégorie,' + escapeCSV(categories.find(c => c.id === production.categoryId)?.name || ''));
                rows.push('Flux,' + escapeCSV(productionFlow?.name || ''));
                rows.push('Statut,' + escapeCSV(production.status));
                rows.push('Coût calculé,' + escapeCSV(production.calculatedCostPrice || 0));
                rows.push('Coût validé,' + escapeCSV(production.validatedCostPrice || ''));
                rows.push('Date de création,' + escapeCSV(
                  production.createdAt?.seconds
                    ? new Date(production.createdAt.seconds * 1000).toLocaleString('fr-FR')
                    : ''
                ));
                rows.push('Fermé,' + escapeCSV(production.isClosed ? 'Oui' : 'Non'));
                rows.push('Publié,' + escapeCSV(production.isPublished ? 'Oui' : 'Non'));
                rows.push('Produit publié ID,' + escapeCSV(production.publishedProductId || ''));
                
                // Materials
                rows.push('');
                rows.push('Matériaux');
                rows.push('Matériau,Quantité,Unité,Prix unitaire,Total');
                production.materials.forEach(m => {
                  rows.push([
                    escapeCSV(m.matiereName),
                    escapeCSV(m.requiredQuantity),
                    escapeCSV(m.unit),
                    escapeCSV(m.costPrice),
                    escapeCSV(m.requiredQuantity * m.costPrice)
                  ].join(','));
                });
                
                // Charges
                rows.push('');
                rows.push('Charges');
                rows.push('Description,Catégorie,Montant,Date');
                charges.forEach(c => {
                  const chargeDate = c.date?.seconds
                    ? new Date(c.date.seconds * 1000).toLocaleDateString('fr-FR')
                    : '';
                  rows.push([
                    escapeCSV(c.description),
                    escapeCSV(c.category),
                    escapeCSV(c.amount),
                    escapeCSV(chargeDate)
                  ].join(','));
                });
                
                // History
                rows.push('');
                rows.push('Historique des Changements d\'État');
                rows.push('De,À,Date,Note');
                production.stateHistory.forEach(h => {
                  const changeDate = h.timestamp?.seconds
                    ? new Date(h.timestamp.seconds * 1000).toLocaleString('fr-FR')
                    : '';
                  rows.push([
                    escapeCSV(h.fromStepName || 'Début'),
                    escapeCSV(h.toStepName),
                    escapeCSV(changeDate),
                    escapeCSV(h.note || '')
                  ].join(','));
                });

                const csvContent = rows.join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `production_${production.reference || production.id}_${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
                showSuccessToast('Export réussi');
              }}
            >
              Exporter
            </Button>
            <Button
              variant="secondary"
              icon={<BarChart3 size={16} />}
              onClick={() => setShowAnalytics(!showAnalytics)}
            >
              Analytics
            </Button>
            {isClosed && production.publishedProductId && (
              <Button
                variant="secondary"
                onClick={() => navigate(`/products`)}
              >
                Voir le produit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Analytics Panel */}
      {showAnalytics && production && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Analytics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-md p-4">
              <div className="text-sm text-blue-600 mb-1">Temps moyen par étape</div>
              <div className="text-2xl font-bold text-blue-900">
                {production.stateHistory.length > 1
                  ? `${Math.round(
                      ((production.stateHistory[production.stateHistory.length - 1]?.timestamp?.seconds || 0) -
                        (production.stateHistory[0]?.timestamp?.seconds || 0)) /
                        3600 /
                        production.stateHistory.length
                    )}h`
                  : '-'}
              </div>
            </div>
            <div className="bg-green-50 rounded-md p-4">
              <div className="text-sm text-green-600 mb-1">Coût total</div>
              <div className="text-2xl font-bold text-green-900">
                {formatPrice(production.calculatedCostPrice || 0)}
              </div>
            </div>
            <div className="bg-purple-50 rounded-md p-4">
              <div className="text-sm text-purple-600 mb-1">Nombre de changements d'état</div>
              <div className="text-2xl font-bold text-purple-900">
                {production.stateHistory.length}
              </div>
            </div>
          </div>
          {production.materials.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Coût des matériaux par unité</h3>
              <div className="space-y-2">
                {production.materials.map((material, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-600">{material.matiereName}:</span>
                    <span className="text-gray-900">
                      {formatPrice(material.costPrice)} / {material.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {(['overview', 'materials', 'charges', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'overview' && 'Vue d\'ensemble'}
              {tab === 'materials' && 'Matériaux'}
              {tab === 'charges' && 'Charges'}
              {tab === 'history' && 'Historique'}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Catégorie</h3>
                <p className="text-gray-900">
                  {production.categoryId
                    ? categories.find(c => c.id === production.categoryId)?.name || 'N/A'
                    : 'Aucune'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Flux</h3>
                <p className="text-gray-900">{productionFlow?.name || 'N/A'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Étape actuelle</h3>
                <div className="flex items-center space-x-2">
                  {currentStep && (
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: currentStep.color || '#3B82F6' }}
                    />
                  )}
                  <p className="text-gray-900">{currentStep?.name || 'N/A'}</p>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Coût calculé</h3>
                <p className="text-lg font-semibold text-gray-900">
                  {formatPrice(production.calculatedCostPrice || 0)}
                </p>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Détail des coûts</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Coût des matériaux:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatPrice(
                      production.materials.reduce(
                        (sum, m) => sum + (m.requiredQuantity * m.costPrice),
                        0
                      )
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total des charges:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatPrice(charges.reduce((sum, c) => sum + c.amount, 0))}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                  <span className="text-base font-medium text-gray-900">Coût total calculé:</span>
                  <span className="text-base font-semibold text-gray-900">
                    {formatPrice(production.calculatedCostPrice || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Cost Validation */}
            {!isClosed && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Validation du coût</h3>
                {production.isCostValidated ? (
                  <div className="bg-green-50 border border-green-200 rounded-md p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-900">
                          Coût validé: {formatPrice(production.validatedCostPrice || 0)}
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                          Le coût a été validé et peut être utilisé pour la publication
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setValidatedCostPrice(production.validatedCostPrice?.toString() || production.calculatedCostPrice?.toString() || '');
                          setIsValidatingCost(true);
                        }}
                      >
                        Modifier
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <p className="text-sm text-yellow-900 mb-3">
                      Le coût calculé n'a pas encore été validé. Vous pouvez le valider tel quel ou le modifier.
                    </p>
                    <Button
                      onClick={() => {
                        setValidatedCostPrice(production.calculatedCostPrice?.toString() || '');
                        setIsValidatingCost(true);
                      }}
                      size="sm"
                    >
                      Valider le coût
                    </Button>
                  </div>
                )}
              </div>
            )}

            {production.description && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
                <p className="text-gray-900">{production.description}</p>
              </div>
            )}

            {production.images && production.images.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Images</h3>
                <div className="grid grid-cols-4 gap-4">
                  {production.images.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`${production.name} ${idx + 1}`}
                      className="w-full h-32 object-cover rounded-md"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Materials Tab */}
        {activeTab === 'materials' && (
          <div className="p-6">
            {production.materials.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Aucun matériau</p>
            ) : (
              <div className="space-y-4">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Matériau
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Quantité requise
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Prix unitaire
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {production.materials.map((material, idx) => {
                      const stockInfo = matiereStocks.find(ms => ms.matiereId === material.matiereId);
                      return (
                        <tr key={idx}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {material.matiereName}
                            </div>
                            <div className="text-sm text-gray-500">
                              Stock disponible: {stockInfo?.currentStock || 0} {material.unit}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {material.requiredQuantity} {material.unit}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatPrice(material.costPrice)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatPrice(material.requiredQuantity * material.costPrice)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="bg-gray-50 rounded-md p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">Total matériaux:</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {formatPrice(
                        production.materials.reduce(
                          (sum, m) => sum + (m.requiredQuantity * m.costPrice),
                          0
                        )
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Charges Tab */}
        {activeTab === 'charges' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Charges</h3>
              {!isClosed && (
                <Button
                  icon={<Plus size={16} />}
                  onClick={() => {
                    setEditingCharge(null);
                    setIsChargeModalOpen(true);
                  }}
                  size="sm"
                >
                  Ajouter une charge
                </Button>
              )}
            </div>

            {chargesLoading ? (
              <div className="text-center py-8">
                <Loader2 size={24} className="animate-spin mx-auto text-gray-400" />
              </div>
            ) : charges.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-md">
                <p className="text-gray-500 mb-2">Aucune charge</p>
                {!isClosed && (
                  <p className="text-sm text-gray-400">
                    Ajoutez des charges pour suivre les coûts supplémentaires
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Catégorie
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Montant
                      </th>
                      {!isClosed && (
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {charges.map((charge) => {
                      const chargeDate = charge.date
                        ? (charge.date instanceof Date
                            ? charge.date
                            : charge.date.seconds
                            ? new Date(charge.date.seconds * 1000)
                            : new Date())
                        : new Date();
                      
                      const categoryLabels: Record<string, string> = {
                        main_oeuvre: 'Main d\'œuvre',
                        overhead: 'Frais généraux',
                        transport: 'Transport',
                        packaging: 'Emballage',
                        utilities: 'Services publics',
                        equipment: 'Équipement',
                        other: 'Autre'
                      };

                      return (
                        <tr key={charge.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {charge.description}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {categoryLabels[charge.category] || charge.category}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {chargeDate.toLocaleDateString('fr-FR')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {formatPrice(charge.amount)}
                            </div>
                          </td>
                          {!isClosed && (
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() => {
                                    setEditingCharge(charge);
                                    setIsChargeModalOpen(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  <EditIcon size={16} />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (deletingChargeId) return; // Prevent double click
                                    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette charge ?')) {
                                      setDeletingChargeId(charge.id);
                                      try {
                                        await deleteCharge(charge.id);
                                        showSuccessToast('Charge supprimée');
                                      } catch (error: any) {
                                        showErrorToast(error.message || 'Erreur lors de la suppression');
                                      } finally {
                                        setDeletingChargeId(null);
                                      }
                                    }
                                  }}
                                  disabled={deletingChargeId === charge.id}
                                  className={`text-red-600 hover:text-red-900 ${deletingChargeId === charge.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  {deletingChargeId === charge.id ? (
                                    <Loader2 size={16} className="animate-spin" />
                                  ) : (
                                    <Trash2 size={16} />
                                  )}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="bg-gray-50 rounded-md p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">Total des charges:</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {formatPrice(charges.reduce((sum, c) => sum + c.amount, 0))}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="p-6">
            {production.stateHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Aucun historique</p>
            ) : (
              <div className="space-y-4">
                {production.stateHistory.map((change, idx) => {
                  const fromStep = change.fromStepId
                    ? flowSteps.find(s => s.id === change.fromStepId)
                    : null;
                  const toStep = flowSteps.find(s => s.id === change.toStepId);

                  return (
                    <div key={change.id} className="flex items-start space-x-4 pb-4 border-b border-gray-200 last:border-0">
                      <div className="flex-shrink-0">
                        {idx === production.stateHistory.length - 1 ? (
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                            <CheckCircle2 size={16} className="text-white" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                            <CheckCircle2 size={16} className="text-gray-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          {fromStep && (
                            <>
                              <span className="text-sm text-gray-600">{fromStep.name}</span>
                              <span className="text-gray-400">→</span>
                            </>
                          )}
                          {toStep && (
                            <span className="text-sm font-medium text-gray-900">{toStep.name}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {change.timestamp && new Date(change.timestamp.seconds * 1000).toLocaleString('fr-FR')}
                        </p>
                        {change.note && (
                          <p className="text-sm text-gray-600 mt-1">{change.note}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Change State Modal */}
      {isChangeStateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Changer l'état</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Étape actuelle
                  </label>
                  <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-600">
                    {currentStep?.name || 'N/A'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nouvelle étape <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newStepId}
                    onChange={(e) => setNewStepId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner une étape...</option>
                    {availableSteps.map(step => (
                      <option key={step.id} value={step.id}>
                        {step.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note (optionnel)
                  </label>
                  <textarea
                    value={stateChangeNote}
                    onChange={(e) => setStateChangeNote(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Ajouter une note pour ce changement d'état..."
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsChangeStateModalOpen(false);
                  setNewStepId('');
                  setStateChangeNote('');
                }}
                disabled={isChangingState}
              >
                Annuler
              </Button>
              <Button
                onClick={handleChangeState}
                disabled={isChangingState || !newStepId}
              >
                {isChangingState ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-2" />
                    Changement...
                  </>
                ) : (
                  'Confirmer'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Charge Form Modal */}
      <ChargeFormModal
        isOpen={isChargeModalOpen}
        onClose={() => {
          setIsChargeModalOpen(false);
          setEditingCharge(null);
        }}
        productionId={production?.id || ''}
        charge={editingCharge}
        onSuccess={() => {
          // Charges will update automatically via subscription
        }}
      />

      {/* Publish Production Modal */}
      <PublishProductionModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        production={production}
        onSuccess={() => {
          // Production will update automatically via subscription
        }}
      />

      {/* Cost Validation Modal */}
      {isValidatingCost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Valider le coût</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Coût calculé
                  </label>
                  <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-600">
                    {formatPrice(production.calculatedCostPrice || 0)}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Coût validé (XAF) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={validatedCostPrice}
                    onChange={(e) => setValidatedCostPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsValidatingCost(false);
                  setValidatedCostPrice('');
                }}
                disabled={isValidatingCostLoading}
              >
                Annuler
              </Button>
              <Button
                onClick={async () => {
                  if (!validatedCostPrice || parseFloat(validatedCostPrice) < 0) {
                    showWarningToast('Veuillez entrer un montant valide');
                    return;
                  }

                  setIsValidatingCostLoading(true);
                  try {
                    await updateProduction({
                      validatedCostPrice: parseFloat(validatedCostPrice),
                      isCostValidated: true
                    });
                    showSuccessToast('Coût validé avec succès');
                    setIsValidatingCost(false);
                    setValidatedCostPrice('');
                  } catch (error: any) {
                    showErrorToast(error.message || 'Erreur lors de la validation du coût');
                  } finally {
                    setIsValidatingCostLoading(false);
                  }
                }}
                disabled={isValidatingCostLoading || !validatedCostPrice}
              >
                {isValidatingCostLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-2" />
                    Validation...
                  </>
                ) : (
                  'Valider'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionDetail;

