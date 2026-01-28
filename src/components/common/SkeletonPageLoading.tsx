import React from 'react';
import SkeletonLoader from './SkeletonLoader';

/**
 * Minimal neutral skeleton for lazy page loading
 * This is shown only during code splitting, before the page component loads
 * Each page will then show its own dedicated skeleton during data loading
 */
const SkeletonPageLoading: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Minimal header */}
      <div className="mb-6">
        <SkeletonLoader width="w-48" height="h-8" className="mb-2" />
        <SkeletonLoader width="w-64" height="h-5" />
      </div>

      {/* Minimal content area */}
      <div className="space-y-4">
        <SkeletonLoader width="w-full" height="h-64" />
        <SkeletonLoader width="w-full" height="h-32" />
      </div>
    </div>
  );
};

export default SkeletonPageLoading;

