// src/components/common/ImageWithSkeleton.tsx
import React, { useState } from 'react';

interface ImageWithSkeletonProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  onError?: () => void;
  onLoad?: () => void;
}

export const ImageWithSkeleton: React.FC<ImageWithSkeletonProps> = ({
  src,
  alt,
  className = '',
  placeholder = '/placeholder.png',
  onError,
  onLoad
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Convert base64 data to data URL if needed
  const getImageSrc = (imageSrc: string) => {
    if (!imageSrc || imageSrc.trim() === '') {
      console.warn('Empty image source provided to ImageWithSkeleton');
      return placeholder;
    }
    
    if (imageSrc.startsWith('data:')) {
      return imageSrc; // Already a data URL
    } else if (imageSrc.startsWith('/') && !imageSrc.startsWith('/9j/') && !imageSrc.startsWith('/9j4')) {
      return imageSrc; // Regular URL path (not base64)
    } else if (imageSrc.startsWith('http')) {
      return imageSrc; // HTTP URL
    } else {
      // Assume it's base64 data and convert to data URL
      console.log('Converting base64 to data URL for image:', {
        preview: imageSrc.substring(0, 50) + '...',
        length: imageSrc.length,
        endsWith: imageSrc.substring(imageSrc.length - 10)
      });
      
      // Try to detect image format from base64 data
      let mimeType = 'image/jpeg'; // Default
      if (imageSrc.startsWith('/9j/') || imageSrc.startsWith('/9j4')) {
        mimeType = 'image/jpeg';
      } else if (imageSrc.startsWith('iVBORw0KGgo')) {
        mimeType = 'image/png';
      } else if (imageSrc.startsWith('R0lGOD')) {
        mimeType = 'image/gif';
      } else if (imageSrc.startsWith('UklGR')) {
        mimeType = 'image/webp';
      } else {
        // Try to detect from first few characters
        const firstChars = imageSrc.substring(0, 10);
        console.log('Unknown image format, first 10 chars:', firstChars);
        // Default to JPEG for most cases
        mimeType = 'image/jpeg';
      }
      
      // Validate base64 data
      if (imageSrc.length < 100) {
        console.error('Base64 data too short, might be corrupted:', imageSrc);
        return placeholder;
      }
      
      const dataUrl = `data:${mimeType};base64,${imageSrc}`;
      console.log('Generated data URL:', dataUrl.substring(0, 100) + '...');
      return dataUrl;
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('Image load error:', e);
    console.error('Failed image src:', getImageSrc(src));
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  // Skeleton loader component
  const SkeletonLoader = () => (
    <div className="absolute inset-0 animate-pulse bg-gray-200 rounded">
      <div className="w-full h-full bg-gray-300 rounded"></div>
    </div>
  );

  // If there's an error, show placeholder
  if (hasError) {
    return (
      <img
        src={placeholder}
        alt={alt}
        className={className}
        onError={() => {}} // Prevent infinite error loop
      />
    );
  }

  return (
    <div className="relative w-full h-full">
      {isLoading && <SkeletonLoader />}
      <img
        src={getImageSrc(src)}
        alt={alt}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
};
