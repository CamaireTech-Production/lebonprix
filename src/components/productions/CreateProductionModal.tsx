// Create Production Modal - Multi-step wizard
import React, { useState, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, Plus, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { Modal, Button, LoadingScreen } from '@components/common';
import ImageWithSkeleton from '@components/common/ImageWithSkeleton';
import { useAuth } from '@contexts/AuthContext';
import { useProductions, useProductionFlows, useProductionFlowSteps, useProductionCategories, useFixedCharges } from '@hooks/data/useFirestore';
import { useMatieres } from '@hooks/business/useMatieres';
import { useMatiereStocks } from '@hooks/business/useMatiereStocks';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import { formatPrice } from '@utils/formatting/formatPrice';
import { FirebaseStorageService } from '@services/core/firebaseStorage';
import imageCompression from 'browser-image-compression';
import type { Production, ProductionMaterial, ProductionFlow, ProductionChargeRef } from '../../types/models';
import { Timestamp } from 'firebase/firestore';

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
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
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

  // Step 4: Charges
  const [step4Data, setStep4Data] = useState<{
    selectedFixedCharges: string[]; // Array of charge IDs
    customCharges: Array<{
      name: string;
      description: string;
      amount: number;
      category: string;
      date: Date;
    }>;
  }>({
    selectedFixedCharges: [],
    customCharges: []
  });

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

  // Fetch fixed charges for selection
  const { charges: fixedCharges } = useFixedCharges(true); // Only active fixed charges

  // Calculate total cost from materials and charges
  const materialsCost = useMemo(() => {
    return step3Data.reduce((sum, material) => {
      return sum + (material.requiredQuantity * material.costPrice);
    }, 0);
  }, [step3Data]);

  const chargesCost = useMemo(() => {
    let total = 0;
    // Add selected fixed charges
    step4Data.selectedFixedCharges.forEach(chargeId => {
      const charge = fixedCharges.find(c => c.id === chargeId);
      if (charge) total += charge.amount;
    });
    // Add custom charges
    step4Data.customCharges.forEach(charge => {
      total += charge.amount;
    });
    return total;
  }, [step4Data, fixedCharges]);

  const calculatedCost = useMemo(() => {
    return materialsCost + chargesCost;
  }, [materialsCost, chargesCost]);

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
      setStep4Data({
        selectedFixedCharges: [],
        customCharges: []
      });
    }
  }, [isOpen]);

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
            unit: matiere.unit || 'unité',
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
      // Flow is optional - can always proceed to next step
      // If flow is selected, validate that initial step is also selected
      if (step2Data.flowId && !step2Data.currentStepId) {
        showWarningToast('Veuillez sélectionner une étape initiale si vous avez choisi un flux');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // Materials step - can proceed even with no materials
      setCurrentStep(4);
    } else if (currentStep === 4) {
      // Charges step - can proceed even with no charges
      setCurrentStep(5);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as 1 | 2 | 3 | 4 | 5);
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

      // Create charges and build charge snapshots
      const { createCharge } = await import('@services/firestore/charges/chargeService');
      const { getUserById } = await import('@services/utilities/userService');
      const { getCurrentEmployeeRef } = await import('@utils/business/employeeUtils');
      const chargeSnapshots: ProductionChargeRef[] = [];

      // Get createdBy reference
      let createdBy = null;
      if (user && company) {
        let userData: Awaited<ReturnType<typeof getUserById>> | null = null;
        if (isOwner && !currentEmployee) {
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            console.error('Error fetching user data for createdBy:', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }

      // Create custom charges and add to snapshots
      for (const customCharge of step4Data.customCharges) {
        try {
          const newCharge = await createCharge({
            type: 'custom',
            name: customCharge.name || customCharge.description,
            description: customCharge.description,
            amount: customCharge.amount,
            category: customCharge.category,
            date: Timestamp.fromDate(customCharge.date),
            userId: user.uid
          }, company.id, createdBy);
          
          chargeSnapshots.push({
            chargeId: newCharge.id,
            name: newCharge.name || newCharge.description,
            description: newCharge.description,
            amount: newCharge.amount,
            category: newCharge.category,
            type: 'custom',
            date: newCharge.date
          });
        } catch (error) {
          console.error('Error creating custom charge:', error);
          showErrorToast('Erreur lors de la création d\'une charge personnalisée');
        }
      }

      // Add selected fixed charges to snapshots
      for (const chargeId of step4Data.selectedFixedCharges) {
        const charge = fixedCharges.find(c => c.id === chargeId);
        if (charge) {
          chargeSnapshots.push({
            chargeId: charge.id,
            name: charge.name || charge.description,
            description: charge.description,
            amount: charge.amount,
            category: charge.category,
            type: 'fixed',
            date: charge.date
          });
        }
      }

      // Create production data
      const productionData: Omit<Production, 'id' | 'createdAt' | 'updatedAt' | 'stateHistory' | 'calculatedCostPrice' | 'isCostValidated' | 'isPublished' | 'isClosed'> = {
        name: step1Data.name.trim(),
        reference,
        description: step1Data.description.trim() || undefined,
        images: imageUrls.length > 0 ? imageUrls : undefined,
        imagePaths: imagePaths.length > 0 ? imagePaths : undefined,
        categoryId: step1Data.categoryId && step1Data.categoryId.trim() !== '' ? step1Data.categoryId : undefined,
        flowId: step2Data.flowId || undefined, // Optional
        currentStepId: step2Data.flowId ? step2Data.currentStepId : undefined, // Only if flowId exists
        status: 'draft',
        materials: step3Data.filter(m => m.matiereId && m.requiredQuantity > 0),
        charges: chargeSnapshots,
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
            {currentStep < 5 ? (
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

        {/* Step 2: Flow Selection (OPTIONAL) */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Le flux est optionnel. Vous pouvez continuer sans sélectionner de flux pour créer une production simple.
              </p>
            </div>
            
            {flowsLoading ? (
              <LoadingScreen />
            ) : flows.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">Aucun flux disponible</p>
                <p className="text-sm text-gray-400 mb-4">
                  Vous pouvez continuer sans flux ou créer un flux dans la section "Flux"
                </p>
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Continuer sans flux
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sélectionner un flux (optionnel)
                  </label>
                  <select
                    value={step2Data.flowId}
                    onChange={(e) => {
                      const selectedFlowId = e.target.value;
                      if (selectedFlowId === '') {
                        // No flow selected - reset currentStepId
                        setStep2Data({
                          flowId: '',
                          currentStepId: ''
                        });
                      } else {
                        // Flow selected - auto-select first step
                        const flow = flows.find(f => f.id === selectedFlowId);
                        setStep2Data({
                          flowId: selectedFlowId,
                          currentStepId: flow?.stepIds[0] || ''
                        });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Aucun flux (production simple)</option>
                    {flows.map(flow => (
                      <option key={flow.id} value={flow.id}>
                        {flow.name} {flow.isDefault && '(Par défaut)'}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedFlow && (
                  <>
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

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Étape initiale
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
                  </>
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
                              {matiere.name} ({getAvailableStock(matiere.id)} {matiere.unit || 'unité'} disponible)
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
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Coût des matériaux:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatPrice(materialsCost)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Coût des charges:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatPrice(chargesCost)}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                  <span className="font-medium text-gray-900">Coût total estimé:</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {formatPrice(calculatedCost)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Charges */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Charges</h3>
              <p className="text-sm text-gray-500">Ajoutez des charges fixes ou personnalisées</p>
            </div>

            {/* Fixed Charges Selection */}
            <div className="border border-gray-200 rounded-md p-4">
              <h4 className="font-medium text-gray-900 mb-3">Charges fixes disponibles</h4>
              {fixedCharges.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune charge fixe disponible. Créez-en une dans la page Charges.</p>
              ) : (
                <div className="space-y-2">
                  {fixedCharges.map((charge) => (
                    <label key={charge.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={step4Data.selectedFixedCharges.includes(charge.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setStep4Data(prev => ({
                              ...prev,
                              selectedFixedCharges: [...prev.selectedFixedCharges, charge.id]
                            }));
                          } else {
                            setStep4Data(prev => ({
                              ...prev,
                              selectedFixedCharges: prev.selectedFixedCharges.filter(id => id !== charge.id)
                            }));
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-900">
                            {charge.name || charge.description}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {formatPrice(charge.amount)}
                          </span>
                        </div>
                        {charge.description && charge.name && charge.name !== charge.description && (
                          <p className="text-xs text-gray-500 mt-1">{charge.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {charge.category === 'main_oeuvre' ? 'Main d\'œuvre' :
                           charge.category === 'overhead' ? 'Frais généraux' :
                           charge.category === 'transport' ? 'Transport' :
                           charge.category === 'packaging' ? 'Emballage' :
                           charge.category === 'utilities' ? 'Services publics' :
                           charge.category === 'equipment' ? 'Équipement' : 'Autre'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Charges */}
            <div className="border border-gray-200 rounded-md p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">Charges personnalisées</h4>
                <Button
                  icon={<Plus size={16} />}
                  onClick={() => {
                    setStep4Data(prev => ({
                      ...prev,
                      customCharges: [...prev.customCharges, {
                        name: '',
                        description: '',
                        amount: 0,
                        category: 'other',
                        date: new Date()
                      }]
                    }));
                  }}
                  variant="secondary"
                  size="sm"
                >
                  Ajouter une charge
                </Button>
              </div>

              {step4Data.customCharges.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune charge personnalisée ajoutée</p>
              ) : (
                <div className="space-y-4">
                  {step4Data.customCharges.map((charge, index) => (
                    <div key={index} className="border border-gray-200 rounded-md p-4 bg-gray-50">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nom / Description <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={charge.name}
                            onChange={(e) => {
                              const updated = [...step4Data.customCharges];
                              updated[index].name = e.target.value;
                              setStep4Data(prev => ({ ...prev, customCharges: updated }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: Main d'œuvre spéciale"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Montant (XAF) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={charge.amount || ''}
                            onChange={(e) => {
                              const updated = [...step4Data.customCharges];
                              updated[index].amount = parseFloat(e.target.value) || 0;
                              setStep4Data(prev => ({ ...prev, customCharges: updated }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Catégorie
                          </label>
                          <select
                            value={charge.category}
                            onChange={(e) => {
                              const updated = [...step4Data.customCharges];
                              updated[index].category = e.target.value;
                              setStep4Data(prev => ({ ...prev, customCharges: updated }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="main_oeuvre">Main d'œuvre</option>
                            <option value="overhead">Frais généraux</option>
                            <option value="transport">Transport</option>
                            <option value="packaging">Emballage</option>
                            <option value="utilities">Services publics</option>
                            <option value="equipment">Équipement</option>
                            <option value="other">Autre</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Date
                          </label>
                          <input
                            type="date"
                            value={charge.date.toISOString().split('T')[0]}
                            onChange={(e) => {
                              const updated = [...step4Data.customCharges];
                              updated[index].date = new Date(e.target.value);
                              setStep4Data(prev => ({ ...prev, customCharges: updated }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description détaillée
                        </label>
                        <textarea
                          value={charge.description}
                          onChange={(e) => {
                            const updated = [...step4Data.customCharges];
                            updated[index].description = e.target.value;
                            setStep4Data(prev => ({ ...prev, customCharges: updated }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={2}
                          placeholder="Description détaillée de la charge..."
                        />
                      </div>
                      <button
                        onClick={() => {
                          setStep4Data(prev => ({
                            ...prev,
                            customCharges: prev.customCharges.filter((_, i) => i !== index)
                          }));
                        }}
                        className="mt-2 text-red-600 hover:text-red-800 text-sm flex items-center"
                      >
                        <Trash2 size={14} className="mr-1" />
                        Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Charges Summary */}
            <div className="bg-gray-50 rounded-md p-4">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-900">Total des charges:</span>
                <span className="text-lg font-semibold text-gray-900">
                  {formatPrice(chargesCost)}
                </span>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                <p>Charges fixes: {step4Data.selectedFixedCharges.length}</p>
                <p>Charges personnalisées: {step4Data.customCharges.length}</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {currentStep === 5 && (
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
                            {material.matiereName} ({material.requiredQuantity} {material.unit || 'unité'})
                          </span>
                          <span className="text-gray-900">
                            {formatPrice(material.requiredQuantity * material.costPrice)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-medium text-gray-900 mb-2">
                    Charges ({step4Data.selectedFixedCharges.length + step4Data.customCharges.length})
                  </h4>
                  {step4Data.selectedFixedCharges.length === 0 && step4Data.customCharges.length === 0 ? (
                    <p className="text-sm text-gray-500">Aucune charge</p>
                  ) : (
                    <div className="space-y-2">
                      {step4Data.selectedFixedCharges.map(chargeId => {
                        const charge = fixedCharges.find(c => c.id === chargeId);
                        if (!charge) return null;
                        return (
                          <div key={chargeId} className="text-sm flex justify-between">
                            <span className="text-gray-600">
                              {charge.name || charge.description} <span className="text-gray-400">(Fixe)</span>
                            </span>
                            <span className="text-gray-900">
                              {formatPrice(charge.amount)}
                            </span>
                          </div>
                        );
                      })}
                      {step4Data.customCharges.map((charge, idx) => (
                        <div key={idx} className="text-sm flex justify-between">
                          <span className="text-gray-600">
                            {charge.name || charge.description} <span className="text-gray-400">(Personnalisée)</span>
                          </span>
                          <span className="text-gray-900">
                            {formatPrice(charge.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 rounded-md p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-blue-700">Coût des matériaux:</span>
                      <span className="text-sm font-medium text-blue-900">
                        {formatPrice(materialsCost)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-blue-700">Coût des charges:</span>
                      <span className="text-sm font-medium text-blue-900">
                        {formatPrice(chargesCost)}
                      </span>
                    </div>
                    <div className="border-t border-blue-200 pt-2 flex justify-between items-center">
                      <span className="font-medium text-blue-900">Coût total estimé:</span>
                      <span className="text-xl font-bold text-blue-900">
                        {formatPrice(calculatedCost)}
                      </span>
                    </div>
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

