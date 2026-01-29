import React from 'react';
import SkeletonLoader from './SkeletonLoader';

interface SkeletonExpensesListProps {
  rows?: number;
}

/**
 * Skeleton loader for Expenses page list layout
 */
const SkeletonExpensesList: React.FC<SkeletonExpensesListProps> = ({ rows = 10 }) => {
  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <SkeletonLoader width="w-24" height="h-4" className="mb-2" />
            <SkeletonLoader width="w-32" height="h-8" />
          </div>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <SkeletonLoader width="w-full md:w-64" height="h-10" />
          <SkeletonLoader width="w-full md:w-48" height="h-10" />
          <SkeletonLoader width="w-32" height="h-10" />
        </div>
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        {/* Desktop View */}
        <div className="hidden md:block">
          <div className="border-b bg-gray-50 p-4">
            <div className="grid grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <SkeletonLoader key={i} width="w-20" height="h-4" />
              ))}
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {[...Array(rows)].map((_, rowIndex) => (
              <div key={rowIndex} className="p-4">
                <div className="grid grid-cols-6 gap-4 items-center">
                  <SkeletonLoader width="w-24" height="h-4" />
                  <SkeletonLoader width="w-20" height="h-5" rounded />
                  <SkeletonLoader width="w-28" height="h-4" />
                  <SkeletonLoader width="w-20" height="h-5" />
                  <SkeletonLoader width="w-16" height="h-4" />
                  <div className="flex gap-2">
                    <SkeletonLoader width="w-8" height="h-8" rounded />
                    <SkeletonLoader width="w-8" height="h-8" rounded />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-gray-200">
          {[...Array(rows)].map((_, index) => (
            <div key={index} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <SkeletonLoader width="w-24" height="h-5" className="mb-2" />
                  <SkeletonLoader width="w-20" height="h-4" className="mb-1" />
                  <SkeletonLoader width="w-32" height="h-4" />
                </div>
                <SkeletonLoader width="w-24" height="h-6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SkeletonExpensesList;
