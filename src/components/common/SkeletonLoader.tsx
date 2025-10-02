import React from 'react';

interface SkeletonLoaderProps {
  className?: string;
  width?: string;
  height?: string;
  rounded?: boolean;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ 
  className = '', 
  width = 'w-full', 
  height = 'h-4', 
  rounded = false 
}) => {
  return (
    <div 
      className={`animate-pulse bg-gray-200 ${width} ${height} ${rounded ? 'rounded-full' : 'rounded'} ${className}`}
    />
  );
};

export default SkeletonLoader;

// Skeleton Card Component for Dashboard Stats
export const SkeletonStatCard: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {/* Title skeleton */}
          <SkeletonLoader width="w-20" height="h-3" className="mb-2" />
          {/* Value skeleton */}
          <SkeletonLoader width="w-16" height="h-6" className="mb-1" />
        </div>
        {/* Icon skeleton */}
        <SkeletonLoader width="w-10" height="h-10" rounded className="ml-4" />
      </div>
    </div>
  );
};

// Skeleton for Chart Component
export const SkeletonChart: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
      {/* Chart title */}
      <SkeletonLoader width="w-32" height="h-5" className="mb-4" />
      
      {/* Chart area */}
      <div className="h-64 flex items-end justify-between space-x-2">
        {/* Simulated chart bars */}
        {[...Array(7)].map((_, i) => (
          <SkeletonLoader 
            key={i}
            width="w-full" 
            height={`h-${Math.floor(Math.random() * 40) + 20}`} 
            className="flex-1"
          />
        ))}
      </div>
    </div>
  );
};

// Skeleton for Table Component
export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100">
      {/* Table header */}
      <div className="p-6 border-b border-gray-100">
        <SkeletonLoader width="w-40" height="h-5" className="mb-4" />
        
        {/* Table headers */}
        <div className="flex space-x-4 mb-4">
          <SkeletonLoader width="w-24" height="h-4" />
          <SkeletonLoader width="w-20" height="h-4" />
          <SkeletonLoader width="w-28" height="h-4" />
        </div>
      </div>
      
      {/* Table rows */}
      <div className="p-6">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="flex space-x-4 mb-3 last:mb-0">
            <SkeletonLoader width="w-24" height="h-4" />
            <SkeletonLoader width="w-20" height="h-4" />
            <SkeletonLoader width="w-28" height="h-4" />
          </div>
        ))}
      </div>
    </div>
  );
};

// Skeleton for Activity List
export const SkeletonActivityList: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100">
      <div className="p-6">
        {/* Title */}
        <SkeletonLoader width="w-32" height="h-5" className="mb-4" />
        
        {/* Activity items */}
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-3 mb-4 last:mb-0">
            {/* Icon */}
            <SkeletonLoader width="w-8" height="h-8" rounded />
            
            <div className="flex-1">
              {/* Activity description */}
              <SkeletonLoader width="w-3/4" height="h-4" className="mb-1" />
              {/* Time */}
              <SkeletonLoader width="w-20" height="h-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Skeleton for Objectives Bar
export const SkeletonObjectivesBar: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        {/* Title */}
        <SkeletonLoader width="w-24" height="h-5" />
        {/* Buttons */}
        <div className="flex space-x-2">
          <SkeletonLoader width="w-16" height="h-8" />
          <SkeletonLoader width="w-16" height="h-8" />
        </div>
      </div>
      
      {/* Progress bars */}
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i}>
            <div className="flex justify-between mb-2">
              <SkeletonLoader width="w-20" height="h-4" />
              <SkeletonLoader width="w-16" height="h-4" />
            </div>
            <SkeletonLoader width="w-full" height="h-2" />
          </div>
        ))}
      </div>
    </div>
  );
};
