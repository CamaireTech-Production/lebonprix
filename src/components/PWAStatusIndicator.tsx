import React from 'react';
import { usePWA } from '../hooks/usePWA';
import { WifiOff, Smartphone, Wifi } from 'lucide-react';

interface PWAStatusIndicatorProps {
  variant?: 'header' | 'floating';
}

export const PWAStatusIndicator: React.FC<PWAStatusIndicatorProps> = ({ variant = 'floating' }) => {
  const { isInstalled, isOnline } = usePWA();

  // Header variant - compact status indicator
  if (variant === 'header') {
    if (!isOnline) {
      return (
        <div className="flex items-center space-x-1 text-red-500" title="Hors ligne">
          <WifiOff className="h-4 w-4" />
        </div>
      );
    }

    if (isInstalled) {
      return (
        <div className="flex items-center space-x-1 text-green-500" title="App installée">
          <Smartphone className="h-4 w-4" />
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-1 text-gray-400" title="En ligne">
        <Wifi className="h-4 w-4" />
      </div>
    );
  }

  // Floating variant - full status indicators (for backward compatibility)
  if (!isOnline) {
    return (
      <div className="fixed top-4 right-4 z-40">
        <div className="bg-red-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">Hors ligne</span>
        </div>
      </div>
    );
  }

  if (isInstalled) {
    return (
      <div className="fixed top-4 right-4 z-40">
        <div className="bg-green-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <Smartphone className="h-4 w-4" />
          <span className="text-sm font-medium">App installée</span>
        </div>
      </div>
    );
  }

  return null;
};
