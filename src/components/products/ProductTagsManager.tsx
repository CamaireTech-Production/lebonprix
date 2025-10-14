import React, { useState } from 'react';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import type { ProductTag, TagVariation } from '../../types/models';

interface ProductTagsManagerProps {
  tags?: ProductTag[];
  onTagsChange: (tags: ProductTag[]) => void;
  images?: string[];
}

const ProductTagsManager: React.FC<ProductTagsManagerProps> = ({ tags = [], onTagsChange, images = [] }) => {
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newVariationName, setNewVariationName] = useState('');
  const [editingVariation, setEditingVariation] = useState<{ tagId: string; variationId: string } | null>(null);

  const addTag = () => {
    if (!newTagName.trim()) return;
    
    const newTag: ProductTag = {
      id: `tag_${Date.now()}`,
      name: newTagName.trim(),
      variations: []
    };
    
    onTagsChange([...tags, newTag]);
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

  const updateVariationImage = (tagId: string, variationId: string, imageIndex: number) => {
    const updatedTags = tags.map(tag => 
      tag.id === tagId 
        ? { 
            ...tag, 
            variations: tag.variations.map(v => 
              v.id === variationId 
                ? { ...v, imageIndex: imageIndex >= 0 ? imageIndex : undefined }
                : v
            )
          }
        : tag
    );
    
    onTagsChange(updatedTags);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Product Tags & Variations</h3>
        <button
          type="button"
          onClick={() => setEditingTag('new')}
          className="flex items-center space-x-1 text-sm text-emerald-600 hover:text-emerald-700"
        >
          <Plus className="h-4 w-4" />
          <span>Add Tag</span>
        </button>
      </div>

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
                
                {/* Image selector */}
                {images.length > 0 && (
                  <select
                    value={variation.imageIndex ?? ''}
                    onChange={(e) => updateVariationImage(tag.id, variation.id, parseInt(e.target.value))}
                    className="text-xs border border-gray-300 rounded px-2 py-1"
                  >
                    <option value="">No image</option>
                    {images.map((_, index) => (
                      <option key={index} value={index}>
                        Image {index + 1}
                      </option>
                    ))}
                  </select>
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
