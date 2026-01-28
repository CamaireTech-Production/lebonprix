import React from 'react';
import SkeletonLoader, { SkeletonTable } from './SkeletonLoader';

/**
 * Skeleton loader for Expenses Categories page
 */
const SkeletonExpensesCategories: React.FC = () => {
  return (
    <div className="pb-16 md:pb-0">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <SkeletonLoader width="w-64" height="h-8" className="mb-2" />
          <SkeletonLoader width="w-96" height="h-5" />
        </div>
        <SkeletonLoader width="w-40" height="h-10" rounded />
      </div>

      {/* Table */}
      <SkeletonTable rows={8} />
    </div>
  );
};

export default SkeletonExpensesCategories;

