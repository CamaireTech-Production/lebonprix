import React from 'react';
import SkeletonLoader from './SkeletonLoader';

/**
 * Skeleton loader for Product Detail Page (public catalogue)
 */
const SkeletonProductDetail: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between bg-gray-800">
        <SkeletonLoader width="w-6" height="h-6" />
        <SkeletonLoader width="w-32" height="h-6" />
        <div className="flex gap-3">
          <SkeletonLoader width="w-5" height="h-5" />
          <SkeletonLoader width="w-5" height="h-5" />
        </div>
      </div>

      {/* Product Image */}
      <div className="bg-white">
        <SkeletonLoader width="w-full" height="h-96" />
      </div>

      {/* Product Info */}
      <div className="bg-white p-4 space-y-4">
        <div>
          <SkeletonLoader width="w-3/4" height="h-8" className="mb-2" />
          <SkeletonLoader width="w-1/2" height="h-6" />
        </div>
        
        <div className="flex items-center gap-4">
          <SkeletonLoader width="w-32" height="h-8" />
          <SkeletonLoader width="w-24" height="h-6" />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <SkeletonLoader width="w-24" height="h-5" />
          <SkeletonLoader width="w-full" height="h-4" />
          <SkeletonLoader width="w-5/6" height="h-4" />
          <SkeletonLoader width="w-4/6" height="h-4" />
        </div>

        {/* Variations */}
        <div className="space-y-3">
          <SkeletonLoader width="w-32" height="h-5" />
          <div className="flex gap-2">
            {[...Array(4)].map((_, i) => (
              <SkeletonLoader key={i} width="w-16" height="h-8" rounded />
            ))}
          </div>
        </div>

        {/* Quantity and Add to Cart */}
        <div className="flex items-center gap-4 pt-4">
          <div className="flex items-center gap-2">
            <SkeletonLoader width="w-10" height="h-10" rounded />
            <SkeletonLoader width="w-12" height="h-6" />
            <SkeletonLoader width="w-10" height="h-10" rounded />
          </div>
          <SkeletonLoader width="w-full" height="h-12" rounded />
        </div>
      </div>

      {/* Additional Info */}
      <div className="bg-white mt-4 p-4 space-y-4">
        <SkeletonLoader width="w-40" height="h-6" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <SkeletonLoader width="w-24" height="h-4" />
              <SkeletonLoader width="w-32" height="h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SkeletonProductDetail;

