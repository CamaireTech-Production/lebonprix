import React from 'react';
import SkeletonLoader from './SkeletonLoader';

/**
 * Skeleton loader for Permissions Management page
 */
const SkeletonPermissions: React.FC = () => {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <SkeletonLoader width="w-64" height="h-8" className="mb-2" />
          <SkeletonLoader width="w-96" height="h-5" />
        </div>
        <SkeletonLoader width="w-40" height="h-10" rounded />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex space-x-4">
          {[...Array(3)].map((_, i) => (
            <SkeletonLoader key={i} width="w-32" height="h-10" className="mb-[-1px]" />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <SkeletonLoader width="w-48" height="h-6" className="mb-4" />
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <SkeletonLoader width="w-10" height="h-10" rounded />
                    <div>
                      <SkeletonLoader width="w-32" height="h-5" className="mb-1" />
                      <SkeletonLoader width="w-48" height="h-4" />
                    </div>
                  </div>
                  <SkeletonLoader width="w-24" height="h-6" rounded />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <SkeletonLoader width="w-40" height="h-6" className="mb-4" />
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <SkeletonLoader width="w-24" height="h-4" />
                  <SkeletonLoader width="w-16" height="h-4" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkeletonPermissions;

