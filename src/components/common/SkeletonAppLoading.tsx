import React from 'react';
import SkeletonLoader from './SkeletonLoader';

/**
 * Unified skeleton for app-level loading states
 * Used for: Auth loading, company loading, initial app load
 */
const SkeletonAppLoading: React.FC = () => {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Navbar Skeleton */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <SkeletonLoader width="w-8" height="h-8" rounded />
            <SkeletonLoader width="w-32" height="h-6" />
          </div>
          <div className="flex items-center gap-3">
            <SkeletonLoader width="w-8" height="h-8" rounded className="hidden md:block" />
            <SkeletonLoader width="w-8" height="h-8" rounded className="hidden md:block" />
            <SkeletonLoader width="w-8" height="h-8" rounded />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Skeleton - Hidden on mobile */}
        <div className="hidden md:block w-64 bg-white border-r border-gray-200">
          <div className="p-4 space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <SkeletonLoader width="w-5" height="h-5" />
                <SkeletonLoader width="w-32" height="h-4" />
              </div>
            ))}
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <SkeletonLoader width="w-48" height="h-8" />
              <SkeletonLoader width="w-32" height="h-10" rounded />
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                  <SkeletonLoader width="w-20" height="h-4" className="mb-2" />
                  <SkeletonLoader width="w-24" height="h-8" />
                </div>
              ))}
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100">
              <div className="p-6">
                <SkeletonLoader width="w-40" height="h-6" className="mb-4" />
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <SkeletonLoader width="w-full" height="h-12" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Nav Skeleton */}
      <div className="md:hidden bg-white border-t border-gray-200">
        <div className="flex justify-around p-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 py-2">
              <SkeletonLoader width="w-6" height="h-6" />
              <SkeletonLoader width="w-12" height="h-3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SkeletonAppLoading;
