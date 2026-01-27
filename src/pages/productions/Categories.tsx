// Production Categories page
import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Loader2, Power, PowerOff, Upload, X } from 'lucide-react';
import { SkeletonTable, Button, Modal, ModalFooter, ImageWithSkeleton } from "@components/common";
import { useAuth } from '@contexts/AuthContext';
import { useProductionCategories } from '@hooks/data/useFirestore';
import { FirebaseStorageService } from '@services/core/firebaseStorage';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import { formatCreatorName } from '@utils/business/employeeUtils';
import { usePermissionCheck } from '@components/permissions';
import { RESOURCES } from '@constants/resources';
import imageCompression from 'browser-image-compression';
import type { ProductionCategory } from '../../types/models';

const Categories: React.FC = () => {
  const { user, company } = useAuth();
  const { categories, loading, addCategory, updateCategory, deleteCategory } = useProductionCategories();
  const { canDelete } = usePermissionCheck(RESOURCES.PRODUCTIONS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductionCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<ProductionCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingCategoryId, setTogglingCategoryId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    imagePath: '',
    compressedImageFile: null as File | null
  });
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleOpenModal = (category?: ProductionCategory) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        description: category.description || '',
        image: category.image || '',
        imagePath: category.imagePath || '',
        compressedImageFile: null
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        description: '',
        image: '',
        imagePath: '',
        compressedImageFile: null
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      image: '',
      imagePath: '',
      compressedImageFile: null
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
      showErrorToast('Le nom de la catégorie est requis');
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
          const tempId = editingCategory?.id || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          const uploadResult = await storageService.uploadCategoryImage(
            formData.compressedImageFile,
            user.uid,
            tempId
          );
          imageUrl = uploadResult.url;
          imagePath = uploadResult.path;
        } catch (error) {
          console.error('Error uploading image:', error);
          showErrorToast('Erreur lors de l\'upload de l\'image. La catégorie sera créée sans image.');
        }
      }

      const categoryData: Omit<ProductionCategory, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'userId'> = {
        name: formData.name.trim(),
        isActive: true
      };

      // Only add optional fields if they have values (Firebase doesn't accept undefined)
      if (formData.description.trim()) {
        categoryData.description = formData.description.trim();
      }
      if (imageUrl) {
        categoryData.image = imageUrl;
      }
      if (imagePath) {
        categoryData.imagePath = imagePath;
      }

      if (editingCategory) {
        await updateCategory(editingCategory.id, categoryData);
        showSuccessToast('Catégorie mise à jour avec succès');
      } else {
        await addCategory(categoryData);
        showSuccessToast('Catégorie créée avec succès');
      }
      handleCloseModal();
    } catch (error: any) {
      console.error('Error saving category:', error);
      showErrorToast(error.message || 'Une erreur est survenue lors de la sauvegarde');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;

    setIsSubmitting(true);
    try {
      await deleteCategory(deletingCategory.id);
      showSuccessToast('Catégorie supprimée avec succès');
      setIsDeleteModalOpen(false);
      setDeletingCategory(null);
    } catch (error: any) {
      showErrorToast(error.message || 'Impossible de supprimer la catégorie');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <SkeletonTable rows={5} />;
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Catégories de Production</h1>
          <p className="text-gray-600">Gérez les catégories pour organiser vos productions</p>
        </div>
        <Button
          icon={<Plus size={16} />}
          onClick={() => handleOpenModal()}
        >
          Nouvelle Catégorie
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 mb-4">Aucune catégorie créée</p>
          <Button onClick={() => handleOpenModal()}>Créer la première catégorie</Button>
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
                  Image
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Productions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
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
              {categories.map((category) => (
                <tr key={category.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{category.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500">{category.description || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {category.image ? (
                      <img
                        src={category.image}
                        alt={category.name}
                        className="w-10 h-10 object-cover rounded-md"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-200 rounded-md flex items-center justify-center">
                        <span className="text-gray-400 text-xs">No img</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {category.productionCount || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {category.isActive !== false ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {formatCreatorName(category.createdBy)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={async () => {
                          if (togglingCategoryId) return; // Prevent double click
                          setTogglingCategoryId(category.id);
                          try {
                            await updateCategory(category.id, { isActive: !category.isActive });
                            showSuccessToast(
                              category.isActive !== false
                                ? 'Catégorie désactivée'
                                : 'Catégorie activée'
                            );
                          } catch (error: any) {
                            showErrorToast(error.message || 'Erreur lors du changement de statut');
                          } finally {
                            setTogglingCategoryId(null);
                          }
                        }}
                        disabled={togglingCategoryId === category.id}
                        className={`${
                          category.isActive !== false
                            ? 'text-yellow-600 hover:text-yellow-900'
                            : 'text-green-600 hover:text-green-900'
                        } ${togglingCategoryId === category.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={category.isActive !== false ? 'Désactiver' : 'Activer'}
                      >
                        {togglingCategoryId === category.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : category.isActive !== false ? (
                          <PowerOff size={16} />
                        ) : (
                          <Power size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => handleOpenModal(category)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit2 size={16} />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => {
                            setDeletingCategory(category);
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
        footer={
          <ModalFooter
            onCancel={handleCloseModal}
            onConfirm={handleSubmit}
            cancelText="Annuler"
            confirmText={editingCategory ? 'Mettre à jour' : 'Créer'}
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
              placeholder="Ex: Vêtements, Accessoires..."
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
              placeholder="Description optionnelle de la catégorie"
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
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingCategory(null);
        }}
        title="Supprimer la catégorie"
        footer={
          <ModalFooter
            onCancel={() => {
              setIsDeleteModalOpen(false);
              setDeletingCategory(null);
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
            Êtes-vous sûr de vouloir supprimer la catégorie <strong>{deletingCategory?.name}</strong> ?
          </p>
          {deletingCategory && deletingCategory.productionCount && deletingCategory.productionCount > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800">
                Cette catégorie est utilisée par {deletingCategory.productionCount} production(s). 
                Elle ne pourra pas être supprimée tant qu'elle est utilisée.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Categories;

