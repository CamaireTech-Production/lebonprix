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

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
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
        src={src}
        alt={alt}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
};
