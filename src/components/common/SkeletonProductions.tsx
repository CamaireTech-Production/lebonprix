import React from 'react';
import SkeletonLoader from './SkeletonLoader';

/**
 * Skeleton loader for Productions page (list/steps/flows views)
 */
const SkeletonProductions: React.FC<{ viewMode?: 'list' | 'steps' | 'flows' }> = ({ viewMode = 'list' }) => {
  if (viewMode === 'steps') {
    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <SkeletonLoader width="w-48" height="h-8" className="mb-2" />
            <SkeletonLoader width="w-64" height="h-5" />
          </div>
          <div className="flex gap-2">
            <SkeletonLoader width="w-32" height="h-10" rounded />
            <SkeletonLoader width="w-32" height="h-10" rounded />
          </div>
        </div>

        {/* Steps Columns View */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, colIndex) => (
            <div key={colIndex} className="bg-gray-50 rounded-lg p-4">
              <SkeletonLoader width="w-32" height="h-6" className="mb-4" />
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg p-3 border border-gray-200">
                    <SkeletonLoader width="w-3/4" height="h-5" className="mb-2" />
                    <SkeletonLoader width="w-1/2" height="h-4" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (viewMode === 'flows') {
    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <SkeletonLoader width="w-48" height="h-8" className="mb-2" />
            <SkeletonLoader width="w-64" height="h-5" />
          </div>
          <SkeletonLoader width="w-32" height="h-10" rounded />
        </div>

        {/* Flows Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
              <SkeletonLoader width="w-3/4" height="h-6" className="mb-3" />
              <SkeletonLoader width="w-full" height="h-4" className="mb-2" />
              <SkeletonLoader width="w-2/3" height="h-4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // List view (default)
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <SkeletonLoader width="w-48" height="h-8" className="mb-2" />
          <SkeletonLoader width="w-64" height="h-5" />
        </div>
        <div className="flex gap-2">
          <SkeletonLoader width="w-24" height="h-10" rounded />
          <SkeletonLoader width="w-24" height="h-10" rounded />
          <SkeletonLoader width="w-24" height="h-10" rounded />
          <SkeletonLoader width="w-32" height="h-10" rounded />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <SkeletonLoader width="w-full md:w-64" height="h-10" />
        <SkeletonLoader width="w-full md:w-48" height="h-10" />
        <SkeletonLoader width="w-full md:w-48" height="h-10" />
      </div>

      {/* Productions List */}
      <div className="space-y-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <SkeletonLoader width="w-48" height="h-6" className="mb-2" />
                <SkeletonLoader width="w-32" height="h-4" />
              </div>
              <SkeletonLoader width="w-20" height="h-6" rounded />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <SkeletonLoader width="w-16" height="h-4" className="mb-1" />
                <SkeletonLoader width="w-24" height="h-5" />
              </div>
              <div>
                <SkeletonLoader width="w-16" height="h-4" className="mb-1" />
                <SkeletonLoader width="w-24" height="h-5" />
              </div>
              <div>
                <SkeletonLoader width="w-16" height="h-4" className="mb-1" />
                <SkeletonLoader width="w-24" height="h-5" />
              </div>
              <div className="flex justify-end gap-2">
                <SkeletonLoader width="w-8" height="h-8" rounded />
                <SkeletonLoader width="w-8" height="h-8" rounded />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkeletonProductions;

