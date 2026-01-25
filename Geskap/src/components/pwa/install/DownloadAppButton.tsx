import React, { useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { usePWA } from '../../../hooks/usePWA';
import { useAuth } from '../../../contexts/AuthContext';
import { usePWAContext } from '../../../contexts/PWAContext';
import { InstallModal } from './InstallModal';

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
  const { deferredPrompt, isIOS, clearDeferredPrompt } = usePWAContext();
  const [showInstallModal, setShowInstallModal] = useState(false);
  const { isInstalled } = usePWA();
  const { company } = useAuth();
  
  // Get dashboard colors
  const getDashboardColors = () => {
    const colors = {
      primary: company?.dashboardColors?.primary || company?.primaryColor || '#183524',
      secondary: company?.dashboardColors?.secondary || company?.secondaryColor || '#e2b069',
      tertiary: company?.dashboardColors?.tertiary || company?.tertiaryColor || '#2a4a3a'
    };
    return colors;
  };
  
  const colors = getDashboardColors();

  const handleDownload = async () => {
    // If deferredPrompt exists, trigger the native install prompt directly
    if (deferredPrompt) {
      try {
        console.log('[PWA] Triggering native install prompt from DownloadAppButton...');
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          console.log('[PWA] User accepted the install prompt');
          // The appinstalled event (handled in context) will handle the rest
        } else {
          console.log('[PWA] User dismissed the install prompt');
          clearDeferredPrompt();
        }
      } catch (error) {
        console.error('[PWA] Error during installation:', error);
        clearDeferredPrompt();
        // Fall back to modal only for iOS, otherwise just show modal
        setShowInstallModal(true);
      }
      return;
    }
    
    // No deferredPrompt available - show modal
    // For iOS, the modal will show manual instructions
    // For other browsers, the modal will also show instructions as fallback
    setShowInstallModal(true);
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
          <Download className={`h-${iconSize/4} w-${iconSize/4}`} style={{color: colors.primary}} />
          {showText && (
            <span className="text-sm font-medium hidden lg:block" style={{color: colors.primary}}>
              {deferredPrompt ? 'Installer Maintenant' : 'Installer App'}
            </span>
          )}
        </div>
      );
    }
    
    if (variant === 'sidebar') {
      return (
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg" style={{backgroundColor: `${colors.primary}20`}}>
            <Download className={`h-${iconSize/4} w-${iconSize/4}`} style={{color: colors.primary}} />
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
        return `${baseClasses} p-2 rounded-lg hover:bg-gray-50 focus:ring-offset-2 ${className}`;
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
        style={variant === 'header' ? {
          color: colors.primary,
          '--tw-ring-color': colors.primary
        } as React.CSSProperties : {}}
        title={deferredPrompt ? 'Installer l\'application maintenant' : 'Installer l\'application'}
      >
        {getButtonContent()}
      </button>
      
      {/* PWA Install Modal */}
      <InstallModal 
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />
    </>
  );
};

export default DownloadAppButton;

