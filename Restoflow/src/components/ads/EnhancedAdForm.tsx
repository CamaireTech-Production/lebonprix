import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Target, DollarSign, Users, MapPin, BarChart3, Eye, EyeOff } from 'lucide-react';
import MediaUpload from './MediaUpload';
import { useLanguage } from '../../contexts/LanguageContext';

interface EnhancedAdFormProps {
  onSubmit: (adData: any) => void;
  onCancel: () => void;
  initialData?: any;
  isEditing?: boolean;
  restaurant?: any;
}

const EnhancedAdForm: React.FC<EnhancedAdFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
  isEditing = false,
  restaurant
}) => {
  const { language } = useLanguage();
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
    scheduleType: 'immediate', // immediate, scheduled
    startDate: '',
    endDate: '',
    startTime: '09:00',
    endTime: '17:00',
    daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    location: {
      enabled: false,
      radius: 5, // km
      coordinates: null
    },
    demographics: {
      ageRange: { min: 18, max: 65 },
      gender: 'all', // all, male, female
      interests: []
    },
    bidding: {
      strategy: 'cost_per_click', // cost_per_click, cost_per_impression, cost_per_conversion
      maxBid: 0
    },
    tracking: {
      trackClicks: true,
      trackConversions: true,
      conversionGoal: 'order_placed'
    }
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...formData,
        ...initialData,
        startDate: initialData.startDate ? new Date(initialData.startDate).toISOString().split('T')[0] : '',
        endDate: initialData.endDate ? new Date(initialData.endDate).toISOString().split('T')[0] : '',
      });
    }
  }, [initialData]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleNestedInputChange = (parent: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent as keyof typeof prev],
        [field]: value
      }
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (formData.budget <= 0) {
      newErrors.budget = 'Budget must be greater than 0';
    }

    if (formData.duration <= 0) {
      newErrors.duration = 'Duration must be at least 1 day';
    }

    if (formData.scheduleType === 'scheduled') {
      if (!formData.startDate) {
        newErrors.startDate = 'Start date is required for scheduled ads';
      }
      if (!formData.endDate) {
        newErrors.endDate = 'End date is required for scheduled ads';
      }
      if (formData.startDate && formData.endDate && new Date(formData.startDate) >= new Date(formData.endDate)) {
        newErrors.endDate = 'End date must be after start date';
      }
    }

    if (formData.bidding.maxBid <= 0) {
      newErrors.maxBid = 'Maximum bid must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const adData = {
        ...formData,
        startDate: formData.scheduleType === 'immediate' ? new Date() : new Date(formData.startDate),
        endDate: formData.scheduleType === 'immediate' 
          ? new Date(Date.now() + formData.duration * 24 * 60 * 60 * 1000)
          : new Date(formData.endDate),
        createdAt: isEditing ? initialData?.createdAt : new Date(),
        updatedAt: new Date(),
        restaurantId: restaurant?.id,
        clicks: initialData?.clicks || 0,
        impressions: initialData?.impressions || 0,
        conversions: initialData?.conversions || 0,
        spend: initialData?.spend || 0
      };

      await onSubmit(adData);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
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

  const toggleDayOfWeek = (day: string) => {
    setFormData(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day]
    }));
  };

  const days = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' }
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Eye className="h-5 w-5 mr-2" />
          Basic Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ad Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter ad title"
            />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Call to Action
            </label>
            <select
              value={formData.callToAction}
              onChange={(e) => handleInputChange('callToAction', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select CTA</option>
              <option value="order_now">Order Now</option>
              <option value="book_table">Book Table</option>
              <option value="call_us">Call Us</option>
              <option value="visit_us">Visit Us</option>
              <option value="learn_more">Learn More</option>
              <option value="get_offer">Get Offer</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            rows={3}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.description ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Describe your advertisement"
          />
          {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
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
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Target className="h-5 w-5 mr-2" />
          Targeting & Budget
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Audience
            </label>
            <select
              value={formData.targetAudience}
              onChange={(e) => handleInputChange('targetAudience', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Customers</option>
              <option value="local">Local Area</option>
              <option value="new_customers">New Customers</option>
              <option value="returning_customers">Returning Customers</option>
              <option value="high_value">High-Value Customers</option>
              <option value="frequent_visitors">Frequent Visitors</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Age Range
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="18"
                max="65"
                value={formData.demographics.ageRange.min}
                onChange={(e) => handleNestedInputChange('demographics', 'ageRange', {
                  ...formData.demographics.ageRange,
                  min: parseInt(e.target.value)
                })}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <span className="text-gray-500">to</span>
              <input
                type="number"
                min="18"
                max="65"
                value={formData.demographics.ageRange.max}
                onChange={(e) => handleNestedInputChange('demographics', 'ageRange', {
                  ...formData.demographics.ageRange,
                  max: parseInt(e.target.value)
                })}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Budget ({restaurant?.currency || 'XAF'}) *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.budget}
              onChange={(e) => handleInputChange('budget', parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.budget ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.budget && <p className="text-red-500 text-xs mt-1">{errors.budget}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Daily Budget ({restaurant?.currency || 'XAF'})
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.dailyBudget}
              onChange={(e) => handleInputChange('dailyBudget', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Days of Week Selection */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Show Ad On
          </label>
          <div className="flex flex-wrap gap-2">
            {days.map(day => (
              <button
                key={day.key}
                type="button"
                onClick={() => toggleDayOfWeek(day.key)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  formData.daysOfWeek.includes(day.key)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scheduling */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Calendar className="h-5 w-5 mr-2" />
          Scheduling
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Schedule Type
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="immediate"
                  checked={formData.scheduleType === 'immediate'}
                  onChange={(e) => handleInputChange('scheduleType', e.target.value)}
                  className="mr-2"
                />
                Start Immediately
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="scheduled"
                  checked={formData.scheduleType === 'scheduled'}
                  onChange={(e) => handleInputChange('scheduleType', e.target.value)}
                  className="mr-2"
                />
                Schedule for Later
              </label>
            </div>
          </div>

          {formData.scheduleType === 'scheduled' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.startDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date *
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.endDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => handleInputChange('startTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => handleInputChange('endTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bidding Strategy */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          Bidding Strategy
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bidding Strategy
            </label>
            <select
              value={formData.bidding.strategy}
              onChange={(e) => handleNestedInputChange('bidding', 'strategy', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="cost_per_click">Cost Per Click (CPC)</option>
              <option value="cost_per_impression">Cost Per Impression (CPM)</option>
              <option value="cost_per_conversion">Cost Per Conversion (CPA)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Bid ({restaurant?.currency || 'XAF'}) *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.bidding.maxBid}
              onChange={(e) => handleNestedInputChange('bidding', 'maxBid', parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.maxBid ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.maxBid && <p className="text-red-500 text-xs mt-1">{errors.maxBid}</p>}
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Saving...' : (isEditing ? 'Update Ad' : 'Create Ad')}
        </button>
      </div>
    </form>
  );
};

export default EnhancedAdForm;
