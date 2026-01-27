// Production Flows page
import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Loader2, ArrowUp, ArrowDown, X, Search, ChevronRight, ChevronDown } from 'lucide-react';
import { SkeletonTable, Button, Modal, ModalFooter } from "@components/common";
import { useProductionFlows, useProductionFlowSteps } from '@hooks/data/useFirestore';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import { formatCreatorName } from '@utils/business/employeeUtils';
import { usePermissionCheck } from '@components/permissions';
import { RESOURCES } from '@constants/resources';
import type { ProductionFlow } from '../../types/models';

const Flows: React.FC = () => {
  const { flows, loading: flowsLoading, addFlow, updateFlow, deleteFlow } = useProductionFlows();
  const { flowSteps, loading: stepsLoading } = useProductionFlowSteps();
  const { canDelete } = usePermissionCheck(RESOURCES.PRODUCTIONS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<ProductionFlow | null>(null);
  const [deletingFlow, setDeletingFlow] = useState<ProductionFlow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFlowId, setExpandedFlowId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isDefault: false,
    selectedStepIds: [] as string[]
  });

  const loading = flowsLoading || stepsLoading;

  const handleOpenModal = (flow?: ProductionFlow) => {
    if (flow) {
      setEditingFlow(flow);
      setFormData({
        name: flow.name,
        description: flow.description || '',
        isDefault: flow.isDefault || false,
        selectedStepIds: flow.stepIds || []
      });
    } else {
      setEditingFlow(null);
      setFormData({
        name: '',
        description: '',
        isDefault: false,
        selectedStepIds: []
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingFlow(null);
    setSearchQuery('');
    setFormData({
      name: '',
      description: '',
      isDefault: false,
      selectedStepIds: []
    });
  };

  const handleToggleStep = (stepId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedStepIds: prev.selectedStepIds.includes(stepId)
        ? prev.selectedStepIds.filter(id => id !== stepId)
        : [...prev.selectedStepIds, stepId]
    }));
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const newStepIds = [...formData.selectedStepIds];
    if (direction === 'up' && index > 0) {
      [newStepIds[index - 1], newStepIds[index]] = [newStepIds[index], newStepIds[index - 1]];
    } else if (direction === 'down' && index < newStepIds.length - 1) {
      [newStepIds[index], newStepIds[index + 1]] = [newStepIds[index + 1], newStepIds[index]];
    }
    setFormData(prev => ({ ...prev, selectedStepIds: newStepIds }));
  };

  const handleRemoveStep = (stepId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedStepIds: prev.selectedStepIds.filter(id => id !== stepId)
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showErrorToast('Le nom du flux est requis');
      return;
    }

    if (formData.selectedStepIds.length === 0) {
      showErrorToast('Le flux doit contenir au moins une étape');
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const flowData: Omit<ProductionFlow, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'userId'> = {
        name: formData.name.trim(),
        isDefault: formData.isDefault,
        isActive: true,
        stepIds: formData.selectedStepIds
      };

      // Only add optional fields if they have values (Firebase doesn't accept undefined)
      if (formData.description.trim()) {
        flowData.description = formData.description.trim();
      }

      if (editingFlow) {
        await updateFlow(editingFlow.id, flowData);
        showSuccessToast('Flux mis à jour avec succès');
      } else {
        await addFlow(flowData);
        showSuccessToast('Flux créé avec succès');
      }
      handleCloseModal();
    } catch (error: any) {
      showErrorToast(error.message || 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingFlow) return;

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await deleteFlow(deletingFlow.id);
      showSuccessToast('Flux supprimé avec succès');
      setIsDeleteModalOpen(false);
      setDeletingFlow(null);
    } catch (error: any) {
      showErrorToast(error.message || 'Impossible de supprimer le flux');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedSteps = useMemo(() => {
    return formData.selectedStepIds
      .map(id => flowSteps.find(step => step.id === id))
      .filter(Boolean) as typeof flowSteps;
  }, [formData.selectedStepIds, flowSteps]);

  const availableSteps = useMemo(() => {
    const filtered = flowSteps.filter(step => !formData.selectedStepIds.includes(step.id));
    
    // Filter by search query (case-insensitive search on name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      return filtered.filter(step => 
        step.name.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [flowSteps, formData.selectedStepIds, searchQuery]);

  const handleExpand = (flowId: string) => {
    setExpandedFlowId((prev) => (prev === flowId ? null : flowId));
  };

  // Map flow steps by flow ID for quick lookup
  const stepsByFlow = useMemo(() => {
    const map = new Map<string, typeof flowSteps>();
    flows.forEach(flow => {
      const flowStepList = flow.stepIds
        .map(stepId => flowSteps.find(step => step.id === stepId))
        .filter(Boolean) as typeof flowSteps;
      map.set(flow.id, flowStepList);
    });
    return map;
  }, [flows, flowSteps]);

  if (loading) {
    return <SkeletonTable rows={5} />;
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Flux de Production</h1>
          <p className="text-gray-600">Gérez les flux de production avec leurs étapes</p>
        </div>
        <Button
          icon={<Plus size={16} />}
          onClick={() => handleOpenModal()}
        >
          Nouveau Flux
        </Button>
      </div>

      {flows.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 mb-4">Aucun flux créé</p>
          <Button onClick={() => handleOpenModal()}>Créer le premier flux</Button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                    {/* Chevron column */}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Étapes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Par défaut
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
                {flows.map((flow) => {
                  const isExpanded = expandedFlowId === flow.id;
                  const flowStepList = stepsByFlow.get(flow.id) || [];
                  return (
                    <React.Fragment key={flow.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-center">
                          <button
                            onClick={() => handleExpand(flow.id)}
                            className="text-gray-500 hover:text-gray-700 transition-colors"
                            aria-label="Toggle steps"
                          >
                            {isExpanded ? (
                              <ChevronDown size={18} className="text-blue-600" />
                            ) : (
                              <ChevronRight size={18} />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{flow.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500">{flow.description || '-'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500">
                            {flow.stepCount || flow.stepIds?.length || 0} étape(s)
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {flow.isDefault ? (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              Oui
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">
                            {formatCreatorName(flow.createdBy)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleOpenModal(flow)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit2 size={16} />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => {
                                  setDeletingFlow(flow);
                                  setIsDeleteModalOpen(true);
                                }}
                                className="text-red-600 hover:text-red-900"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-0 py-0">
                            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                              {flowStepList.length === 0 ? (
                                <div className="text-center py-4">
                                  <p className="text-sm text-gray-500">Aucune étape dans ce flux</p>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
                                    Étapes du flux ({flowStepList.length})
                                  </h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                    {flowStepList.map((step, index) => (
                                      <div
                                        key={step.id}
                                        className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-md hover:border-blue-300 transition-colors"
                                      >
                                        <div className="flex-shrink-0">
                                          <span className="text-xs font-medium text-gray-500 w-6 inline-block">
                                            {index + 1}.
                                          </span>
                                        </div>
                                        {step.image ? (
                                          <img
                                            src={step.image}
                                            alt={step.name}
                                            className="w-8 h-8 object-cover rounded flex-shrink-0"
                                          />
                                        ) : (
                                          <div className="w-8 h-8 bg-gray-200 rounded flex-shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-gray-900 truncate">
                                            {step.name}
                                          </p>
                                          {step.description && (
                                            <p className="text-xs text-gray-500 truncate mt-0.5">
                                              {step.description}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingFlow ? 'Modifier le flux' : 'Nouveau flux'}
        size="lg"
        footer={
          <ModalFooter
            onCancel={handleCloseModal}
            onConfirm={handleSubmit}
            cancelText="Annuler"
            confirmText={editingFlow ? 'Mettre à jour' : 'Créer'}
            isLoading={isSubmitting}
            disabled={isSubmitting || formData.selectedStepIds.length === 0}
          />
        }
      >
        <div className="space-y-5">
          {/* Basic Info Section */}
          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Production Standard"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Description optionnelle"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isDefault" className="ml-2 block text-sm text-gray-700">
                Flux par défaut
              </label>
            </div>
          </div>

          {/* Steps Section */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Étapes <span className="text-red-500">*</span>
              {selectedSteps.length > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-500">
                  ({selectedSteps.length} sélectionnée{selectedSteps.length > 1 ? 's' : ''})
                </span>
              )}
            </label>

            {/* Selected Steps - Ordered List */}
            {selectedSteps.length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-xs text-gray-500 mb-2">Ordre des étapes :</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedSteps.map((step, index) => (
                    <div
                      key={step.id}
                      className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-md"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-600 w-6 flex-shrink-0">{index + 1}.</span>
                        {step.image ? (
                          <img
                            src={step.image}
                            alt={step.name}
                            className="w-6 h-6 object-cover rounded flex-shrink-0"
                          />
                        ) : (
                          <div className="w-6 h-6 bg-gray-200 rounded flex-shrink-0" />
                        )}
                        <span className="text-sm text-gray-900">{step.name}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <button
                          onClick={() => handleMoveStep(index, 'up')}
                          disabled={index === 0}
                          className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Déplacer vers le haut"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          onClick={() => handleMoveStep(index, 'down')}
                          disabled={index === selectedSteps.length - 1}
                          className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Déplacer vers le bas"
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          onClick={() => handleRemoveStep(step.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 transition-colors"
                          title="Retirer"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available Steps - Search and Badge Grid */}
            {flowSteps.filter(step => !formData.selectedStepIds.includes(step.id)).length > 0 && (
              <div>
                <div className="mb-2 sm:mb-3">
                  <label className="block text-xs text-gray-500 mb-1.5">
                    Rechercher et ajouter des étapes :
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 sm:pl-10 pr-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Rechercher une étape..."
                    />
                  </div>
                </div>

                {availableSteps.length > 0 ? (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">
                      {availableSteps.length} étape{availableSteps.length > 1 ? 's' : ''} disponible{availableSteps.length > 1 ? 's' : ''}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {availableSteps.slice(0, 8).map((step) => (
                        <button
                          key={step.id}
                          onClick={() => {
                            handleToggleStep(step.id);
                            setSearchQuery(''); // Clear search after adding
                          }}
                          className="flex items-center gap-2 p-2 border border-gray-300 rounded-md hover:bg-blue-50 hover:border-blue-300 transition-all group w-full"
                          title={step.name}
                        >
                          {step.image ? (
                            <img
                              src={step.image}
                              alt={step.name}
                              className="w-6 h-6 object-cover rounded flex-shrink-0"
                            />
                          ) : (
                            <div className="w-6 h-6 bg-gray-200 rounded flex-shrink-0" />
                          )}
                          <span className="text-xs text-gray-700 truncate flex-1 text-left group-hover:text-blue-600">
                            {step.name}
                          </span>
                        </button>
                      ))}
                    </div>
                    {availableSteps.length > 8 && (
                      <p className="text-xs text-gray-400 mt-2 text-center">
                        {availableSteps.length - 8} autre{availableSteps.length - 8 > 1 ? 's' : ''} étape{availableSteps.length - 8 > 1 ? 's' : ''} disponible{availableSteps.length - 8 > 1 ? 's' : ''}. Utilisez la recherche pour les trouver.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-sm text-gray-500 bg-gray-50 rounded border border-gray-200">
                    Aucune étape trouvée pour "{searchQuery}"
                  </div>
                )}
              </div>
            )}

            {flowSteps.length === 0 && (
              <div className="text-center py-4 text-sm text-gray-500 bg-gray-50 rounded border border-gray-200">
                Aucune étape disponible. Créez d'abord des étapes.
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingFlow(null);
        }}
        title="Supprimer le flux"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Êtes-vous sûr de vouloir supprimer le flux <strong>{deletingFlow?.name}</strong> ?
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              Cette action ne peut pas être annulée. Les productions utilisant ce flux devront être mises à jour.
            </p>
          </div>
        </div>

        footer={
          <ModalFooter
            onCancel={() => {
              setIsDeleteModalOpen(false);
              setDeletingFlow(null);
            }}
            onConfirm={handleDelete}
            cancelText="Annuler"
            confirmText="Supprimer"
            isLoading={isSubmitting}
            isDanger={true}
            disabled={isSubmitting}
          />
        }
      </Modal>
    </div>
  );
};

export default Flows;

