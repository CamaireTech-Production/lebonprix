import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { db } from '../../../firebase/config';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
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
  Music,
  Megaphone,
  MapPin
} from 'lucide-react';
import MediaUpload from '../../../components/ads/MediaUpload';
import AdPopupTemplate from '../../../components/ads/AdPopupTemplate';

const AdsManagementFast: React.FC = () => {
  const { restaurant, currentUser } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAd, setEditingAd] = useState<any>(null);
  const [showStatsModal, setShowStatsModal] = useState<any>(null);
  const [showAdPopup, setShowAdPopup] = useState<any>(null);
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageBase64: '',
    audioBase64: '',
    videoBase64: '',
    targetAudience: 'all',
    duration: 7,
    position: 'under_menu_cards', // Default position
    status: 'draft'
  });

  // Fetch ads from Firebase
  React.useEffect(() => {
    if (!restaurant?.id) return;

    const adsQuery = query(
      collection(db, 'ads'),
      where('restaurantId', '==', restaurant.id)
    );

    const unsubscribe = onSnapshot(adsQuery, (snapshot) => {
      const adsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by createdAt in descending order (newest first)
      const sortedAds = adsData.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
        const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
        return bTime.getTime() - aTime.getTime();
      });
      
      setAds(sortedAds);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching ads:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [restaurant?.id]);

  // Calculate stats dynamically from ads
  const stats = {
    totalAds: ads.length,
    activeAds: ads.filter(ad => ad.status === 'active').length,
    totalSpent: ads.reduce((sum, ad) => sum + (ad.spend || 0), 0),
    totalClicks: ads.reduce((sum, ad) => sum + (ad.clicks || 0), 0),
    totalImpressions: ads.reduce((sum, ad) => sum + (ad.impressions || 0), 0),
    totalConversions: ads.reduce((sum, ad) => sum + (ad.conversions || 0), 0)
  };

  const handleCreateAd = async () => {
    if (!restaurant?.id) return;
    
    try {
      const adData = {
        ...formData,
        restaurantId: restaurant.id,
        status: 'active',
        clicks: 0,
        impressions: 0,
        conversions: 0,
        spend: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'ads'), adData);
      
      toast.success('Ad created successfully!');
      resetForm();
      setShowCreateModal(false);
      
      // Show ad popup after a short delay
      setTimeout(() => {
        setShowAdPopup({ id: docRef.id, ...adData });
      }, 500);
    } catch (error) {
      console.error('Error creating ad:', error);
      toast.error('Failed to create ad');
    }
  };


  const handleUpdateAd = async () => {
    if (!editingAd) return;
    
    try {
      const adRef = doc(db, 'ads', editingAd.id);
      await updateDoc(adRef, {
        ...formData,
        updatedAt: serverTimestamp()
      });
      
      toast.success(`Ad "${editingAd.title}" updated successfully!`);
      setEditingAd(null);
      resetForm();
    } catch (error) {
      console.error('Error updating ad:', error);
      toast.error('Failed to update ad');
    }
  };

  const handleDeleteAd = async (adId: string, adTitle: string) => {
    if (window.confirm(`Are you sure you want to delete the ad "${adTitle}"? This action cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, 'ads', adId));
        toast.success(`Ad "${adTitle}" deleted successfully!`);
      } catch (error) {
        console.error('Error deleting ad:', error);
        toast.error('Failed to delete ad');
      }
    }
  };

  const handleEditAd = (ad: any) => {
    setEditingAd(ad);
    setFormData({
      title: ad.title,
      description: ad.description,
      imageBase64: ad.imageBase64,
      audioBase64: ad.audioBase64,
      videoBase64: ad.videoBase64,
      targetAudience: ad.targetAudience,
      duration: ad.duration,
      position: ad.position || 'under_menu_cards', // Default to under_menu_cards if not set
      status: ad.status
    });
  };

  const handleReservation = () => {
    alert('Reservation functionality will be connected to your booking system!');
    setShowAdPopup(null);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      imageBase64: '',
      audioBase64: '',
      videoBase64: '',
      targetAudience: 'all',
      duration: 7,
      position: 'under_menu_cards',
      status: 'draft'
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-2 sm:p-4 lg:p-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6 mb-3 sm:mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex-1">
              <div className="flex items-center space-x-2 sm:space-x-3 mb-2">
                <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                  <Megaphone className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Ads Management</h1>
                  <p className="text-xs sm:text-sm lg:text-base text-gray-600 mt-1">Create and manage your restaurant advertisements</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2 sm:mt-3">
                <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Fast Loading
                </span>
                <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Analytics
                </span>
                <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  <Target className="h-3 w-3 mr-1" />
                  Targeting
                </span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 lg:ml-6 mt-3 lg:mt-0">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 text-sm sm:text-base"
              >
                <Plus size={18} className="mr-2" />
                Create New Ad
              </button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 space-y-1 sm:space-y-0">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Performance Overview</h2>
            <div className="text-xs sm:text-sm text-gray-500">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                  <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <div className="ml-2 sm:ml-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Ads</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.totalAds}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                </div>
                <div className="ml-2 sm:ml-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Ads</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.activeAds}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-1.5 sm:p-2 bg-yellow-100 rounded-lg">
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
                </div>
                <div className="ml-2 sm:ml-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Spent</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(stats.totalSpent)}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg">
                  <Eye className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                </div>
                <div className="ml-2 sm:ml-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Impressions</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.totalImpressions.toLocaleString()}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg">
                  <Target className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                </div>
                <div className="ml-2 sm:ml-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Clicks</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.totalClicks.toLocaleString()}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-1.5 sm:p-2 bg-indigo-100 rounded-lg">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
                </div>
                <div className="ml-2 sm:ml-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Conversions</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.totalConversions.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ads List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                  <Megaphone className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Your Advertisements</h3>
                  <p className="text-xs sm:text-sm text-gray-500">Manage and monitor your active campaigns</p>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-gray-500">
                {ads.length} {ads.length === 1 ? 'ad' : 'ads'} total
              </div>
            </div>
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
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
                      Duration
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
                        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center mr-3">
                          <ImageIcon size={16} className="text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{ad.title}</div>
                          <div className="text-sm text-gray-500 truncate max-w-xs">{ad.description}</div>
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
                      <div className="text-sm text-gray-900">{ad.duration} days</div>
                      <div className="text-xs text-gray-500">Campaign length</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ad.status)}`}>
                        {getStatusIcon(ad.status)}
                        <span className="ml-1 capitalize">{ad.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="space-y-1">
                        <div>👁️ {ad.impressions} impressions</div>
                        <div>🖱️ {ad.clicks} clicks</div>
                        <div>💰 {formatCurrency(ad.spend)} spent</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setShowStatsModal(ad)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                          title="View Stats"
                        >
                          <BarChart3 size={16} />
                        </button>
                        <button
                          onClick={() => handleEditAd(ad)}
                          className="text-indigo-600 hover:text-indigo-900 p-1 rounded hover:bg-indigo-50"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteAd(ad.id, ad.title)}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
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

          {/* Mobile Card View */}
          <div className="lg:hidden">
            {ads.map((ad) => (
              <div key={ad.id} className="border-b border-gray-200 p-4 sm:p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <ImageIcon size={16} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">{ad.title}</h4>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{ad.description}</p>
                      
                      {/* Mobile Details */}
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center text-xs text-gray-600">
                          <Target size={12} className="mr-1" />
                          <span className="capitalize">{ad.targetAudience.replace('_', ' ')}</span>
                        </div>
                        <div className="flex items-center text-xs text-gray-600">
                          <Clock size={12} className="mr-1" />
                          <span>{ad.duration} days</span>
                        </div>
                        <div className="flex items-center text-xs text-gray-600">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ad.status)}`}>
                            {getStatusIcon(ad.status)}
                            <span className="ml-1 capitalize">{ad.status}</span>
                          </span>
                        </div>
                      </div>

                      {/* Performance Stats */}
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <div className="font-medium text-gray-900">{ad.impressions}</div>
                          <div className="text-gray-500">Impressions</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-gray-900">{ad.clicks}</div>
                          <div className="text-gray-500">Clicks</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-gray-900">{formatCurrency(ad.spend)}</div>
                          <div className="text-gray-500">Spent</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col space-y-2 ml-3">
                    <button
                      onClick={() => setShowStatsModal(ad)}
                      className="text-blue-600 hover:text-blue-900 p-2 rounded hover:bg-blue-50"
                      title="View Stats"
                    >
                      <BarChart3 size={16} />
                    </button>
                    <button
                      onClick={() => handleEditAd(ad)}
                      className="text-indigo-600 hover:text-indigo-900 p-2 rounded hover:bg-indigo-50"
                      title="Edit"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteAd(ad.id, ad.title)}
                      className="text-red-600 hover:text-red-900 p-2 rounded hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create/Edit Modal */}
        {(showCreateModal || editingAd) && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-4 sm:top-20 mx-auto p-4 sm:p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
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
                  <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                    <h4 className="text-md font-semibold text-gray-900 mb-3">Basic Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ad Title *
                        </label>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                          placeholder="Enter ad title"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Duration (Days) *
                        </label>
                        <input
                          type="number"
                          value={formData.duration}
                          onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 7 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                          placeholder="7"
                          min="1"
                          max="365"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ad Position *
                        </label>
                        <select
                          value={formData.position}
                          onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                        >
                          <option value="top">Top of Menu</option>
                          <option value="under_menu_cards">Under Menu Cards</option>
                          <option value="bottom">Bottom of Menu</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Choose where your ad will appear in the public menu
                        </p>
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
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

                  {/* Targeting */}
                  <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                    <h4 className="text-md font-semibold text-gray-900 mb-3">Targeting</h4>
                    <div className="grid grid-cols-1 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Target Audience
                        </label>
                        <select
                          value={formData.targetAudience}
                          onChange={(e) => setFormData(prev => ({ ...prev, targetAudience: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                        >
                          <option value="all">All Customers</option>
                          <option value="local">Local Customers</option>
                          <option value="new_customers">New Customers</option>
                          <option value="returning_customers">Returning Customers</option>
                          <option value="high_value">High Value Customers</option>
                          <option value="frequent_visitors">Frequent Visitors</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                    <button
                      onClick={() => {
                        setShowCreateModal(false);
                        setEditingAd(null);
                        resetForm();
                      }}
                      className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm sm:text-base"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={editingAd ? handleUpdateAd : handleCreateAd}
                      disabled={!formData.title || !formData.description}
                      className="w-full sm:w-auto px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
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

        {/* Ad Popup Template */}
        {showAdPopup && (
          <AdPopupTemplate
            ad={showAdPopup}
            onClose={() => setShowAdPopup(null)}
            onReserve={handleReservation}
          />
        )}

      </div>
    </DashboardLayout>
  );
};

export default AdsManagementFast;
