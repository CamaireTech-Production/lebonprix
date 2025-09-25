import React, { useState, useEffect } from 'react';
import { RefreshCw, X, CheckCircle } from 'lucide-react';

export const PWAUpdateNotification: React.FC = () => {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setShowUpdatePrompt(true);
      });
    }
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.waiting) {
          // Tell the waiting service worker to skip waiting and become active
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          
          // Reload the page to use the new service worker
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('Error updating app:', error);
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    setShowUpdatePrompt(false);
  };

  if (!showUpdatePrompt) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto">
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white border-0 shadow-lg rounded-lg">
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-white/20 rounded-lg">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Mise à jour Disponible</h3>
                <p className="text-green-100 text-sm">
                  Une nouvelle version de l'app est disponible
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

          <div className="space-y-3">
            <p className="text-green-100 text-sm">
              Mettez à jour pour bénéficier des dernières améliorations et corrections de bugs.
            </p>
            
            <div className="flex space-x-2">
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="flex-1 bg-white text-green-600 hover:bg-green-50 font-medium disabled:opacity-50 py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Mise à jour...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span>Mettre à jour</span>
                  </>
                )}
              </button>
              
              <button
                onClick={handleDismiss}
                className="px-4 py-2 text-green-100 hover:text-white hover:bg-green-500/20 rounded-lg"
              >
                Plus tard
              </button>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-green-500/30">
            <p className="text-green-200 text-xs">
              ✓ Améliorations de performance • ✓ Nouvelles fonctionnalités • ✓ Corrections de bugs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
