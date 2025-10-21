/**
 * Save Status Indicator Component
 * Shows real-time save status for checkout form
 */

import React from 'react';
import { Check, Loader2, AlertCircle, Clock } from 'lucide-react';

export interface SaveStatusIndicatorProps {
  isSaving: boolean;
  lastSaved: string | null;
  hasUnsavedChanges: boolean;
  isDataFresh: boolean;
  dataAge: number;
  className?: string;
}

export const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({
  isSaving,
  lastSaved,
  hasUnsavedChanges,
  isDataFresh,
  dataAge,
  className = ''
}) => {
  // Determine status
  const getStatus = () => {
    if (isSaving) return 'saving';
    if (hasUnsavedChanges) return 'unsaved';
    if (!lastSaved) return 'never-saved';
    if (!isDataFresh) return 'stale';
    return 'saved';
  };

  const status = getStatus();

  // Format last saved time
  const formatLastSaved = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  // Format data age
  const formatDataAge = (age: number) => {
    const minutes = Math.floor(age / (1000 * 60));
    const hours = Math.floor(age / (1000 * 60 * 60));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Status configurations
  const statusConfig = {
    saving: {
      icon: Loader2,
      text: 'Saving...',
      className: 'text-blue-600',
      iconClassName: 'animate-spin'
    },
    unsaved: {
      icon: Clock,
      text: 'Unsaved changes',
      className: 'text-yellow-600',
      iconClassName: ''
    },
    'never-saved': {
      icon: Clock,
      text: 'Not saved',
      className: 'text-gray-500',
      iconClassName: ''
    },
    stale: {
      icon: AlertCircle,
      text: 'Data may be outdated',
      className: 'text-orange-600',
      iconClassName: ''
    },
    saved: {
      icon: Check,
      text: lastSaved ? `Saved ${formatLastSaved(lastSaved)}` : 'Saved',
      className: 'text-green-600',
      iconClassName: ''
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`flex items-center space-x-2 text-sm ${className}`}>
      <Icon className={`h-4 w-4 ${config.iconClassName} ${config.className}`} />
      <span className={config.className}>
        {config.text}
      </span>
      
      {/* Additional info for saved status */}
      {status === 'saved' && lastSaved && (
        <span className="text-xs text-gray-500">
          ({formatDataAge(dataAge)})
        </span>
      )}
      
      {/* Tooltip for stale data */}
      {status === 'stale' && (
        <div className="group relative">
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Data is {formatDataAge(dataAge)} old
          </div>
        </div>
      )}
    </div>
  );
};

export default SaveStatusIndicator;
