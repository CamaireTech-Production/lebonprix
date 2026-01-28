import React from 'react';
import SkeletonLoader from './SkeletonLoader';

/**
 * Skeleton loader for Production Detail page
 */
const SkeletonProductionDetail: React.FC = () => {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <SkeletonLoader width="w-8" height="h-8" rounded />
          <div>
            <SkeletonLoader width="w-48" height="h-8" className="mb-2" />
            <SkeletonLoader width="w-64" height="h-5" />
          </div>
        </div>
        <div className="flex gap-2">
          <SkeletonLoader width="w-24" height="h-10" rounded />
          <SkeletonLoader width="w-24" height="h-10" rounded />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex space-x-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonLoader key={i} width="w-24" height="h-10" className="mb-[-1px]" />
          ))}
        </div>
      </div>

      {/* Overview Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <SkeletonLoader width="w-32" height="h-6" className="mb-4" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <SkeletonLoader width="w-24" height="h-4" />
                  <SkeletonLoader width="w-32" height="h-4" />
                </div>
              ))}
            </div>
          </div>

          {/* Articles Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <SkeletonLoader width="w-32" height="h-6" className="mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4">
                  <SkeletonLoader width="w-3/4" height="h-5" className="mb-2" />
                  <SkeletonLoader width="w-full" height="h-4" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <SkeletonLoader width="w-32" height="h-6" className="mb-4" />
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <SkeletonLoader width="w-20" height="h-4" />
                  <SkeletonLoader width="w-24" height="h-4" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkeletonProductionDetail;

