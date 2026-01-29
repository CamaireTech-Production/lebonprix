import React from 'react';
import SkeletonLoader from './SkeletonLoader';

/**
 * Skeleton loader for Categories page (grid/list view)
 */
const SkeletonCategories: React.FC<{ viewMode?: 'grid' | 'list' }> = ({ viewMode = 'grid' }) => {
  if (viewMode === 'list') {
    return (
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <SkeletonLoader width="w-48" height="h-8" className="mb-2" />
            <SkeletonLoader width="w-64" height="h-5" />
          </div>
          <SkeletonLoader width="w-32" height="h-10" rounded />
        </div>

        {/* Search */}
        <SkeletonLoader width="w-full" height="h-10" />

        {/* List View */}
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-4">
                <SkeletonLoader width="w-16" height="h-16" rounded />
                <div className="flex-1">
                  <SkeletonLoader width="w-32" height="h-5" className="mb-2" />
                  <SkeletonLoader width="w-48" height="h-4" />
                </div>
                <div className="flex gap-2">
                  <SkeletonLoader width="w-8" height="h-8" rounded />
                  <SkeletonLoader width="w-8" height="h-8" rounded />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <SkeletonLoader width="w-48" height="h-8" className="mb-2" />
          <SkeletonLoader width="w-64" height="h-5" />
        </div>
        <div className="flex items-center gap-3">
          <SkeletonLoader width="w-10" height="h-10" rounded />
          <SkeletonLoader width="w-32" height="h-10" rounded />
        </div>
      </div>

      {/* Search and View Toggle */}
      <div className="flex flex-col sm:flex-row gap-4">
        <SkeletonLoader width="w-full sm:w-64" height="h-10" />
        <div className="flex gap-2">
          <SkeletonLoader width="w-10" height="h-10" rounded />
          <SkeletonLoader width="w-10" height="h-10" rounded />
        </div>
      </div>

      {/* Grid View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <SkeletonLoader width="w-full" height="h-48" />
            <div className="p-4">
              <SkeletonLoader width="w-3/4" height="h-5" className="mb-2" />
              <SkeletonLoader width="w-full" height="h-4" className="mb-3" />
              <div className="flex justify-between items-center">
                <SkeletonLoader width="w-16" height="h-4" />
                <div className="flex gap-2">
                  <SkeletonLoader width="w-8" height="h-8" rounded />
                  <SkeletonLoader width="w-8" height="h-8" rounded />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkeletonCategories;

