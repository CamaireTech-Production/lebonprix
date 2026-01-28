import React from 'react';
import SkeletonLoader, { SkeletonChart } from './SkeletonLoader';

/**
 * Skeleton loader for Reports page
 */
const SkeletonReports: React.FC = () => {
  return (
    <div className="pb-16 md:pb-0 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <SkeletonLoader width="w-48" height="h-8" className="mb-2" />
          <SkeletonLoader width="w-64" height="h-5" />
        </div>
        <div className="flex gap-3">
          <SkeletonLoader width="w-32" height="h-10" rounded />
          <SkeletonLoader width="w-32" height="h-10" rounded />
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonLoader width="w-full" height="h-10" />
          <SkeletonLoader width="w-full" height="h-10" />
          <SkeletonLoader width="w-full" height="h-10" />
          <SkeletonLoader width="w-full" height="h-10" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <SkeletonLoader width="w-24" height="h-4" className="mb-2" />
            <SkeletonLoader width="w-32" height="h-8" />
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChart />
        <SkeletonChart />
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <SkeletonLoader width="w-40" height="h-6" className="mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <SkeletonLoader width="w-32" height="h-4" />
                <SkeletonLoader width="w-24" height="h-5" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <SkeletonLoader width="w-40" height="h-6" className="mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <SkeletonLoader width="w-32" height="h-4" />
                <SkeletonLoader width="w-24" height="h-5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkeletonReports;

