import React from 'react';
import SkeletonLoader from './SkeletonLoader';

/**
 * Skeleton loader for Stocks page
 */
const SkeletonStocks: React.FC = () => {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <SkeletonLoader width="w-48" height="h-8" className="mb-2" />
          <SkeletonLoader width="w-64" height="h-5" />
        </div>
        <div className="flex gap-3">
          <SkeletonLoader width="w-32" height="h-10" rounded />
          <SkeletonLoader width="w-32" height="h-10" rounded />
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <SkeletonLoader width="w-full sm:w-64" height="h-10" />
        <SkeletonLoader width="w-full sm:w-48" height="h-10" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        {/* Table Header */}
        <div className="border-b bg-gray-50 p-4">
          <div className="grid grid-cols-12 gap-4">
            <SkeletonLoader width="w-4" height="h-4" />
            <SkeletonLoader width="w-24" height="h-4" />
            <SkeletonLoader width="w-20" height="h-4" />
            <SkeletonLoader width="w-16" height="h-4" />
            <SkeletonLoader width="w-20" height="h-4" />
            <SkeletonLoader width="w-16" height="h-4" />
            <SkeletonLoader width="w-20" height="h-4" />
            <SkeletonLoader width="w-16" height="h-4" />
            <SkeletonLoader width="w-20" height="h-4" />
            <SkeletonLoader width="w-16" height="h-4" />
            <SkeletonLoader width="w-20" height="h-4" />
            <SkeletonLoader width="w-16" height="h-4" />
          </div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-gray-200">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="p-4">
              <div className="grid grid-cols-12 gap-4 items-center">
                <SkeletonLoader width="w-4" height="h-4" />
                <div className="col-span-3">
                  <SkeletonLoader width="w-32" height="h-4" className="mb-1" />
                  <SkeletonLoader width="w-24" height="h-3" />
                </div>
                <SkeletonLoader width="w-20" height="h-4" />
                <SkeletonLoader width="w-16" height="h-5" rounded />
                <SkeletonLoader width="w-20" height="h-4" />
                <SkeletonLoader width="w-16" height="h-4" />
                <SkeletonLoader width="w-20" height="h-4" />
                <SkeletonLoader width="w-16" height="h-4" />
                <SkeletonLoader width="w-20" height="h-4" />
                <SkeletonLoader width="w-16" height="h-4" />
                <div className="col-span-2 flex justify-end gap-2">
                  <SkeletonLoader width="w-16" height="h-8" rounded />
                  <SkeletonLoader width="w-20" height="h-8" rounded />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SkeletonStocks;

