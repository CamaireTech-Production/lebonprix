import React from 'react';
import SkeletonLoader from './SkeletonLoader';

interface SkeletonCustomersListProps {
  rows?: number;
}

/**
 * Skeleton loader for Customers/Contacts page
 */
const SkeletonCustomersList: React.FC<SkeletonCustomersListProps> = ({ rows = 10 }) => {
  return (
    <div className="space-y-4">
      {/* Header with Search and Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <SkeletonLoader width="w-full md:w-64" height="h-10" />
          <div className="flex gap-3">
            <SkeletonLoader width="w-32" height="h-10" rounded />
            <SkeletonLoader width="w-32" height="h-10" rounded />
          </div>
        </div>
      </div>

      {/* Customers Grid/List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(rows)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <SkeletonLoader width="w-12" height="h-12" rounded />

              {/* Customer Info */}
              <div className="flex-1">
                <SkeletonLoader width="w-32" height="h-5" className="mb-2" />
                <SkeletonLoader width="w-28" height="h-4" className="mb-1" />
                <SkeletonLoader width="w-24" height="h-4" />
              </div>

              {/* Actions */}
              <SkeletonLoader width="w-8" height="h-8" rounded />
            </div>

            {/* Stats */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <SkeletonLoader width="w-16" height="h-3" className="mb-1" />
                  <SkeletonLoader width="w-12" height="h-5" />
                </div>
                <div>
                  <SkeletonLoader width="w-20" height="h-3" className="mb-1" />
                  <SkeletonLoader width="w-16" height="h-5" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkeletonCustomersList;
