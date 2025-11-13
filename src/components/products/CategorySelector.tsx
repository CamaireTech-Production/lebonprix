import React, { useState, useEffect } from 'react';
import { ChevronDown, Plus, Grid, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ImageWithSkeleton } from '../common/ImageWithSkeleton';
import { subscribeToCategories } from '../../services/firestore';
import type { Category } from '../../types/models';

interface CategorySelectorProps {
  value: string;
  onChange: (category: string) => void;
  showImages?: boolean;
  placeholder?: string;
  className?: string;
}

const CategorySelector: React.FC<CategorySelectorProps> = ({
  value,
  onChange,
  showImages = true,
  placeholder = "Select a category",
  className = ""
}) => {
  const { company } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Subscribe to categories
  useEffect(() => {
    if (!company?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToCategories(company.id, (categoriesData) => {
      setCategories(categoriesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [company?.id]);

  // Filter categories based on search
  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Get selected category info
  const selectedCategory = categories.find(cat => cat.name === value);

  // Handle category selection
  const handleCategorySelect = (categoryName: string) => {
    onChange(categoryName);
    setIsOpen(false);
    setSearchQuery('');
  };

  // Handle create new category
  const handleCreateNew = () => {
    if (searchQuery.trim()) {
      onChange(searchQuery.trim());
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            {selectedCategory && showImages && selectedCategory.image ? (
              <div className="w-6 h-6 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                <ImageWithSkeleton
                  src={selectedCategory.image}
                  alt={selectedCategory.name}
                  className="w-full h-full object-cover"
                  placeholder=""
                />
              </div>
            ) : selectedCategory && showImages ? (
              <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Grid size={12} className="text-gray-400" />
              </div>
            ) : null}
            
            <span className={`${selectedCategory ? 'text-gray-900' : 'text-gray-500'} truncate`}>
              {selectedCategory ? selectedCategory.name : placeholder}
            </span>
          </div>
          
          <ChevronDown 
            size={20} 
            className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                autoFocus
              />
            </div>
          </div>

          {/* Categories List */}
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mx-auto mb-2"></div>
                Loading categories...
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {searchQuery ? (
                  <div className="space-y-2">
                    <p>No categories found</p>
                    {searchQuery.trim() && (
                      <button
                        onClick={handleCreateNew}
                        className="flex items-center space-x-2 text-emerald-600 hover:text-emerald-700 text-sm mx-auto"
                      >
                        <Plus size={16} />
                        <span>Create "{searchQuery.trim()}"</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <p>No categories available</p>
                )}
              </div>
            ) : (
              <div className="py-1">
                {filteredCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategorySelect(category.name)}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 ${
                      value === category.name ? 'bg-emerald-50 text-emerald-700' : 'text-gray-900'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {showImages && (
                        <div className="w-8 h-8 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                          {category.image ? (
                            <ImageWithSkeleton
                              src={category.image}
                              alt={category.name}
                              className="w-full h-full object-cover"
                              placeholder=""
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Grid size={16} className="text-gray-400" />
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">
                          {category.name}
                        </div>
                        {category.description && (
                          <div className="text-xs text-gray-500 truncate">
                            {category.description}
                          </div>
                        )}
                      </div>
                      
                      {category.productCount !== undefined && (
                        <div className="text-xs text-gray-400 flex-shrink-0">
                          {category.productCount} products
                        </div>
                      )}
                    </div>
                  </button>
                ))}
                
                {/* Create new category option */}
                {searchQuery.trim() && !filteredCategories.some(cat => cat.name.toLowerCase() === searchQuery.toLowerCase()) && (
                  <button
                    onClick={handleCreateNew}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 text-emerald-600 border-t border-gray-200"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <Plus size={16} className="text-emerald-600" />
                      </div>
                      <div className="font-medium text-sm">
                        Create "{searchQuery.trim()}"
                      </div>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default CategorySelector;
