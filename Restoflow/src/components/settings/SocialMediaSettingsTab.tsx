import React from 'react';
import { Share2 } from 'lucide-react';
import { Restaurant } from '../../types';
import SocialMediaPreviewSettings from './SocialMediaPreviewSettings';

interface SocialMediaSettingsTabProps {
  restaurant: Restaurant | null;
  onUpdate: (data: Record<string, unknown>) => Promise<void>;
}

const SocialMediaSettingsTab: React.FC<SocialMediaSettingsTabProps> = ({ restaurant, onUpdate }) => {
  return (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <Share2 className="h-5 w-5 text-green-600 mr-2" />
          <h3 className="text-sm font-medium text-green-800">
            Social Media Preview Settings
          </h3>
        </div>
        <p className="mt-1 text-sm text-green-700">
          Configure how your restaurant appears when shared on social media platforms.
        </p>
      </div>

      <SocialMediaPreviewSettings 
        restaurant={restaurant}
        onUpdate={onUpdate}
      />
    </div>
  );
};

export default SocialMediaSettingsTab;
