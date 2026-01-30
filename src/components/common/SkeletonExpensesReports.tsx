import React from 'react';
import SkeletonLoader, { SkeletonTable } from './SkeletonLoader';

/**
 * Skeleton loader for Expenses Reports / Export page
 */
const SkeletonExpensesReports: React.FC = () => {
  return (
    <div className="pb-16 md:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <SkeletonLoader width="w-56" height="h-8" className="mb-2" />
          <SkeletonLoader width="w-96" height="h-5" />
        </div>
        <SkeletonLoader width="w-40" height="h-10" rounded />
      </div>

      {/* Filters */}
      <div className="space-y-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <SkeletonLoader width="w-full md:w-64" height="h-10" />
            <SkeletonLoader width="w-full md:w-48" height="h-10" />
            <SkeletonLoader width="w-full md:w-48" height="h-10" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <SkeletonLoader width="w-full sm:w-64" height="h-10" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <SkeletonLoader width="w-56" height="h-4" className="mb-4" />
        <SkeletonTable rows={8} />
      </div>
    </div>
  );
};

export default SkeletonExpensesReports;


