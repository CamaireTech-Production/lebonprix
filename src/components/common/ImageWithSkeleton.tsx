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

  const handleLoad = () => {
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
        src={getImageSrc(src)}
        alt={alt}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
};
