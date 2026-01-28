import React from 'react';
import SkeletonLoader from './SkeletonLoader';

/**
 * Skeleton loader for POS page layout
 */
const SkeletonPOSLayout: React.FC = () => {
  return (
    <div className="h-screen flex flex-col">
      {/* POS Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <SkeletonLoader width="w-32" height="h-8" />
          <div className="flex gap-3">
            <SkeletonLoader width="w-24" height="h-10" rounded />
            <SkeletonLoader width="w-24" height="h-10" rounded />
          </div>
        </div>
      </div>

      {/* Main POS Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Recent Transactions */}
        <div className="w-48 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <SkeletonLoader width="w-32" height="h-6" />
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-gray-50 rounded p-2">
                <SkeletonLoader width="w-full" height="h-4" className="mb-1" />
                <SkeletonLoader width="w-2/3" height="h-3" />
              </div>
            ))}
          </div>
        </div>

        {/* Products Section - Center */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search and Filters */}
          <div className="p-4 bg-white border-b border-gray-200">
            <div className="flex gap-3">
              <SkeletonLoader width="w-full" height="h-10" />
              <SkeletonLoader width="w-32" height="h-10" />
              <SkeletonLoader width="w-32" height="h-10" />
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-100 p-3">
                  <SkeletonLoader width="w-full" height="h-32" className="mb-2" />
                  <SkeletonLoader width="w-3/4" height="h-4" className="mb-2" />
                  <SkeletonLoader width="w-1/2" height="h-5" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cart Section - Right */}
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
          {/* Cart Header */}
          <div className="p-4 border-b border-gray-200">
            <SkeletonLoader width="w-32" height="h-6" className="mb-3" />
            <SkeletonLoader width="w-full" height="h-10" />
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <SkeletonLoader width="w-32" height="h-4" />
                    <SkeletonLoader width="w-8" height="h-8" rounded />
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <SkeletonLoader width="w-8" height="h-8" rounded />
                      <SkeletonLoader width="w-12" height="h-4" />
                      <SkeletonLoader width="w-8" height="h-8" rounded />
                    </div>
                    <SkeletonLoader width="w-20" height="h-5" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cart Summary */}
          <div className="p-4 border-t border-gray-200 space-y-3">
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <SkeletonLoader width="w-24" height="h-4" />
                  <SkeletonLoader width="w-20" height="h-4" />
                </div>
              ))}
            </div>
            <SkeletonLoader width="w-full" height="h-12" rounded />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkeletonPOSLayout;
