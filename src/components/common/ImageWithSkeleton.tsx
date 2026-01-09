// src/components/common/ImageWithSkeleton.tsx
import React, { useState, useEffect } from 'react';

// Global cache to track loaded images
const loadedImagesCache = new Set<string>();

interface ImageWithSkeletonProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  onError?: () => void;
  onLoad?: () => void;
}

const ImageWithSkeleton: React.FC<ImageWithSkeletonProps> = ({
  src,
  alt,
  className = '',
  placeholder = '/placeholder.png',
  onError,
  onLoad
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Check if image is already cached/loaded when src changes
  useEffect(() => {
    // Handle image source - only support proper URLs and blob URLs
    const getImageSrc = (imageSrc: string) => {
      if (!imageSrc || imageSrc.trim() === '') {
        return placeholder;
      }
      
      // Handle different image source types
      if (imageSrc.startsWith('http') || imageSrc.startsWith('/') || imageSrc.startsWith('blob:')) {
        return imageSrc; // HTTP URL, local path, or blob URL
      }
      
      // If it's not a proper URL, return placeholder
      console.warn('Invalid image source, using placeholder:', imageSrc);
      return placeholder;
    };

    const imageSrc = getImageSrc(src);
    if (imageSrc === placeholder || !src) {
      setIsLoading(false);
      return;
    }

    // If image is already in cache (was loaded before), skip loading state
    if (loadedImagesCache.has(src)) {
      setIsLoading(false);
      setHasError(false);
      return;
    }

    // Check if the image is already loaded in the browser cache
    const img = new Image();
    img.onload = () => {
      loadedImagesCache.add(src);
      setIsLoading(false);
      setHasError(false);
    };
    img.onerror = () => {
      setIsLoading(false);
      setHasError(true);
    };
    img.src = src;

    // Reset loading state for new src
    setIsLoading(true);
    setHasError(false);
  }, [src, placeholder]);

  const handleLoad = () => {
    loadedImagesCache.add(src);
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    console.error('Image load error for src:', src);
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
        src={src && (src.startsWith('http') || src.startsWith('/') || src.startsWith('blob:')) ? src : placeholder}
        alt={alt}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
};

export default ImageWithSkeleton;
