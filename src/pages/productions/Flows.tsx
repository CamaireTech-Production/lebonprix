// Production Flows page
import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Loader2, ArrowUp, ArrowDown, X } from 'lucide-react';
import { Button, Modal, ModalFooter, LoadingScreen } from '@components/common';
import { useProductionFlows, useProductionFlowSteps } from '@hooks/data/useFirestore';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import type { ProductionFlow } from '../../types/models';

const Flows: React.FC = () => {
  const { flows, loading: flowsLoading, addFlow, updateFlow, deleteFlow } = useProductionFlows();
  const { flowSteps, loading: stepsLoading } = useProductionFlowSteps();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<ProductionFlow | null>(null);
  const [deletingFlow, setDeletingFlow] = useState<ProductionFlow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    return flowSteps.filter(step => !formData.selectedStepIds.includes(step.id));
  }, [flowSteps, formData.selectedStepIds]);

  if (loading) {
    return <LoadingScreen />;
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
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {flows.map((flow) => (
                <tr key={flow.id} className="hover:bg-gray-50">
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
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(flow)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setDeletingFlow(flow);
                          setIsDeleteModalOpen(true);
                        }}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingFlow ? 'Modifier le flux' : 'Nouveau flux'}
        size="large"
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
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Production Standard, Commandes Personnalisées..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Description optionnelle du flux"
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
              Définir comme flux par défaut
            </label>
          </div>

          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Étapes dans ce flux <span className="text-red-500">*</span>
            </label>

            {/* Selected Steps (ordered) */}
            {selectedSteps.length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-xs text-gray-500 mb-2">Ordre des étapes (glisser pour réorganiser) :</p>
                {selectedSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-600 w-6">{index + 1}.</span>
                      {step.image ? (
                        <img
                          src={step.image}
                          alt={step.name}
                          className="w-6 h-6 object-cover rounded-md"
                        />
                      ) : (
                        <div className="w-4 h-4 bg-gray-200 rounded-md" />
                      )}
                      <span className="text-sm text-gray-900">{step.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMoveStep(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        onClick={() => handleMoveStep(index, 'down')}
                        disabled={index === selectedSteps.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        onClick={() => handleRemoveStep(step.id)}
                        className="p-1 text-red-400 hover:text-red-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Available Steps */}
            {availableSteps.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Étapes disponibles :</p>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {availableSteps.map((step) => (
                    <button
                      key={step.id}
                      onClick={() => handleToggleStep(step.id)}
                      className="flex items-center gap-2 p-2 text-left border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      {step.image ? (
                        <img
                          src={step.image}
                          alt={step.name}
                          className="w-4 h-4 object-cover rounded-md"
                        />
                      ) : (
                        <div className="w-3 h-3 bg-gray-200 rounded-md" />
                      )}
                      <span className="text-sm text-gray-700">{step.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {flowSteps.length === 0 && (
              <div className="text-center py-4 text-sm text-gray-500">
                Aucune étape disponible. Créez d'abord des étapes dans la section "Étapes de Production".
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

