import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Monitor } from 'lucide-react';
import { InstallGuide } from './InstallGuide';
import { usePWAContext } from '../../../contexts/PWAContext';

export const InstallButton: React.FC = () => {
  const { deferredPrompt, isIOS, isStandalone, clearDeferredPrompt } = usePWAContext();
  const [isInstallable, setIsInstallable] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  useEffect(() => {
    // Check if PWA is installable (has service worker, manifest, and HTTPS)
    const checkInstallability = () => {
      const hasServiceWorker = 'serviceWorker' in navigator;
      const hasManifest = !!document.querySelector('link[rel="manifest"]');
      const isHTTPS = location.protocol === 'https:' || location.hostname === 'localhost';
      
      setIsInstallable(hasServiceWorker && hasManifest && isHTTPS);
    };

    checkInstallability();
    
    // Update installability when deferredPrompt becomes available
    if (deferredPrompt) {
      setIsInstallable(true);
    }
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    // If deferredPrompt exists, trigger the native install prompt directly
    if (deferredPrompt) {
      try {
        console.log('[PWA] Triggering native install prompt...');
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          console.log('[PWA] User accepted the install prompt');
          // The appinstalled event (handled in context) will clear the prompt
        } else {
          console.log('[PWA] User dismissed the install prompt');
          // Clear the prompt so we don't keep trying
          clearDeferredPrompt();
        }
      } catch (error) {
        console.error('[PWA] Error during installation:', error);
        clearDeferredPrompt();
        // Fall back to manual guide only for iOS
        if (isIOS) {
          setShowInstallGuide(true);
        }
      }
      return;
    }
    
    // No deferredPrompt available
    // For iOS Safari, show manual guide (beforeinstallprompt not supported)
    if (isIOS) {
      setShowInstallGuide(true);
      return;
    }
    
    // For other browsers, if no prompt is available, it might not be installable yet
    // or the user already dismissed it. Show manual guide as fallback.
    console.log('[PWA] No deferred prompt available, showing manual guide');
    setShowInstallGuide(true);
  };

  // Don't show if already installed
  if (isStandalone) {
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
                  🎉 <strong>Votre app Geskap est prête !</strong>
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
                    <p>• <strong>Chrome/Edge:</strong> Menu (⋮) → "Installer Geskap"</p>
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

// Export with old name for backward compatibility
export const LoginPWAInstallButton = InstallButton;

