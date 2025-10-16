import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Monitor } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const LoginPWAInstallButton: React.FC = () => {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

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

    // Check if PWA is installable
    const checkInstallability = () => {
      const hasServiceWorker = 'serviceWorker' in navigator;
      const hasManifest = !!document.querySelector('link[rel="manifest"]');
      const isHTTPS = location.protocol === 'https:' || location.hostname === 'localhost';
      
      setIsInstallable(hasServiceWorker && hasManifest && isHTTPS);
    };

    checkIfInstalled();
    checkInstallability();

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // Listen for the appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
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
        // Fall back to manual guide
      }
    }
    
    // Try to force the beforeinstallprompt event
    console.log('Attempting to force install prompt...');
    
    // Check if we can trigger the install prompt manually
    if ('serviceWorker' in navigator) {
      try {
        // Get existing service worker registration
        const registration = await navigator.serviceWorker.getRegistration();
        console.log('Service worker found:', registration);
        
        // Wait a moment for the event to fire
        setTimeout(() => {
          if (deferredPrompt) {
            console.log('Found deferred prompt');
            deferredPrompt.prompt().then(() => {
              return deferredPrompt.userChoice;
            }).then((choiceResult) => {
              if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
              } else {
                console.log('User dismissed the install prompt');
              }
              setDeferredPrompt(null);
            });
          } else {
            console.log('No deferred prompt available, showing manual guide');
            setShowInstallGuide(true);
          }
        }, 1000);
      } catch (error) {
        console.error('Service worker error:', error);
        setShowInstallGuide(true);
      }
    } else {
      setShowInstallGuide(true);
    }
  };

  // Don't show if already installed
  if (isInstalled) {
    return null;
  }

  return (
    <>
      {/* Install Button */}
      <div className="mt-6 p-4 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-600 rounded-lg">
              <Download className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Installer l'App</h3>
              <p className="text-sm text-gray-600">
                {deferredPrompt 
                  ? '🚀 Installation automatique disponible !' 
                  : 'Accès rapide depuis votre écran d\'accueil'
                }
              </p>
            </div>
          </div>
          <button
            onClick={handleInstallClick}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>{deferredPrompt ? 'Installer Maintenant' : 'Installer'}</span>
          </button>
        </div>
        
        <div className="mt-3 flex items-center space-x-4 text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <Smartphone className="h-3 w-3" />
            <span>Mobile</span>
          </div>
          <div className="flex items-center space-x-1">
            <Monitor className="h-3 w-3" />
            <span>Desktop</span>
          </div>
        </div>
      </div>

      {/* Install Guide Modal */}
      {showInstallGuide && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                  <Download className="h-5 w-5 text-red-600" />
                  <span>Installer l'App</span>
                </h2>
                <button
                  onClick={() => setShowInstallGuide(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-gray-600 text-sm text-center">
                  🎉 <strong>Votre app Le Bon Prix est prête !</strong>
                </p>

                {/* Primary Method - Address Bar */}
                <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-300">
                  <h3 className="font-bold text-blue-800 mb-3 text-center">
                    📱 Méthode recommandée
                  </h3>
                  <div className="text-center">
                    <p className="text-blue-700 text-sm mb-2">
                      <strong>Regardez dans la barre d'adresse de votre navigateur</strong>
                    </p>
                    <p className="text-blue-600 text-xs mb-3">
                      Cherchez une icône d'installation (📱 ou ⬇️) et cliquez dessus
                    </p>
                    <div className="bg-blue-100 p-2 rounded text-xs text-blue-800">
                      💡 Cette icône apparaît automatiquement quand l'app est installable
                    </div>
                  </div>
                </div>

                {/* Alternative Methods */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h3 className="font-medium text-gray-800 mb-2 text-sm">Autres méthodes :</h3>
                  <div className="text-gray-600 text-xs space-y-1">
                    <p>• <strong>Chrome/Edge:</strong> Menu (⋮) → "Installer Le Bon Prix"</p>
                    <p>• <strong>Firefox:</strong> Menu (⋮) → "Installer"</p>
                    <p>• <strong>Safari:</strong> Partager → "Ajouter à l'écran d'accueil"</p>
                  </div>
                </div>

                {/* Benefits */}
                <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                  <h3 className="font-medium text-red-800 mb-2 text-sm">🎯 Avantages :</h3>
                  <div className="text-red-700 text-xs space-y-1">
                    <p>✓ Accès rapide depuis l'écran d'accueil</p>
                    <p>✓ Fonctionne hors ligne</p>
                    <p>✓ Notifications push</p>
                    <p>✓ Expérience native</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowInstallGuide(false)}
                  className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  Compris
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
