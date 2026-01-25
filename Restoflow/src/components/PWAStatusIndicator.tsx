import React from 'react';
import { useLocation } from 'react-router-dom';
import { usePWA } from '../hooks/usePWA';
import { Wifi, WifiOff, Download, CheckCircle, Smartphone } from 'lucide-react';

export const PWAStatusIndicator: React.FC = () => {
  const { isInstalled, isOnline, isUpdateAvailable } = usePWA();
  const location = useLocation();

  if (!isOnline) {
    return (
      <div className="fixed top-4 right-4 z-40">
        <div className="bg-red-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">Offline</span>
        </div>
      </div>
    );
  }

  // Check if we're on a login page
  const isLoginPage = location.pathname === '/login' || location.pathname === '/admin/login';
  
  if (isUpdateAvailable && isLoginPage) {
    return (
      <div className="fixed top-4 right-4 z-40">
        <div className="bg-orange-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <Download className="h-4 w-4" />
          <span className="text-sm font-medium">Update available</span>
        </div>
      </div>
    );
  }

  if (isInstalled) {
    return (
      <div className="fixed top-4 right-4 z-40">
        <div className="bg-green-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <Smartphone className="h-4 w-4" />
          <span className="text-sm font-medium">App installed</span>
        </div>
      </div>
    );
  }

  return null;
};
