import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Monitor } from 'lucide-react';
import { usePWAContext } from '../../../contexts/PWAContext';

export const InstallPrompt: React.FC = () => {
  const { deferredPrompt, isIOS, isStandalone, clearDeferredPrompt } = usePWAContext();
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    // Show prompt when deferredPrompt becomes available
    if (deferredPrompt) {
      setShowInstallPrompt(true);
    }

    // Check if user has previously dismissed the prompt
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      
      // Show prompt again after 1 day
      if (daysSinceDismissed > 1) {
        localStorage.removeItem('pwa-install-dismissed');
        if (deferredPrompt) {
          setShowInstallPrompt(true);
        }
      } else {
        setShowInstallPrompt(false);
      }
    } else if (deferredPrompt) {
      // Show prompt after a delay if not dismissed
      setTimeout(() => {
        setShowInstallPrompt(true);
      }, 3000);
    }
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    // If deferredPrompt exists, trigger the native install prompt directly
    if (deferredPrompt) {
      try {
        console.log('[PWA] Triggering native install prompt from InstallPrompt...');
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          console.log('[PWA] User accepted the install prompt');
        } else {
          console.log('[PWA] User dismissed the install prompt');
          clearDeferredPrompt();
        }
        
        setShowInstallPrompt(false);
      } catch (error) {
        console.error('[PWA] Error during installation:', error);
        clearDeferredPrompt();
        setShowInstallPrompt(false);
      }
      return;
    }
    
    // No deferredPrompt - shouldn't happen if prompt is showing, but handle gracefully
    console.log('[PWA] No deferred prompt available');
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (isStandalone) {
    return null;
  }

  if (!showInstallPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto">
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white border-0 shadow-lg rounded-lg">
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-white/20 rounded-lg">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Installer l'App</h3>
                <p className="text-red-100 text-sm">
                  Accès plus rapide à votre application
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/70 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {isIOS ? (
            <div className="space-y-3">
              <p className="text-red-100 text-sm">
                Pour installer cette app sur votre iPhone/iPad :
              </p>
              <ol className="text-red-100 text-sm space-y-1 list-decimal list-inside">
                <li>Appuyez sur le bouton Partager</li>
                <li>Faites défiler et sélectionnez "Ajouter à l'écran d'accueil"</li>
                <li>Appuyez sur "Ajouter"</li>
              </ol>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center space-x-4 text-red-100 text-sm">
                <div className="flex items-center space-x-1">
                  <Smartphone className="h-4 w-4" />
                  <span>Mobile</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Monitor className="h-4 w-4" />
                  <span>Desktop</span>
                </div>
              </div>
              <p className="text-red-100 text-sm">
                Installez l'app pour une expérience optimale
              </p>
              <button
                onClick={handleInstallClick}
                className="w-full bg-white text-red-600 hover:bg-red-50 font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Installer Maintenant</span>
              </button>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-red-500/30">
            <p className="text-red-200 text-xs">
              ✓ Fonctionne hors ligne • ✓ Notifications • ✓ Accès rapide
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export with old name for backward compatibility
export const PWAInstallPrompt = InstallPrompt;
