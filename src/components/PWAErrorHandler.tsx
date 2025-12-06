import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';

interface PWAErrorHandlerProps {
  children: React.ReactNode;
}

export const PWAErrorHandler: React.FC<PWAErrorHandlerProps> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasServiceWorker, setHasServiceWorker] = useState(false);
  const [swError, setSwError] = useState<string | null>(null);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);

  useEffect(() => {
    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineBanner(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check service worker support
    if ('serviceWorker' in navigator) {
      setHasServiceWorker(true);
      
      // Wait 3 seconds before first check (give Vite PWA time to register)
      // Then check multiple times before showing error
      let attempts = 0;
      const maxAttempts = 5; // Check 5 times over ~10 seconds
      const checkInterval = 2000; // Check every 2 seconds
      
      const checkServiceWorker = async () => {
        attempts++;
        
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          
          if (registration) {
            // Service worker is registered, clear any error
            setSwError(null);
            return;
          }
          
          // If no registration after max attempts, show error (only in production)
          if (attempts >= maxAttempts) {
            if (import.meta.env.PROD) {
              setSwError('Service Worker not registered');
            }
          } else {
            // Try again after delay
            setTimeout(checkServiceWorker, checkInterval);
          }
        } catch (error) {
          // Only show error after all retries failed (only in production)
          if (attempts >= maxAttempts) {
            if (import.meta.env.PROD) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              setSwError(`Service Worker error: ${errorMessage}`);
            }
          } else {
            // Try again after delay
            setTimeout(checkServiceWorker, checkInterval);
          }
        }
      };
      
      // Start checking after initial delay (give Vite PWA time to register)
      setTimeout(checkServiceWorker, 3000); // Wait 3 seconds before first check
    } else {
      // Service worker not supported - only show in production
      if (import.meta.env.PROD) {
        setSwError('Service Worker not supported');
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <>
      {children}
      
      {/* Offline Banner */}
      {showOfflineBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <WifiOff className="h-4 w-4" />
            <span className="text-sm font-medium">Vous êtes hors ligne</span>
          </div>
          <button
            onClick={handleRetry}
            className="flex items-center space-x-1 text-sm hover:bg-orange-600 px-2 py-1 rounded transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Réessayer</span>
          </button>
        </div>
      )}

      {/* Service Worker Error - Only show in production */}
      {swError && import.meta.env.PROD && (
        <div className="fixed bottom-4 left-4 right-4 z-50 bg-red-500 text-white p-4 rounded-lg shadow-lg">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Problème PWA détecté</h3>
              <p className="text-sm opacity-90 mt-1">{swError}</p>
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={handleRetry}
                  className="bg-white text-red-500 px-3 py-1 rounded text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  Réessayer
                </button>
                <button
                  onClick={() => setSwError(null)}
                  className="text-white/80 hover:text-white text-sm transition-colors"
                >
                  Ignorer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
};
