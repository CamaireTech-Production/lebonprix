import React from 'react';
import SkeletonLoader from './SkeletonLoader';

/**
 * Skeleton loader for Charges page
 */
const SkeletonCharges: React.FC = () => {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <SkeletonLoader width="w-48" height="h-8" className="mb-2" />
          <SkeletonLoader width="w-64" height="h-5" />
        </div>
        <SkeletonLoader width="w-32" height="h-10" rounded />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex space-x-4">
          {[...Array(3)].map((_, i) => (
            <SkeletonLoader key={i} width="w-24" height="h-10" className="mb-[-1px]" />
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <SkeletonLoader width="w-24" height="h-4" className="mb-2" />
            <SkeletonLoader width="w-32" height="h-8" />
          </div>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <SkeletonLoader width="w-full sm:w-64" height="h-10" />
        <SkeletonLoader width="w-full sm:w-48" height="h-10" />
      </div>

      {/* Charges Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="grid grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <SkeletonLoader key={i} width="w-20" height="h-4" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="p-4">
              <div className="grid grid-cols-6 gap-4 items-center">
                <SkeletonLoader width="w-32" height="h-4" />
                <SkeletonLoader width="w-24" height="h-4" />
                <SkeletonLoader width="w-20" height="h-5" rounded />
                <SkeletonLoader width="w-24" height="h-4" />
                <SkeletonLoader width="w-20" height="h-4" />
                <div className="flex justify-end gap-2">
                  <SkeletonLoader width="w-8" height="h-8" rounded />
                  <SkeletonLoader width="w-8" height="h-8" rounded />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SkeletonCharges;

