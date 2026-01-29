import React from 'react';
import SkeletonLoader from './SkeletonLoader';

/**
 * Skeleton loader for Expenses Analytics page
 */
const SkeletonExpensesAnalytics: React.FC = () => {
  return (
    <div className="pb-16 md:pb-0 space-y-6">
      {/* Header */}
      <div>
        <SkeletonLoader width="w-56" height="h-8" className="mb-2" />
        <SkeletonLoader width="w-96" height="h-5" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonLoader width="w-full" height="h-10" />
          <SkeletonLoader width="w-full" height="h-10" />
          <SkeletonLoader width="w-full" height="h-10" />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <SkeletonLoader width="w-24" height="h-4" className="mb-2" />
            <SkeletonLoader width="w-32" height="h-8" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <SkeletonLoader width="w-48" height="h-6" className="mb-4" />
            <div className="animate-pulse bg-gray-100 w-full h-64 rounded" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <SkeletonLoader width="w-48" height="h-6" className="mb-4" />
        <div className="animate-pulse bg-gray-100 w-full h-64 rounded" />
      </div>
    </div>
  );
};

export default SkeletonExpensesAnalytics;


