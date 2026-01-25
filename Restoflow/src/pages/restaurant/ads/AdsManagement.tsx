import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { db } from '../../../firebase/config';
import { 
  collection, 
  query, 
  where, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  orderBy, 
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import designSystem from '../../../designSystem';
import { 
  Plus, 
  Edit, 
  Trash2, 
  DollarSign, 
  Target,
  BarChart3,
  TrendingUp,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Download,
  Play,
  Pause,
  Video,
  X
} from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import EnhancedAdForm from '../../../components/ads/EnhancedAdForm';

interface Ad {
  id: string;
  title: string;
  description: string;
  callToAction?: string;
  imageBase64?: string;
  audioBase64?: string;
  videoBase64?: string;
  targetAudience: 'all' | 'local' | 'new_customers' | 'returning_customers' | 'high_value' | 'frequent_visitors';
  budget: number;
  dailyBudget?: number;
  duration: number; // in days
  status: 'draft' | 'active' | 'paused' | 'completed' | 'rejected';
  scheduleType: 'immediate' | 'scheduled';
  startDate: any;
  endDate: any;
  startTime?: string;
  endTime?: string;
  daysOfWeek?: string[];
  location?: {
    enabled: boolean;
    radius: number;
    coordinates: any;
  };
  demographics?: {
    ageRange: { min: number; max: number };
    gender: string;
    interests: string[];
  };
  bidding?: {
    strategy: 'cost_per_click' | 'cost_per_impression' | 'cost_per_conversion';
    maxBid: number;
  };
  tracking?: {
    trackClicks: boolean;
    trackConversions: boolean;
    conversionGoal: string;
  };
  createdAt: any;
  updatedAt: any;
  clicks?: number;
  impressions?: number;
  conversions?: number;
  spend?: number;
  restaurantId: string;
}

const AdsManagement: React.FC = () => {
  const { restaurant, currentUser } = useAuth();
  useLanguage();
  const [ads, setAds] = useState<Ad[]>([]);
  const [filteredAds, setFilteredAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [showStatsModal, setShowStatsModal] = useState<Ad | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState({
    status: 'all',
    targetAudience: 'all',
    dateRange: 'all',
    budgetRange: 'all'
  });

  // Stats state
  const [stats, setStats] = useState({
    totalAds: 0,
    activeAds: 0,
    totalSpent: 0,
    totalClicks: 0,
    totalImpressions: 0,
    totalConversions: 0
  });

  // Filter ads based on current filters
  useEffect(() => {
    let filtered = [...ads];

    if (filters.status !== 'all') {
      filtered = filtered.filter(ad => ad.status === filters.status);
    }

    if (filters.targetAudience !== 'all') {
      filtered = filtered.filter(ad => ad.targetAudience === filters.targetAudience);
    }

    if (filters.dateRange !== 'all') {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      switch (filters.dateRange) {
        case 'last_7_days':
          filtered = filtered.filter(ad => {
            const adDate = ad.createdAt?.toDate ? ad.createdAt.toDate() : new Date(ad.createdAt);
            return adDate >= sevenDaysAgo;
          });
          break;
        case 'last_30_days':
          filtered = filtered.filter(ad => {
            const adDate = ad.createdAt?.toDate ? ad.createdAt.toDate() : new Date(ad.createdAt);
            return adDate >= thirtyDaysAgo;
          });
          break;
      }
    }

    if (filters.budgetRange !== 'all') {
      switch (filters.budgetRange) {
        case 'low':
          filtered = filtered.filter(ad => ad.budget < 10000);
          break;
        case 'medium':
          filtered = filtered.filter(ad => ad.budget >= 10000 && ad.budget < 50000);
          break;
        case 'high':
          filtered = filtered.filter(ad => ad.budget >= 50000);
          break;
      }
    }

    setFilteredAds(filtered);
  }, [ads, filters]);

  useEffect(() => {
    if (!restaurant?.id) return;
    
    setLoading(true);
    const adsQuery = query(
      collection(db, 'ads'),
      where('restaurantId', '==', restaurant.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(adsQuery, (snapshot: any) => {
      const adsData = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      })) as Ad[];
      
      setAds(adsData);
      
      // Calculate stats
      const newStats = {
        totalAds: adsData.length,
        activeAds: adsData.filter(ad => ad.status === 'active').length,
        totalSpent: adsData.reduce((sum, ad) => sum + (ad.spend || 0), 0),
        totalClicks: adsData.reduce((sum, ad) => sum + (ad.clicks || 0), 0),
        totalImpressions: adsData.reduce((sum, ad) => sum + (ad.impressions || 0), 0),
        totalConversions: adsData.reduce((sum, ad) => sum + (ad.conversions || 0), 0)
      };
      setStats(newStats);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [restaurant?.id]);

  const handleCreateAd = async (adData: any) => {
    if (!restaurant?.id || !currentUser?.uid) return;

    try {
      const now = serverTimestamp();
      
      const newAdData = {
        ...adData,
        restaurantId: restaurant.id,
        createdAt: now,
        updatedAt: now,
        clicks: 0,
        impressions: 0,
        conversions: 0,
        spend: 0
      };

      await addDoc(collection(db, 'ads'), newAdData);
      
      toast.success('Ad created successfully!');
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating ad:', error);
      toast.error('Failed to create ad. Please try again.');
    }
  };

  const handleUpdateAd = async (adData: any) => {
    if (!editingAd) return;

    try {
      const adRef = doc(db, 'ads', editingAd.id);

      await updateDoc(adRef, {
        ...adData,
        updatedAt: serverTimestamp()
      });

      toast.success('Ad updated successfully!');
      setEditingAd(null);
    } catch (error) {
      console.error('Error updating ad:', error);
      toast.error('Failed to update ad. Please try again.');
    }
  };

  const handleDeleteAd = async (adId: string) => {
    if (!confirm('Are you sure you want to delete this ad?')) return;

    try {
      await deleteDoc(doc(db, 'ads', adId));
      toast.success('Ad deleted successfully!');
    } catch (error) {
      console.error('Error deleting ad:', error);
      toast.error('Failed to delete ad. Please try again.');
    }
  };

  const handleStatusChange = async (adId: string, newStatus: Ad['status']) => {
    try {
      const adRef = doc(db, 'ads', adId);
      await updateDoc(adRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(`Ad ${newStatus} successfully!`);
    } catch (error) {
      console.error('Error updating ad status:', error);
      toast.error('Failed to update ad status. Please try again.');
    }
  };

  const openEditModal = (ad: Ad) => {
    setEditingAd(ad);
  };

  const handleFilterChange = (filterType: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      targetAudience: 'all',
      dateRange: 'all',
      budgetRange: 'all'
    });
  };

  const exportAdsData = () => {
    const csvContent = [
      ['Title', 'Status', 'Target Audience', 'Budget', 'Clicks', 'Impressions', 'Conversions', 'Spend', 'Created Date'].join(','),
      ...filteredAds.map(ad => [
        ad.title,
        ad.status,
        ad.targetAudience,
        ad.budget,
        ad.clicks || 0,
        ad.impressions || 0,
        ad.conversions || 0,
        ad.spend || 0,
        formatDate(ad.createdAt)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ads-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: Ad['status']) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'paused': return 'text-yellow-600 bg-yellow-100';
      case 'completed': return 'text-blue-600 bg-blue-100';
      case 'rejected': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: Ad['status']) => {
    switch (status) {
      case 'active': return <CheckCircle size={16} />;
      case 'paused': return <Clock size={16} />;
      case 'completed': return <CheckCircle size={16} />;
      case 'rejected': return <XCircle size={16} />;
      default: return <AlertCircle size={16} />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CM', {
      style: 'currency',
      currency: restaurant?.currency || 'XAF'
    }).format(amount);
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString();
  };

  if (loading) {
    return (
      <DashboardLayout title=" ">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: designSystem.colors.accent }}></div>
        </div>
      </DashboardLayout>
    );
  }

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
                <p className="text-2xl font-semibold text-gray-900">{stats.totalAds}</p>
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
                <p className="text-2xl font-semibold text-gray-900">{stats.activeAds}</p>
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
                <p className="text-2xl font-semibold text-gray-900">{formatCurrency(stats.totalSpent)}</p>
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
                <p className="text-2xl font-semibold text-gray-900">{stats.totalClicks}</p>
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
          <div className="flex space-x-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Filter size={20} className="mr-2" />
              Filters
            </button>
            <button
              onClick={exportAdsData}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download size={20} className="mr-2" />
              Export
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center px-4 py-2 rounded-lg font-semibold text-white transition-colors"
              style={{ background: designSystem.colors.accent }}
            >
              <Plus size={20} className="mr-2" />
              Create Ad
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
                <select
                  value={filters.targetAudience}
                  onChange={(e) => handleFilterChange('targetAudience', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Audiences</option>
                  <option value="all">All Customers</option>
                  <option value="local">Local Area</option>
                  <option value="new_customers">New Customers</option>
                  <option value="returning_customers">Returning Customers</option>
                  <option value="high_value">High-Value Customers</option>
                  <option value="frequent_visitors">Frequent Visitors</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Time</option>
                  <option value="last_7_days">Last 7 Days</option>
                  <option value="last_30_days">Last 30 Days</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budget Range</label>
                <select
                  value={filters.budgetRange}
                  onChange={(e) => handleFilterChange('budgetRange', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Budgets</option>
                  <option value="low">Low (&lt; 10,000)</option>
                  <option value="medium">Medium (10,000 - 50,000)</option>
                  <option value="high">High (&gt; 50,000)</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end mt-4">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Ads List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredAds.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                {ads.length === 0 ? 'No ads yet' : 'No ads match your filters'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {ads.length === 0 
                  ? 'Get started by creating your first advertisement.'
                  : 'Try adjusting your filters or create a new ad.'
                }
              </p>
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
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ad
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Target
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Budget
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Performance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Schedule
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAds.map((ad) => (
                    <tr key={ad.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {ad.imageBase64 && (
                            <img
                              className="h-10 w-10 rounded-lg object-cover mr-3"
                              src={ad.imageBase64}
                              alt={ad.title}
                            />
                          )}
                          {ad.videoBase64 && !ad.imageBase64 && (
                            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center mr-3">
                              <Video size={16} className="text-purple-600" />
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{ad.title}</div>
                            <div className="text-sm text-gray-500 truncate max-w-xs">{ad.description}</div>
                            {ad.callToAction && (
                              <div className="text-xs text-blue-600 font-medium">
                                CTA: {ad.callToAction.replace('_', ' ')}
                              </div>
                            )}
                            <div className="flex items-center space-x-2 mt-1">
                              {ad.imageBase64 && (
                                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">Image</span>
                              )}
                              {ad.audioBase64 && (
                                <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">Audio</span>
                              )}
                              {ad.videoBase64 && (
                                <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded">Video</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Target size={16} className="mr-1 text-gray-400" />
                          <span className="text-sm text-gray-900 capitalize">
                            {ad.targetAudience.replace('_', ' ')}
                          </span>
                        </div>
                        {ad.demographics && (
                          <div className="text-xs text-gray-500">
                            Age: {ad.demographics.ageRange.min}-{ad.demographics.ageRange.max}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatCurrency(ad.budget)}</div>
                        {ad.dailyBudget && (
                          <div className="text-sm text-gray-500">Daily: {formatCurrency(ad.dailyBudget)}</div>
                        )}
                        <div className="text-sm text-gray-500">{ad.duration} days</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ad.status)}`}>
                          {getStatusIcon(ad.status)}
                          <span className="ml-1 capitalize">{ad.status}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {ad.clicks || 0} clicks
                        </div>
                        <div className="text-sm text-gray-500">
                          {ad.impressions || 0} impressions
                        </div>
                        <div className="text-sm text-gray-500">
                          CTR: {ad.impressions ? ((ad.clicks || 0) / ad.impressions * 100).toFixed(2) : 0}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {ad.scheduleType === 'immediate' ? 'Immediate' : 'Scheduled'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatDate(ad.startDate)} - {formatDate(ad.endDate)}
                        </div>
                        {ad.startTime && ad.endTime && (
                          <div className="text-xs text-gray-500">
                            {ad.startTime} - {ad.endTime}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setShowStatsModal(ad)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Stats"
                          >
                            <BarChart3 size={16} />
                          </button>
                          <button
                            onClick={() => openEditModal(ad)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                          {ad.status === 'active' ? (
                            <button
                              onClick={() => handleStatusChange(ad.id, 'paused')}
                              className="text-yellow-600 hover:text-yellow-900"
                              title="Pause"
                            >
                              <Pause size={16} />
                            </button>
                          ) : ad.status === 'paused' ? (
                            <button
                              onClick={() => handleStatusChange(ad.id, 'active')}
                              className="text-green-600 hover:text-green-900"
                              title="Resume"
                            >
                              <Play size={16} />
                            </button>
                          ) : null}
                          <button
                            onClick={() => handleDeleteAd(ad.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingAd) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingAd ? 'Edit Advertisement' : 'Create New Advertisement'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingAd(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>
              
              <EnhancedAdForm
                onSubmit={editingAd ? handleUpdateAd : handleCreateAd}
                onCancel={() => {
                  setShowCreateModal(false);
                  setEditingAd(null);
                }}
                initialData={editingAd}
                isEditing={!!editingAd}
                restaurant={restaurant}
              />
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Stats Modal */}
      {showStatsModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Ad Performance: {showStatsModal.title}
                </h3>
                <button
                  onClick={() => setShowStatsModal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-6">
                {/* Performance Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-blue-600 font-medium">Clicks</div>
                    <div className="text-2xl font-bold text-blue-900">{showStatsModal.clicks || 0}</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm text-green-600 font-medium">Impressions</div>
                    <div className="text-2xl font-bold text-green-900">{showStatsModal.impressions || 0}</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-sm text-purple-600 font-medium">Conversions</div>
                    <div className="text-2xl font-bold text-purple-900">{showStatsModal.conversions || 0}</div>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="text-sm text-yellow-600 font-medium">CTR</div>
                    <div className="text-2xl font-bold text-yellow-900">
                      {showStatsModal.impressions 
                        ? ((showStatsModal.clicks || 0) / showStatsModal.impressions * 100).toFixed(2)
                        : 0}%
                    </div>
                  </div>
                </div>

                {/* Budget Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 font-medium">Total Budget</div>
                    <div className="text-xl font-semibold text-gray-900">{formatCurrency(showStatsModal.budget)}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 font-medium">Amount Spent</div>
                    <div className="text-xl font-semibold text-gray-900">{formatCurrency(showStatsModal.spend || 0)}</div>
                  </div>
                </div>

                {/* Ad Details */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Ad Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Target Audience:</span>
                      <span className="ml-2 font-medium capitalize">
                        {showStatsModal.targetAudience.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(showStatsModal.status)}`}>
                        {showStatsModal.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Duration:</span>
                      <span className="ml-2 font-medium">{showStatsModal.duration} days</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Schedule:</span>
                      <span className="ml-2 font-medium">
                        {showStatsModal.scheduleType === 'immediate' ? 'Immediate' : 'Scheduled'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Created:</span>
                      <span className="ml-2 font-medium">{formatDate(showStatsModal.createdAt)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Last Updated:</span>
                      <span className="ml-2 font-medium">{formatDate(showStatsModal.updatedAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Performance Insights */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Performance Insights</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    {(showStatsModal.impressions || 0) > 0 && (
                      <div>
                        • Click-through rate: {((showStatsModal.clicks || 0) / (showStatsModal.impressions || 1) * 100).toFixed(2)}%
                      </div>
                    )}
                    {(showStatsModal.clicks || 0) > 0 && (
                      <div>
                        • Cost per click: {formatCurrency((showStatsModal.spend || 0) / (showStatsModal.clicks || 1))}
                      </div>
                    )}
                    {(showStatsModal.conversions || 0) > 0 && (
                      <div>
                        • Conversion rate: {((showStatsModal.conversions || 0) / (showStatsModal.clicks || 1) * 100).toFixed(2)}%
                      </div>
                    )}
                    <div>
                      • Budget utilization: {((showStatsModal.spend || 0) / showStatsModal.budget * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AdsManagement;
