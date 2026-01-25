import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Info, Trash2 } from 'lucide-react';
import { checkForUpdates, getUpdateNotificationMessage, getUpdatePriority, updateStoredVersion } from '../../utils/versionManager';
import { clearCacheForUpdate, getCacheStats } from '../../utils/cacheManager';
import { APP_VERSION } from '../../config/version';

interface VersionUpdateNotificationProps {
  className?: string;
}

const VersionUpdateNotification: React.FC<VersionUpdateNotificationProps> = ({ className = '' }) => {
  const [update, setUpdate] = useState(checkForUpdates());
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [cacheStats] = useState(getCacheStats());
  const location = useLocation();

  useEffect(() => {
    // Check if we're on a login page
    const isLoginPage = location.pathname === '/login' || location.pathname === '/admin/login';
    
    // Show notification if there's an update, it hasn't been dismissed, and we're on a login page
    if (update.hasUpdate && !isDismissed && isLoginPage) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [update.hasUpdate, isDismissed, location.pathname]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    // Store dismissal in localStorage
    try {
      localStorage.setItem('version_update_dismissed', APP_VERSION.version);
    } catch (error) {
      console.warn('Failed to store version dismissal:', error);
    }
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      // Clear cache while preserving menu data
      await clearCacheForUpdate();
      updateStoredVersion();
      setUpdate(checkForUpdates());
      setIsVisible(false);
    } catch (error) {
      console.error('Failed to update:', error);
      // Fallback to simple reload
      window.location.reload();
    } finally {
      setIsUpdating(false);
    }
  };

  const getPriorityStyles = () => {
    const priority = getUpdatePriority(update);
    switch (priority) {
      case 'high':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'low':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  if (!isVisible || !update.hasUpdate) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-sm ${className}`}>
      <div className={`rounded-lg border p-4 shadow-lg ${getPriorityStyles()}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <Info size={20} className="mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-sm">
                {getUpdateNotificationMessage(update)}
              </h4>
              <p className="text-xs mt-1 opacity-90">
                New features and improvements available
              </p>
              <div className="mt-2 text-xs opacity-75">
                <p>Cache: {(cacheStats.localStorage / 1024).toFixed(1)}KB • Menu data preserved</p>
              </div>
              {update.releaseNotes.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium mb-1">What's new:</p>
                  <ul className="text-xs space-y-1">
                    {update.releaseNotes.slice(0, 3).map((note, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-current mr-1">•</span>
                        {note}
                      </li>
                    ))}
                    {update.releaseNotes.length > 3 && (
                      <li className="text-xs opacity-75">
                        +{update.releaseNotes.length - 3} more improvements
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-current hover:opacity-70 transition-opacity ml-2"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex items-center justify-end space-x-2 mt-3">
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium rounded-md bg-current text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                <span>Updating...</span>
              </>
            ) : (
              <>
                <Trash2 size={14} />
                <span>Update & Clear Cache</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VersionUpdateNotification; 