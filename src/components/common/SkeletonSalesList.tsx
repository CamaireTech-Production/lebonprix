import React from 'react';
import SkeletonLoader from './SkeletonLoader';

interface SkeletonSalesListProps {
  rows?: number;
}

/**
 * Skeleton loader for Sales page list layout
 */
const SkeletonSalesList: React.FC<SkeletonSalesListProps> = ({ rows = 10 }) => {
  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <SkeletonLoader width="w-full md:w-64" height="h-10" />
          <SkeletonLoader width="w-full md:w-48" height="h-10" />
          <SkeletonLoader width="w-full md:w-48" height="h-10" />
        </div>
      </div>

      {/* Sales List - Desktop */}
      <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-100">
        {/* Table Header */}
        <div className="border-b bg-gray-50 p-4">
          <div className="grid grid-cols-7 gap-4">
            {[...Array(7)].map((_, i) => (
              <SkeletonLoader key={i} width="w-20" height="h-4" />
            ))}
          </div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-gray-200">
          {[...Array(rows)].map((_, rowIndex) => (
            <div key={rowIndex} className="p-4 hover:bg-gray-50">
              <div className="grid grid-cols-7 gap-4 items-center">
                <SkeletonLoader width="w-16" height="h-4" />
                <SkeletonLoader width="w-24" height="h-4" />
                <SkeletonLoader width="w-20" height="h-5" />
                <SkeletonLoader width="w-24" height="h-4" />
                <SkeletonLoader width="w-20" height="h-5" rounded />
                <SkeletonLoader width="w-20" height="h-5" rounded />
                <div className="flex gap-2">
                  <SkeletonLoader width="w-8" height="h-8" rounded />
                  <SkeletonLoader width="w-8" height="h-8" rounded />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sales List - Mobile */}
      <div className="md:hidden space-y-3">
        {[...Array(rows)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <SkeletonLoader width="w-32" height="h-5" className="mb-2" />
                <SkeletonLoader width="w-24" height="h-4" className="mb-1" />
                <SkeletonLoader width="w-20" height="h-4" />
              </div>
              <SkeletonLoader width="w-20" height="h-6" rounded />
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-gray-100">
              <SkeletonLoader width="w-24" height="h-5" />
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
};

export default SkeletonSalesList;
