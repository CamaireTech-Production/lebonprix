import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X, Check, Copy, Bookmark } from 'lucide-react';
import type { ProductTag, TagVariation } from '../../types/models';
import { subscribeToUserTags, createUserTag } from '../../services/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface ProductTagsManagerProps {
  tags?: ProductTag[];
  onTagsChange: (tags: ProductTag[]) => void;
  images?: string[];
}

const ProductTagsManager: React.FC<ProductTagsManagerProps> = ({ tags = [], onTagsChange, images = [] }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newVariationName, setNewVariationName] = useState('');
  const [userTags, setUserTags] = useState<ProductTag[]>([]);
  const [showUserTags, setShowUserTags] = useState(false);

  // Load user tags from Firebase
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToUserTags(user.uid, (tags) => {
      setUserTags(tags);
    });

    return unsubscribe;
  }, [user?.uid]);

  const addTag = async () => {
    if (!newTagName.trim() || !user?.uid) return;
    
    const newTag: ProductTag = {
      id: `tag_${Date.now()}`,
      name: newTagName.trim(),
      variations: []
    };
    
    // Add to current product tags
    onTagsChange([...tags, newTag]);
    
    // Save to user's global tags in Firebase
    try {
      await createUserTag(newTag, user.uid);
    } catch (error) {
      console.error('Error saving tag to Firebase:', error);
    }
    
    setNewTagName('');
  };

  const removeTag = (tagId: string) => {
    onTagsChange(tags.filter(tag => tag.id !== tagId));
  };

  const addVariation = (tagId: string) => {
    if (!newVariationName.trim()) return;
    
    const newVariation: TagVariation = {
      id: `variation_${Date.now()}`,
      name: newVariationName.trim()
    };
    
    const updatedTags = tags.map(tag => 
      tag.id === tagId 
        ? { ...tag, variations: [...tag.variations, newVariation] }
        : tag
    );
    
    onTagsChange(updatedTags);
    setNewVariationName('');
  };

  const removeVariation = (tagId: string, variationId: string) => {
    const updatedTags = tags.map(tag => 
      tag.id === tagId 
        ? { ...tag, variations: tag.variations.filter(v => v.id !== variationId) }
        : tag
    );
    
    onTagsChange(updatedTags);
  };

  const updateVariationImage = (tagId: string, variationId: string, imageIndex: number | undefined) => {
    const updatedTags = tags.map(tag => 
      tag.id === tagId 
        ? { 
            ...tag, 
            variations: tag.variations.map(v => 
              v.id === variationId 
                ? { ...v, imageIndex: imageIndex !== undefined && imageIndex >= 0 ? imageIndex : undefined }
                : v
            )
          }
        : tag
    );
    
    onTagsChange(updatedTags);
  };

  // Copy a tag from user's global tags to current product
  const copyTagFromUserTags = (userTag: ProductTag) => {
    const newTag: ProductTag = {
      id: `tag_${Date.now()}`,
      name: userTag.name,
      variations: userTag.variations.map(variation => ({
        id: `variation_${Date.now()}_${Math.random()}`,
        name: variation.name,
        imageIndex: variation.imageIndex
      }))
    };
    
    onTagsChange([...tags, newTag]);
  };

  // Check if a user tag is already used in current product
  const isTagAlreadyUsed = (userTag: ProductTag) => {
    return tags.some(tag => tag.name.toLowerCase() === userTag.name.toLowerCase());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Product Tags & Variations</h3>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowUserTags(!showUserTags)}
            className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Bookmark className="h-4 w-4" />
            <span>My Tags ({userTags.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setEditingTag('new')}
            className="flex items-center space-x-1 text-sm text-emerald-600 hover:text-emerald-700"
          >
            <Plus className="h-4 w-4" />
            <span>Add Tag</span>
          </button>
        </div>
      </div>

      {/* User Tags Section */}
      {showUserTags && (
        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
          <h4 className="text-sm font-medium text-blue-900 mb-3">Your Saved Tags</h4>
          {userTags.length > 0 ? (
            <div className="space-y-2">
              {userTags.map((userTag) => (
                <div key={userTag.id} className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-900">{userTag.name}</div>
                    <div className="text-xs text-gray-500">
                      {userTag.variations.length} variations: {userTag.variations.map(v => v.name).join(', ')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyTagFromUserTags(userTag)}
                    disabled={isTagAlreadyUsed(userTag)}
                    className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
                      isTagAlreadyUsed(userTag)
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    <Copy className="h-3 w-3" />
                    <span>{isTagAlreadyUsed(userTag) ? t('common.used') : t('common.copy')}</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-blue-600">
              <p className="text-sm">{t('products.tags.noSavedTags')}</p>
              <p className="text-xs mt-1">Create tags and they'll be saved here for future use</p>
            </div>
          )}
        </div>
      )}

      {/* Add new tag */}
      {editingTag === 'new' && (
        <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Tag name (e.g., Model, Color, Size)"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              onKeyPress={(e) => e.key === 'Enter' && addTag()}
            />
            <button
              type="button"
              onClick={addTag}
              className="p-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingTag(null);
                setNewTagName('');
              }}
              className="p-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Image-Variation Mapping Summary */}
      {images.length > 0 && tags.some(tag => tag.variations.some(v => v.imageIndex !== undefined)) && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-3">Image Assignments</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((image, index) => {
              const assignedVariations = tags
                .flatMap(tag => tag.variations)
                .filter(variation => variation.imageIndex === index);
              
              return (
                <div key={index} className="text-center">
                  <div className="relative w-16 h-16 mx-auto mb-2 rounded-lg overflow-hidden border-2 border-gray-300">
                    <img
                      src={image}
                      alt={`Image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs px-1 rounded-bl">
                      {index + 1}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    {assignedVariations.length > 0 ? (
                      <div>
                        <div className="font-medium text-blue-800">Assigned to:</div>
                        {assignedVariations.map((variation, idx) => (
                          <div key={idx} className="text-blue-700">
                            {variation.name}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-400">Not assigned</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Existing tags */}
      {tags.map((tag) => (
        <div key={tag.id} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">{tag.name}</h4>
            <button
              type="button"
              onClick={() => removeTag(tag.id)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Variations */}
          <div className="space-y-2">
            {tag.variations.map((variation) => (
              <div key={variation.id} className="flex items-center space-x-2 p-2 bg-white rounded border">
                <span className="flex-1 text-sm">{variation.name}</span>
                
                {/* Image selector with thumbnails */}
                {images.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">Image:</span>
                    <div className="flex space-x-1">
                      <button
                        type="button"
                        onClick={() => updateVariationImage(tag.id, variation.id, undefined)}
                        className={`px-2 py-1 text-xs rounded border ${
                          variation.imageIndex === undefined 
                            ? 'bg-gray-100 border-gray-400 text-gray-700' 
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                        title="No image"
                      >
                        None
                      </button>
                      {images.map((image, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => updateVariationImage(tag.id, variation.id, index)}
                          className={`relative w-8 h-8 rounded border-2 overflow-hidden ${
                            variation.imageIndex === index 
                              ? 'border-emerald-500 ring-2 ring-emerald-200' 
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                          title={`Image ${index + 1} - ${variation.name}`}
                        >
                          <img
                            src={image}
                            alt={`Image ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {variation.imageIndex === index && (
                            <div className="absolute inset-0 bg-emerald-500 bg-opacity-20 flex items-center justify-center">
                              <div className="w-2 h-2 bg-emerald-600 rounded-full"></div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <button
                  type="button"
                  onClick={() => removeVariation(tag.id, variation.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {/* Add variation */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Variation name (e.g., N1, Red, Large)"
                value={newVariationName}
                onChange={(e) => setNewVariationName(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                onKeyPress={(e) => e.key === 'Enter' && addVariation(tag.id)}
              />
              <button
                type="button"
                onClick={() => addVariation(tag.id)}
                className="p-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {tags.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No tags added yet</p>
          <p className="text-xs mt-1">Add tags to create product variations like Model, Color, Size, etc.</p>
        </div>
      )}
    </div>
  );
};

export default ProductTagsManager;
