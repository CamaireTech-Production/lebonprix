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
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  Calendar, 
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
  Upload,
  Settings,
  Play,
  Pause,
  Stop,
  Video,
  Image as ImageIcon,
  Music
} from 'lucide-react';
import { t } from '../../../utils/i18n';
import { useLanguage } from '../../../contexts/LanguageContext';
import MediaUpload from '../../../components/ads/MediaUpload';

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
  duration: number;
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

const AdsManagementWorking: React.FC = () => {
  const { restaurant, currentUser } = useAuth();
  const { language } = useLanguage();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [showStatsModal, setShowStatsModal] = useState<Ad | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    callToAction: '',
    imageBase64: '',
    audioBase64: '',
    videoBase64: '',
    targetAudience: 'all',
    budget: 0,
    dailyBudget: 0,
    duration: 7,
    status: 'draft',
    scheduleType: 'immediate',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    daysOfWeek: [] as string[],
    location: {
      enabled: false,
      radius: 5,
      coordinates: null
    },
    demographics: {
      ageRange: { min: 18, max: 65 },
      gender: 'all',
      interests: [] as string[]
    },
    bidding: {
      strategy: 'cost_per_click',
      maxBid: 1
    },
    tracking: {
      trackClicks: true,
      trackConversions: true,
      conversionGoal: 'order_placed'
    }
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

  useEffect(() => {
    if (!restaurant?.id) return;
    
    setLoading(true);
    const adsQuery = query(
      collection(db, 'ads'),
      where('restaurantId', '==', restaurant.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(adsQuery, (snapshot) => {
      const adsData = snapshot.docs.map(doc => ({
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

  const handleCreateAd = async () => {
    if (!restaurant?.id || !currentUser?.uid) return;

    try {
      const now = serverTimestamp();
      
      const newAdData = {
        ...formData,
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
      resetForm();
    } catch (error) {
      console.error('Error creating ad:', error);
      toast.error('Failed to create ad. Please try again.');
    }
  };

  const handleUpdateAd = async () => {
    if (!editingAd) return;

    try {
      const now = serverTimestamp();
      
      const updateData = {
        ...formData,
        updatedAt: now
      };

      await updateDoc(doc(db, 'ads', editingAd.id), updateData);
      
      toast.success('Ad updated successfully!');
      setEditingAd(null);
      resetForm();
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

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      callToAction: '',
      imageBase64: '',
      audioBase64: '',
      videoBase64: '',
      targetAudience: 'all',
      budget: 0,
      dailyBudget: 0,
      duration: 7,
      status: 'draft',
      scheduleType: 'immediate',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      daysOfWeek: [],
      location: {
        enabled: false,
        radius: 5,
        coordinates: null
      },
      demographics: {
        ageRange: { min: 18, max: 65 },
        gender: 'all',
        interests: []
      },
      bidding: {
        strategy: 'cost_per_click',
        maxBid: 1
      },
      tracking: {
        trackClicks: true,
        trackConversions: true,
        conversionGoal: 'order_placed'
      }
    });
  };

  const handleImageUpload = (base64: string, file: File) => {
    setFormData(prev => ({ ...prev, imageBase64: base64 }));
  };

  const handleAudioUpload = (base64: string, file: File) => {
    setFormData(prev => ({ ...prev, audioBase64: base64 }));
  };

  const handleVideoUpload = (base64: string, file: File) => {
    setFormData(prev => ({ ...prev, videoBase64: base64 }));
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, imageBase64: '' }));
  };

  const handleRemoveAudio = () => {
    setFormData(prev => ({ ...prev, audioBase64: '' }));
  };

  const handleRemoveVideo = () => {
    setFormData(prev => ({ ...prev, videoBase64: '' }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle size={16} />;
      case 'paused': return <Pause size={16} />;
      case 'draft': return <Edit size={16} />;
      case 'completed': return <CheckCircle size={16} />;
      case 'rejected': return <XCircle size={16} />;
      default: return <AlertCircle size={16} />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <DashboardLayout title="Ads Management">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <span className="ml-4">Loading ads...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Ads Management">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ads Management</h1>
            <p className="text-gray-600">Create and manage your restaurant advertisements</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center"
          >
            <Plus size={20} className="mr-2" />
            Create Ad
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-blue-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Total Ads</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalAds}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Active Ads</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.activeAds}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-yellow-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Total Spent</p>
                <p className="text-2xl font-semibold text-gray-900">{formatCurrency(stats.totalSpent)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <Eye className="h-8 w-8 text-purple-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Impressions</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalImpressions.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-red-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Clicks</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalClicks.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-indigo-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Conversions</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalConversions.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ads Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Your Ads</h3>
          </div>
          
          {ads.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No ads yet</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating your first advertisement.</p>
              <div className="mt-6">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Create Your First Ad
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ad Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Target Audience
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
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ads.map((ad) => (
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
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatCurrency(ad.budget)}</div>
                        {ad.dailyBudget && (
                          <div className="text-xs text-gray-500">Daily: {formatCurrency(ad.dailyBudget)}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ad.status)}`}>
                          {getStatusIcon(ad.status)}
                          <span className="ml-1 capitalize">{ad.status}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="space-y-1">
                          <div>👁️ {ad.impressions || 0} impressions</div>
                          <div>🖱️ {ad.clicks || 0} clicks</div>
                          <div>💰 {formatCurrency(ad.spend || 0)} spent</div>
                        </div>
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
                            onClick={() => {
                              setEditingAd(ad);
                              setFormData({
                                ...ad,
                                startDate: ad.startDate ? formatDate(ad.startDate) : '',
                                endDate: ad.endDate ? formatDate(ad.endDate) : ''
                              });
                            }}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
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

        {/* Create/Edit Modal */}
        {(showCreateModal || editingAd) && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingAd ? 'Edit Ad' : 'Create New Ad'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingAd(null);
                      resetForm();
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle size={24} />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-md font-semibold text-gray-900 mb-3">Basic Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ad Title *
                        </label>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter ad title"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Call to Action
                        </label>
                        <select
                          value={formData.callToAction}
                          onChange={(e) => setFormData(prev => ({ ...prev, callToAction: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select CTA</option>
                          <option value="order_now">Order Now</option>
                          <option value="book_table">Book Table</option>
                          <option value="learn_more">Learn More</option>
                          <option value="visit_us">Visit Us</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description *
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Describe your advertisement"
                      />
                    </div>
                  </div>

                  {/* Media Upload */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Media Content</h3>
                    <MediaUpload
                      onImageUpload={handleImageUpload}
                      onAudioUpload={handleAudioUpload}
                      onVideoUpload={handleVideoUpload}
                      onRemoveImage={handleRemoveImage}
                      onRemoveAudio={handleRemoveAudio}
                      onRemoveVideo={handleRemoveVideo}
                      currentImage={formData.imageBase64}
                      currentAudio={formData.audioBase64}
                      currentVideo={formData.videoBase64}
                    />
                  </div>

                  {/* Targeting & Budget */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-md font-semibold text-gray-900 mb-3">Targeting & Budget</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Target Audience
                        </label>
                        <select
                          value={formData.targetAudience}
                          onChange={(e) => setFormData(prev => ({ ...prev, targetAudience: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="all">All Customers</option>
                          <option value="local">Local Customers</option>
                          <option value="new_customers">New Customers</option>
                          <option value="returning_customers">Returning Customers</option>
                          <option value="high_value">High Value Customers</option>
                          <option value="frequent_visitors">Frequent Visitors</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Total Budget ($)
                        </label>
                        <input
                          type="number"
                          value={formData.budget}
                          onChange={(e) => setFormData(prev => ({ ...prev, budget: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Daily Budget ($)
                        </label>
                        <input
                          type="number"
                          value={formData.dailyBudget}
                          onChange={(e) => setFormData(prev => ({ ...prev, dailyBudget: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setShowCreateModal(false);
                        setEditingAd(null);
                        resetForm();
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={editingAd ? handleUpdateAd : handleCreateAd}
                      disabled={!formData.title || !formData.description}
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {editingAd ? 'Update Ad' : 'Create Ad'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Modal */}
        {showStatsModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Ad Performance</h3>
                  <button
                    onClick={() => setShowStatsModal(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle size={24} />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900">{showStatsModal.title}</h4>
                    <p className="text-sm text-gray-500">{showStatsModal.description}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-2xl font-bold text-blue-600">{showStatsModal.impressions || 0}</div>
                      <div className="text-sm text-gray-600">Impressions</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-2xl font-bold text-green-600">{showStatsModal.clicks || 0}</div>
                      <div className="text-sm text-gray-600">Clicks</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-2xl font-bold text-purple-600">{showStatsModal.conversions || 0}</div>
                      <div className="text-sm text-gray-600">Conversions</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-2xl font-bold text-yellow-600">{formatCurrency(showStatsModal.spend || 0)}</div>
                      <div className="text-sm text-gray-600">Spent</div>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <button
                      onClick={() => setShowStatsModal(null)}
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdsManagementWorking;
