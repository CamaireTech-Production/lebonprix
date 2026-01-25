import React, { useState, useEffect } from 'react';
import { RefreshCw, X, CheckCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export const PWAUpdateNotification: React.FC = () => {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Check if we're on a public page (restrict update notifications)
    const isPublicPage = location.pathname.includes('/public-menu/') || 
                        location.pathname.includes('/public-order/') || 
                        location.pathname.includes('/public-daily-menu/');
    
    // Check if we're on a login page
    const isLoginPage = location.pathname === '/login' || location.pathname === '/admin/login';
    
    if (isPublicPage || !isLoginPage) {
      return; // Don't show update notifications on public pages or non-login pages
    }

    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setShowUpdatePrompt(true);
      });
    }
  }, [location.pathname]);

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

  // Check if we're on a public page (restrict update notifications)
  const isPublicPage = location.pathname.includes('/public-menu/') || 
                      location.pathname.includes('/public-order/') || 
                      location.pathname.includes('/public-daily-menu/');
  
  // Check if we're on a login page
  const isLoginPage = location.pathname === '/login' || location.pathname === '/admin/login';
  
  if (!showUpdatePrompt || isPublicPage || !isLoginPage) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white border-0 shadow-lg rounded-lg">
        <div className="p-3">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <CheckCircle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">Update Available</h3>
                <p className="text-red-100 text-xs">
                  A new version of RestaurantOS is available
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/70 hover:text-white transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-red-100 text-xs">
              Update to benefit from the latest improvements and bug fixes.
            </p>
            
            <div className="flex space-x-2">
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="flex-1 bg-white text-red-600 hover:bg-red-50 font-medium disabled:opacity-50 py-1.5 px-3 rounded-lg flex items-center justify-center space-x-2 text-sm"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3" />
                    <span>Update</span>
                  </>
                )}
              </button>
              
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-red-100 hover:text-white hover:bg-red-500/20 rounded-lg text-sm"
              >
                Later
              </button>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-red-500/30">
            <p className="text-red-200 text-xs">
              ✓ Performance improvements • ✓ New features • ✓ Bug fixes
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
