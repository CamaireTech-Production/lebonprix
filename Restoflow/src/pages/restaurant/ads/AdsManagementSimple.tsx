import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { Plus, BarChart3, TrendingUp, DollarSign, Users } from 'lucide-react';
import designSystem from '../../../designSystem';

const AdsManagementSimple: React.FC = () => {
  const { restaurant } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Mock data for testing
  const mockStats = {
    totalAds: 0,
    activeAds: 0,
    totalSpent: 0,
    totalClicks: 0,
    totalImpressions: 0,
    totalConversions: 0
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CM', {
      style: 'currency',
      currency: restaurant?.currency || 'XAF'
    }).format(amount);
  };

  return (
    <DashboardLayout title="Ads Management">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-blue-100">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Ads</p>
                <p className="text-2xl font-semibold text-gray-900">{mockStats.totalAds}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-green-100">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Ads</p>
                <p className="text-2xl font-semibold text-gray-900">{mockStats.activeAds}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-yellow-100">
                <DollarSign className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Spent</p>
                <p className="text-2xl font-semibold text-gray-900">{formatCurrency(mockStats.totalSpent)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-purple-100">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Clicks</p>
                <p className="text-2xl font-semibold text-gray-900">{mockStats.totalClicks}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your Advertisements</h2>
            <p className="text-gray-600">Create and manage your restaurant advertisements</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 rounded-lg font-semibold text-white transition-colors"
            style={{ background: designSystem.colors.accent }}
          >
            <Plus size={20} className="mr-2" />
            Create Ad
          </button>
        </div>

        {/* Empty State */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="text-center py-12">
            <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No ads yet</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating your first advertisement.</p>
            <div className="mt-6">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white"
                style={{ background: designSystem.colors.accent }}
              >
                <Plus size={20} className="mr-2" />
                Create Ad
              </button>
            </div>
          </div>
        </div>

        {/* Debug Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-blue-900 mb-2">Debug Information</h3>
          <div className="text-sm text-blue-800 space-y-1">
            <p>• Restaurant ID: {restaurant?.id || 'Not found'}</p>
            <p>• Restaurant Name: {restaurant?.name || 'Not found'}</p>
            <p>• Currency: {restaurant?.currency || 'XAF'}</p>
            <p>• Page Status: Loaded successfully</p>
            <p>• Component: AdsManagementSimple (Test Version)</p>
          </div>
        </div>
      </div>

      {/* Simple Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Ad</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Title</label>
                  <input
                    type="text"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Enter ad title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    rows={3}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Describe your advertisement"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Budget ({restaurant?.currency || 'XAF'})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Enter budget"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    alert('Ad creation functionality will be implemented with the full version!');
                    setShowCreateModal(false);
                  }}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white"
                  style={{ background: designSystem.colors.accent }}
                >
                  Create Ad
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AdsManagementSimple;
