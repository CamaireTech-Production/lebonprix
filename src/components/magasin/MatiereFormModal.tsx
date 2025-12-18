import React, { useState, useEffect } from 'react';
import { X, Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import Modal, { ModalFooter } from '../common/Modal';
import Input from '../common/Input';
import PriceInput from '../common/PriceInput';
import MatiereCategorySelector from './MatiereCategorySelector';
import UnitSelector from './UnitSelector';
import { useMatieres } from '../../hooks/useMatieres';
import { useSuppliers } from '../../hooks/useFirestore';
import { useAuth } from '../../contexts/AuthContext';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import { FirebaseStorageService } from '../../services/firebaseStorageService';
import imageCompression from 'browser-image-compression';
import { ImageWithSkeleton } from '../common/ImageWithSkeleton';
import type { Matiere } from '../../types/models';

interface MatiereFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  matiere?: Matiere | null; // If provided, we're editing
  onSuccess?: () => void;
}

const MatiereFormModal: React.FC<MatiereFormModalProps> = ({
  isOpen,
  onClose,
  matiere,
  onSuccess
}) => {
  const { user, company } = useAuth();
  const { addMatiere, updateMatiereData } = useMatieres();
  const { suppliers } = useSuppliers();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    refCategorie: '',
    unit: '',
    costPrice: '',
    initialStock: '',
    supplierId: '',
    isOwnPurchase: true,
    isCredit: false,
    images: [] as (File | string)[], // Can be File objects (new) or string URLs (existing)
    imagePaths: [] as string[]
  });

  // Reset form when modal opens/closes or matiere changes
  useEffect(() => {
    if (isOpen) {
      if (matiere) {
        // Edit mode: populate form with existing data
        setFormData({
          name: matiere.name || '',
          description: matiere.description || '',
          refCategorie: matiere.refCategorie || '',
          unit: matiere.unit || '',
          costPrice: matiere.costPrice?.toString() || '',
          initialStock: '', // Don't pre-fill stock in edit mode
          supplierId: '',
          isOwnPurchase: true,
          isCredit: false,
          images: matiere.images || [],
          imagePaths: matiere.imagePaths || []
        });
      } else {
        // Add mode: reset form
        setFormData({
          name: '',
          description: '',
          refCategorie: '',
          unit: '',
          costPrice: '',
          initialStock: '',
          supplierId: '',
          isOwnPurchase: true,
          isCredit: false,
          images: [],
          imagePaths: []
        });
      }
    }
  }, [isOpen, matiere]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const compressImage = async (file: File): Promise<File> => {
    try {
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 600,
        useWebWorker: true,
        initialQuality: 0.7,
        alwaysKeepResolution: false,
        fileType: 'image/jpeg'
      };

      const compressedFile = await imageCompression(file, options);
      
      if (compressedFile instanceof File) {
        return compressedFile;
      } else {
        const blobType = (compressedFile as Blob).type || 'image/jpeg';
        return new File([compressedFile], file.name, { type: blobType });
      }
    } catch (error) {
      console.error('Error compressing image:', error);
      throw error;
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImages(true);
    try {
      const fileArray = Array.from(files);
      const compressedFiles = await Promise.all(fileArray.map(file => compressImage(file)));
      
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...compressedFiles]
      }));
    } catch (error: any) {
      console.error('Error processing images:', error);
      showErrorToast('Erreur lors du traitement des images');
    } finally {
      setIsUploadingImages(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setFormData(prev => {
      const newImages = [...prev.images];
      const newImagePaths = [...prev.imagePaths];
      newImages.splice(index, 1);
      if (newImagePaths[index]) {
        newImagePaths.splice(index, 1);
      }
      return {
        ...prev,
        images: newImages,
        imagePaths: newImagePaths
      };
    });
  };

  const handleSubmit = async () => {
    if (!user || !company) {
      showErrorToast('Utilisateur non authentifié');
      return;
    }

    // Validation
    if (!formData.name.trim()) {
      showErrorToast('Le nom est requis');
      return;
    }

    if (!formData.refCategorie) {
      showErrorToast('La catégorie est requise');
      return;
    }

    if (!formData.unit) {
      showErrorToast('L\'unité est requise');
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload images if any new files
      let imageUrls: string[] = [];
      let imagePaths: string[] = [];

      const imageFiles = formData.images.filter((img): img is File => img instanceof File);
      const existingUrls = formData.images.filter((img): img is string => typeof img === 'string');

      if (imageFiles.length > 0) {
        const storageService = new FirebaseStorageService();
        const tempId = matiere?.id || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const uploadResults = await storageService.uploadProductImagesFromFiles(
          imageFiles,
          user.uid,
          tempId
        );
        
        imageUrls = uploadResults.map(result => result.url);
        imagePaths = uploadResults.map(result => result.path);
      }

      // Combine existing URLs with new ones
      imageUrls = [...existingUrls, ...imageUrls];
      imagePaths = [...formData.imagePaths.filter((_, idx) => typeof formData.images[idx] === 'string'), ...imagePaths];

      if (matiere) {
        // Edit mode
        await updateMatiereData(matiere.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          refCategorie: formData.refCategorie,
          unit: formData.unit,
          costPrice: formData.costPrice ? parseFloat(formData.costPrice) : 0,
          images: imageUrls,
          imagePaths: imagePaths
        });
        showSuccessToast('Matière mise à jour avec succès');
      } else {
        // Create mode
        const initialStock = formData.initialStock ? parseInt(formData.initialStock) : 0;
        const costPrice = formData.costPrice ? parseFloat(formData.costPrice) : undefined;

        const supplierInfo = formData.supplierId ? {
          supplierId: formData.supplierId,
          isOwnPurchase: formData.isOwnPurchase,
          isCredit: formData.isCredit
        } : undefined;

        await addMatiere(
          {
            name: formData.name.trim(),
            description: formData.description.trim() || undefined,
            refCategorie: formData.refCategorie,
            unit: formData.unit,
            costPrice: costPrice || 0,
            images: imageUrls,
            imagePaths: imagePaths,
            refStock: '', // Will be set by createMatiere
            companyId: company.id,
            userId: user.uid,
            isDeleted: false
          },
          initialStock,
          costPrice,
          supplierInfo
        );
        showSuccessToast('Matière créée avec succès');
      }

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Error saving matiere:', error);
      showErrorToast(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={matiere ? 'Modifier la matière' : 'Ajouter une matière'}
      size="lg"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleSubmit}
          confirmText={matiere ? 'Modifier' : 'Créer'}
          isLoading={isSubmitting || isUploadingImages}
        />
      }
    >
      <div className="space-y-4">
        {/* Name */}
        <Input
          label="Nom *"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          required
          placeholder="Nom de la matière"
        />

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Description de la matière"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Catégorie *
          </label>
          <MatiereCategorySelector
            value={formData.refCategorie}
            onChange={(value) => setFormData(prev => ({ ...prev, refCategorie: value }))}
            placeholder="Sélectionner une catégorie"
          />
        </div>

        {/* Unit */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unité de mesure *
          </label>
          <UnitSelector
            value={formData.unit}
            onChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}
            placeholder="Sélectionner une unité"
          />
        </div>

        {/* Cost Price */}
        <PriceInput
          label="Prix d'achat (XAF)"
          name="costPrice"
          value={formData.costPrice}
          onChange={handleInputChange}
          placeholder="0"
          allowDecimals={true}
        />

        {/* Initial Stock (only in create mode) */}
        {!matiere && (
          <Input
            label="Stock initial"
            name="initialStock"
            type="number"
            value={formData.initialStock}
            onChange={handleInputChange}
            placeholder="0"
            min="0"
          />
        )}

        {/* Supplier Info (only in create mode with initial stock) */}
        {!matiere && formData.initialStock && parseFloat(formData.initialStock) > 0 && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type d'approvisionnement
              </label>
              <select
                name="supplyType"
                value={formData.isOwnPurchase ? 'ownPurchase' : 'fromSupplier'}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  isOwnPurchase: e.target.value === 'ownPurchase',
                  supplierId: e.target.value === 'ownPurchase' ? '' : prev.supplierId
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="ownPurchase">Achat propre</option>
                <option value="fromSupplier">Depuis un fournisseur</option>
              </select>
            </div>

            {!formData.isOwnPurchase && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fournisseur
                  </label>
                  <select
                    name="supplierId"
                    value={formData.supplierId}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">Sélectionner un fournisseur</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isCredit"
                    checked={formData.isCredit}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-700">
                    Achat à crédit
                  </label>
                </div>
              </>
            )}
          </>
        )}

        {/* Images */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Images
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.images.map((img, idx) => {
              let imageSrc: string;
              if (img instanceof File) {
                imageSrc = URL.createObjectURL(img);
              } else if (typeof img === 'string') {
                imageSrc = img;
              } else {
                imageSrc = '/placeholder.png';
              }
              
              return (
                <div key={idx} className="relative w-20 h-20 rounded-md overflow-hidden group">
                  <ImageWithSkeleton
                    src={imageSrc}
                    alt={`Matiere ${idx + 1}`}
                    className="w-full h-full object-cover"
                    placeholder="/placeholder.png"
                  />
                  <button
                    type="button"
                    className="absolute top-1 right-1 bg-white bg-opacity-80 rounded-full p-1 text-red-600 hover:text-red-800 shadow"
                    onClick={() => handleRemoveImage(idx)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
          <label className="flex items-center justify-center w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-emerald-500 transition-colors">
            <Upload className="w-5 h-5 mr-2 text-gray-400" />
            <span className="text-sm text-gray-600">
              {isUploadingImages ? 'Traitement...' : 'Ajouter des images'}
            </span>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={isUploadingImages}
            />
          </label>
        </div>
      </div>
    </Modal>
  );
};

export default MatiereFormModal;

