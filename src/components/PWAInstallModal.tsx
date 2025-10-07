import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Monitor, AlertCircle, CheckCircle } from 'lucide-react';
import { PWAInstallGuide } from './PWAInstallGuide';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [pwaStatus, setPwaStatus] = useState({
    hasServiceWorker: false,
    hasManifest: false,
    isHTTPS: false,
    isInstallable: false,
    errors: [] as string[]
  });

  // Device detection
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isChrome = /Chrome/.test(navigator.userAgent);
  const isEdge = /Edg/.test(navigator.userAgent);
  const isFirefox = /Firefox/.test(navigator.userAgent);
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

  useEffect(() => {
    if (!isOpen) return;

    // Check PWA requirements
    const checkPWARequirements = () => {
      const status = {
        hasServiceWorker: 'serviceWorker' in navigator,
        hasManifest: !!document.querySelector('link[rel="manifest"]'),
        isHTTPS: location.protocol === 'https:' || location.hostname === 'localhost',
        isInstallable: false,
        errors: [] as string[]
      };

      // Check service worker registration
      if (status.hasServiceWorker) {
        navigator.serviceWorker.getRegistration()
          .then(registration => {
            if (!registration) {
              status.errors.push('Service worker not registered');
            }
          })
          .catch(error => {
            status.errors.push(`Service worker error: ${error.message}`);
          });
      } else {
        status.errors.push('Service worker not supported');
      }

      // Check manifest
      if (status.hasManifest) {
        const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
        if (manifestLink) {
          fetch(manifestLink.href)
            .then(response => {
              if (!response.ok) {
                status.errors.push('Manifest file not found');
              }
              return response.json();
            })
            .then(manifest => {
              if (!manifest.icons || manifest.icons.length === 0) {
                status.errors.push('No icons in manifest');
              }
            })
            .catch(error => {
              status.errors.push(`Manifest error: ${error.message}`);
            });
        }
      } else {
        status.errors.push('Manifest not found');
      }

      // Check HTTPS
      if (!status.isHTTPS) {
        status.errors.push('HTTPS required for PWA');
      }

      // Determine if installable
      status.isInstallable = status.hasServiceWorker && status.hasManifest && status.isHTTPS && status.errors.length === 0;

      setPwaStatus(status);
    };

    checkPWARequirements();

    // Check if app is already installed
    const checkIfInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return;
      }
      
      // Check for iOS Safari
      if ((window.navigator as { standalone?: boolean }).standalone === true) {
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
    };

    // Listen for the appinstalled event
    const handleAppInstalled = () => {
      console.log('App installed successfully!');
      setIsInstalled(true);
      onClose();
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isOpen, onClose]);

  const handleInstallClick = async () => {
    // For Android users with Chrome/Edge, try automatic installation first
    if (isAndroid && (isChrome || isEdge) && deferredPrompt) {
      try {
        console.log('Triggering automatic install prompt for Android...');
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          console.log('User accepted the install prompt');
          setDeferredPrompt(null);
          onClose();
          return;
        } else {
          console.log('User dismissed the install prompt');
          // Show manual instructions for Android
          setShowInstallGuide(true);
          return;
        }
      } catch (error) {
        console.error('Error during automatic installation:', error);
        // Fall back to manual instructions
        setShowInstallGuide(true);
        return;
      }
    }

    // For other cases, show manual installation guide
    console.log('Showing manual installation guide');
    setShowInstallGuide(true);
  };

  const handleDismiss = () => {
    onClose();
  };

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  if (!isOpen || isInstalled || isStandalone) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
        <div className="bg-white w-full max-w-md mx-auto rounded-t-lg">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white border-0 shadow-lg rounded-t-lg">
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Download className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Installer l'App</h3>
                    <p className="text-emerald-100 text-sm">
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

              {/* PWA Status */}
              <div className="mb-3 p-2 bg-white/10 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-emerald-100 text-sm font-medium">État PWA:</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-xs">
                    {pwaStatus.hasServiceWorker ? (
                      <CheckCircle className="h-3 w-3 text-green-300" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-red-300" />
                    )}
                    <span className="text-emerald-100">Service Worker</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs">
                    {pwaStatus.hasManifest ? (
                      <CheckCircle className="h-3 w-3 text-green-300" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-red-300" />
                    )}
                    <span className="text-emerald-100">Manifest</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs">
                    {pwaStatus.isHTTPS ? (
                      <CheckCircle className="h-3 w-3 text-green-300" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-red-300" />
                    )}
                    <span className="text-emerald-100">HTTPS</span>
                  </div>
                </div>
                {pwaStatus.errors.length > 0 && (
                  <div className="mt-2 text-xs text-emerald-200">
                    <div className="font-medium">Problèmes détectés:</div>
                    {pwaStatus.errors.map((error, index) => (
                      <div key={index}>• {error}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Device-specific installation instructions */}
              {isIOS ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-emerald-100 text-sm">
                    <Smartphone className="h-4 w-4" />
                    <span className="font-medium">iPhone/iPad (Safari)</span>
                  </div>
                  <p className="text-emerald-100 text-sm">
                    Pour installer cette app sur votre iPhone/iPad :
                  </p>
                  <ol className="text-emerald-100 text-sm space-y-1 list-decimal list-inside">
                    <li>Appuyez sur le bouton Partager <span className="text-emerald-200">(📤)</span></li>
                    <li>Faites défiler et sélectionnez "Ajouter à l'écran d'accueil"</li>
                    <li>Appuyez sur "Ajouter"</li>
                  </ol>
                  <div className="mt-3 p-2 bg-white/10 rounded-lg">
                    <p className="text-emerald-200 text-xs">
                      💡 L'app apparaîtra sur votre écran d'accueil comme une vraie app !
                    </p>
                  </div>
                </div>
              ) : isAndroid ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-emerald-100 text-sm">
                    <Smartphone className="h-4 w-4" />
                    <span className="font-medium">Android ({isChrome ? 'Chrome' : isEdge ? 'Edge' : 'Navigateur'})</span>
                  </div>
                  {deferredPrompt ? (
                    <div className="space-y-3">
                      <p className="text-emerald-100 text-sm">
                        🚀 Installation automatique disponible !
                      </p>
                      <button
                        onClick={handleInstallClick}
                        className="w-full bg-white text-emerald-600 hover:bg-emerald-50 font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
                      >
                        <Download className="h-4 w-4" />
                        <span>Installer Maintenant</span>
                      </button>
                      <p className="text-emerald-200 text-xs text-center">
                        Ou suivez les instructions manuelles ci-dessous
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-emerald-100 text-sm">
                        Pour installer cette app sur votre Android :
                      </p>
                      <ol className="text-emerald-100 text-sm space-y-1 list-decimal list-inside">
                        <li>Appuyez sur le menu <span className="text-emerald-200">(⋮)</span> en haut à droite</li>
                        <li>Sélectionnez "Installer l'application" ou "Ajouter à l'écran d'accueil"</li>
                        <li>Confirmez l'installation</li>
                      </ol>
                    </div>
                  )}
                  <div className="mt-3 p-2 bg-white/10 rounded-lg">
                    <p className="text-emerald-200 text-xs">
                      💡 L'app sera installée comme une vraie application Android !
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-emerald-100 text-sm">
                    <Monitor className="h-4 w-4" />
                    <span className="font-medium">Desktop ({isChrome ? 'Chrome' : isEdge ? 'Edge' : isFirefox ? 'Firefox' : isSafari ? 'Safari' : 'Navigateur'})</span>
                  </div>
                  {deferredPrompt ? (
                    <div className="space-y-3">
                      <p className="text-emerald-100 text-sm">
                        🚀 Installation automatique disponible !
                      </p>
                      <button
                        onClick={handleInstallClick}
                        className="w-full bg-white text-emerald-600 hover:bg-emerald-50 font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
                      >
                        <Download className="h-4 w-4" />
                        <span>Installer Maintenant</span>
                      </button>
                      <p className="text-emerald-200 text-xs text-center">
                        Ou suivez les instructions manuelles ci-dessous
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-emerald-100 text-sm">
                        Pour installer cette app sur votre ordinateur :
                      </p>
                      <ol className="text-emerald-100 text-sm space-y-1 list-decimal list-inside">
                        <li>Cherchez l'icône d'installation <span className="text-emerald-200">(📱 ou ⬇️)</span> dans la barre d'adresse</li>
                        <li>Ou utilisez le menu : <span className="text-emerald-200">Menu (⋮) → "Installer Le Bon Prix"</span></li>
                        <li>Confirmez l'installation</li>
                      </ol>
                    </div>
                  )}
                  <div className="mt-3 p-2 bg-white/10 rounded-lg">
                    <p className="text-emerald-200 text-xs">
                      💡 L'app s'ouvrira dans une fenêtre séparée comme une vraie application !
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-emerald-500/30">
                <p className="text-emerald-200 text-xs">
                  ✓ Fonctionne hors ligne • ✓ Notifications • ✓ Accès rapide
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Installation Guide Modal */}
      <PWAInstallGuide 
        isOpen={showInstallGuide} 
        onClose={() => setShowInstallGuide(false)} 
      />
    </>
  );
};
