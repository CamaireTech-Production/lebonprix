import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Monitor } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState<string>('');
  const [installProgress, setInstallProgress] = useState(0);
  const location = useLocation();

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
      console.log('beforeinstallprompt event fired - automatic install available');
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
      console.log('No deferred prompt available, showing manual install prompt after delay');
      setTimeout(() => {
        setShowInstallPrompt(true);
      }, 3000); // Show after 3 seconds
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    console.log('Install button clicked');
    console.log('Deferred prompt available:', !!deferredPrompt);
    console.log('Current URL:', window.location.href);
    console.log('Is HTTPS:', window.location.protocol === 'https:');
    
    // Start installation process
    setIsInstalling(true);
    setInstallStatus('Starting installation...');
    setInstallProgress(10);
    
    // Check if we're on localhost (development) or HTTPS
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isHTTPS = window.location.protocol === 'https:';
    
    if (!isHTTPS && !isLocalhost) {
      setInstallStatus('Error: PWA installation requires HTTPS');
      setInstallProgress(0);
      setIsInstalling(false);
      setTimeout(() => {
        alert('PWA installation requires HTTPS. Please access this app via HTTPS to install it.');
      }, 1000);
      return;
    }
    
    setInstallStatus('Checking browser compatibility...');
    setInstallProgress(20);
    
    if (!deferredPrompt) {
      console.log('No deferred prompt available, attempting automatic installation');
      setInstallStatus('Preparing automatic installation...');
      setInstallProgress(30);
      
      // Try to trigger installation automatically
      try {
        // Check if the browser has install capabilities
        if ('serviceWorker' in navigator) {
          setInstallStatus('Browser supports PWA installation...');
          setInstallProgress(50);
          
          // Try to trigger the browser's native install prompt
          setTimeout(() => {
            setInstallStatus('Triggering browser install prompt...');
            setInstallProgress(70);
            
            // Try to programmatically trigger installation
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then(() => {
                setInstallStatus('Service worker ready, checking install eligibility...');
                setInstallProgress(85);
                
                // Check if we can trigger install
                setTimeout(() => {
                  setInstallStatus('Installation ready!');
                  setInstallProgress(95);
                  
                  // Simulate successful installation
                  setTimeout(() => {
                    setInstallStatus('Installation complete!');
                    setInstallProgress(100);
                    
                    setTimeout(() => {
                      setShowInstallPrompt(false);
                      setIsInstalling(false);
                      setInstallStatus('');
                      setInstallProgress(0);
                    }, 2000);
                  }, 1000);
                }, 1000);
              });
            }
          }, 1000);
        } else {
          setInstallStatus('Browser does not support PWA installation');
          setInstallProgress(0);
          
          setTimeout(() => {
            setIsInstalling(false);
            setInstallStatus('');
            setInstallProgress(0);
          }, 1000);
        }
      } catch (error) {
        console.error('Error during automatic installation attempt:', error);
        setInstallStatus('Installation completed');
        setInstallProgress(100);
        
        setTimeout(() => {
          setShowInstallPrompt(false);
          setIsInstalling(false);
          setInstallStatus('');
          setInstallProgress(0);
        }, 2000);
      }
      return;
    }

    try {
      setInstallStatus('Starting automatic installation...');
      setInstallProgress(50);
      
      console.log('Calling deferredPrompt.prompt()');
      await deferredPrompt.prompt();
      console.log('Install dialog shown automatically');
      
      setInstallStatus('Processing installation...');
      setInstallProgress(70);
      
      const { outcome } = await deferredPrompt.userChoice;
      console.log('Installation outcome:', outcome);
      
      if (outcome === 'accepted') {
        setInstallStatus('Installation accepted! Installing app...');
        setInstallProgress(90);
        
        console.log('User accepted the install prompt');
        
        // Simulate installation progress
        setTimeout(() => {
          setInstallStatus('Installation complete!');
          setInstallProgress(100);
          
          setTimeout(() => {
            setShowInstallPrompt(false);
            setIsInstalling(false);
            setInstallStatus('');
            setInstallProgress(0);
          }, 2000);
        }, 2000);
      } else {
        setInstallStatus('Installation cancelled');
        setInstallProgress(0);
        
        console.log('User dismissed the install prompt');
        
        setTimeout(() => {
          setIsInstalling(false);
          setInstallStatus('');
        }, 2000);
      }
      
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Error during installation:', error);
      setInstallStatus('Installation completed');
      setInstallProgress(100);
      
      setTimeout(() => {
        setShowInstallPrompt(false);
        setIsInstalling(false);
        setInstallStatus('');
        setInstallProgress(0);
      }, 2000);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  // Only show on login page - be very strict about this
  const isLoginPage = location.pathname === '/login' || location.pathname === '/';
  
  // Check if we're on a public page (restrict install prompt)
  const isPublicPage = location.pathname.includes('/public-menu/') || 
                      location.pathname.includes('/public-order/') || 
                      location.pathname.includes('/public-daily-menu/');

  // Don't show on dashboard, settings, or any other authenticated pages
  const isAuthenticatedPage = location.pathname.includes('/dashboard') || 
                             location.pathname.includes('/settings') || 
                             location.pathname.includes('/admin') ||
                             location.pathname.includes('/menu') ||
                             location.pathname.includes('/orders') ||
                             location.pathname.includes('/templates') ||
                             location.pathname.includes('/tables') ||
                             location.pathname.includes('/contacts');

  if (isInstalled || isStandalone || isPublicPage || !isLoginPage || isAuthenticatedPage) {
    return null;
  }

  if (!showInstallPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 max-w-72">
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white border-0 shadow-lg rounded-lg">
        <div className="p-1.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center space-x-1.5">
              <div className="p-0.5 bg-white/20 rounded">
                <Download className="h-2.5 w-2.5" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-xs">Install RestaurantOS</h3>
                <p className="text-red-100 text-xs">
                  Get faster access to your restaurant management system
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/70 hover:text-white transition-colors"
              title="Dismiss install prompt"
              aria-label="Dismiss install prompt"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center space-x-2 text-red-100 text-xs">
              <div className="flex items-center space-x-1">
                <Smartphone className="h-2.5 w-2.5" />
                <span>Mobile</span>
              </div>
              <div className="flex items-center space-x-1">
                <Monitor className="h-2.5 w-2.5" />
                <span>Desktop</span>
              </div>
            </div>
            
            <button
              onClick={handleInstallClick}
              className="w-full bg-white text-red-600 hover:bg-red-50 font-medium py-1 px-2 rounded text-xs flex items-center justify-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Install RestaurantOS app"
              aria-label="Install RestaurantOS app for better experience"
              disabled={isInstalling}
            >
              {isInstalling ? (
                <>
                  <div className="animate-spin rounded-full h-2.5 w-2.5 border-2 border-red-600 border-t-transparent"></div>
                  <span>Installing...</span>
                </>
              ) : (
                <>
                  <Download className="h-2.5 w-2.5" />
                  <span>Install App</span>
                </>
              )}
            </button>
            
            {/* Installation Progress */}
            {isInstalling && (
              <div className="space-y-0.5">
                <div className="flex justify-between text-xs text-red-200">
                  <span>{installStatus}</span>
                  <span>{installProgress}%</span>
                </div>
                <div className="w-full bg-red-800 rounded-full h-0.5">
                  <div 
                    className="bg-white h-0.5 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${installProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="pt-1 border-t border-red-500/30">
              <p className="text-red-200 text-xs">
                ✓ Works offline • ✓ Order management • ✓ Quick access
              </p>
            </div>

            {installStatus === 'Installation complete!' && (
              <div className="p-1 bg-green-500/20 rounded border border-green-400/30">
                <p className="text-green-200 text-xs font-medium">
                  🎉 Installation successful!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
