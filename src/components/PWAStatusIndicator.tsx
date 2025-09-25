import React from 'react';
import { usePWA } from '../hooks/usePWA';
import { WifiOff, Smartphone } from 'lucide-react';

export const PWAStatusIndicator: React.FC = () => {
  const { isInstalled, isOnline } = usePWA();

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
