import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Monitor, AlertCircle, CheckCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { InstallGuide } from './InstallGuide';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const EnhancedInstallPrompt: React.FC = () => {
  const location = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [pwaStatus, setPwaStatus] = useState({
    hasServiceWorker: false,
    hasManifest: false,
    isHTTPS: false,
    isInstallable: false,
    errors: [] as string[]
  });

  // Only show on login page
  const isLoginPage = location.pathname === '/auth/login';

  useEffect(() => {
    // Check PWA requirements
    const checkPWARequirements = () => {
      const status = {
        hasServiceWorker: 'serviceWorker' in navigator,
        hasManifest: !!document.querySelector('link[rel="manifest"]'),
        isHTTPS: window.location.protocol === 'https:' || window.location.hostname === 'localhost',
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
      console.log('App installed successfully!');
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

    // Show prompt if installable and on login page
    if (pwaStatus.isInstallable && !isInstalled && isLoginPage) {
      console.log('PWA is installable, showing prompt in 3 seconds...');
      setTimeout(() => {
        setShowInstallPrompt(true);
      }, 3000);
    } else {
      console.log('PWA not installable or not on login page:', pwaStatus);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [pwaStatus.isInstallable, isInstalled, isLoginPage]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      console.log('No deferred prompt available');
      console.log('PWA Status:', pwaStatus);
      
      // Try to trigger the beforeinstallprompt event manually
      const event = new Event('beforeinstallprompt');
      window.dispatchEvent(event);
      
      // Wait a moment for the event to be processed
      setTimeout(() => {
        if (!deferredPrompt && pwaStatus.isInstallable) {
          // If still no prompt, try browser-specific installation
          const userAgent = navigator.userAgent;
          if (/Chrome/.test(userAgent) || /Edg/.test(userAgent)) {
            // For Chrome/Edge, try to open the install dialog
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistration().then(registration => {
                if (registration) {
                  // Try to trigger install via service worker
                  console.log('Attempting to trigger install via service worker...');
                }
              });
            }
          }
          
          // Show helpful installation guide
          setShowInstallGuide(true);
        } else if (!pwaStatus.isInstallable) {
          alert('App is not installable. Issues found:\n\n' + pwaStatus.errors.join('\n'));
        }
      }, 100);
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
      alert('Installation failed. Please try using your browser\'s menu to install the app.');
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  if (isInstalled || isStandalone || !isLoginPage) {
    return null;
  }

  if (!showInstallPrompt) {
    return null;
  }

  return (
    <>
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

            {/* PWA Status */}
            <div className="mb-3 p-2 bg-white/10 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-red-100 text-sm font-medium">État PWA:</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-xs">
                  {pwaStatus.hasServiceWorker ? (
                    <CheckCircle className="h-3 w-3 text-green-300" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-red-300" />
                  )}
                  <span className="text-red-100">Service Worker</span>
                </div>
                <div className="flex items-center space-x-2 text-xs">
                  {pwaStatus.hasManifest ? (
                    <CheckCircle className="h-3 w-3 text-green-300" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-red-300" />
                  )}
                  <span className="text-red-100">Manifest</span>
                </div>
                <div className="flex items-center space-x-2 text-xs">
                  {pwaStatus.isHTTPS ? (
                    <CheckCircle className="h-3 w-3 text-green-300" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-red-300" />
                  )}
                  <span className="text-red-100">HTTPS</span>
                </div>
              </div>
              {pwaStatus.errors.length > 0 && (
                <div className="mt-2 text-xs text-red-200">
                  <div className="font-medium">Problèmes détectés:</div>
                  {pwaStatus.errors.map((error, index) => (
                    <div key={index}>• {error}</div>
                  ))}
                </div>
              )}
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

      {/* Installation Guide Modal */}
      <InstallGuide 
        isOpen={showInstallGuide} 
        onClose={() => setShowInstallGuide(false)} 
      />
    </>
  );
};

// Export with old name for backward compatibility
export const EnhancedPWAInstallPrompt = EnhancedInstallPrompt;

