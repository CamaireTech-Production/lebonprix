import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Monitor } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const checkIfInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return;
      }
      
      // Check for iOS Safari
      if ((window.navigator as any).standalone === true) {
        setIsInstalled(true);
        return;
      }
    };

    checkIfInstalled();

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('beforeinstallprompt event fired!');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    // Listen for the appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if user has previously dismissed the prompt
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      
      // Show prompt again after 1 day
      if (daysSinceDismissed > 1) {
        localStorage.removeItem('pwa-install-dismissed');
      } else {
        setShowInstallPrompt(false);
      }
    }

    // If no deferred prompt but app is installable, show prompt after a delay
    if (!deferredPrompt && !isInstalled) {
      setTimeout(() => {
        // Check if the app meets PWA criteria
        const hasManifest = document.querySelector('link[rel="manifest"]');
        const hasServiceWorker = 'serviceWorker' in navigator;
        
        if (hasManifest && hasServiceWorker) {
          setShowInstallPrompt(true);
        }
      }, 3000); // Show after 3 seconds
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      console.log('No deferred prompt available');
      // Try to trigger install manually for debugging
      console.log('PWA Installability check:');
      console.log('- Service Worker:', 'serviceWorker' in navigator);
      console.log('- Manifest:', !!document.querySelector('link[rel="manifest"]'));
      console.log('- HTTPS:', location.protocol === 'https:' || location.hostname === 'localhost');
      return;
    }

    try {
      console.log('Triggering install prompt...');
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    } catch (error) {
      console.error('Error during installation:', error);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  if (isInstalled || isStandalone) {
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
