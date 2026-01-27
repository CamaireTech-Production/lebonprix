import React from 'react';
import SkeletonLoader from './SkeletonLoader';

interface SkeletonSuppliersListProps {
  rows?: number;
}

/**
 * Skeleton loader for Suppliers page
 */
const SkeletonSuppliersList: React.FC<SkeletonSuppliersListProps> = ({ rows = 8 }) => {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <SkeletonLoader width="w-48" height="h-8" />
        <SkeletonLoader width="w-32" height="h-10" rounded />
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(rows)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <SkeletonLoader width="w-32" height="h-6" className="mb-2" />
                <SkeletonLoader width="w-24" height="h-4" className="mb-1" />
                <SkeletonLoader width="w-28" height="h-4" />
              </div>
              <SkeletonLoader width="w-8" height="h-8" rounded />
            </div>

            {/* Debt Info */}
            <div className="bg-gray-50 rounded-lg p-3">
              <SkeletonLoader width="w-20" height="h-3" className="mb-2" />
              <SkeletonLoader width="w-28" height="h-6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkeletonSuppliersList;
