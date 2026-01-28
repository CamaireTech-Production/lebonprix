import React from 'react';
import SkeletonLoader from './SkeletonLoader';

/**
 * Skeleton loader for HR Profile page
 */
const SkeletonProfile: React.FC = () => {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <SkeletonLoader width="w-48" height="h-8" />
        <SkeletonLoader width="w-32" height="h-10" rounded />
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <SkeletonLoader width="w-32" height="w-32" rounded="full" />

          {/* Info */}
          <div className="flex-1 space-y-4">
            <div>
              <SkeletonLoader width="w-48" height="h-8" className="mb-2" />
              <SkeletonLoader width="w-64" height="h-5" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <SkeletonLoader width="w-24" height="h-4" className="mb-1" />
                  <SkeletonLoader width="w-32" height="h-5" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Additional Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <SkeletonLoader width="w-40" height="h-6" className="mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex justify-between">
                  <SkeletonLoader width="w-24" height="h-4" />
                  <SkeletonLoader width="w-32" height="h-4" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkeletonProfile;

