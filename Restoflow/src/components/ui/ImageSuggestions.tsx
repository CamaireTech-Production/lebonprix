import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, Image as ImageIcon, Check, Info, X, RefreshCw } from 'lucide-react';
import { getImageSuggestions, getDiverseImageSuggestions, ImageSuggestion } from '../../services/storageService';
import LoadingSpinner from './LoadingSpinner';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import designSystem from '../../designSystem';

interface ImageSuggestionsProps {
  restaurantId: string;
  dishName: string;
  onImageSelect: (imageUrl: string, suggestion: ImageSuggestion) => void;
  currentImageUrl?: string;
  disabled?: boolean;
}

const ImageSuggestions: React.FC<ImageSuggestionsProps> = ({
  restaurantId,
  dishName,
  onImageSelect,
  currentImageUrl,
  disabled = false
}) => {
  const [suggestions, setSuggestions] = useState<ImageSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const { language } = useLanguage();

  // Debounced dish name to avoid too many API calls
  const debouncedDishName = useMemo(() => {
    const timeoutId = setTimeout(() => dishName, 500);
    return () => clearTimeout(timeoutId);
  }, [dishName]);

  // Fetch suggestions when dish name changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!dishName.trim() || disabled) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        // Fetch all suggestions from all restaurants (no restaurant filtering)
        const allSuggestions = await getDiverseImageSuggestions(restaurantId, dishName, 12);
        setSuggestions(allSuggestions);
      } catch (error) {
        console.error('Error fetching image suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [dishName, restaurantId, disabled]);

  // Handle image selection
  const handleImageSelect = (suggestion: ImageSuggestion) => {
    if (disabled) return;
    
    setSelectedImageId(suggestion.id);
    onImageSelect(suggestion.url, suggestion);
    
    // Visual feedback
    setTimeout(() => setSelectedImageId(null), 1000);
  };


  if (!dishName.trim() || disabled) {
    return null;
  }

  const hasAnySuggestions = suggestions.length > 0;

  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
      {/* Header */}
      <div className="flex items-center mb-3">
        <div className="flex items-center space-x-2">
          <Sparkles size={18} className="text-blue-600" />
          <h4 className="text-sm font-semibold text-blue-900">
            {t('smart_image_suggestions', language) || 'Smart Image Suggestions'}
          </h4>
          {isLoading && <RefreshCw size={14} className="text-blue-600 animate-spin" />}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size={24} />
          <span className="ml-2 text-sm text-gray-600">
            {t('analyzing_dish_name', language) || 'Analyzing dish name...'}
          </span>
        </div>
      )}

      {/* No Suggestions */}
      {!isLoading && !hasAnySuggestions && (
        <div className="text-center py-6">
          <ImageIcon size={32} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">
            {t('no_matching_images', language) || 'No matching images found for this dish name.'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {t('try_different_name', language) || 'Try a different dish name or upload a new image.'}
          </p>
        </div>
      )}

      {/* Suggestions Grid */}
      {!isLoading && hasAnySuggestions && (
        <div className="block sm:hidden">
          {/* Mobile: Horizontal slider */}
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {suggestions.map((suggestion) => (
              <div key={suggestion.id} className="flex-shrink-0 w-24 h-24">
                <SuggestionCard
                  suggestion={suggestion}
                  isSelected={selectedImageId === suggestion.id}
                  isCurrentImage={currentImageUrl === suggestion.url}
                  onSelect={() => handleImageSelect(suggestion)}
                  disabled={disabled}
                  isMobile={true}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Desktop Grid */}
      {!isLoading && hasAnySuggestions && (
        <div className="hidden sm:grid sm:grid-cols-3 md:grid-cols-4 gap-3">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              isSelected={selectedImageId === suggestion.id}
              isCurrentImage={currentImageUrl === suggestion.url}
              onSelect={() => handleImageSelect(suggestion)}
              disabled={disabled}
              isMobile={false}
            />
          ))}
        </div>
      )}

      {/* Info Footer */}
      {hasAnySuggestions && !isLoading && (
        <div className="mt-3 pt-3 border-t border-blue-200">
          <div className="flex items-start space-x-2">
            <Info size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              {t('smart_suggestions_info', language) || 'Smart suggestions from our image database. Click on any image to use it for your dish.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// Individual suggestion card component
interface SuggestionCardProps {
  suggestion: ImageSuggestion;
  isSelected: boolean;
  isCurrentImage: boolean;
  onSelect: () => void;
  disabled: boolean;
  isMobile?: boolean;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  isSelected,
  isCurrentImage,
  onSelect,
  disabled,
  isMobile = false
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative group">
      <div
        className={`
          relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200
          ${isMobile ? 'w-full h-full' : 'aspect-square'}
          ${isCurrentImage 
            ? 'ring-2 ring-green-500 ring-offset-2' 
            : 'hover:ring-2 hover:ring-blue-400 hover:ring-offset-1'
          }
          ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 scale-105' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onClick={onSelect}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <img
          src={suggestion.url}
          alt={suggestion.dishName || 'Dish image'}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200" />
        

        {/* Current image indicator */}
        {isCurrentImage && (
          <div className="absolute bottom-1 right-1">
            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
              <Check size={12} className="text-white" />
            </div>
          </div>
        )}

        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <Check size={16} className="text-white" />
            </div>
          </div>
        )}

      </div>

      {/* Tooltip */}
      {showTooltip && !isMobile && (
        <div className="absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg max-w-48">
          <div className="font-medium">{suggestion.dishName || 'Unknown dish'}</div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

export default ImageSuggestions;
