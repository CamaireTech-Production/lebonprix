import React from 'react';
import SkeletonLoader, { SkeletonStatCard, SkeletonChart, SkeletonTable, SkeletonObjectivesBar } from './SkeletonLoader';

/**
 * Skeleton loader for Dashboard page
 */
const SkeletonDashboard: React.FC = () => {
  return (
    <div className="pb-16 md:pb-0 space-y-6">
      {/* Dashboard Header */}
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

      {/* Main Layout: 70% / 30% split */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Left Column - 70% */}
        <div className="lg:col-span-7 space-y-6">
          {/* Objectives Bar */}
          <SkeletonObjectivesBar />

          {/* Date Range Picker */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <SkeletonLoader width="w-full md:w-64" height="h-10" />
              <SkeletonLoader width="w-32" height="h-10" rounded />
            </div>
          </div>

          {/* Stats Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <SkeletonStatCard key={i} />
            ))}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SkeletonChart />
            <SkeletonChart />
          </div>

          {/* Latest Orders Table */}
          <SkeletonTable rows={5} />
        </div>

        {/* Right Column - 30% */}
        <div className="lg:col-span-3 space-y-6">
          {/* Top Sales */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <SkeletonLoader width="w-32" height="h-6" className="mb-4" />
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex-1">
                    <SkeletonLoader width="w-24" height="h-4" className="mb-1" />
                    <SkeletonLoader width="w-20" height="h-3" />
                  </div>
                  <SkeletonLoader width="w-20" height="h-5" />
                </div>
              ))}
            </div>
          </div>

          {/* Best Clients */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <SkeletonLoader width="w-32" height="h-6" className="mb-4" />
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <SkeletonLoader width="w-10" height="h-10" rounded />
                  <div className="flex-1">
                    <SkeletonLoader width="w-24" height="h-4" className="mb-1" />
                    <SkeletonLoader width="w-20" height="h-3" />
                  </div>
                  <SkeletonLoader width="w-20" height="h-5" />
                </div>
              ))}
            </div>
          </div>

          {/* Best Products */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <SkeletonLoader width="w-32" height="h-6" className="mb-4" />
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex-1">
                    <SkeletonLoader width="w-28" height="h-4" className="mb-1" />
                    <SkeletonLoader width="w-16" height="h-3" />
                  </div>
                  <SkeletonLoader width="w-20" height="h-5" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkeletonDashboard;
