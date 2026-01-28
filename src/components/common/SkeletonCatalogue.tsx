import React from 'react';
import SkeletonLoader from './SkeletonLoader';

/**
 * Skeleton loader for Catalogue page
 */
const SkeletonCatalogue: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <SkeletonLoader width="w-48" height="h-8" />
          <div className="flex gap-3">
            <SkeletonLoader width="w-10" height="h-10" rounded />
            <SkeletonLoader width="w-10" height="h-10" rounded />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <SkeletonLoader width="w-full md:w-64" height="h-10" />
          <SkeletonLoader width="w-full md:w-48" height="h-10" />
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex gap-2 overflow-x-auto">
          {[...Array(8)].map((_, i) => (
            <SkeletonLoader key={i} width="w-24" height="h-8" rounded />
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-100 p-3">
              <SkeletonLoader width="w-full" height="h-48" className="mb-3 rounded" />
              <SkeletonLoader width="w-3/4" height="h-5" className="mb-2" />
              <SkeletonLoader width="w-1/2" height="h-4" className="mb-3" />
              <div className="flex justify-between items-center">
                <SkeletonLoader width="w-20" height="h-6" />
                <SkeletonLoader width="w-10" height="h-10" rounded />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SkeletonCatalogue;

