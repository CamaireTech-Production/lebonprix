// Production Flow Steps page
import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Loader2, Upload, X } from 'lucide-react';
import { Button, Modal, ModalFooter, LoadingScreen } from '@components/common';
import { useAuth } from '@contexts/AuthContext';
import { useProductionFlowSteps } from '@hooks/data/useFirestore';
import { FirebaseStorageService } from '@services/core/firebaseStorage';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import imageCompression from 'browser-image-compression';
import type { ProductionFlowStep } from '../../types/models';

const FlowSteps: React.FC = () => {
  const { user, company } = useAuth();
  const { flowSteps, loading, error, addFlowStep, updateFlowStep, deleteFlowStep } = useProductionFlowSteps();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<ProductionFlowStep | null>(null);
  const [deletingStep, setDeletingStep] = useState<ProductionFlowStep | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    imagePath: '',
    compressedImageFile: null as File | null,
    estimatedDuration: ''
  });

  const handleOpenModal = (step?: ProductionFlowStep) => {
    if (step) {
      setEditingStep(step);
      setFormData({
        name: step.name,
        description: step.description || '',
        image: step.image || '',
        imagePath: step.imagePath || '',
        compressedImageFile: null,
        estimatedDuration: step.estimatedDuration?.toString() || ''
      });
    } else {
      setEditingStep(null);
      setFormData({
        name: '',
        description: '',
        image: '',
        imagePath: '',
        compressedImageFile: null,
        estimatedDuration: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingStep(null);
    setFormData({
      name: '',
      description: '',
      image: '',
      imagePath: '',
      compressedImageFile: null,
      estimatedDuration: ''
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      showErrorToast('Veuillez sélectionner un fichier image valide');
      return;
    }

    const maxSizeBeforeCompression = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSizeBeforeCompression) {
      showErrorToast('L\'image est trop grande. Veuillez sélectionner une image de moins de 10MB');
      return;
    }

    setIsUploadingImage(true);
    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 600,
        useWebWorker: true,
        initialQuality: 0.7,
        fileType: 'image/jpeg'
      });

      setFormData(prev => ({
        ...prev,
        compressedImageFile: compressedFile,
        image: URL.createObjectURL(compressedFile)
      }));
      setIsUploadingImage(false);
    } catch (error) {
      console.error('Error compressing image:', error);
      showErrorToast('Erreur lors du traitement de l\'image');
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({
      ...prev,
      image: '',
      imagePath: '',
      compressedImageFile: null
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showErrorToast('Le nom de l\'étape est requis');
      return;
    }

    if (isSubmitting) return;

    if (!user || !company) {
      showErrorToast('Utilisateur non authentifié');
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl = formData.image && !formData.compressedImageFile ? formData.image : '';
      let imagePath = formData.imagePath;

      // Upload image if new file is provided
      if (formData.compressedImageFile) {
        try {
          const storageService = new FirebaseStorageService();
          const tempId = editingStep?.id || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          const uploadResult = await storageService.uploadCategoryImage(
            formData.compressedImageFile,
            user.uid,
            tempId
          );
          imageUrl = uploadResult.url;
          imagePath = uploadResult.path;
        } catch (error) {
          console.error('Error uploading image:', error);
          showErrorToast('Erreur lors de l\'upload de l\'image. L\'étape sera créée sans image.');
        }
      }

      const stepData: Omit<ProductionFlowStep, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'userId'> = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        image: imageUrl || undefined,
        imagePath: imagePath || undefined,
        estimatedDuration: formData.estimatedDuration ? parseFloat(formData.estimatedDuration) : undefined,
        isActive: true
      };

      if (editingStep) {
        await updateFlowStep(editingStep.id, stepData);
        showSuccessToast('Étape mise à jour avec succès');
      } else {
        await addFlowStep(stepData);
        showSuccessToast('Étape créée avec succès');
      }
      handleCloseModal();
    } catch (error: any) {
      console.error('Error saving step:', error);
      showErrorToast(error.message || 'Une erreur est survenue lors de la sauvegarde');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingStep) return;

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await deleteFlowStep(deletingStep.id);
      showSuccessToast('Étape supprimée avec succès');
      setIsDeleteModalOpen(false);
      setDeletingStep(null);
    } catch (error: any) {
      showErrorToast(error.message || 'Impossible de supprimer l\'étape');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Erreur: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Étapes de Production</h1>
          <p className="text-gray-600">Gérez les étapes réutilisables pour vos flux de production</p>
        </div>
        <Button
          icon={<Plus size={16} />}
          onClick={() => handleOpenModal()}
        >
          Nouvelle Étape
        </Button>
      </div>

      {flowSteps.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 mb-4">Aucune étape créée</p>
          <Button onClick={() => handleOpenModal()}>Créer la première étape</Button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Image
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durée estimée
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {flowSteps.map((step) => (
                <tr key={step.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {step.image ? (
                      <img
                        src={step.image}
                        alt={step.name}
                        className="w-10 h-10 object-cover rounded-md"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-200 rounded-md flex items-center justify-center">
                        <span className="text-gray-400 text-xs">No img</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{step.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500">{step.description || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {step.estimatedDuration ? `${step.estimatedDuration}h` : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(step)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setDeletingStep(step);
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
        title={editingStep ? 'Modifier l\'étape' : 'Nouvelle étape'}
        footer={
          <ModalFooter
            onCancel={handleCloseModal}
            onConfirm={handleSubmit}
            cancelText="Annuler"
            confirmText={editingStep ? 'Mettre à jour' : 'Créer'}
            isLoading={isSubmitting}
            disabled={isSubmitting || isUploadingImage}
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
              placeholder="Ex: Design, Cutting, Sewing..."
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
              rows={3}
              placeholder="Description optionnelle de l'étape"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Image
            </label>
            {formData.image ? (
              <div className="relative">
                <img
                  src={formData.image}
                  alt="Preview"
                  className="w-32 h-32 object-cover rounded-md border border-gray-300"
                />
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-blue-500 transition-colors">
                <Upload className="w-5 h-5 mr-2 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {isUploadingImage ? 'Traitement...' : 'Ajouter une image'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isUploadingImage}
                />
              </label>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Durée estimée (heures)
            </label>
            <input
              type="number"
              value={formData.estimatedDuration}
              onChange={(e) => setFormData({ ...formData, estimatedDuration: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: 2"
              min="0"
              step="0.5"
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingStep(null);
        }}
        title="Supprimer l'étape"
        footer={
          <ModalFooter
            onCancel={() => {
              setIsDeleteModalOpen(false);
              setDeletingStep(null);
            }}
            onConfirm={handleDelete}
            cancelText="Annuler"
            confirmText="Supprimer"
            isLoading={isSubmitting}
            isDanger={true}
            disabled={isSubmitting}
          />
        }
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Êtes-vous sûr de vouloir supprimer l'étape <strong>{deletingStep?.name}</strong> ?
          </p>
          {deletingStep && deletingStep.usageCount && deletingStep.usageCount > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800">
                Cette étape est utilisée dans {deletingStep.usageCount} flux(s). 
                Elle ne pourra pas être supprimée tant qu'elle est utilisée.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default FlowSteps;
