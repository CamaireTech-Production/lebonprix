import React, { useState, useEffect } from 'react';
import { Search, Edit2, Trash2, Image as ImageIcon, Upload, Filter, Download, Eye } from 'lucide-react';
import AdminDashboardLayout from '../../components/layout/AdminDashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import { MediaItem } from '../../types';
import { getAllMedia, updateImageMetadata, deleteMediaItem, searchMedia } from '../../services/storageService';
import { toast } from 'react-hot-toast';

interface MediaManagementState {
  media: MediaItem[];
  filteredMedia: MediaItem[];
  loading: boolean;
  searchTerm: string;
  selectedType: 'all' | 'dish' | 'logo' | 'menu';
  selectedRestaurant: string;
  selectedMedia: MediaItem | null;
  showEditModal: boolean;
  showPreviewModal: boolean;
  editForm: {
    dishName: string;
    quality: number;
    customMetadata: Record<string, string>;
  };
}

const MediaManagement: React.FC = () => {
  const [state, setState] = useState<MediaManagementState>({
    media: [],
    filteredMedia: [],
    loading: true,
    searchTerm: '',
    selectedType: 'all',
    selectedRestaurant: 'all',
    selectedMedia: null,
    showEditModal: false,
    showPreviewModal: false,
    editForm: {
      dishName: '',
      quality: 3,
      customMetadata: {}
    }
  });

  // Get unique restaurant IDs for filter
  const uniqueRestaurants = Array.from(new Set(state.media.map(item => item.restaurantId)));

  useEffect(() => {
    loadMedia();
  }, []);

  useEffect(() => {
    filterMedia();
  }, [state.media, state.searchTerm, state.selectedType, state.selectedRestaurant]);

  const loadMedia = async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const media = await getAllMedia();
      setState(prev => ({ 
        ...prev, 
        media: media.sort((a, b) => b.uploadDate?.toDate?.() - a.uploadDate?.toDate?.() || 0),
        loading: false 
      }));
    } catch (error) {
      console.error('Error loading media:', error);
      toast.error('Failed to load media');
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const filterMedia = () => {
    let filtered = [...state.media];

    // Filter by search term
    if (state.searchTerm.trim()) {
      const term = state.searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.dishName?.toLowerCase().includes(term) ||
        item.originalFileName.toLowerCase().includes(term) ||
        item.metadata.originalName.toLowerCase().includes(term) ||
        Object.values(item.metadata.customMetadata || {}).some(value =>
          value.toLowerCase().includes(term)
        )
      );
    }

    // Filter by type
    if (state.selectedType !== 'all') {
      filtered = filtered.filter(item => item.type === state.selectedType);
    }

    // Filter by restaurant
    if (state.selectedRestaurant !== 'all') {
      filtered = filtered.filter(item => item.restaurantId === state.selectedRestaurant);
    }

    setState(prev => ({ ...prev, filteredMedia: filtered }));
  };

  const handleEditMedia = (media: MediaItem) => {
    setState(prev => ({
      ...prev,
      selectedMedia: media,
      showEditModal: true,
      editForm: {
        dishName: media.dishName || '',
        quality: media.quality || 3,
        customMetadata: { ...media.metadata.customMetadata }
      }
    }));
  };

  const handleSaveEdit = async () => {
    if (!state.selectedMedia) return;

    try {
      await updateImageMetadata(state.selectedMedia.id, {
        dishName: state.editForm.dishName,
        quality: state.editForm.quality,
        customMetadata: state.editForm.customMetadata
      });

      toast.success('Media metadata updated successfully');
      setState(prev => ({ ...prev, showEditModal: false, selectedMedia: null }));
      loadMedia(); // Reload to get updated data
    } catch (error) {
      console.error('Error updating media metadata:', error);
      toast.error('Failed to update media metadata');
    }
  };

  const handleDeleteMedia = async (media: MediaItem) => {
    if (!confirm(`Are you sure you want to delete "${media.dishName || media.originalFileName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteMediaItem(media.id);
      toast.success('Media deleted successfully');
      loadMedia(); // Reload to reflect deletion
    } catch (error) {
      console.error('Error deleting media:', error);
      toast.error('Failed to delete media');
    }
  };

  const handlePreviewMedia = (media: MediaItem) => {
    setState(prev => ({
      ...prev,
      selectedMedia: media,
      showPreviewModal: true
    }));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'dish':
        return '🍽️';
      case 'logo':
        return '🏢';
      case 'menu':
        return '📄';
      default:
        return '📷';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'dish':
        return 'bg-green-100 text-green-800';
      case 'logo':
        return 'bg-blue-100 text-blue-800';
      case 'menu':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (state.loading) {
    return (
      <AdminDashboardLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size={48} />
        </div>
      </AdminDashboardLayout>
    );
  }

  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Media Management</h1>
            <p className="text-gray-600">Manage all application images and their metadata</p>
          </div>
          <div className="text-sm text-gray-500">
            Total: {state.filteredMedia.length} / {state.media.length} items
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by name, filename, or metadata..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={state.searchTerm}
                onChange={(e) => setState(prev => ({ ...prev, searchTerm: e.target.value }))}
              />
            </div>

            {/* Type Filter */}
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={state.selectedType}
              onChange={(e) => setState(prev => ({ ...prev, selectedType: e.target.value as any }))}
            >
              <option value="all">All Types</option>
              <option value="dish">Dish Images</option>
              <option value="logo">Restaurant Logos</option>
              <option value="menu">Menu Files</option>
            </select>

            {/* Restaurant Filter */}
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={state.selectedRestaurant}
              onChange={(e) => setState(prev => ({ ...prev, selectedRestaurant: e.target.value }))}
            >
              <option value="all">All Restaurants</option>
              {uniqueRestaurants.map(restaurantId => (
                <option key={restaurantId} value={restaurantId}>
                  {restaurantId}
                </option>
              ))}
            </select>

            {/* Clear Filters */}
            <button
              onClick={() => setState(prev => ({
                ...prev,
                searchTerm: '',
                selectedType: 'all',
                selectedRestaurant: 'all'
              }))}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Media Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {state.filteredMedia.map((media) => (
            <div key={media.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
              {/* Image Preview */}
              <div className="aspect-w-16 aspect-h-9 relative">
                <img
                  src={media.url}
                  alt={media.dishName || media.originalFileName}
                  className="w-full h-48 object-cover rounded-t-lg cursor-pointer"
                  onClick={() => handlePreviewMedia(media)}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/icons/placeholder.png';
                  }}
                />
                <div className="absolute top-2 left-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(media.type)}`}>
                    {getTypeIcon(media.type)} {media.type}
                  </span>
                </div>
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={() => handlePreviewMedia(media)}
                    className="p-1 bg-black bg-opacity-50 text-white rounded hover:bg-opacity-75"
                    title="Preview"
                  >
                    <Eye size={16} />
                  </button>
                </div>
              </div>

              {/* Media Info */}
              <div className="p-4">
                <div className="mb-2">
                  <h3 className="font-semibold text-gray-900 truncate" title={media.dishName || media.originalFileName}>
                    {media.dishName || media.originalFileName}
                  </h3>
                  <p className="text-sm text-gray-500 truncate" title={media.originalFileName}>
                    {media.originalFileName}
                  </p>
                </div>

                <div className="text-xs text-gray-500 space-y-1 mb-3">
                  <div>Size: {formatFileSize(media.size)}</div>
                  <div>Uploaded: {formatDate(media.uploadDate)}</div>
                  <div className="truncate">Restaurant: {media.restaurantId}</div>
                  <div className="flex items-center gap-1">
                    <span>Quality:</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-xs ${star <= (media.quality || 3) ? 'text-yellow-500' : 'text-gray-300'}`}
                        >
                          ★
                        </span>
                      ))}
                      <span className="text-gray-600">({media.quality || 3}/5)</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between">
                  <button
                    onClick={() => handleEditMedia(media)}
                    className="flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit2 size={14} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteMedia(media)}
                    className="flex items-center gap-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {state.filteredMedia.length === 0 && !state.loading && (
          <div className="text-center py-12">
            <ImageIcon size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No media found</h3>
            <p className="text-gray-500">
              {state.searchTerm || state.selectedType !== 'all' || state.selectedRestaurant !== 'all'
                ? 'Try adjusting your filters'
                : 'No media has been uploaded yet'}
            </p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={state.showEditModal}
        onClose={() => setState(prev => ({ ...prev, showEditModal: false }))}
        title="Edit Media Metadata"
      >
        {state.selectedMedia && (
          <div className="space-y-4">
            {/* Preview */}
            <div className="flex items-center gap-4">
              <img
                src={state.selectedMedia.url}
                alt={state.selectedMedia.dishName || state.selectedMedia.originalFileName}
                className="w-20 h-20 object-cover rounded-lg"
              />
              <div>
                <h4 className="font-medium">{state.selectedMedia.originalFileName}</h4>
                <p className="text-sm text-gray-500">{formatFileSize(state.selectedMedia.size)}</p>
              </div>
            </div>

            {/* Dish Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dish Name / Description
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={state.editForm.dishName}
                onChange={(e) => setState(prev => ({
                  ...prev,
                  editForm: { ...prev.editForm, dishName: e.target.value }
                }))}
                placeholder="Enter dish name or description"
              />
            </div>

            {/* Quality Rating */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Image Quality Rating (1-5)
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={state.editForm.quality}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  // Allow any input while typing, but validate on blur
                  setState(prev => ({
                    ...prev,
                    editForm: { ...prev.editForm, quality: inputValue }
                  }));
                }}
                onBlur={(e) => {
                  const inputValue = e.target.value;
                  const numValue = parseInt(inputValue);
                  // Validate and set proper value when user finishes editing
                  if (isNaN(numValue) || numValue < 1) {
                    setState(prev => ({
                      ...prev,
                      editForm: { ...prev.editForm, quality: 1 }
                    }));
                  } else if (numValue > 5) {
                    setState(prev => ({
                      ...prev,
                      editForm: { ...prev.editForm, quality: 5 }
                    }));
                  } else {
                    setState(prev => ({
                      ...prev,
                      editForm: { ...prev.editForm, quality: numValue }
                    }));
                  }
                }}
                placeholder="Enter quality rating (1-5)"
              />
              <div className="flex items-center gap-1 mt-2">
                <span className="text-sm text-gray-600">Quality:</span>
                {[1, 2, 3, 4, 5].map((star) => {
                  const currentQuality = parseInt(String(state.editForm.quality)) || 1;
                  return (
                    <span
                      key={star}
                      className={`text-lg ${star <= currentQuality ? 'text-yellow-500' : 'text-gray-300'}`}
                    >
                      ★
                    </span>
                  );
                })}
                <span className="text-sm text-gray-600 ml-2">({state.editForm.quality}/5)</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Poor (1) ← → Excellent (5)
              </div>
            </div>

            {/* Custom Metadata */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custom Metadata (Key-Value pairs)
              </label>
              <div className="space-y-2">
                {Object.entries(state.editForm.customMetadata).map(([key, value], index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Key"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={key}
                      onChange={(e) => {
                        const newMetadata = { ...state.editForm.customMetadata };
                        delete newMetadata[key];
                        newMetadata[e.target.value] = value;
                        setState(prev => ({
                          ...prev,
                          editForm: { ...prev.editForm, customMetadata: newMetadata }
                        }));
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Value"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={value}
                      onChange={(e) => {
                        setState(prev => ({
                          ...prev,
                          editForm: {
                            ...prev.editForm,
                            customMetadata: { ...prev.editForm.customMetadata, [key]: e.target.value }
                          }
                        }));
                      }}
                    />
                    <button
                      onClick={() => {
                        const newMetadata = { ...state.editForm.customMetadata };
                        delete newMetadata[key];
                        setState(prev => ({
                          ...prev,
                          editForm: { ...prev.editForm, customMetadata: newMetadata }
                        }));
                      }}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setState(prev => ({
                      ...prev,
                      editForm: {
                        ...prev.editForm,
                        customMetadata: { ...prev.editForm.customMetadata, '': '' }
                      }
                    }));
                  }}
                  className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded"
                >
                  + Add Metadata
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setState(prev => ({ ...prev, showEditModal: false }))}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={state.showPreviewModal}
        onClose={() => setState(prev => ({ ...prev, showPreviewModal: false }))}
        title="Media Preview"
        size="lg"
      >
        {state.selectedMedia && (
          <div className="space-y-4">
            <div className="text-center">
              <img
                src={state.selectedMedia.url}
                alt={state.selectedMedia.dishName || state.selectedMedia.originalFileName}
                className="max-w-full max-h-96 mx-auto rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/icons/placeholder.png';
                }}
              />
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">{state.selectedMedia.dishName || state.selectedMedia.originalFileName}</h4>
              
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <span className="font-medium">Type:</span> {state.selectedMedia.type}
                </div>
                <div>
                  <span className="font-medium">Size:</span> {formatFileSize(state.selectedMedia.size)}
                </div>
                <div>
                  <span className="font-medium">Uploaded:</span> {formatDate(state.selectedMedia.uploadDate)}
                </div>
                <div>
                  <span className="font-medium">Restaurant:</span> {state.selectedMedia.metadata?.restaurantName || state.selectedMedia.restaurantId}
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Quality:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-sm ${star <= (state.selectedMedia.quality || 3) ? 'text-yellow-500' : 'text-gray-300'}`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <span className="text-sm text-gray-600">({state.selectedMedia.quality || 3}/5)</span>
                  </div>
                </div>
              </div>

              {/* Rich Metadata from Migration Script */}
              {state.selectedMedia.metadata && (
                <div className="space-y-3">
                  {/* Dish Information */}
                  {(state.selectedMedia.metadata.dishName || state.selectedMedia.metadata.dishDescription) && (
                    <div>
                      <span className="font-medium text-sm">Dish Information:</span>
                      <div className="text-xs text-gray-600 mt-1">
                        {state.selectedMedia.metadata.dishName && (
                          <div><span className="font-medium">Name:</span> {state.selectedMedia.metadata.dishName}</div>
                        )}
                        {state.selectedMedia.metadata.dishDescription && (
                          <div><span className="font-medium">Description:</span> {state.selectedMedia.metadata.dishDescription}</div>
                        )}
                        {state.selectedMedia.metadata.dishPrice && (
                          <div><span className="font-medium">Price:</span> {state.selectedMedia.metadata.dishPrice} XAF</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Restaurant & Category */}
                  {(state.selectedMedia.metadata.restaurantName || state.selectedMedia.metadata.categoryName) && (
                    <div>
                      <span className="font-medium text-sm">Restaurant & Category:</span>
                      <div className="text-xs text-gray-600 mt-1">
                        {state.selectedMedia.metadata.restaurantName && (
                          <div><span className="font-medium">Restaurant:</span> {state.selectedMedia.metadata.restaurantName}</div>
                        )}
                        {state.selectedMedia.metadata.categoryName && (
                          <div><span className="font-medium">Category:</span> {state.selectedMedia.metadata.categoryName}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {state.selectedMedia.metadata.tags && state.selectedMedia.metadata.tags.length > 0 && (
                    <div>
                      <span className="font-medium text-sm">Tags:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {state.selectedMedia.metadata.tags.map((tag, index) => (
                          <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cuisine & Dietary */}
                  {(state.selectedMedia.metadata.cuisine || (state.selectedMedia.metadata.dietary && state.selectedMedia.metadata.dietary.length > 0)) && (
                    <div>
                      <span className="font-medium text-sm">Cuisine & Dietary:</span>
                      <div className="text-xs text-gray-600 mt-1">
                        {state.selectedMedia.metadata.cuisine && (
                          <div><span className="font-medium">Cuisine:</span> {state.selectedMedia.metadata.cuisine}</div>
                        )}
                        {state.selectedMedia.metadata.dietary && state.selectedMedia.metadata.dietary.length > 0 && (
                          <div>
                            <span className="font-medium">Dietary:</span> 
                            <div className="flex flex-wrap gap-1 mt-1">
                              {state.selectedMedia.metadata.dietary.map((diet, index) => (
                                <span key={index} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                  {diet}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Search Keywords */}
                  {state.selectedMedia.metadata.searchKeywords && state.selectedMedia.metadata.searchKeywords.length > 0 && (
                    <div>
                      <span className="font-medium text-sm">Search Keywords:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {state.selectedMedia.metadata.searchKeywords.slice(0, 10).map((keyword, index) => (
                          <span key={index} className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded">
                            {keyword}
                          </span>
                        ))}
                        {state.selectedMedia.metadata.searchKeywords.length > 10 && (
                          <span className="text-xs text-gray-500">+{state.selectedMedia.metadata.searchKeywords.length - 10} more</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Quality & Migration Info */}
                  {(state.selectedMedia.metadata.qualityScore || state.selectedMedia.metadata.migratedFrom) && (
                    <div>
                      <span className="font-medium text-sm">Technical Info:</span>
                      <div className="text-xs text-gray-600 mt-1">
                        {state.selectedMedia.metadata.qualityScore && (
                          <div><span className="font-medium">Quality Score:</span> {state.selectedMedia.metadata.qualityScore}</div>
                        )}
                        {state.selectedMedia.metadata.migratedFrom && (
                          <div><span className="font-medium">Migrated From:</span> {state.selectedMedia.metadata.migratedFrom}</div>
                        )}
                        {state.selectedMedia.metadata.migrationDate && (
                          <div><span className="font-medium">Migration Date:</span> {new Date(state.selectedMedia.metadata.migrationDate).toLocaleString()}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Custom Metadata */}
                  {state.selectedMedia.metadata.customMetadata && Object.keys(state.selectedMedia.metadata.customMetadata).length > 0 && (
                    <div>
                      <span className="font-medium text-sm">Custom Metadata:</span>
                      <div className="mt-1 space-y-1">
                        {Object.entries(state.selectedMedia.metadata.customMetadata).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="font-medium">{key}:</span> {value}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <a
                href={state.selectedMedia.url}
                download={state.selectedMedia.originalFileName}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download size={16} />
                Download
              </a>
            </div>
          </div>
        )}
      </Modal>
    </AdminDashboardLayout>
  );
};

export default MediaManagement;
