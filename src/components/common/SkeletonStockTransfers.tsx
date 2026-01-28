import React from 'react';
import SkeletonLoader from './SkeletonLoader';

/**
 * Skeleton loader for Stock Transfers page
 */
const SkeletonStockTransfers: React.FC = () => {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <SkeletonLoader width="w-48" height="h-8" className="mb-2" />
          <SkeletonLoader width="w-64" height="h-5" />
        </div>
        <SkeletonLoader width="w-40" height="h-10" rounded />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonLoader width="w-full" height="h-10" />
          <SkeletonLoader width="w-full" height="h-10" />
          <SkeletonLoader width="w-full" height="h-10" />
        </div>
      </div>

      {/* Transfers List */}
      <div className="space-y-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <SkeletonLoader width="w-12" height="h-12" rounded />
                <div>
                  <SkeletonLoader width="w-32" height="h-5" className="mb-1" />
                  <SkeletonLoader width="w-24" height="h-4" />
                </div>
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
              <div>
                <SkeletonLoader width="w-16" height="h-4" className="mb-1" />
                <SkeletonLoader width="w-24" height="h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkeletonStockTransfers;

