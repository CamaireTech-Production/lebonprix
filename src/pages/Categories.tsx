import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Grid, List, Upload, X } from 'lucide-react';
// import { useTranslation } from 'react-i18next';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import { useAuth } from '../contexts/AuthContext';
import { FirebaseStorageService } from '../services/firebaseStorageService';
import { ImageWithSkeleton } from '../components/common/ImageWithSkeleton';
import LoadingScreen from '../components/common/LoadingScreen';
import SyncIndicator from '../components/common/SyncIndicator';
import { showSuccessToast, showErrorToast, showWarningToast } from '../utils/toast';
import imageCompression from 'browser-image-compression';
import type { Category } from '../types/models';
import { 
  createCategory, 
  updateCategory, 
  deleteCategory, 
  subscribeToCategories,
  recalculateCategoryProductCounts
} from '../services/firestore';

const Categories = () => {
  // const { t } = useTranslation();
  const { user } = useAuth();
  
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
  });
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  // Subscribe to categories
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setSyncing(true);
    
    const unsubscribe = subscribeToCategories(user.uid, (categoriesData) => {
      setCategories(categoriesData);
      setLoading(false);
      setSyncing(false);
      setError(null);
    });

    return () => unsubscribe();
  }, [user?.uid]);

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

    setIsUploadingImage(true);
    try {
      // Compress image
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 800,
        useWebWorker: true,
      });

      // Store the compressed file in state (don't upload yet)
      setFormData(prev => ({ 
        ...prev, 
        compressedImageFile: compressedFile,
        image: URL.createObjectURL(compressedFile) // For preview only
      }));
      setIsUploadingImage(false);
    } catch (error) {
      console.error('Error compressing image:', error);
      showErrorToast('Error processing image');
      setIsUploadingImage(false);
    }
  };

  // Remove image
  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, image: '' }));
  };

  // Handle form input changes
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
    if (!user?.uid) return;
    
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
          const storageService = new FirebaseStorageService();
          // Generate a temporary ID for the upload
          const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const uploadResult = await storageService.uploadCategoryImage(
            formData.compressedImageFile,
            user.uid,
            tempId
          );
          imageUrl = uploadResult.url;
          imagePath = uploadResult.path;
        } catch (error) {
          console.error('Error uploading image:', error);
          showErrorToast('Image upload failed');
          return;
        }
      }

      // Create category with image URL included
      const categoryData = {
        name: formData.name.trim(),
        description: formData.description.trim() || '',
        image: imageUrl,
        imagePath: imagePath,
        userId: user.uid,
      };

      await createCategory(categoryData, user.uid);
      
      setIsAddModalOpen(false);
      resetForm();
      showSuccessToast('Category created successfully');
    } catch (error) {
      console.error('Error creating category:', error);
      showErrorToast('Failed to create category');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit category
  const handleEditCategory = async () => {
    if (!user?.uid || !currentCategory) return;
    
    if (!formData.name.trim()) {
      showWarningToast('Category name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      // Handle new image upload if one was selected
      let imageUrl = formData.image;
      let imagePath = formData.imagePath;
      
      if (formData.compressedImageFile) {
        try {
          const storageService = new FirebaseStorageService();
          const uploadResult = await storageService.uploadCategoryImage(
            formData.compressedImageFile,
            user.uid,
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

      await updateCategory(currentCategory.id, updateData, user.uid);
      
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
    if (!user?.uid || !currentCategory) return;

    setIsDeleting(true);
    try {
      await deleteCategory(currentCategory.id, user.uid);
      
      setIsDeleteModalOpen(false);
      setCurrentCategory(null);
      showSuccessToast('Category deleted successfully');
    } catch (error) {
      console.error('Error deleting category:', error);
      if (error instanceof Error && error.message.includes('existing products')) {
        showErrorToast('Cannot delete category with existing products. Please move or delete products first.');
      } else {
        showErrorToast('Failed to delete category');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle recalculate category counts
  const handleRecalculateCounts = async () => {
    if (!user?.uid) return;
    
    setSyncing(true);
    try {
      await recalculateCategoryProductCounts(user.uid);
      showSuccessToast('Category product counts recalculated successfully');
    } catch (error) {
      console.error('Error recalculating category counts:', error);
      showErrorToast('Failed to recalculate category counts');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
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
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-600">Manage your product categories</p>
        </div>
        <div className="flex items-center gap-3">
          <SyncIndicator isSyncing={syncing} />
          <Button 
            onClick={handleRecalculateCounts} 
            variant="outline"
            disabled={syncing}
            isLoading={syncing}
          >
            Recalculate Counts
          </Button>
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
              {searchQuery ? 'No categories found' : 'No categories yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery 
                ? 'Try adjusting your search terms'
                : 'Create your first category to organize your products'
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
                      <Badge variant="info" className="mb-3">
                        {category.productCount || 0} products
                      </Badge>
                      
                      {/* Actions */}
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => openEditModal(category)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit category"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => openDeleteModal(category)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete category"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // List View
                <div className="flex items-center space-x-4">
                  {/* Category Image */}
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
                  
                  {/* Category Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {category.description}
                      </p>
                    )}
                    <Badge variant="info">
                      {category.productCount || 0} products
                    </Badge>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openEditModal(category)}
                      className="text-indigo-600 hover:text-indigo-900"
                      title="Edit category"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => openDeleteModal(category)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete category"
                    >
                      <Trash2 size={16} />
                    </button>
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
        title="Add Category"
        size="md"
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
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500"></div>
                <span>Uploading image...</span>
              </div>
            )}
          </div>
        </div>

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
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Category"
        size="md"
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
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500"></div>
                <span>Uploading image...</span>
              </div>
            )}
          </div>
        </div>

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
      </Modal>

      {/* Delete Category Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Category"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete the category <strong>"{currentCategory?.name}"</strong>?
          </p>
          <p className="text-sm text-red-600">
            This action cannot be undone. If this category has products, you'll need to move or delete them first.
          </p>
        </div>

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
              Delete Category
            </Button>
          </div>
        }
      </Modal>
    </div>
  );
};

export default Categories;
