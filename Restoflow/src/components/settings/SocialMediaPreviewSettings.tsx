import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { uploadImage } from '../../services/storageService';
import { toast } from 'react-hot-toast';

interface SocialMediaPreviewSettingsProps {
  restaurant: any;
  onUpdate: (updates: any) => void;
}

interface PreviewSettings {
  menu?: {
    title?: string;
    description?: string;
    image?: string;
  };
  dailyMenu?: {
    title?: string;
    description?: string;
    image?: string;
  };
}

const SocialMediaPreviewSettings: React.FC<SocialMediaPreviewSettingsProps> = ({
  restaurant,
  onUpdate
}) => {
  const { user } = useAuth();
  const [previewSettings, setPreviewSettings] = useState<PreviewSettings>({
    menu: {
      title: '',
      description: '',
      image: ''
    },
    dailyMenu: {
      title: '',
      description: '',
      image: ''
    }
  });
  const [uploading, setUploading] = useState<{ [key: string]: boolean }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (restaurant?.socialMediaPreview) {
      setPreviewSettings({
        menu: {
          title: restaurant.socialMediaPreview.menu?.title || '',
          description: restaurant.socialMediaPreview.menu?.description || '',
          image: restaurant.socialMediaPreview.menu?.image || ''
        },
        dailyMenu: {
          title: restaurant.socialMediaPreview.dailyMenu?.title || '',
          description: restaurant.socialMediaPreview.dailyMenu?.description || '',
          image: restaurant.socialMediaPreview.dailyMenu?.image || ''
        }
      });
    }
  }, [restaurant]);

  const handleInputChange = (pageType: 'menu' | 'dailyMenu', field: 'title' | 'description', value: string) => {
    setPreviewSettings(prev => ({
      ...prev,
      [pageType]: {
        ...prev[pageType],
        [field]: value
      }
    }));
  };

  const handleImageUpload = async (pageType: 'menu' | 'dailyMenu', file: File) => {
    if (!file || !user || !restaurant) return;

    const fieldKey = `${pageType}Image`;
    setUploading(prev => ({ ...prev, [fieldKey]: true }));

    try {
      const result = await uploadImage(
        file, 
        `restaurants/${restaurant.id}/social-preview`, 
        {
          restaurantId: restaurant.id,
          type: 'menu',
          originalName: file.name,
          description: `${pageType} social media preview image`
        }
      );
      
      setPreviewSettings(prev => ({
        ...prev,
        [pageType]: {
          ...prev[pageType],
          image: result.url
        }
      }));

      toast.success(`${pageType === 'menu' ? 'Menu' : 'Daily Menu'} preview image uploaded successfully!`);
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image. Please try again.');
    } finally {
      setUploading(prev => ({ ...prev, [fieldKey]: false }));
    }
  };

  const handleSave = async () => {
    if (!user || !restaurant) return;

    setSaving(true);
    try {
      const updates = {
        socialMediaPreview: previewSettings,
        updatedAt: new Date()
      };

      await updateDoc(doc(db, 'restaurants', restaurant.id), updates);
      onUpdate(updates);
      toast.success('Social media preview settings saved successfully!');
    } catch (error) {
      console.error('Error saving preview settings:', error);
      toast.error('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const generatePreview = (pageType: 'menu' | 'dailyMenu') => {
    const settings = previewSettings[pageType];
    const pageName = pageType === 'menu' ? 'Menu' : 'Daily Menu';
    
    return {
      title: settings?.title || `${restaurant?.name} - ${pageName}`,
      description: settings?.description || `Explore our ${pageName.toLowerCase()} at ${restaurant?.name}. Delicious dishes and fresh ingredients.`,
      image: settings?.image || restaurant?.logo || '/icons/icon-512x512.png'
    };
  };

  const renderPreviewSection = (pageType: 'menu' | 'dailyMenu') => {
    const pageName = pageType === 'menu' ? 'Menu' : 'Daily Menu';
    const settings = previewSettings[pageType];
    const preview = generatePreview(pageType);
    const fieldKey = `${pageType}Image`;

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {pageName} Preview Settings
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Settings Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preview Title
              </label>
              <input
                type="text"
                value={settings?.title || ''}
                onChange={(e) => handleInputChange(pageType, 'title', e.target.value)}
                placeholder={`${restaurant?.name} - ${pageName}`}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={60}
              />
              <p className="text-xs text-gray-500 mt-1">
                {settings?.title?.length || 0}/60 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preview Description
              </label>
              <textarea
                value={settings?.description || ''}
                onChange={(e) => handleInputChange(pageType, 'description', e.target.value)}
                placeholder={`Explore our ${pageName.toLowerCase()} at ${restaurant?.name}. Delicious dishes and fresh ingredients.`}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                maxLength={160}
              />
              <p className="text-xs text-gray-500 mt-1">
                {settings?.description?.length || 0}/160 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preview Image
              </label>
              <div className="flex items-center space-x-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(pageType, file);
                  }}
                  className="hidden"
                  id={`${pageType}-image-upload`}
                />
                <label
                  htmlFor={`${pageType}-image-upload`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition-colors"
                >
                  {uploading[fieldKey] ? 'Uploading...' : 'Upload Image'}
                </label>
                {settings?.image && (
                  <button
                    onClick={() => handleInputChange(pageType, 'image', '')}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Recommended size: 1200x630px for best results
              </p>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700">Preview</h4>
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="space-y-3">
                <div className="w-full h-32 bg-gray-200 rounded-md overflow-hidden">
                  {preview.image ? (
                    <img
                      src={preview.image}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      No image
                    </div>
                  )}
                </div>
                <div>
                  <h5 className="font-semibold text-gray-900 text-sm">
                    {preview.title}
                  </h5>
                  <p className="text-gray-600 text-xs mt-1">
                    {preview.description}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    {window.location.origin}/public-{pageType}/{restaurant?.id}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">
          Social Media Preview Settings
        </h2>
        <p className="text-blue-700 text-sm">
          Customize how your restaurant menu links appear when shared on social media platforms like Facebook, Twitter, and LinkedIn.
        </p>
      </div>

      {renderPreviewSection('menu')}
      {renderPreviewSection('dailyMenu')}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default SocialMediaPreviewSettings;
