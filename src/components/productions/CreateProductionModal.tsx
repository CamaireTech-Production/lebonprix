// Create Production Modal - Multi-step wizard
import React, { useState, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, Plus, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { Modal, Button, LoadingScreen } from '@components/common';
import ImageWithSkeleton from '@components/common/ImageWithSkeleton';
import { useAuth } from '@contexts/AuthContext';
import { useProductions, useProductionFlows, useProductionFlowSteps, useProductionCategories } from '@hooks/data/useFirestore';
import { useMatieres } from '@hooks/business/useMatieres';
import { useMatiereStocks } from '@hooks/business/useMatiereStocks';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import { formatPrice } from '@utils/formatting/formatPrice';
import { FirebaseStorageService } from '@services/core/firebaseStorage';
import imageCompression from 'browser-image-compression';
import type { Production, ProductionMaterial, ProductionFlow } from '../../types/models';

interface CreateProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateProductionModal: React.FC<CreateProductionModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user, company } = useAuth();
  const { addProduction } = useProductions();
  const { flows, loading: flowsLoading } = useProductionFlows();
  const { flowSteps } = useProductionFlowSteps();
  const { categories } = useProductionCategories();
  const { matieres } = useMatieres();
  const { matiereStocks } = useMatiereStocks();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  // Step 1: Basic Info
  const [step1Data, setStep1Data] = useState({
    name: '',
    reference: '',
    description: '',
    categoryId: '',
    images: [] as (File | string)[]
  });

  // Step 2: Flow Selection
  const [step2Data, setStep2Data] = useState({
    flowId: '',
    currentStepId: ''
  });

  // Step 3: Materials
  const [step3Data, setStep3Data] = useState<ProductionMaterial[]>([]);

  // Get selected flow details
  const selectedFlow = useMemo(() => {
    if (!step2Data.flowId) return null;
    return flows.find(f => f.id === step2Data.flowId) || null;
  }, [flows, step2Data.flowId]);

  // Get flow steps for selected flow
  const selectedFlowSteps = useMemo(() => {
    if (!selectedFlow) return [];
    return selectedFlow.stepIds
      .map(stepId => flowSteps.find(s => s.id === stepId))
      .filter(Boolean) as typeof flowSteps;
  }, [selectedFlow, flowSteps]);

  // Calculate total cost from materials
  const calculatedCost = useMemo(() => {
    return step3Data.reduce((sum, material) => {
      return sum + (material.requiredQuantity * material.costPrice);
    }, 0);
  }, [step3Data]);

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setStep1Data({
        name: '',
        reference: '',
        description: '',
        categoryId: '',
        images: []
      });
      setStep2Data({
        flowId: '',
        currentStepId: ''
      });
      setStep3Data([]);
    } else if (isOpen && flows.length > 0 && !step2Data.flowId) {
      // Auto-select default flow if available
      const defaultFlow = flows.find(f => f.isDefault) || flows[0];
      if (defaultFlow) {
        setStep2Data({
          flowId: defaultFlow.id,
          currentStepId: defaultFlow.stepIds[0] || ''
        });
      }
    }
  }, [isOpen, flows, step2Data.flowId]);

  // Image compression
  const compressImage = async (file: File): Promise<File> => {
    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 800,
        useWebWorker: true
      });
      return compressedFile;
    } catch (error) {
      console.error('Error compressing image:', error);
      throw error;
    }
  };

  // Handle image upload
  const handleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsUploadingImages(true);
    const newImages: File[] = [];
    for (const file of files) {
      try {
        const compressedFile = await compressImage(file);
        newImages.push(compressedFile);
      } catch (err) {
        console.error('Error compressing image:', err);
        showErrorToast('Erreur lors de la compression de l\'image');
      }
    }
    setStep1Data(prev => ({ ...prev, images: [...prev.images, ...newImages] }));
    setIsUploadingImages(false);
  };

  const handleRemoveImage = (idx: number) => {
    setStep1Data(prev => {
      // Clean up object URL before removing
      const imgToRemove = prev.images[idx];
      if (imgToRemove instanceof File || (imgToRemove && typeof imgToRemove === 'object' && 'type' in imgToRemove)) {
        const url = imgToRemove instanceof File 
          ? URL.createObjectURL(imgToRemove) 
          : URL.createObjectURL(imgToRemove as Blob);
        URL.revokeObjectURL(url);
      }
      return { ...prev, images: prev.images.filter((_, i) => i !== idx) };
    });
  };

  // Add material
  const handleAddMaterial = () => {
    setStep3Data(prev => [...prev, {
      matiereId: '',
      matiereName: '',
      requiredQuantity: 0,
      unit: '',
      costPrice: 0
    }]);
  };

  // Update material
  const handleUpdateMaterial = (index: number, field: keyof ProductionMaterial, value: any) => {
    setStep3Data(prev => {
      const updated = [...prev];
      if (field === 'matiereId') {
        const matiere = matieres.find(m => m.id === value);
        if (matiere) {
          updated[index] = {
            ...updated[index],
            matiereId: value,
            matiereName: matiere.name,
            unit: matiere.unit,
            costPrice: matiere.costPrice
          };
        }
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  // Remove material
  const handleRemoveMaterial = (index: number) => {
    setStep3Data(prev => prev.filter((_, i) => i !== index));
  };

  // Get available stock for a matiere
  const getAvailableStock = (matiereId: string): number => {
    const stockInfo = matiereStocks.find(ms => ms.matiereId === matiereId);
    return stockInfo?.currentStock || 0;
  };

  // Navigation
  const nextStep = () => {
    if (currentStep === 1) {
      if (!step1Data.name.trim()) {
        showWarningToast('Le nom de la production est requis');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!step2Data.flowId) {
        showWarningToast('Veuillez sélectionner un flux');
        return;
      }
      if (!step2Data.currentStepId) {
        showWarningToast('Veuillez sélectionner une étape initiale');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // Materials step - can proceed even with no materials
      setCurrentStep(4);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as 1 | 2 | 3 | 4);
    }
  };

  // Submit production
  const handleSubmit = async () => {
    if (!user || !company) return;

    setIsSubmitting(true);

    try {
      // Upload images if any
      let imageUrls: string[] = [];
      let imagePaths: string[] = [];

      const imageFiles = step1Data.images.filter((img): img is File => img instanceof File);
      if (imageFiles.length > 0) {
        try {
          const storageService = new FirebaseStorageService();
          const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const uploadResults = await storageService.uploadProductImagesFromFiles(
            imageFiles,
            user.uid,
            tempId
          );
          imageUrls = uploadResults.map(result => result.url);
          imagePaths = uploadResults.map(result => result.path);
        } catch (error) {
          console.error('Error uploading images:', error);
          showErrorToast('Erreur lors de l\'upload des images');
          setIsSubmitting(false);
          return;
        }
      }

      // Generate reference if not provided
      let reference = step1Data.reference.trim();
      if (!reference) {
        const prefix = step1Data.name.substring(0, 3).toUpperCase();
        const existingCount = 0; // TODO: Count existing productions with this prefix
        const nextNumber = (existingCount + 1).toString().padStart(3, '0');
        reference = `${prefix}${nextNumber}`;
      }

      // Create production data
      const productionData: Omit<Production, 'id' | 'createdAt' | 'updatedAt' | 'stateHistory' | 'calculatedCostPrice' | 'isCostValidated' | 'isPublished' | 'isClosed'> = {
        name: step1Data.name.trim(),
        reference,
        description: step1Data.description.trim() || undefined,
        images: imageUrls,
        imagePaths: imagePaths,
        categoryId: step1Data.categoryId || undefined,
        flowId: step2Data.flowId,
        currentStepId: step2Data.currentStepId,
        status: 'draft',
        materials: step3Data.filter(m => m.matiereId && m.requiredQuantity > 0),
        chargeIds: [],
        userId: user.uid,
        companyId: company.id
      };

      await addProduction(productionData);
      showSuccessToast('Production créée avec succès');
      onClose();
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Error creating production:', error);
      showErrorToast(error.message || 'Erreur lors de la création de la production');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nouvelle Production"
      size="lg"
      footer={
        <div className="flex justify-between w-full">
          <Button
            variant="outline"
            onClick={currentStep === 1 ? onClose : prevStep}
            disabled={isSubmitting || isUploadingImages}
          >
            {currentStep === 1 ? 'Annuler' : (
              <span className="flex items-center gap-2">
                <ChevronLeft size={16} />
                Précédent
              </span>
            )}
          </Button>
          <div className="flex gap-3">
            {currentStep < 4 ? (
              <Button
                onClick={nextStep}
                disabled={isSubmitting || isUploadingImages}
              >
                <span className="flex items-center gap-2">
                  Suivant
                  <ChevronRight size={16} />
                </span>
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                isLoading={isSubmitting || isUploadingImages}
                disabled={isSubmitting || isUploadingImages}
              >
                Créer la production
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* Progress Steps */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((step) => (
            <React.Fragment key={step}>
              <div className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                    currentStep === step
                      ? 'bg-blue-600 text-white'
                      : currentStep > step
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {currentStep > step ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    step
                  )}
                </div>
                <span className={`ml-2 text-sm font-medium ${
                  currentStep >= step ? 'text-gray-900' : 'text-gray-500'
                }`}>
                  {step === 1 && 'Infos'}
                  {step === 2 && 'Flux'}
                  {step === 3 && 'Matériaux'}
                  {step === 4 && 'Récapitulatif'}
                </span>
              </div>
              {step < 4 && (
                <div className={`flex-1 h-0.5 mx-4 ${
                  currentStep > step ? 'bg-green-600' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de la production <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={step1Data.name}
                onChange={(e) => setStep1Data({ ...step1Data, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: T-shirt personnalisé"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Référence
              </label>
              <input
                type="text"
                value={step1Data.reference}
                onChange={(e) => setStep1Data({ ...step1Data, reference: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Auto-généré si vide"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={step1Data.description}
                onChange={(e) => setStep1Data({ ...step1Data, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Description de la production..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catégorie
              </label>
              <select
                value={step1Data.categoryId}
                onChange={(e) => setStep1Data({ ...step1Data, categoryId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Aucune catégorie</option>
                {categories.filter(c => c.isActive !== false).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Images
              </label>
              <div className="mt-1">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImagesUpload}
                  className="hidden"
                  id="production-images-upload"
                  disabled={isUploadingImages}
                />
                <label
                  htmlFor="production-images-upload"
                  className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  {isUploadingImages ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Upload...
                    </>
                  ) : (
                    <>
                      <Plus size={16} className="mr-2" />
                      Ajouter des images
                    </>
                  )}
                </label>
              </div>
              {step1Data.images.length > 0 && (
                <div className="mt-4 grid grid-cols-4 gap-4">
                  {step1Data.images.map((img, idx) => {
                    // Handle both File objects and existing URLs
                    let imageSrc: string;
                    if (img instanceof File) {
                      imageSrc = URL.createObjectURL(img);
                    } else if (typeof img === 'string') {
                      imageSrc = img;
                    } else if (img && typeof img === 'object' && 'type' in img) {
                      // Handle Blob objects (convert to object URL)
                      imageSrc = URL.createObjectURL(img as Blob);
                    } else {
                      console.warn('Invalid image object:', img);
                      imageSrc = '/placeholder.png';
                    }
                    
                    return (
                      <div key={idx} className="relative w-full h-24 rounded-md overflow-hidden group">
                        <ImageWithSkeleton
                          src={imageSrc}
                          alt={`Preview ${idx + 1}`}
                          className="w-full h-full object-cover"
                          placeholder="/placeholder.png"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-1 right-1 bg-white bg-opacity-80 rounded-full p-1 text-red-600 hover:text-red-800 shadow opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Flow Selection */}
        {currentStep === 2 && (
          <div className="space-y-4">
            {flowsLoading ? (
              <LoadingScreen />
            ) : flows.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">Aucun flux disponible</p>
                <p className="text-sm text-gray-400">
                  Créez d'abord un flux dans la section "Flux"
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sélectionner un flux <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={step2Data.flowId}
                    onChange={(e) => {
                      const flow = flows.find(f => f.id === e.target.value);
                      setStep2Data({
                        flowId: e.target.value,
                        currentStepId: flow?.stepIds[0] || ''
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner un flux...</option>
                    {flows.map(flow => (
                      <option key={flow.id} value={flow.id}>
                        {flow.name} {flow.isDefault && '(Par défaut)'}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedFlow && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <h4 className="font-medium text-blue-900 mb-2">
                      Étapes dans ce flux:
                    </h4>
                    <div className="space-y-2">
                      {selectedFlowSteps.map((step, idx) => (
                        <div
                          key={step.id}
                          className="flex items-center space-x-2 text-sm"
                        >
                          {step.image ? (
                            <img
                              src={step.image}
                              alt={step.name}
                              className="w-5 h-5 object-cover rounded"
                            />
                          ) : (
                            <div className="w-5 h-5 bg-gray-200 rounded" />
                          )}
                          <span className="text-gray-700">
                            {idx + 1}. {step.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedFlow && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Étape initiale <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={step2Data.currentStepId}
                      onChange={(e) => setStep2Data({ ...step2Data, currentStepId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Sélectionner une étape...</option>
                      {selectedFlowSteps.map(step => (
                        <option key={step.id} value={step.id}>
                          {step.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 3: Materials */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Matériaux requis</h3>
              <Button
                icon={<Plus size={16} />}
                onClick={handleAddMaterial}
                variant="secondary"
                size="sm"
              >
                Ajouter un matériau
              </Button>
            </div>

            {step3Data.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-md">
                <p className="text-gray-500 mb-2">Aucun matériau ajouté</p>
                <p className="text-sm text-gray-400">
                  Vous pouvez ajouter des matériaux plus tard
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {step3Data.map((material, index) => (
                  <div key={index} className="border border-gray-200 rounded-md p-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Matériau <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={material.matiereId}
                          onChange={(e) => handleUpdateMaterial(index, 'matiereId', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Sélectionner un matériau...</option>
                          {matieres.map(matiere => (
                            <option key={matiere.id} value={matiere.id}>
                              {matiere.name} ({getAvailableStock(matiere.id)} {matiere.unit} disponible)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Quantité requise <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            value={material.requiredQuantity || ''}
                            onChange={(e) => handleUpdateMaterial(index, 'requiredQuantity', parseFloat(e.target.value) || 0)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min="0"
                            step="0.01"
                          />
                          <span className="text-sm text-gray-500">{material.unit || 'unité'}</span>
                        </div>
                      </div>
                    </div>
                    {material.matiereId && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          Prix unitaire: {formatPrice(material.costPrice)}
                        </span>
                        <span className="font-medium text-gray-900">
                          Total: {formatPrice(material.requiredQuantity * material.costPrice)}
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => handleRemoveMaterial(index)}
                      className="mt-2 text-red-600 hover:text-red-800 text-sm flex items-center"
                    >
                      <Trash2 size={14} className="mr-1" />
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-gray-50 rounded-md p-4">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-900">Coût total estimé:</span>
                <span className="text-lg font-semibold text-gray-900">
                  {formatPrice(calculatedCost)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Récapitulatif</h3>
              
              <div className="space-y-4">
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Informations de base</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-gray-600">Nom:</span> {step1Data.name}</p>
                    <p><span className="text-gray-600">Référence:</span> {step1Data.reference || 'Auto-généré'}</p>
                    {step1Data.description && (
                      <p><span className="text-gray-600">Description:</span> {step1Data.description}</p>
                    )}
                    {step1Data.categoryId && (
                      <p><span className="text-gray-600">Catégorie:</span> {
                        categories.find(c => c.id === step1Data.categoryId)?.name
                      }</p>
                    )}
                  </div>
                </div>

                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Flux sélectionné</h4>
                  <div className="text-sm">
                    <p><span className="text-gray-600">Flux:</span> {selectedFlow?.name}</p>
                    <p><span className="text-gray-600">Étape initiale:</span> {
                      flowSteps.find(s => s.id === step2Data.currentStepId)?.name
                    }</p>
                  </div>
                </div>

                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-medium text-gray-900 mb-2">
                    Matériaux ({step3Data.filter(m => m.matiereId).length})
                  </h4>
                  {step3Data.filter(m => m.matiereId).length === 0 ? (
                    <p className="text-sm text-gray-500">Aucun matériau</p>
                  ) : (
                    <div className="space-y-2">
                      {step3Data.filter(m => m.matiereId).map((material, idx) => (
                        <div key={idx} className="text-sm flex justify-between">
                          <span className="text-gray-600">
                            {material.matiereName} ({material.requiredQuantity} {material.unit})
                          </span>
                          <span className="text-gray-900">
                            {formatPrice(material.requiredQuantity * material.costPrice)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 rounded-md p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-blue-900">Coût total estimé:</span>
                    <span className="text-xl font-bold text-blue-900">
                      {formatPrice(calculatedCost)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </Modal>
  );
};

export default CreateProductionModal;

