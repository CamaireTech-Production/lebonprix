import React from 'react';
import { Wifi, WifiOff, Sync, AlertCircle, CheckCircle, X } from 'lucide-react';
import { useOfflineStatus } from '../../hooks/useOfflineSync';

interface OfflineStatusBannerProps {
  className?: string;
}

const OfflineStatusBanner: React.FC<OfflineStatusBannerProps> = ({ className = '' }) => {
  const {
    isOnline,
    isSyncing,
    pendingOperations,
    failedOperations,
    lastSync,
    showBanner,
    dismissBanner
  } = useOfflineStatus();

  if (!showBanner) {
    return null;
  }

  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="w-4 h-4" />;
    if (isSyncing) return <Sync className="w-4 h-4 animate-spin" />;
    if (failedOperations > 0) return <AlertCircle className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'You are offline. Changes will sync when you reconnect.';
    if (isSyncing) return 'Syncing your changes...';
    if (failedOperations > 0) return `${failedOperations} operations failed to sync.`;
    if (pendingOperations > 0) return `${pendingOperations} changes pending sync.`;
    return `Last synced ${formatLastSync(lastSync)}.`;
  };

  const getStatusColor = () => {
    if (!isOnline) return 'bg-yellow-500';
    if (isSyncing) return 'bg-blue-500';
    if (failedOperations > 0) return 'bg-red-500';
    if (pendingOperations > 0) return 'bg-orange-500';
    return 'bg-green-500';
  };

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${className}`}>
      <div className={`${getStatusColor()} text-white px-4 py-2 shadow-lg`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="text-sm font-medium">
              {getStatusText()}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            {isOnline && pendingOperations > 0 && (
              <div className="flex items-center space-x-1 text-xs">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span>{pendingOperations} pending</span>
              </div>
            )}
            
            <button
              onClick={dismissBanner}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineStatusBanner;

