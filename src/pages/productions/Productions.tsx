// Productions list page
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Eye, Loader2, Search, Filter, X, Trash2, Edit2, Package, List, Columns, Workflow } from 'lucide-react';
import { SkeletonProductions, Button, Input, Modal, ModalFooter } from "@components/common";
import { useProductions, useProductionFlows, useProductionCategories, useProductionFlowSteps } from '@hooks/data/useFirestore';
import { canPublishProduction } from '@utils/productions/flowValidation';
import { formatPrice } from '@utils/formatting/formatPrice';
import CreateProductionModal from '@components/productions/CreateProductionModal';
import PublishProductionModal from '@components/productions/PublishProductionModal';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import { formatCreatorName } from '@utils/business/employeeUtils';
import { usePermissionCheck } from '@components/permissions';
import { RESOURCES } from '@constants/resources';
import type { Production } from '../../types/models';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const Productions: React.FC = () => {
  const { productions, loading, deleteProduction, changeState, changeStatus } = useProductions();
  const { flows } = useProductionFlows();
  const { categories } = useProductionCategories();
  const { flowSteps } = useProductionFlowSteps();
  const { company, user } = useAuth();
  const { canDelete } = usePermissionCheck(RESOURCES.PRODUCTIONS);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract companyId from URL if in company route
  const isCompanyRoute = location.pathname.startsWith('/company/');
  const urlCompanyId = isCompanyRoute ? location.pathname.split('/')[2] : null;
  const companyId = urlCompanyId || company?.id || null;
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deletingProductionId, setDeletingProductionId] = useState<string | null>(null);
  const [selectedProduction, setSelectedProduction] = useState<Production | null>(null);
  const [isChangeStateModalOpen, setIsChangeStateModalOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [newStepId, setNewStepId] = useState('');
  const [newStatus, setNewStatus] = useState<'draft' | 'in_progress' | 'ready' | 'published' | 'cancelled' | 'closed'>('draft');
  const [stateChangeNote, setStateChangeNote] = useState('');
  const [isChangingState, setIsChangingState] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedFlow, setSelectedFlow] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStep, setSelectedStep] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [costRange, setCostRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [showFilters, setShowFilters] = useState(false);
  
  // View mode state
  type ViewMode = 'list' | 'steps' | 'flows';
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedFlowForStepsView, setSelectedFlowForStepsView] = useState<string>('all');
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Drag and drop sensors - optimized for mobile touch
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts (prevents accidental drags on mobile)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const [activeId, setActiveId] = useState<string | null>(null);

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

  const getStepName = (stepId?: string) => {
    if (!stepId) return '-';
    const step = flowSteps.find(s => s.id === stepId);
    return step?.name || 'N/A';
  };

  const handleDeleteProduction = async (production: Production, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click navigation
    
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer la production "${production.name}" ? Cette action est irréversible.`)) {
      return;
    }

    setDeletingProductionId(production.id);
    try {
      await deleteProduction(production.id);
      showSuccessToast('Production supprimée avec succès');
    } catch (error: any) {
      showErrorToast(error.message || 'Erreur lors de la suppression de la production');
    } finally {
      setDeletingProductionId(null);
    }
  };

  // Check if production can be deleted (draft or in_progress, not published, not closed)
  const canDeleteProduction = (production: Production) => {
    return (production.status === 'draft' || production.status === 'in_progress') 
      && !production.isPublished 
      && !production.isClosed;
  };

  const handleOpenChangeStateModal = (production: Production, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProduction(production);
    setNewStepId('');
    setNewStatus(production.status);
    setStateChangeNote('');
    setIsChangeStateModalOpen(true);
  };

  const handleOpenPublishModal = (production: Production, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProduction(production);
    setIsPublishModalOpen(true);
  };

  const handleChangeState = async () => {
    if (!selectedProduction || !companyId || !user) return;

    setIsChangingState(true);
    try {
      if (selectedProduction.flowId) {
        // Flow mode - change step
        if (!newStepId) {
          showErrorToast('Veuillez sélectionner une étape');
          return;
        }
        await changeState(selectedProduction.id, newStepId, stateChangeNote || undefined);
        showSuccessToast('État de la production mis à jour');
      } else {
        // Simple mode - change status
        await changeStatus(selectedProduction.id, newStatus, stateChangeNote || undefined);
        showSuccessToast('Statut de la production mis à jour');
      }
      setIsChangeStateModalOpen(false);
      setSelectedProduction(null);
      setNewStepId('');
      setNewStatus('draft');
      setStateChangeNote('');
    } catch (error: any) {
      showErrorToast(error.message || 'Erreur lors du changement d\'état');
    } finally {
      setIsChangingState(false);
    }
  };

  const handlePublishSuccess = () => {
    setIsPublishModalOpen(false);
    setSelectedProduction(null);
  };

  // Handle drag and drop
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !companyId || !user) return;

    const productionId = active.id as string;
    const newStepId = over.id as string;

    // Don't do anything if dropped in the same column
    const production = productions.find(p => p.id === productionId);
    if (!production || production.currentStepId === newStepId) return;

    // Verify the step belongs to the production's flow
    if (production.flowId) {
      const flow = flows.find(f => f.id === production.flowId);
      if (flow && !flow.stepIds.includes(newStepId)) {
        showErrorToast('Cette étape n\'appartient pas au flux de cette production');
        return;
      }
    }

    setIsChangingState(true);
    try {
      await changeState(productionId, newStepId, 'Changement d\'étape via drag & drop');
      showSuccessToast('Étape mise à jour avec succès');
    } catch (error: any) {
      showErrorToast(error.message || 'Erreur lors du changement d\'étape');
    } finally {
      setIsChangingState(false);
    }
  };

  // Get available steps for flow-based productions
  const getAvailableSteps = (production: Production) => {
    if (!production.flowId) return [];
    const flow = flows.find(f => f.id === production.flowId);
    if (!flow) return [];
    return flow.stepIds
      .map(stepId => flowSteps.find(s => s.id === stepId))
      .filter(Boolean) as typeof flowSteps;
  };

  const hasFlow = selectedProduction?.flowId ? true : false;
  const availableSteps = selectedProduction ? getAvailableSteps(selectedProduction) : [];
  const currentStep = selectedProduction?.currentStepId
    ? flowSteps.find(s => s.id === selectedProduction.currentStepId)
    : null;

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

    // Step filter
    if (selectedStep !== 'all') {
      filtered = filtered.filter(p => p.currentStepId === selectedStep);
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
  }, [productions, searchQuery, selectedStatus, selectedFlow, selectedCategory, selectedStep, dateRange, costRange]);


  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedStatus !== 'all') count++;
    if (selectedFlow !== 'all') count++;
    if (selectedCategory !== 'all') count++;
    if (selectedStep !== 'all') count++;
    if (dateRange.start || dateRange.end) count++;
    if (costRange.min || costRange.max) count++;
    return count;
  }, [selectedStatus, selectedFlow, selectedCategory, selectedStep, dateRange, costRange]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedStatus('all');
    setSelectedFlow('all');
    setSelectedCategory('all');
    setSelectedStep('all');
    setDateRange({ start: '', end: '' });
    setCostRange({ min: '', max: '' });
  };

  // Group productions by step for Kanban view
  const productionsByStep = useMemo(() => {
    const grouped: Record<string, Production[]> = {};
    
    // Get steps to display
    let stepsToShow: typeof flowSteps = [];
    if (selectedFlowForStepsView !== 'all') {
      const flow = flows.find(f => f.id === selectedFlowForStepsView);
      if (flow) {
        stepsToShow = flow.stepIds
          .map(stepId => flowSteps.find(s => s.id === stepId))
          .filter(Boolean) as typeof flowSteps;
      }
    } else {
      // Show all steps that have productions
      const stepIds = new Set(filteredProductions.map(p => p.currentStepId).filter(Boolean));
      stepsToShow = flowSteps.filter(s => stepIds.has(s.id));
    }
    
    // Group productions by step
    filteredProductions.forEach(prod => {
      const stepId = prod.currentStepId || 'no-step';
      if (!grouped[stepId]) grouped[stepId] = [];
      grouped[stepId].push(prod);
    });
    
    // Add empty steps
    stepsToShow.forEach(step => {
      if (!grouped[step.id]) grouped[step.id] = [];
    });
    
    return { grouped, steps: stepsToShow };
  }, [filteredProductions, selectedFlowForStepsView, flows, flowSteps]);

  // Group productions by flow for flow view
  const productionsByFlow = useMemo(() => {
    const grouped: Record<string, { flow: typeof flows[0] | null; productions: Production[] }> = {};
    
    filteredProductions.forEach(prod => {
      const flowId = prod.flowId || 'no-flow';
      if (!grouped[flowId]) {
        grouped[flowId] = {
          flow: flows.find(f => f.id === flowId) || null,
          productions: []
        };
      }
      grouped[flowId].productions.push(prod);
    });
    
    return grouped;
  }, [filteredProductions, flows]);

  // Production Card Component
  const ProductionCard: React.FC<{ production: Production }> = ({ production }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: production.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`bg-white rounded-lg shadow-sm border border-gray-200 mb-2 cursor-move hover:shadow-md transition-shadow touch-none ${isMobile ? 'p-2' : 'p-3'}`}
      >
        <div className={`font-medium text-gray-900 mb-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>{production.name}</div>
        {production.reference && (
          <div className={`text-gray-500 mb-2 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>Ref: {production.reference}</div>
        )}
        <div className="flex items-center justify-between mt-2">
          <div className={`font-semibold text-gray-700 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
            {formatPrice(production.calculatedCostPrice || 0)}
          </div>
          <div className={isMobile ? 'scale-75' : ''}>
            {getStatusBadge(production.status)}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (companyId) {
                navigate(`/company/${companyId}/productions/${production.id}`);
              } else {
                navigate(`/productions/${production.id}`);
              }
            }}
            className={`text-blue-600 hover:text-blue-900 ${isMobile ? 'text-[10px]' : 'text-xs'}`}
            title="Voir les détails"
          >
            <Eye size={isMobile ? 12 : 14} />
          </button>
        </div>
      </div>
    );
  };

  // Step Column Component
  const StepColumn: React.FC<{ stepId: string; stepName: string; productions: Production[] }> = ({ stepId, stepName, productions }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
    } = useSortable({ id: stepId });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`flex-shrink-0 bg-gray-50 rounded-lg p-3 ${isMobile ? 'w-64 mr-3' : 'w-72 mr-4'}`}
      >
        <div className="flex items-center justify-between mb-3" {...attributes} {...listeners}>
          <h3 className={`font-semibold text-gray-900 ${isMobile ? 'text-sm' : ''}`}>{stepName}</h3>
          <span className="bg-gray-200 text-gray-700 text-xs font-semibold px-2 py-1 rounded-full">
            {productions.length}
          </span>
        </div>
        <SortableContext items={productions.map(p => p.id)} strategy={verticalListSortingStrategy}>
          <div className={`space-y-2 min-h-[200px] ${isMobile ? 'max-h-[calc(100vh-250px)]' : 'max-h-[calc(100vh-400px)]'} overflow-y-auto`}>
            {productions.map(production => (
              <ProductionCard key={production.id} production={production} />
            ))}
            {productions.length === 0 && (
              <div className={`text-center text-gray-400 ${isMobile ? 'text-xs' : 'text-sm'} py-8`}>
                Aucune production
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    );
  };

  if (loading) {
    return <SkeletonProductions viewMode={viewMode} />;
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Productions</h1>
          <p className="text-gray-600">Gérez vos productions et leur évolution</p>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          {/* View Mode Selector */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Vue liste"
            >
              <List size={16} className="inline mr-1" />
              Liste
            </button>
            <button
              onClick={() => setViewMode('steps')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'steps'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Vue par étapes"
            >
              <Columns size={16} className="inline mr-1" />
              Étapes
            </button>
            <button
              onClick={() => setViewMode('flows')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'flows'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Vue par flux"
            >
              <Workflow size={16} className="inline mr-1" />
              Flux
            </button>
          </div>
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

            {/* Step Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Étape
              </label>
              <select
                value={selectedStep}
                onChange={(e) => setSelectedStep(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Toutes les étapes</option>
                {flowSteps.map(step => (
                  <option key={step.id} value={step.id}>{step.name}</option>
                ))}
              </select>
            </div>

            {/* Flow Filter for Steps View */}
            {viewMode === 'steps' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filtrer par flux (vue étapes)
                </label>
                <select
                  value={selectedFlowForStepsView}
                  onChange={(e) => {
                    setSelectedFlowForStepsView(e.target.value);
                    setVisibleColumnsStart(0);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Tous les flux</option>
                  {flows.map(flow => (
                    <option key={flow.id} value={flow.id}>{flow.name}</option>
                  ))}
                </select>
              </div>
            )}

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
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
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
                  Étape
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Créé par
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
                    <div 
                      onClick={() => {
                        if (companyId) {
                          navigate(`/company/${companyId}/productions/${production.id}`);
                        } else {
                          navigate(`/productions/${production.id}`);
                        }
                      }}
                      className="text-sm font-medium text-gray-900 hover:text-gray-700 cursor-pointer transition-colors"
                    >
                      {production.name}
                    </div>
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
                    <div className="text-sm text-gray-500">{getStepName(production.currentStepId)}</div>
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {formatCreatorName(production.createdBy)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
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
                      {!production.isClosed && !production.isPublished && (
                        <>
                          <button
                            onClick={(e) => handleOpenChangeStateModal(production, e)}
                            className="text-orange-600 hover:text-orange-900"
                            title="Changer l'état"
                          >
                            <Edit2 size={16} />
                          </button>
                          {(() => {
                            const flow = production.flowId ? flows.find(f => f.id === production.flowId) : null;
                            const publishCheck = canPublishProduction(production, flow?.stepIds);
                            return (
                              <button
                                onClick={(e) => {
                                  if (publishCheck.canPublish) {
                                    handleOpenPublishModal(production, e);
                                  } else {
                                    showErrorToast(publishCheck.reason || 'Impossible de publier cette production');
                                  }
                                }}
                                disabled={!publishCheck.canPublish}
                                className={`${
                                  publishCheck.canPublish
                                    ? 'text-green-600 hover:text-green-900'
                                    : 'text-gray-400 cursor-not-allowed opacity-50'
                                }`}
                                title={publishCheck.canPublish ? 'Publier' : publishCheck.reason || 'Impossible de publier'}
                              >
                                <Package size={16} />
                              </button>
                            );
                          })()}
                        </>
                      )}
                      {canDelete && canDeleteProduction(production) && (
                        <button
                          onClick={(e) => handleDeleteProduction(production, e)}
                          disabled={deletingProductionId === production.id}
                          className={`text-red-600 hover:text-red-900 ${
                            deletingProductionId === production.id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          title="Supprimer la production"
                        >
                          {deletingProductionId === production.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ) : viewMode === 'steps' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className={`bg-white rounded-lg shadow ${isMobile ? 'p-2' : 'p-4'}`}>
            <div className={`flex items-center justify-between ${isMobile ? 'mb-2' : 'mb-4'}`}>
              <h2 className={`font-semibold text-gray-900 ${isMobile ? 'text-base' : 'text-lg'}`}>
                {isMobile ? 'Étapes' : 'Vue par Étapes'}
                {selectedFlowForStepsView !== 'all' && (
                  <span className={`font-normal text-gray-600 ml-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    - {getFlowName(selectedFlowForStepsView)}
                  </span>
                )}
              </h2>
            </div>
            <div className="overflow-x-auto overflow-y-hidden -mx-2 px-2 pb-2" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin' }}>
              <div className="flex min-w-max">
                <SortableContext
                  items={productionsByStep.steps.map(s => s.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  {productionsByStep.steps.map(step => (
                    <StepColumn
                      key={step.id}
                      stepId={step.id}
                      stepName={step.name}
                      productions={productionsByStep.grouped[step.id] || []}
                    />
                  ))}
                </SortableContext>
              </div>
            </div>
          </div>
          <DragOverlay>
            {activeId ? (
              <div className="bg-white rounded-lg shadow-lg border-2 border-blue-500 p-3 w-64">
                <div className="font-medium text-sm text-gray-900">
                  {productions.find(p => p.id === activeId)?.name}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className={`bg-white rounded-lg shadow ${isMobile ? 'p-2' : 'p-4'}`}>
          <h2 className={`font-semibold text-gray-900 ${isMobile ? 'text-base mb-2' : 'text-lg mb-4'}`}>
            {isMobile ? 'Flux' : 'Vue par Flux'}
          </h2>
          <div className="overflow-x-auto overflow-y-hidden -mx-2 px-2 pb-2" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin' }}>
            <div className={`flex min-w-max ${isMobile ? 'gap-2' : 'gap-4'}`}>
              {Object.entries(productionsByFlow).map(([flowId, { flow, productions: flowProductions }]) => {
                  // Group productions by step within this flow
                  const byStep: Record<string, Production[]> = {};
                  flowProductions.forEach(prod => {
                    const stepId = prod.currentStepId || 'no-step';
                    if (!byStep[stepId]) byStep[stepId] = [];
                    byStep[stepId].push(prod);
                  });

                  const flowStepsList = flow
                    ? flow.stepIds.map(id => flowSteps.find(s => s.id === id)).filter(Boolean)
                    : [];

                  return (
                    <div key={flowId} className={`flex-shrink-0 bg-gray-50 rounded-lg ${isMobile ? 'w-64 p-2' : 'w-80 p-4'}`}>
                      <h3 className={`font-semibold text-gray-900 mb-2 ${isMobile ? 'text-sm' : ''}`}>
                        {flow?.name || 'Sans flux'}
                      </h3>
                      <div className={`text-gray-600 mb-3 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
                        {flowProductions.length} production(s)
                      </div>
                      <div className={`space-y-3 ${isMobile ? 'max-h-[calc(100vh-200px)]' : 'max-h-[calc(100vh-300px)]'} overflow-y-auto`}>
                        {flowStepsList.map(step => {
                          if (!step) return null;
                          const stepProds = byStep[step.id] || [];
                          return (
                            <div key={step.id} className="bg-white rounded p-2">
                              <div className="flex items-center justify-between mb-2">
                                <span className={`font-medium text-gray-700 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>{step.name}</span>
                                <span className={`bg-gray-200 text-gray-600 px-2 py-0.5 rounded ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
                                  {stepProds.length}
                                </span>
                              </div>
                              <div className="space-y-1">
                                {stepProds.map(prod => (
                                  <div
                                    key={prod.id}
                                    onClick={() => {
                                      if (companyId) {
                                        navigate(`/company/${companyId}/productions/${prod.id}`);
                                      } else {
                                        navigate(`/productions/${prod.id}`);
                                      }
                                    }}
                                    className={`p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer ${isMobile ? 'text-[10px]' : 'text-xs'}`}
                                  >
                                    <div className="font-medium text-gray-900">{prod.name}</div>
                                    <div className="text-gray-600">{formatPrice(prod.calculatedCostPrice || 0)}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        {flowStepsList.length === 0 && (
                          <div className={`text-center text-gray-400 py-4 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                            Aucune étape définie
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
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

      {/* Change State Modal */}
      {isChangeStateModalOpen && selectedProduction && (
        <Modal
          isOpen={isChangeStateModalOpen}
          onClose={() => {
            setIsChangeStateModalOpen(false);
            setSelectedProduction(null);
            setNewStepId('');
            setNewStatus('draft');
            setStateChangeNote('');
          }}
          title={hasFlow ? "Changer l'étape" : "Changer le statut"}
          size="md"
          footer={
            <ModalFooter
              onCancel={() => {
                setIsChangeStateModalOpen(false);
                setSelectedProduction(null);
                setNewStepId('');
                setNewStatus('draft');
                setStateChangeNote('');
              }}
              onConfirm={handleChangeState}
              cancelText="Annuler"
              confirmText={isChangingState ? 'En cours...' : 'Confirmer'}
              isLoading={isChangingState}
              disabled={isChangingState || (hasFlow ? !newStepId : false)}
            />
          }
        >
          <div className="space-y-4">
            {hasFlow ? (
              <>
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
                    {availableSteps.map((step) => (
                      <option key={step.id} value={step.id}>
                        {step.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
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
                  <option value="closed">Fermé</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note (optionnel)
              </label>
              <textarea
                value={stateChangeNote}
                onChange={(e) => setStateChangeNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Ajouter une note pour ce changement..."
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Publish Production Modal */}
      {isPublishModalOpen && selectedProduction && (
        <PublishProductionModal
          isOpen={isPublishModalOpen}
          onClose={() => {
            setIsPublishModalOpen(false);
            setSelectedProduction(null);
          }}
          production={selectedProduction}
          onSuccess={handlePublishSuccess}
        />
      )}
    </div>
  );
};

export default Productions;

