import React from 'react';
import SkeletonLoader from './SkeletonLoader';

/**
 * Skeleton loader for Settings page
 */
const SkeletonSettings: React.FC = () => {
  return (
    <div className="pb-16 md:pb-0">
      {/* Header */}
      <div className="mb-6">
        <SkeletonLoader width="w-48" height="h-8" className="mb-2" />
        <SkeletonLoader width="w-64" height="h-5" />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex space-x-4">
          {[...Array(7)].map((_, i) => (
            <SkeletonLoader key={i} width="w-24" height="h-10" className="mb-[-1px]" />
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="space-y-6">
          {/* Section Title */}
          <SkeletonLoader width="w-40" height="h-6" className="mb-4" />

          {/* Form Fields */}
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonLoader width="w-24" height="h-4" />
              <SkeletonLoader width="w-full" height="h-10" />
            </div>
          ))}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <SkeletonLoader width="w-32" height="h-10" rounded />
            <SkeletonLoader width="w-32" height="h-10" rounded />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkeletonSettings;

