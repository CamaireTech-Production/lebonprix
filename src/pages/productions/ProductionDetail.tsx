// Production Detail page
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Edit2, Loader2, CheckCircle2, Plus, Trash2, Package, Download, BarChart3, X, XCircle, Check, AlertTriangle } from 'lucide-react';
import { SkeletonTable } from "@components/common";
import { useProductions, useProductionFlows, useProductionFlowSteps, useProductionCategories, useFixedCharges } from '@hooks/data/useFirestore';
import { useAuth } from '@contexts/AuthContext';
import { useMatiereStocks } from '@hooks/business/useMatiereStocks';
import { formatPrice } from '@utils/formatting/formatPrice';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import { canPublishProduction } from '@utils/productions/flowValidation';
import { getUserById } from '@services/utilities/userService';
import { formatCreatorName } from '@utils/business/employeeUtils';
import { usePermissionCheck } from '@components/permissions';
import { RESOURCES } from '@constants/resources';
import ChargeFormModal from '@components/productions/ChargeFormModal';
import PublishProductionModal from '@components/productions/PublishProductionModal';
import AddArticleModal from '@components/productions/AddArticleModal';
import type { ProductionChargeRef } from '../../types/models';

const ProductionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract companyId from URL if in company route
  const isCompanyRoute = location.pathname.startsWith('/company/');
  const urlCompanyId = isCompanyRoute ? location.pathname.split('/')[2] : null;
  const { company } = useAuth();
  const companyId = urlCompanyId || company?.id || null;
  
  const { productions, loading: productionsLoading, changeState, changeStatus, updateProduction: updateProductionData, deleteProduction } = useProductions();
  const { flows } = useProductionFlows();
  const { flowSteps } = useProductionFlowSteps();
  const { categories } = useProductionCategories();
  const { matiereStocks } = useMatiereStocks();
  const { canDelete } = usePermissionCheck(RESOURCES.PRODUCTIONS);

  const [activeTab, setActiveTab] = useState<'overview' | 'materials' | 'charges' | 'history'>('overview');
  const [isChangeStateModalOpen, setIsChangeStateModalOpen] = useState(false);
  const [isChangeStatusModalOpen, setIsChangeStatusModalOpen] = useState(false);
  const [newStepId, setNewStepId] = useState('');
  const [newStatus, setNewStatus] = useState<'draft' | 'in_progress' | 'ready' | 'published' | 'cancelled' | 'closed'>('draft');
  const [stateChangeNote, setStateChangeNote] = useState('');
  const [isChangingState, setIsChangingState] = useState(false);
  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
  const [isSelectFixedChargeModalOpen, setIsSelectFixedChargeModalOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [deletingChargeId, setDeletingChargeId] = useState<string | null>(null);
  const [isDeletingProduction, setIsDeletingProduction] = useState(false);
  const [selectedFixedChargeId, setSelectedFixedChargeId] = useState<string | null>(null);
  const [isAddingFixedCharge, setIsAddingFixedCharge] = useState(false);
  const [isDeleteProductionModalOpen, setIsDeleteProductionModalOpen] = useState(false);
  const [showPublishWarning, setShowPublishWarning] = useState(true); // Show warning until user changes state
  const [isRemoveChargeModalOpen, setIsRemoveChargeModalOpen] = useState(false);
  const [chargeToRemove, setChargeToRemove] = useState<ProductionChargeRef | null>(null);
  const [isAddArticleModalOpen, setIsAddArticleModalOpen] = useState(false);
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [isChangingArticleStage, setIsChangingArticleStage] = useState<string | null>(null);
  const [isPublishingArticle, setIsPublishingArticle] = useState<string | null>(null);
  const [isBulkPublishing, setIsBulkPublishing] = useState(false);
  const [userNamesMap, setUserNamesMap] = useState<Map<string, string>>(new Map());
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);

  const production = useMemo(() => {
    if (!id) return null;
    return productions.find(p => p.id === id) || null;
  }, [productions, id]);

  // Fetch user names for state history
  useEffect(() => {
    const fetchUserNames = async () => {
      if (!production || !production.stateHistory || production.stateHistory.length === 0) {
        return;
      }

      const userIds = new Set<string>();
      production.stateHistory.forEach((change) => {
        if (change.changedBy) {
          userIds.add(change.changedBy);
        }
      });

      const namesMap = new Map<string, string>();
      const fetchPromises = Array.from(userIds).map(async (userId) => {
        try {
          const user = await getUserById(userId);
          if (user) {
            const fullName = user.username || user.email || userId;
            namesMap.set(userId, fullName || user.email || userId);
          } else {
            namesMap.set(userId, userId); // Fallback to userId if user not found
          }
        } catch (error) {
          console.error(`Error fetching user ${userId}:`, error);
          namesMap.set(userId, userId); // Fallback to userId on error
        }
      });

      await Promise.all(fetchPromises);
      setUserNamesMap(namesMap);
    };

    fetchUserNames();
  }, [production?.stateHistory]);

  // Calculate costs from articles and charges
  const materialsCost = useMemo(() => {
    if (!production || !production.articles) return 0;
    return production.articles.reduce((sum, article) => {
      const articleMaterialsCost = (article.materials || []).reduce((articleSum, material) => {
        return articleSum + (material.requiredQuantity * material.costPrice);
      }, 0);
      return sum + articleMaterialsCost;
    }, 0);
  }, [production]);

  const chargesCost = useMemo(() => {
    if (!production || !production.charges) return 0;
    return production.charges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
  }, [production]);

  const totalCost = useMemo(() => {
    return materialsCost + chargesCost;
  }, [materialsCost, chargesCost]);

  // Get fixed charges for selection
  const { charges: fixedCharges } = useFixedCharges(); // Get all fixed charges

  const productionFlow = useMemo(() => {
    if (!production) return null;
    return flows.find(f => f.id === production.flowId) || null;
  }, [flows, production]);

  const availableSteps = useMemo(() => {
    if (!productionFlow) return [];
    return productionFlow.stepIds
      .map((stepId: string) => flowSteps.find(s => s.id === stepId))
      .filter(Boolean);
  }, [productionFlow, flowSteps]);

  const currentStep = useMemo(() => {
    if (!production) return null;
    return flowSteps.find(s => s.id === production.currentStepId) || null;
  }, [flowSteps, production]);

  // Format seconds to h:min:sec format
  const formatTime = (totalSeconds: number): string => {
    if (totalSeconds <= 0) return '0:00:00';
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

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
      setShowPublishWarning(false); // Hide warning after state change
    } catch (error: any) {
      showErrorToast(error.message || 'Erreur lors du changement d\'état');
    } finally {
      setIsChangingState(false);
    }
  };

  const handleChangeStatus = async () => {
    if (!production) return;

    setIsChangingState(true);
    try {
      await changeStatus(production.id, newStatus, stateChangeNote || undefined);
      showSuccessToast('Statut de la production mis à jour');
      setIsChangeStatusModalOpen(false);
      setNewStatus('draft');
      setStateChangeNote('');
      setShowPublishWarning(false); // Hide warning after status change
    } catch (error: any) {
      showErrorToast(error.message || 'Erreur lors du changement de statut');
    } finally {
      setIsChangingState(false);
    }
  };

  const handleDeleteProduction = async () => {
    if (!production || !companyId) return;

    setIsDeletingProduction(true);
    try {
      await deleteProduction(production.id);
      showSuccessToast('Production supprimée avec succès');
      setIsDeleteProductionModalOpen(false);
      // Navigate back to productions list
      if (isCompanyRoute) {
        navigate(`/company/${companyId}/productions`);
      } else {
        navigate('/productions');
      }
    } catch (error: any) {
      showErrorToast(error.message || 'Erreur lors de la suppression de la production');
    } finally {
      setIsDeletingProduction(false);
    }
  };

  // Check if production uses flow or simple mode
  const hasFlow = production?.flowId !== undefined && production.flowId !== null;

  // Get article current step
  const getArticleCurrentStep = (article: typeof production.articles[0]) => {
    if (!article || !article.currentStepId) return null;
    return flowSteps.find(s => s.id === article.currentStepId) || null;
  };

  if (productionsLoading) {
    return <SkeletonTable rows={5} />;
  }

  if (!production) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Production introuvable</p>
          <Button 
            onClick={() => {
              if (companyId) {
                navigate(`/company/${companyId}/productions`);
              } else {
                navigate('/productions');
              }
            }} 
            className="mt-4"
          >
            Retour à la liste
          </Button>
        </div>
      </div>
    );
  }

  const isClosed = production.isClosed;

  // Check if production can be published
  const flow = production.flowId ? flows.find(f => f.id === production.flowId) : null;
  const publishCheck = canPublishProduction(production, flow?.stepIds);
  
  // Hide warning if user has changed state at least once (stateHistory has more than initial state)
  const hasStateChanges = production.stateHistory && production.stateHistory.length > 1;
  const shouldShowWarning = showPublishWarning && !publishCheck.canPublish && !hasStateChanges;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <Button
          variant="outline"
          icon={<ArrowLeft size={16} />}
          onClick={() => {
            if (companyId) {
              navigate(`/company/${companyId}/productions`);
            } else {
              navigate('/productions');
            }
          }}
          className="mb-4"
        >
          Retour
        </Button>
        
        {/* Publish Warning Badge - Visible on mobile and desktop */}
        {shouldShowWarning && (
          <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-yellow-800 mb-1">
                  Publication non disponible
                </h3>
                <p className="text-sm text-yellow-700">
                  {publishCheck.reason || 'Toutes les étapes du flux doivent être passées avant de publier'}
                </p>
                <p className="text-xs text-yellow-600 mt-2">
                  Ce message disparaîtra une fois que vous commencerez le processus de production.
                </p>
              </div>
              <button
                onClick={() => setShowPublishWarning(false)}
                className="ml-2 text-yellow-600 hover:text-yellow-800"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900">{production.name}</h1>
            {production.reference && (
              <p className="text-gray-600 mt-1 text-sm md:text-base">Réf: {production.reference}</p>
            )}
            <div className="flex items-center gap-2 md:gap-4 mt-2 flex-wrap">
              {getStatusBadge(production.status)}
              {isClosed && (
                <Badge>Fermé</Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {!isClosed && (
              <>
                {hasFlow ? (
                  <Button
                    variant="outline"
                    icon={<Edit2 size={16} />}
                    onClick={() => setIsChangeStateModalOpen(true)}
                    className="flex-1 md:flex-none"
                  >
                    Changer l'étape
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    icon={<Edit2 size={16} />}
                    onClick={() => {
                      setNewStatus(production.status);
                      setIsChangeStatusModalOpen(true);
                    }}
                    className="flex-1 md:flex-none"
                  >
                    Changer le statut
                  </Button>
                )}
                <Button
                  icon={<Package size={16} />}
                  onClick={() => {
                    if (publishCheck.canPublish) {
                      setIsPublishModalOpen(true);
                    } else {
                      showErrorToast(publishCheck.reason || 'Impossible de publier cette production');
                    }
                  }}
                  disabled={!publishCheck.canPublish}
                  title={publishCheck.reason || undefined}
                  className="flex-1 md:flex-none"
                >
                  Publier
                </Button>
              </>
            )}
            {canDelete && !production.isPublished && !isClosed && (
              <Button
                variant="danger"
                icon={<Trash2 size={16} />}
                onClick={() => setIsDeleteProductionModalOpen(true)}
                isLoading={isDeletingProduction}
                disabled={isDeletingProduction}
                className="flex-1 md:flex-none"
              >
                Supprimer
              </Button>
            )}
            <Button
              variant="outline"
              icon={<Download size={16} />}
              onClick={() => {
                // Export production detail
              }}
              className="flex-1 md:flex-none"
            >
              Exporter
            </Button>
            <Button
              variant="outline"
              icon={<BarChart3 size={16} />}
              onClick={() => setShowAnalytics(!showAnalytics)}
              className="flex-1 md:flex-none"
            >
              Analytics
            </Button>
          </div>
        </div>
      </div>

      {/* Analytics Panel */}
      {showAnalytics && production && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Analytics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-md p-4">
              <div className="text-sm text-blue-600 mb-1">Temps moyen par étape</div>
              <div className="text-2xl font-bold text-blue-900">
                {production.stateHistory.length > 1
                  ? formatTime(
                      ((production.stateHistory[production.stateHistory.length - 1]?.timestamp?.seconds || 0) -
                        (production.stateHistory[0]?.timestamp?.seconds || 0)) /
                        production.stateHistory.length
                    )
                  : '-'}
              </div>
            </div>
            <div className="bg-green-50 rounded-md p-4">
              <div className="text-sm text-green-600 mb-1">Coût total</div>
              <div className="text-2xl font-bold text-green-900">
                {formatPrice(totalCost)}
              </div>
            </div>
            <div className="bg-purple-50 rounded-md p-4">
              <div className="text-sm text-purple-600 mb-1">Nombre de changements d'état</div>
              <div className="text-2xl font-bold text-purple-900">
                {production.stateHistory.length}
              </div>
            </div>
          </div>
          
          {/* Article Analytics */}
          {production.articles && production.articles.length > 0 && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-md font-semibold text-gray-900 mb-4">Analytics des Articles</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-orange-50 rounded-md p-4">
                  <div className="text-sm text-orange-600 mb-1">Total articles</div>
                  <div className="text-2xl font-bold text-orange-900">
                    {production.articles.length}
                  </div>
                </div>
                <div className="bg-green-50 rounded-md p-4">
                  <div className="text-sm text-green-600 mb-1">Articles publiés</div>
                  <div className="text-2xl font-bold text-green-900">
                    {production.publishedArticlesCount || 0}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    {production.articles.length > 0
                      ? `${Math.round(((production.publishedArticlesCount || 0) / production.articles.length) * 100)}%`
                      : '0%'}
                  </div>
                </div>
                <div className="bg-blue-50 rounded-md p-4">
                  <div className="text-sm text-blue-600 mb-1">Taux de publication</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {production.articles.length > 0
                      ? `${Math.round(((production.publishedArticlesCount || 0) / production.articles.length) * 100)}%`
                      : '0%'}
                  </div>
                </div>
                <div className="bg-indigo-50 rounded-md p-4">
                  <div className="text-sm text-indigo-600 mb-1">Quantité totale</div>
                  <div className="text-2xl font-bold text-indigo-900">
                    {production.totalArticlesQuantity || 0}
                  </div>
                </div>
              </div>
              
              {/* Article Progress by Status */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Répartition par statut</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {['draft', 'in_progress', 'ready', 'published', 'cancelled'].map((status) => {
                    const count = production.articles.filter((a: typeof production.articles[0]) => a.status === status).length;
                    const percentage = production.articles.length > 0 ? (count / production.articles.length) * 100 : 0;
                    const colors = {
                      draft: 'bg-gray-100 text-gray-800',
                      in_progress: 'bg-blue-100 text-blue-800',
                      ready: 'bg-green-100 text-green-800',
                      published: 'bg-purple-100 text-purple-800',
                      cancelled: 'bg-red-100 text-red-800'
                    };
                    const labels = {
                      draft: 'Brouillon',
                      in_progress: 'En cours',
                      ready: 'Prêt',
                      published: 'Publié',
                      cancelled: 'Annulé'
                    };
                    return (
                      <div key={status} className={`rounded-md p-3 ${colors[status as keyof typeof colors]}`}>
                        <div className="text-xs font-medium mb-1">{labels[status as keyof typeof labels]}</div>
                        <div className="text-lg font-bold">{count}</div>
                        <div className="text-xs opacity-75">{percentage.toFixed(0)}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {production.materials.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Coût des matériaux par unité</h3>
              <div className="space-y-2">
                {production.materials.map((material: typeof production.materials[0], idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-600">{material.matiereName}:</span>
                    <span className="text-gray-900">
                      {formatPrice(material.costPrice)} / {material.unit || 'unité'}
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
              {hasFlow ? (
                <>
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
                </>
              ) : (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Mode</h3>
                  <p className="text-gray-900">Production simple (sans flux)</p>
                </div>
              )}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Coût calculé</h3>
                <p className="text-lg font-semibold text-gray-900">
                  {formatPrice(totalCost)}
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
                    {formatPrice(materialsCost)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total des charges:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatPrice(chargesCost)}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                  <span className="text-base font-medium text-gray-900">Coût total calculé:</span>
                  <span className="text-base font-semibold text-gray-900">
                    {formatPrice(totalCost)}
                  </span>
                </div>
              </div>
            </div>

            {/* Articles Section */}
            <div className="mt-6 border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Articles</h3>
                <div className="flex items-center gap-2">
                  {!isClosed && selectedArticles.size > 0 && (
                    <Button
                      icon={<Package size={16} />}
                      onClick={async () => {
                        if (selectedArticles.size === 0 || !production) return;
                        setIsBulkPublishing(true);
                        try {
                          const { bulkPublishArticles } = await import('@services/firestore/productions/productionService');
                          
                          // Create product data map for each article
                          const productDataMap = new Map();
                          const selectedArticleIds = Array.from(selectedArticles);
                          
                          for (const articleId of selectedArticleIds) {
                            const article = production.articles?.find((a: typeof production.articles[0]) => a.id === articleId);
                            if (!article) continue;
                            
                            // Calculate cost from article's own materials
                            const articleMaterialsCost = (article.materials || []).reduce((sum, material) => {
                              return sum + (material.requiredQuantity * material.costPrice);
                            }, 0);
                            const articleCostPrice = article.calculatedCostPrice || articleMaterialsCost;
                            
                            productDataMap.set(articleId, {
                              name: article.name,
                              costPrice: articleCostPrice,
                              sellingPrice: 0, // User will need to set this - can be enhanced later
                              stock: article.quantity,
                              description: article.description || production.description,
                              isVisible: true
                            });
                          }
                          
                          const results = await bulkPublishArticles(production.id, selectedArticleIds, companyId || production.companyId, productDataMap);
                          showSuccessToast(`${results.length} article(s) publié(s) avec succès`);
                          setSelectedArticles(new Set());
                        } catch (error: any) {
                          showErrorToast(error.message || 'Erreur lors de la publication en masse');
                        } finally {
                          setIsBulkPublishing(false);
                        }
                      }}
                      isLoading={isBulkPublishing}
                      disabled={isBulkPublishing}
                      variant="secondary"
                      size="sm"
                    >
                      Publier la sélection ({selectedArticles.size})
                    </Button>
                  )}
                  {!isClosed && (
                    <Button
                      icon={<Plus size={16} />}
                      onClick={() => setIsAddArticleModalOpen(true)}
                      variant="secondary"
                      size="sm"
                    >
                      Ajouter un article
                    </Button>
                  )}
                </div>
              </div>
              {production.articles && production.articles.length > 0 ? (
                <div className="space-y-3">
                  {production.articles.map((article: typeof production.articles[0]) => {
                    const articleStep = getArticleCurrentStep(article);
                    const isSelected = selectedArticles.has(article.id);
                    const canPublish = article.status === 'ready' || article.status === 'in_progress' || article.status === 'partially_published';
                    const isPublished = article.status === 'published';
                    const isPartiallyPublished = article.status === 'partially_published';
                    
                    // Calculate published quantity from publications array if available (source of truth)
                    let publishedQuantity = article.publishedQuantity;
                    if (publishedQuantity === undefined) {
                      if (article.publications && article.publications.length > 0) {
                        // Calculate from publications array (most accurate)
                        publishedQuantity = article.publications.reduce((sum, pub) => sum + (pub.quantity || 0), 0);
                      } else if (article.status === 'published') {
                        // Backward compatibility: if status is 'published' but no publications, assume all was published
                        publishedQuantity = article.quantity;
                      } else {
                        publishedQuantity = 0;
                      }
                    }
                    
                    // Calculate remaining quantity
                    let remainingQuantity = article.remainingQuantity;
                    if (remainingQuantity === undefined) {
                      remainingQuantity = article.quantity - publishedQuantity;
                    }

                    return (
                      <div key={article.id} className={`border rounded-md p-4 ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                        <div className="flex items-start gap-4">
                              {!isClosed && canPublish && (
                            <div className="pt-1">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const newSelected = new Set(selectedArticles);
                                  if (e.target.checked) {
                                    newSelected.add(article.id);
                                  } else {
                                    newSelected.delete(article.id);
                                  }
                                  setSelectedArticles(newSelected);
                                }}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <h4 className="font-medium text-gray-900">{article.name}</h4>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${
                                  article.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                                  article.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                  article.status === 'ready' ? 'bg-green-100 text-green-800' :
                                  article.status === 'partially_published' ? 'bg-yellow-100 text-yellow-800' :
                                  article.status === 'published' ? 'bg-purple-100 text-purple-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {article.status === 'draft' && (
                                    <>
                                      <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                                      Brouillon
                                    </>
                                  )}
                                  {article.status === 'in_progress' && (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      En cours
                                    </>
                                  )}
                                  {article.status === 'ready' && (
                                    <>
                                      <CheckCircle2 className="w-3 h-3 text-green-600" />
                                      Prêt
                                    </>
                                  )}
                                  {article.status === 'partially_published' && (
                                    <>
                                      <Package className="w-3 h-3 text-yellow-600" />
                                      Partiellement publié
                                    </>
                                  )}
                                  {article.status === 'published' && (
                                    <>
                                      <CheckCircle2 className="w-3 h-3 text-purple-600" />
                                      Publié
                                    </>
                                  )}
                                  {article.status === 'cancelled' && (
                                    <>
                                      <XCircle className="w-3 h-3 text-red-600" />
                                      Annulé
                                    </>
                                  )}
                                </span>
                              </div>
                              {!isClosed && !isPublished && (
                                <div className="flex items-center gap-2">
                                  {hasFlow && (
                                    <div className="relative">
                                      <select
                                        value={article.currentStepId || ''}
                                        onChange={async (e) => {
                                          const newStepId = e.target.value;
                                          if (!newStepId) return;
                                          setIsChangingArticleStage(article.id);
                                          try {
                                            const { updateArticleStage } = await import('@services/firestore/productions/productionService');
                                            await updateArticleStage(production.id, article.id, newStepId);
                                            showSuccessToast('Étape de l\'article mise à jour');
                                          } catch (error: any) {
                                            showErrorToast(error.message || 'Erreur lors du changement d\'étape');
                                          } finally {
                                            setIsChangingArticleStage(null);
                                          }
                                        }}
                                        disabled={isChangingArticleStage === article.id}
                                        className="text-sm px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                      >
                                        <option value="">Sélectionner une étape...</option>
                                        {availableSteps.map((step: typeof availableSteps[0]) => (
                                          <option key={step.id} value={step.id}>
                                            {step.name}
                                          </option>
                                        ))}
                                      </select>
                                      {isChangingArticleStage === article.id && (
                                        <Loader2 className="absolute right-2 top-1.5 animate-spin" size={14} />
                                      )}
                                    </div>
                                  )}
                                  {canPublish && (
                                    <Button
                                      icon={<Package size={14} />}
                                      onClick={async () => {
                                        setIsPublishingArticle(article.id);
                                        try {
                                          const { publishArticle } = await import('@services/firestore/productions/productionService');
                                          
                                          // Calculate cost from article's own materials
                                          const articleMaterialsCost = (article.materials || []).reduce((sum, material) => {
                                            return sum + (material.requiredQuantity * material.costPrice);
                                          }, 0);
                                          const articleCostPrice = article.calculatedCostPrice || articleMaterialsCost;
                                          
                                          // NEW: Use remaining quantity for partial publishing
                                          const publishQuantity = remainingQuantity > 0 ? remainingQuantity : article.quantity;
                                          
                                          await publishArticle(production.id, article.id, companyId || production.companyId, {
                                            name: article.name,
                                            costPrice: articleCostPrice,
                                            sellingPrice: 0, // User will need to set this - can be enhanced later
                                            stock: publishQuantity,
                                            description: article.description || production.description,
                                            isVisible: true
                                          });
                                          showSuccessToast('Article publié avec succès');
                                        } catch (error: any) {
                                          showErrorToast(error.message || 'Erreur lors de la publication');
                                        } finally {
                                          setIsPublishingArticle(null);
                                        }
                                      }}
                                      isLoading={isPublishingArticle === article.id}
                                      disabled={isPublishingArticle === article.id}
                                      size="sm"
                                      variant="secondary"
                                    >
                                      Publier
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <div>
                                <span className="font-medium">Quantité totale:</span> {article.quantity} unité{article.quantity !== 1 ? 's' : ''}
                              </div>
                              {(publishedQuantity > 0 || isPublished || isPartiallyPublished) && (
                                <div className="text-green-600">
                                  <span className="font-medium">Publiée:</span> {publishedQuantity} unité{publishedQuantity !== 1 ? 's' : ''}
                                </div>
                              )}
                              {remainingQuantity > 0 && (
                                <div className="text-blue-600 font-medium">
                                  <span className="font-medium">Restante:</span> {remainingQuantity} unité{remainingQuantity !== 1 ? 's' : ''}
                                </div>
                              )}
                              {remainingQuantity === 0 && publishedQuantity === article.quantity && (
                                <div className="text-gray-500 text-xs italic">
                                  Toutes les unités ont été publiées
                                </div>
                              )}
                              {article.publications && article.publications.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-200">
                                  <p className="text-xs font-medium text-gray-700 mb-1">Historique des publications:</p>
                                  <div className="space-y-1">
                                    {article.publications.map((pub, idx) => (
                                      <div key={pub.id || idx} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                        <div className="flex justify-between items-center">
                                          <span>{pub.quantity} unité{pub.quantity !== 1 ? 's' : ''}</span>
                                          <span className="text-gray-500">
                                            {pub.publishedAt?.toDate?.()?.toLocaleDateString('fr-FR') || 'Date inconnue'}
                                          </span>
                                        </div>
                                        <div className="text-gray-500 mt-0.5">
                                          Coût: {pub.costPrice?.toLocaleString('fr-FR') || '0'} XAF | 
                                          Prix: {pub.sellingPrice?.toLocaleString('fr-FR') || '0'} XAF
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {articleStep && (
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium">Étape:</span>
                                  <div className="flex items-center space-x-1">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: articleStep.color || '#3B82F6' }}
                                    />
                                    <span>{articleStep.name}</span>
                                  </div>
                                </div>
                              )}
                              {article.description && (
                                <div>
                                  <span className="font-medium">Description:</span> {article.description}
                                </div>
                              )}
                              {isPublished && article.publishedProductId && (
                                <div>
                                  <span className="font-medium">Produit publié:</span>{' '}
                                  <a
                                    href={`/products`}
                                    className="text-blue-600 hover:text-blue-800 underline"
                                  >
                                    Voir le produit
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-md">
                  <p className="text-gray-500 mb-2">Aucun article</p>
                  {!isClosed && (
                    <p className="text-sm text-gray-400">
                      Cliquez sur "Ajouter un article" pour commencer
                    </p>
                  )}
                </div>
              )}
            </div>

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
                  {production.images.map((img: string, idx: number) => (
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
            {(!production.articles || production.articles.length === 0) ? (
              <p className="text-gray-500 text-center py-8">Aucun matériau</p>
            ) : (
              <div className="space-y-4">
                {production.articles.map((article) => {
                  const articleMaterials = article.materials || [];
                  const isExpanded = expandedArticleId === article.id;

                  return (
                    <div key={article.id} className="border rounded-lg shadow-sm bg-white">
                      <button
                        type="button"
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                        onClick={() =>
                          setExpandedArticleId(isExpanded ? null : article.id)
                        }
                      >
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-semibold text-gray-900">{article.name}</span>
                          <span className="text-xs text-gray-500">Quantité: {article.quantity}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-900">
                            {formatPrice(
                              articleMaterials.reduce(
                                (sum, m) => sum + m.requiredQuantity * m.costPrice,
                                0
                              )
                            )}
                          </span>
                          <svg
                            className={`w-4 h-4 text-gray-500 transition-transform ${
                              isExpanded ? 'transform rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4">
                          {articleMaterials.length === 0 ? (
                            <div className="py-4 text-sm text-gray-500">Aucun matériau pour cet article</div>
                          ) : (
                            <div className="space-y-3">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                      Matériau
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                      Quantité requise
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                      Prix unitaire
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                      Total
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                      Créé par
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {articleMaterials.map((material, idx) => {
                                    const stockInfo = matiereStocks.find(ms => ms.matiereId === material.matiereId);
                                    return (
                                      <tr key={`${material.matiereId}-${idx}`}>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <div className="text-sm font-medium text-gray-900">
                                            {material.matiereName}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            Stock disponible: {stockInfo?.currentStock || 0} {material.unit || 'unité'}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                          {material.requiredQuantity} {material.unit || 'unité'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                          {formatPrice(material.costPrice)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                          {formatPrice(material.requiredQuantity * material.costPrice)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                          {formatCreatorName(production.createdBy)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              <div className="bg-gray-50 rounded-md p-3 flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-900">Total matériaux (article):</span>
                                <span className="text-base font-semibold text-gray-900">
                                  {formatPrice(
                                    articleMaterials.reduce(
                                      (sum, m) => sum + m.requiredQuantity * m.costPrice,
                                      0
                                    )
                                  )}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="bg-gray-50 rounded-md p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">Total matériaux (production):</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {formatPrice(materialsCost)}
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
                <div className="flex gap-2">
                  <Button
                    icon={<Plus size={16} />}
                    onClick={() => {
                      setIsChargeModalOpen(true);
                    }}
                    size="sm"
                  >
                    Ajouter une charge
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setIsSelectFixedChargeModalOpen(true);
                    }}
                    size="sm"
                  >
                    Sélectionner une charge fixe
                  </Button>
                </div>
              )}
            </div>

            {(production.charges || []).length === 0 ? (
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
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Nom / Description
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Créé par
                      </th>
                      {!isClosed && (
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(production.charges || []).map((charge: ProductionChargeRef, index: number) => {
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
                        <tr key={charge.chargeId || index} className="hover:bg-gray-50">
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
                            <div className="text-sm text-gray-500">
                              {charge.category ? (categoryLabels[charge.category] || charge.category) : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {chargeDate.toLocaleDateString('fr-FR')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {formatPrice(charge.amount || 0)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">
                              {formatCreatorName(charge.createdBy)}
                            </div>
                          </td>
                          {!isClosed && (charge.type === 'fixed' || canDelete) && (
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() => {
                                    setChargeToRemove(charge);
                                    setIsRemoveChargeModalOpen(true);
                                  }}
                                  disabled={deletingChargeId === charge.chargeId}
                                  className={`${charge.type === 'fixed' ? 'text-orange-600 hover:text-orange-900' : 'text-red-600 hover:text-red-900'} ${deletingChargeId === charge.chargeId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  title={charge.type === 'fixed' ? 'Retirer de la production' : 'Supprimer'}
                                >
                                  {deletingChargeId === charge.chargeId ? (
                                    <Loader2 size={16} className="animate-spin" />
                                  ) : charge.type === 'fixed' ? (
                                    <XCircle size={16} />
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
                      {formatPrice(
                        (production.charges || []).reduce((sum: number, c: ProductionChargeRef) => sum + (c.amount || 0), 0)
                      )}
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
                {production.stateHistory.map((change: typeof production.stateHistory[0], idx: number) => {
                  // Handle both flow mode and simple mode
                  const isFlowMode = hasFlow && (change.toStepId || change.fromStepId);
                  
                  let displayText = '';
                  if (isFlowMode) {
                    const fromStep = change.fromStepId
                      ? flowSteps.find(s => s.id === change.fromStepId)
                      : null;
                    const toStep = change.toStepId
                      ? flowSteps.find(s => s.id === change.toStepId)
                      : null;
                    
                    if (fromStep && toStep) {
                      displayText = `${fromStep.name} → ${toStep.name}`;
                    } else if (toStep) {
                      displayText = `Début → ${toStep.name}`;
                    } else if (change.toStepName) {
                      displayText = change.toStepName;
                    }
                  } else {
                    // Simple mode: status-based
                    const statusLabels: Record<string, string> = {
                      draft: 'Brouillon',
                      in_progress: 'En cours',
                      ready: 'Prêt',
                      published: 'Publié',
                      cancelled: 'Annulé',
                      closed: 'Fermé'
                    };
                    
                    const fromStatusLabel = change.fromStatus ? statusLabels[change.fromStatus] || change.fromStatus : 'Début';
                    const toStatusLabel = change.toStatus ? statusLabels[change.toStatus] || change.toStatus : '';
                    
                    if (fromStatusLabel && toStatusLabel) {
                      displayText = `${fromStatusLabel} → ${toStatusLabel}`;
                    } else if (toStatusLabel) {
                      displayText = toStatusLabel;
                    }
                  }

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
                          <span className="text-sm font-medium text-gray-900">{displayText || 'Changement d\'état'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-xs text-gray-500">
                            {change.timestamp && new Date(change.timestamp.seconds * 1000).toLocaleString('fr-FR')}
                          </p>
                          {change.changedBy && (
                            <p className="text-xs text-gray-600">
                              par <span className="font-medium">{userNamesMap.get(change.changedBy) || change.changedBy}</span>
                            </p>
                          )}
                        </div>
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

      {/* Change State Modal (Flow Mode) */}
      {isChangeStateModalOpen && hasFlow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Changer l'étape</h3>
              
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
                    {availableSteps.map((step: typeof availableSteps[0]) => (
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
                    placeholder="Ajouter une note pour ce changement d'étape..."
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
              <Button
                variant="outline"
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

      {/* Change Status Modal (Simple Mode) */}
      {isChangeStatusModalOpen && !hasFlow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Changer le statut</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Statut actuel
                  </label>
                  <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-600">
                    {getStatusBadge(production.status)}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nouveau statut <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as typeof newStatus)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="draft">Brouillon</option>
                    <option value="in_progress">En cours</option>
                    <option value="ready">Prêt</option>
                    <option value="published">Publié</option>
                    <option value="cancelled">Annulé</option>
                    {production.status !== 'closed' && <option value="closed">Fermé</option>}
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
                    placeholder="Ajouter une note pour ce changement de statut..."
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsChangeStatusModalOpen(false);
                  setNewStatus('draft');
                  setStateChangeNote('');
                }}
                disabled={isChangingState}
              >
                Annuler
              </Button>
              <Button
                onClick={handleChangeStatus}
                disabled={isChangingState || newStatus === production.status}
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
        }}
        onChargeCreated={async (newCharge) => {
          if (!production) return;
          try {
            // Add charge snapshot to production
            const snapshot: ProductionChargeRef = {
              chargeId: newCharge.id,
              name: newCharge.name || newCharge.description || '',
              amount: newCharge.amount,
              type: newCharge.type || 'custom',
              date: newCharge.date
            };
            
            // Only include optional fields if they have values
            if (newCharge.description) {
              snapshot.description = newCharge.description;
            }
            if (newCharge.category) {
              snapshot.category = newCharge.category;
            }
            
            const updatedCharges = [
              ...(production.charges || []),
              snapshot
            ];
            
            await updateProductionData(production.id, { charges: updatedCharges });
            const chargeTypeLabel = newCharge.type === 'fixed' ? 'fixe' : 'personnalisée';
            showSuccessToast(`Charge ${chargeTypeLabel} ajoutée à la production`);
            setIsChargeModalOpen(false);
          } catch (error: any) {
            showErrorToast(error.message || 'Erreur lors de l\'ajout de la charge à la production');
          }
        }}
        onSuccess={() => {
          setIsChargeModalOpen(false);
        }}
      />

      {/* Fixed Charge Selection Modal */}
      {isSelectFixedChargeModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="p-6 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Sélectionner une charge fixe</h2>
                <button
                  onClick={() => {
                    setIsSelectFixedChargeModalOpen(false);
                    setSelectedFixedChargeId(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto px-6">
              {fixedCharges.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-2">Aucune charge fixe disponible</p>
                  <p className="text-sm text-gray-400">
                    Créez une charge fixe dans la page Charges pour la réutiliser
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {fixedCharges
                    .filter(charge => !(production.charges || []).some((c: ProductionChargeRef) => c.chargeId === charge.id))
                    .map((charge) => {
                      const categoryLabels: Record<string, string> = {
                        main_oeuvre: 'Main d\'œuvre',
                        overhead: 'Frais généraux',
                        transport: 'Transport',
                        packaging: 'Emballage',
                        utilities: 'Services publics',
                        equipment: 'Équipement',
                        other: 'Autre'
                      };
                      
                      const isSelected = selectedFixedChargeId === charge.id;
                      
                      return (
                        <button
                          key={charge.id}
                          onClick={() => setSelectedFixedChargeId(charge.id)}
                          className={`w-full text-left p-4 border-2 rounded-md transition-colors ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                  isSelected 
                                    ? 'border-blue-500 bg-blue-500' 
                                    : 'border-gray-300'
                                }`}>
                                  {isSelected && <Check size={12} className="text-white" />}
                                </div>
                                <div className="font-medium text-gray-900">
                                  {charge.name || charge.description}
                                </div>
                              </div>
                              {charge.description && charge.name && charge.name !== charge.description && (
                                <div className="text-sm text-gray-500 mt-1 ml-6">{charge.description}</div>
                              )}
                              {charge.category && (
                                <div className="text-xs text-gray-400 mt-1 ml-6">
                                  {categoryLabels[charge.category] || charge.category}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-gray-900">
                                {formatPrice(charge.amount)}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200 flex-shrink-0 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsSelectFixedChargeModalOpen(false);
                  setSelectedFixedChargeId(null);
                }}
              >
                Annuler
              </Button>
              <Button
                onClick={async () => {
                  if (!production || !selectedFixedChargeId || isAddingFixedCharge) return;
                  
                  const selectedCharge = fixedCharges.find(c => c.id === selectedFixedChargeId);
                  if (!selectedCharge) return;
                  
                  setIsAddingFixedCharge(true);
                  try {
                    const snapshot: ProductionChargeRef = {
                      chargeId: selectedCharge.id,
                      name: selectedCharge.name || selectedCharge.description || '',
                      amount: selectedCharge.amount,
                      type: 'fixed' as const,
                      date: selectedCharge.date
                    };
                    
                    // Only include optional fields if they have values
                    if (selectedCharge.description) {
                      snapshot.description = selectedCharge.description;
                    }
                    if (selectedCharge.category) {
                      snapshot.category = selectedCharge.category;
                    }
                    
                    const updatedCharges = [
                      ...(production.charges || []),
                      snapshot
                    ];
                    
                    await updateProductionData(production.id, { charges: updatedCharges });
                    showSuccessToast('Charge fixe ajoutée à la production');
                    setIsSelectFixedChargeModalOpen(false);
                    setSelectedFixedChargeId(null);
                  } catch (error: any) {
                    console.error('Error adding fixed charge to production:', error);
                    showErrorToast(error.message || 'Erreur lors de l\'ajout de la charge');
                  } finally {
                    setIsAddingFixedCharge(false);
                  }
                }}
                disabled={!selectedFixedChargeId || isAddingFixedCharge}
                isLoading={isAddingFixedCharge}
                icon={!isAddingFixedCharge ? <Check size={16} /> : undefined}
              >
                {isAddingFixedCharge ? 'Ajout en cours...' : 'Confirmer'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Publish Production Modal */}
      <PublishProductionModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        production={production}
        onSuccess={() => {
          // Production will update automatically via subscription
        }}
      />

      <AddArticleModal
        isOpen={isAddArticleModalOpen}
        onClose={() => setIsAddArticleModalOpen(false)}
        onSuccess={() => {
          setIsAddArticleModalOpen(false);
          // Production will be updated via subscription
        }}
        production={production}
      />

      {/* Delete Production Confirmation Modal */}
      <Modal
        isOpen={isDeleteProductionModalOpen}
        onClose={() => setIsDeleteProductionModalOpen(false)}
        title="Supprimer la production"
        footer={
          <ModalFooter
            onCancel={() => setIsDeleteProductionModalOpen(false)}
            onConfirm={handleDeleteProduction}
            confirmText="Supprimer"
            cancelText="Annuler"
            isLoading={isDeletingProduction}
            isDanger
          />
        }
      >
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Êtes-vous sûr de vouloir supprimer la production "{production?.name}" ?
          </p>
          <p className="text-sm text-red-600">
            Cette action est irréversible.
          </p>
        </div>
      </Modal>

      {/* Remove Charge Confirmation Modal */}
      <Modal
        isOpen={isRemoveChargeModalOpen}
        onClose={() => {
          setIsRemoveChargeModalOpen(false);
          setChargeToRemove(null);
        }}
        title={chargeToRemove?.type === 'fixed' ? 'Retirer la charge fixe' : 'Supprimer la charge personnalisée'}
        footer={
          <ModalFooter
            onCancel={() => {
              setIsRemoveChargeModalOpen(false);
              setChargeToRemove(null);
            }}
            onConfirm={async () => {
              if (!chargeToRemove || !production) return;
              
              setDeletingChargeId(chargeToRemove.chargeId);
              try {
                if (chargeToRemove.type === 'fixed') {
                  // Remove charge from production.charges array (fixed charges are reusable)
                  const updatedCharges = (production.charges || []).filter(
                    (c: ProductionChargeRef) => c.chargeId !== chargeToRemove.chargeId
                  );
                  await updateProductionData(production.id, { charges: updatedCharges });
                  showSuccessToast('Charge fixe retirée de la production');
                } else {
                  // For custom charges, we can also just remove from production
                  // (they're production-specific, so removing from production is effectively deleting)
                  const updatedCharges = (production.charges || []).filter(
                    (c: ProductionChargeRef) => c.chargeId !== chargeToRemove.chargeId
                  );
                  await updateProductionData(production.id, { charges: updatedCharges });
                  showSuccessToast('Charge personnalisée retirée de la production');
                }
                setIsRemoveChargeModalOpen(false);
                setChargeToRemove(null);
              } catch (error: any) {
                showErrorToast(error.message || 'Erreur lors de la suppression');
              } finally {
                setDeletingChargeId(null);
              }
            }}
            confirmText={chargeToRemove?.type === 'fixed' ? 'Retirer' : 'Supprimer'}
            cancelText="Annuler"
            isLoading={deletingChargeId === chargeToRemove?.chargeId}
            isDanger={chargeToRemove?.type !== 'fixed'}
          />
        }
      >
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            {chargeToRemove?.type === 'fixed' 
              ? 'Êtes-vous sûr de vouloir retirer cette charge fixe de la production ? La charge restera disponible pour d\'autres productions.'
              : 'Êtes-vous sûr de vouloir supprimer cette charge personnalisée ?'}
          </p>
          {chargeToRemove && (
            <div className="bg-gray-50 rounded-md p-3 text-left">
              <p className="text-sm font-medium text-gray-900">{chargeToRemove.name || chargeToRemove.description}</p>
              <p className="text-sm text-gray-600">{formatPrice(chargeToRemove.amount || 0)}</p>
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
};

export default ProductionDetail;

