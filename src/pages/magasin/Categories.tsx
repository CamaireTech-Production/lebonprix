// Magasin Categories page - shows only matiere categories
import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Grid, List, Upload, X } from 'lucide-react';
import { SkeletonCategories, Card, Button, Input, Modal, ImageWithSkeleton, Badge, SyncIndicator, SkeletonLoader } from "@components/common";
import { useAuth } from '@contexts/AuthContext';
import { FirebaseStorageService } from '@services/core/firebaseStorage';
import { getCurrentEmployeeRef, formatCreatorName } from '@utils/business/employeeUtils';
import { getUserById } from '@services/utilities/userService';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import imageCompression from 'browser-image-compression';
import type { Category } from '../../types/models';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  subscribeToCategories
} from '@services/firestore/categories/categoryService';
import { PermissionButton, usePermissionCheck } from '@components/permissions';
import { RESOURCES } from '@constants/resources';

const MagasinCategories = () => {
  const { user, company, currentEmployee, isOwner } = useAuth();
  const { canEdit, canDelete } = usePermissionCheck(RESOURCES.MAGASIN);

  // State management
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // UI state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    imagePath: '',
    compressedImageFile: null as File | null,
    type: 'matiere' as 'product' | 'matiere',
  });
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  // Subscribe to matiere categories only
  useEffect(() => {
    if (!user || !company) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setSyncing(true);
    
    const unsubscribe = subscribeToCategories(company.id, (categoriesData) => {
      setCategories(categoriesData);
      setLoading(false);
      setSyncing(false);
      setError(null);
    }, 'matiere'); // Only subscribe to matiere categories

    return () => unsubscribe();
  }, [user, company]);

  // Filter categories based on search
  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      image: '',
      imagePath: '',
      compressedImageFile: null,
      type: 'matiere',
    });
    setCurrentCategory(null);
  };

  // Handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      showErrorToast('Please select a valid image file');
      return;
    }

    // Validate file size before processing (max 10MB before compression)
    const maxSizeBeforeCompression = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSizeBeforeCompression) {
      showErrorToast('Image size must be less than 10MB');
      return;
    }

    setIsUploadingImage(true);
    try {
      // Compress image
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true
      };
      
      const compressedFile = await imageCompression(file, options);
      setFormData(prev => ({ ...prev, compressedImageFile: compressedFile }));
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(compressedFile);
      setFormData(prev => ({ ...prev, image: previewUrl }));
      
      showSuccessToast('Image ready for upload');
    } catch (error) {
      console.error('Error compressing image:', error);
      showErrorToast('Failed to process image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Handle remove image
  const handleRemoveImage = () => {
    setFormData(prev => ({
      ...prev,
      image: '',
      imagePath: '',
      compressedImageFile: null
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Open add modal
  const openAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  // Open edit modal
  const openEditModal = (category: Category) => {
    setCurrentCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      image: category.image || '',
      imagePath: category.imagePath || '',
      compressedImageFile: null,
      type: category.type || 'matiere',
    });
    setIsEditModalOpen(true);
  };

  // Open delete modal
  const openDeleteModal = (category: Category) => {
    setCurrentCategory(category);
    setIsDeleteModalOpen(true);
  };

  // Handle add category
  const handleAddCategory = async () => {
    if (!user || !company) return;
    
    if (!formData.name.trim()) {
      showWarningToast('Category name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl = '';
      let imagePath = '';
      
      // Upload image first if available
      if (formData.compressedImageFile) {
        try {
          // Validate image size before upload
          const maxSize = 2 * 1024 * 1024; // 2MB
          if (formData.compressedImageFile.size > maxSize) {
            showErrorToast('Compressed image size must be less than 2MB');
            setIsSubmitting(false);
            return;
          }

          const storageService = new FirebaseStorageService();
          const uploadResult = await storageService.uploadCategoryImage(
            formData.compressedImageFile,
            user.uid,
            'temp' // Will be replaced with actual category ID after creation
          );
          imageUrl = uploadResult.url;
          imagePath = uploadResult.path;
        } catch (error) {
          console.error('Error uploading image:', error);
          showErrorToast('Failed to upload image');
          setIsSubmitting(false);
          return;
        }
      }

      // Get createdBy employee reference
      let createdBy = null;
      if (user && company) {
        let userData = null;
        if (isOwner && !currentEmployee) {
          try {
            userData = await getUserById(user.uid);
          } catch (error) {
            console.error('Error fetching user data for createdBy', error);
          }
        }
        createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
      }

      // Create category with type: 'matiere'
      const categoryData = {
        name: formData.name.trim(),
        description: formData.description.trim() || '',
        image: imageUrl,
        imagePath: imagePath,
        type: 'matiere' as const, // Always matiere for magasin categories
        userId: user.uid,
        companyId: company.id,
      };

      console.log('Creating matiere category:', categoryData);
      await createCategory(categoryData, company.id, createdBy);
      
      setIsAddModalOpen(false);
      resetForm();
      showSuccessToast('Matiere category created successfully');
    } catch (error) {
      console.error('Error creating category:', error);
      if (error instanceof Error) {
        showErrorToast(`Failed to create category: ${error.message}`);
      } else {
        showErrorToast('Failed to create category');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit category
  const handleEditCategory = async () => {
    if (!user || !company || !currentCategory) return;
    
    if (!formData.name.trim()) {
      showWarningToast('Category name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl = formData.image;
      let imagePath = formData.imagePath;
      
      // Upload new image if a new one was selected
      if (formData.compressedImageFile) {
        try {
          const maxSize = 2 * 1024 * 1024; // 2MB
          if (formData.compressedImageFile.size > maxSize) {
            showErrorToast('Compressed image size must be less than 2MB');
            setIsSubmitting(false);
            return;
          }

          const storageService = new FirebaseStorageService();
          const uploadResult = await storageService.uploadCategoryImage(
            formData.compressedImageFile,
            user.uid, // Use user.uid, not company.id
            currentCategory.id
          );
          imageUrl = uploadResult.url;
          imagePath = uploadResult.path;
        } catch (error) {
          console.error('Error uploading new image:', error);
          showErrorToast('Category updated but image upload failed');
          return;
        }
      }

      // Update category with all data including new image
      const updateData = {
        name: formData.name.trim(),
        description: formData.description.trim() || '',
        image: imageUrl,
        imagePath: imagePath,
      };

      await updateCategory(currentCategory.id, updateData, company.id);
      
      setIsEditModalOpen(false);
      resetForm();
      showSuccessToast('Category updated successfully');
    } catch (error) {
      console.error('Error updating category:', error);
      showErrorToast('Failed to update category');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete category
  const handleDeleteCategory = async () => {
    if (!user || !company || !currentCategory) return;

    // Check if category has matieres
    const matiereCount = currentCategory.matiereCount || 0;
    
    // If category has matieres, show confirmation
    if (matiereCount > 0) {
      const confirmed = window.confirm(
        `Cette catégorie contient ${matiereCount} matière${matiereCount > 1 ? 's' : ''}. ` +
        `Toutes les matières associées seront supprimées définitivement. ` +
        `Êtes-vous sûr de vouloir continuer ?`
      );
      
      if (!confirmed) {
        setIsDeleteModalOpen(false);
        return;
      }
    }

    setIsDeleting(true);
    try {
      await deleteCategory(currentCategory.id, company.id, matiereCount > 0);
      setIsDeleteModalOpen(false);
      setCurrentCategory(null);
      showSuccessToast('Category deleted successfully');
    } catch (error) {
      console.error('Error deleting category:', error);
      if (error instanceof Error) {
        showErrorToast(`Failed to delete category: ${error.message}`);
      } else {
        showErrorToast('Failed to delete category');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <SkeletonCategories viewMode={viewMode} />;
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-600">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Matiere Categories</h1>
          <p className="text-gray-600">Manage your matiere categories</p>
        </div>
        <div className="flex items-center gap-3">
          <SyncIndicator isSyncing={syncing} />
          <Button onClick={openAddModal} icon={<Plus size={20} />}>
            Add Category
          </Button>
        </div>
      </div>

      {/* Search and View Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <Input
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-emerald-100 text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Grid size={20} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-emerald-100 text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <List size={20} />
          </button>
        </div>
      </div>

      {/* Categories Display */}
      {filteredCategories.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Grid className="text-gray-400" size={32} />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? 'No categories found' : 'No matiere categories yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery 
                ? 'Try adjusting your search terms'
                : 'Create your first matiere category to organize your materials'
              }
            </p>
            {!searchQuery && (
              <Button onClick={openAddModal} icon={<Plus size={20} />}>
                Create Category
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
          : 'space-y-4'
        }>
          {filteredCategories.map(category => (
            <Card key={category.id} className="h-full">
              {viewMode === 'grid' ? (
                // Grid View
                <div className="flex flex-col h-full">
                  {/* Category Image */}
                  <div className="aspect-square rounded-lg overflow-hidden mb-4 bg-gray-100">
                    {category.image ? (
                      <ImageWithSkeleton
                        src={category.image}
                        alt={category.name}
                        className="w-full h-full object-cover"
                        placeholder="Loading image..."
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Grid size={48} />
                      </div>
                    )}
                  </div>
                  
                  {/* Category Info */}
                  <div className="flex-1 flex flex-col">
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                        {category.description}
                      </p>
                    )}
                    <div className="mt-auto">
                      <div className="flex gap-2 mb-3 flex-wrap">
                        <Badge variant="warning">
                          Matiere
                        </Badge>
                        {category.matiereCount !== undefined && (
                          <Badge variant="info">
                            {category.matiereCount || 0} matières
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mb-3">
                        Créé par: {formatCreatorName(category.createdBy)}
                      </div>
                      
                      {/* Actions */}
                      <div className="flex justify-end space-x-2">
                        {canEdit && (
                          <button
                            onClick={() => openEditModal(category)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit category"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => openDeleteModal(category)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete category"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // List View
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {category.image ? (
                      <ImageWithSkeleton
                        src={category.image}
                        alt={category.name}
                        className="w-full h-full object-cover"
                        placeholder="Loading image..."
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Grid size={24} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {category.description}
                      </p>
                    )}
                    <div className="flex gap-2 items-center">
                      <Badge variant="warning">Matiere</Badge>
                      {category.matiereCount !== undefined && (
                        <Badge variant="info">
                          {category.matiereCount || 0} matières
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {canEdit && (
                      <button
                        onClick={() => openEditModal(category)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit category"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => openDeleteModal(category)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete category"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add Category Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Matiere Category"
        size="md"
        footer={
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCategory}
              disabled={isSubmitting || !formData.name.trim()}
              isLoading={isSubmitting}
            >
              Create Category
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Category Name *"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Enter category name"
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter category description (optional)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category Image
            </label>
            
            {formData.image ? (
              <div className="space-y-3">
                <div className="w-32 h-32 rounded-lg overflow-hidden bg-gray-100">
                  <ImageWithSkeleton
                    src={formData.image}
                    alt="Category preview"
                    className="w-full h-full object-cover"
                    placeholder="Loading image..."
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="flex items-center space-x-1 text-red-600 hover:text-red-700 text-sm"
                >
                  <X size={16} />
                  <span>Remove image</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                  <Upload className="w-8 h-8 mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF up to 1MB</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}
            
            {isUploadingImage && (
              <div className="flex items-center space-x-2 text-sm text-gray-600 mt-2">
                <div className="animate-pulse bg-gray-200 w-4 h-4 rounded-full"></div>
                <span>Uploading image...</span>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Matiere Category"
        size="md"
        footer={
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditCategory}
              disabled={isSubmitting || !formData.name.trim()}
              isLoading={isSubmitting}
            >
              Update Category
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Category Name *"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Enter category name"
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter category description (optional)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category Image
            </label>
            
            {formData.image ? (
              <div className="space-y-3">
                <div className="w-32 h-32 rounded-lg overflow-hidden bg-gray-100">
                  <ImageWithSkeleton
                    src={formData.image}
                    alt="Category preview"
                    className="w-full h-full object-cover"
                    placeholder="Loading image..."
                  />
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm cursor-pointer">
                    <Upload size={16} />
                    <span>Change image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="flex items-center space-x-1 text-red-600 hover:text-red-700 text-sm"
                  >
                    <X size={16} />
                    <span>Remove image</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                  <Upload className="w-8 h-8 mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF up to 1MB</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}
            
            {isUploadingImage && (
              <div className="flex items-center space-x-2 text-sm text-gray-600 mt-2">
                <div className="animate-pulse bg-gray-200 w-4 h-4 rounded-full"></div>
                <span>Uploading image...</span>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Category Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Category"
        size="md"
        footer={
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteCategory}
              disabled={isDeleting}
              isLoading={isDeleting}
            >
              Delete
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete the category <strong>"{currentCategory?.name}"</strong>?
          </p>
          {currentCategory && (currentCategory.matiereCount || 0) > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                ⚠️ This category contains {currentCategory.matiereCount} matiere(s). 
                All associated matieres will be permanently deleted.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default MagasinCategories;
