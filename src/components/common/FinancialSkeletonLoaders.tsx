// src/components/common/FinancialSkeletonLoaders.tsx
import React from 'react';
import SkeletonLoader from './SkeletonLoader';

/**
 * Skeleton loader for financial balance card
 */
export const SkeletonFinancialBalance: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <SkeletonLoader width="20px" height="20px" rounded />
          <SkeletonLoader width="80px" height="16px" />
        </div>
        <div className="text-right">
          <SkeletonLoader width="120px" height="32px" />
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton loader for debt card
 */
export const SkeletonDebtCard: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <SkeletonLoader width="20px" height="20px" rounded />
          <SkeletonLoader width="100px" height="16px" />
        </div>
        <div className="text-right">
          <SkeletonLoader width="120px" height="32px" />
        </div>
      </div>
      <SkeletonLoader width="100%" height="32px" className="mt-2" />
    </div>
  );
};

/**
 * Skeleton loader for financial stat cards
 */
export const SkeletonFinancialStatCard: React.FC = () => {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className="flex items-center justify-center mb-1">
        <SkeletonLoader width="20px" height="20px" rounded />
      </div>
      <div className="mb-1">
        <SkeletonLoader width="80px" height="12px" className="mx-auto" />
      </div>
      <div>
        <SkeletonLoader width="100px" height="14px" className="mx-auto" />
      </div>
    </div>
  );
};

/**
 * Skeleton loader for financial calculations section
 */
export const SkeletonFinancialCalculations: React.FC = () => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <SkeletonLoader width="20px" height="20px" rounded />
          <SkeletonLoader width="200px" height="18px" />
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonFinancialStatCard key={index} />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton loader for financial entries table
 */
export const SkeletonFinancialEntriesTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Table header */}
      <div className="hidden md:block">
        <div className="border-b bg-gray-50 p-4">
          <div className="grid grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonLoader key={index} width="80px" height="16px" />
            ))}
          </div>
        </div>
        
        {/* Table rows */}
        <div className="divide-y divide-gray-200">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="p-4">
              <div className="grid grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, colIndex) => (
                  <SkeletonLoader key={colIndex} width="60px" height="14px" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="border-b border-gray-100 p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <SkeletonLoader width="80px" height="14px" />
                  <SkeletonLoader width="60px" height="20px" rounded />
                </div>
                <SkeletonLoader width="100px" height="12px" className="mb-1" />
                <SkeletonLoader width="150px" height="12px" className="mb-2" />
              </div>
              <div className="text-right ml-4">
                <SkeletonLoader width="100px" height="18px" className="mb-2" />
                <div className="flex gap-2">
                  <SkeletonLoader width="24px" height="24px" rounded />
                  <SkeletonLoader width="24px" height="24px" rounded />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton loader for objectives bar
 */
export const SkeletonObjectivesBar: React.FC = () => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <SkeletonLoader width="120px" height="18px" />
        <div className="flex gap-2">
          <SkeletonLoader width="80px" height="32px" rounded />
          <SkeletonLoader width="100px" height="32px" rounded />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between">
            <SkeletonLoader width="150px" height="14px" />
            <div className="flex items-center gap-2">
              <SkeletonLoader width="100px" height="8px" rounded />
              <SkeletonLoader width="40px" height="14px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default {
  SkeletonFinancialBalance,
  SkeletonDebtCard,
  SkeletonFinancialStatCard,
  SkeletonFinancialCalculations,
  SkeletonFinancialEntriesTable,
  SkeletonObjectivesBar
};
