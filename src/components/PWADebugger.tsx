import React, { useState, useEffect } from 'react';
import { Bug, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export const PWADebugger: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkPWARequirements = () => {
      const info = {
        // Basic requirements
        hasServiceWorker: 'serviceWorker' in navigator,
        hasManifest: !!document.querySelector('link[rel="manifest"]'),
        isHTTPS: location.protocol === 'https:' || location.hostname === 'localhost',
        
        // Manifest details
        manifest: null as any,
        
        // Service worker status
        serviceWorkerRegistration: null as any,
        
        // Browser support
        userAgent: navigator.userAgent,
        isChrome: /Chrome/.test(navigator.userAgent),
        isEdge: /Edg/.test(navigator.userAgent),
        isFirefox: /Firefox/.test(navigator.userAgent),
        isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent),
        
        // PWA specific
        isStandalone: window.matchMedia('(display-mode: standalone)').matches,
        isIOSStandalone: (window.navigator as any).standalone === true,
        
        // Install prompt
        hasBeforeInstallPrompt: false,
      };

      // Check manifest
      if (info.hasManifest) {
        const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
        if (manifestLink) {
          fetch(manifestLink.href)
            .then(response => response.json())
            .then(manifest => {
              info.manifest = manifest;
              setDebugInfo({ ...info });
            })
            .catch(error => {
              info.manifest = { error: error.message };
              setDebugInfo({ ...info });
            });
        }
      }

      // Check service worker
      if (info.hasServiceWorker) {
        navigator.serviceWorker.getRegistration()
          .then(registration => {
            info.serviceWorkerRegistration = registration ? {
              scope: registration.scope,
              state: registration.active?.state,
              scriptURL: registration.active?.scriptURL
            } : null;
            setDebugInfo({ ...info });
          })
          .catch(error => {
            info.serviceWorkerRegistration = { error: error.message };
            setDebugInfo({ ...info });
          });
      }

      setDebugInfo(info);
    };

    checkPWARequirements();

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = () => {
      setDebugInfo(prev => ({ ...prev, hasBeforeInstallPrompt: true }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const getStatusIcon = (condition: boolean) => {
    return condition ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusColor = (condition: boolean) => {
    return condition ? 'text-green-600' : 'text-red-600';
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors"
        title="PWA Debug Info"
      >
        <Bug className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-md max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 flex items-center space-x-2">
          <Bug className="h-4 w-4" />
          <span>PWA Debug Info</span>
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          <XCircle className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span>Service Worker</span>
          {getStatusIcon(debugInfo.hasServiceWorker)}
        </div>
        
        <div className="flex items-center justify-between">
          <span>Manifest</span>
          {getStatusIcon(debugInfo.hasManifest)}
        </div>
        
        <div className="flex items-center justify-between">
          <span>HTTPS/Localhost</span>
          {getStatusIcon(debugInfo.isHTTPS)}
        </div>
        
        <div className="flex items-center justify-between">
          <span>Install Prompt Available</span>
          {getStatusIcon(debugInfo.hasBeforeInstallPrompt)}
        </div>
        
        <div className="flex items-center justify-between">
          <span>Already Installed</span>
          {getStatusIcon(debugInfo.isStandalone || debugInfo.isIOSStandalone)}
        </div>

        <div className="pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-600">
            <div>Browser: {debugInfo.userAgent?.split(' ').pop()}</div>
            <div>Chrome: {debugInfo.isChrome ? 'Yes' : 'No'}</div>
            <div>Edge: {debugInfo.isEdge ? 'Yes' : 'No'}</div>
            <div>Firefox: {debugInfo.isFirefox ? 'Yes' : 'No'}</div>
            <div>Safari: {debugInfo.isSafari ? 'Yes' : 'No'}</div>
          </div>
        </div>

        {debugInfo.manifest && (
          <div className="pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-600">
              <div>App Name: {debugInfo.manifest.name}</div>
              <div>Icons: {debugInfo.manifest.icons?.length || 0}</div>
            </div>
          </div>
        )}

        {debugInfo.serviceWorkerRegistration && (
          <div className="pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-600">
              <div>SW State: {debugInfo.serviceWorkerRegistration.state || 'Not active'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
