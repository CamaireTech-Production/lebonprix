import React from 'react';
import SkeletonLoader, { SkeletonStatCard, SkeletonTable } from './SkeletonLoader';

/**
 * Skeleton loader for Finance page
 */
const SkeletonFinance: React.FC = () => {
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <SkeletonLoader width="w-full md:w-64" height="h-10" />
          <SkeletonLoader width="w-full md:w-48" height="h-10" />
          <SkeletonLoader width="w-full md:w-48" height="h-10" />
          <SkeletonLoader width="w-32" height="h-10" rounded />
        </div>
      </div>

      {/* Finance Entries Table */}
      <SkeletonTable rows={10} />
    </div>
  );
};

export default SkeletonFinance;

