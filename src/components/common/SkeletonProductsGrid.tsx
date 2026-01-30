import React from 'react';
import SkeletonLoader from './SkeletonLoader';

interface SkeletonProductsGridProps {
  rows?: number;
}

/**
 * Skeleton loader for Products page grid layout
 */
const SkeletonProductsGrid: React.FC<SkeletonProductsGridProps> = ({ rows = 20 }) => {
  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <SkeletonLoader width="w-full md:w-64" height="h-10" />
          <SkeletonLoader width="w-full md:w-48" height="h-10" />
          <SkeletonLoader width="w-32" height="h-10" />
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(rows)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            {/* Product Image */}
            <SkeletonLoader width="w-full" height="h-48" className="mb-3" />

            {/* Product Name */}
            <SkeletonLoader width="w-3/4" height="h-5" className="mb-2" />

            {/* Product Category */}
            <SkeletonLoader width="w-1/2" height="h-4" className="mb-3" />

            {/* Price and Stock */}
            <div className="flex justify-between items-center mb-3">
              <SkeletonLoader width="w-24" height="h-6" />
              <SkeletonLoader width="w-16" height="h-5" />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <SkeletonLoader width="w-full" height="h-9" />
              <SkeletonLoader width="w-9" height="h-9" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkeletonProductsGrid;
