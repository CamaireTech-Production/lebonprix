import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Monitor, ExternalLink } from 'lucide-react';
import { getDeviceInfo, getDownloadLinks } from '../../utils/deviceDetection';
import { usePWA } from '../../hooks/usePWA';
import { PWAInstallModal } from '../PWAInstallModal';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface DownloadAppButtonProps {
  variant?: 'header' | 'sidebar' | 'compact';
  showText?: boolean;
  className?: string;
}

export const DownloadAppButton: React.FC<DownloadAppButtonProps> = ({
  variant = 'header',
  showText = true,
  className = ''
}) => {
  const [deviceInfo, setDeviceInfo] = useState(getDeviceInfo());
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const { isInstalled, isInstallable } = usePWA();

  useEffect(() => {
    // Listen for the beforeinstallprompt event to get the deferred prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleDownload = async () => {
    // Try automatic installation first
    if (deferredPrompt) {
      try {
        console.log('Triggering automatic install prompt...');
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          console.log('User accepted the install prompt');
          // The appinstalled event will handle hiding the button
        } else {
          console.log('User dismissed the install prompt');
        }
        
        setDeferredPrompt(null);
        return;
      } catch (error) {
        console.error('Error during automatic installation:', error);
        // Fall back to showing the modal
        setShowInstallModal(true);
      }
    } else {
      // No automatic prompt available, show the detailed modal
      setShowInstallModal(true);
    }
  };


  // Don't show if already installed
  if (isInstalled) {
    return null;
  }

  const getButtonContent = () => {
    const isCompact = variant === 'compact';
    const iconSize = isCompact ? 16 : 20;
    
    if (variant === 'header') {
      return (
        <div className="flex items-center space-x-2">
          <Download className={`h-${iconSize/4} w-${iconSize/4} text-emerald-600`} />
          {showText && (
            <span className="text-sm font-medium text-emerald-600 hidden lg:block">
              {deferredPrompt ? 'Installer Maintenant' : 'Installer App'}
            </span>
          )}
        </div>
      );
    }
    
    if (variant === 'sidebar') {
      return (
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Download className={`h-${iconSize/4} w-${iconSize/4} text-emerald-600`} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">
              {deferredPrompt ? 'Installer l\'App' : 'Installer l\'App'}
            </p>
            <p className="text-xs text-gray-500">
              {deferredPrompt 
                ? '🚀 Installation automatique disponible !' 
                : 'Accès rapide depuis votre écran d\'accueil'
              }
            </p>
          </div>
          <ExternalLink className="h-4 w-4 text-gray-400" />
        </div>
      );
    }
    
    // Compact variant
    return (
      <div className="flex items-center space-x-2">
        <Download className={`h-${iconSize/4} w-${iconSize/4}`} />
        {showText && <span className="text-sm">App</span>}
      </div>
    );
  };

  const getButtonClasses = () => {
    const baseClasses = "transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
    
    switch (variant) {
      case 'header':
        return `${baseClasses} p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 focus:ring-emerald-500 ${className}`;
      case 'sidebar':
        return `${baseClasses} w-full px-3 py-2 text-left rounded-md hover:bg-gray-50 ${className}`;
      case 'compact':
        return `${baseClasses} p-1 rounded text-gray-600 hover:text-gray-800 hover:bg-gray-100 ${className}`;
      default:
        return baseClasses;
    }
  };

  return (
    <>
      <button
        onClick={handleDownload}
        className={getButtonClasses()}
        title={deferredPrompt ? 'Installer l\'application maintenant' : 'Installer l\'application'}
      >
        {getButtonContent()}
      </button>
      
      {/* PWA Install Modal */}
      <PWAInstallModal 
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />
    </>
  );
};

export default DownloadAppButton;
