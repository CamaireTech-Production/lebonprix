import React from 'react';
import SkeletonLoader from './SkeletonLoader';

/**
 * Skeleton loader for Warehouse page
 */
const SkeletonWarehouse: React.FC = () => {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <SkeletonLoader width="w-48" height="h-8" className="mb-2" />
          <SkeletonLoader width="w-64" height="h-5" />
        </div>
        <div className="flex gap-2">
          <SkeletonLoader width="w-32" height="h-10" rounded />
          <SkeletonLoader width="w-40" height="h-10" rounded />
        </div>
      </div>

      {/* Search */}
      <SkeletonLoader width="w-full" height="h-10" />

      {/* Warehouses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <SkeletonLoader width="w-5" height="h-5" rounded />
                <SkeletonLoader width="w-32" height="h-6" />
                <SkeletonLoader width="w-16" height="h-5" rounded />
              </div>
              <div className="flex gap-2">
                <SkeletonLoader width="w-8" height="h-8" rounded />
                <SkeletonLoader width="w-8" height="h-8" rounded />
              </div>
            </div>
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2">
                <SkeletonLoader width="w-4" height="h-4" rounded />
                <SkeletonLoader width="w-40" height="h-4" />
              </div>
              <div className="flex items-center gap-2">
                <SkeletonLoader width="w-4" height="h-4" rounded />
                <SkeletonLoader width="w-32" height="h-4" />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <SkeletonLoader width="w-24" height="h-4" />
              <SkeletonLoader width="w-20" height="h-6" rounded />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkeletonWarehouse;

