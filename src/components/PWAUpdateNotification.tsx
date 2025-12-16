import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, X } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';
import { showSuccessToast } from '../utils/toast';

export const PWAUpdateNotification: React.FC = () => {
  const { hasUpdate, updateApp } = usePWA();
  const [toastId, setToastId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (hasUpdate && !toastId) {
      // Show persistent toast notification
      const id = toast(
        (t) => (
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-blue-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Nouvelle version disponible</p>
                <p className="text-sm text-gray-600 mt-0.5">
                  Une mise à jour de l'application est prête
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleUpdate(t.id)}
                disabled={isUpdating}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Mise à jour...</span>
                  </>
                ) : (
                  <span>Mettre à jour maintenant</span>
                )}
              </button>
              <button
                onClick={() => handleDismiss(t.id)}
                disabled={isUpdating}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-1"
                title="Plus tard"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        ),
        {
          duration: Infinity, // Persistent toast
          position: 'top-right',
          style: {
            background: '#fff',
            color: '#333',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            borderRadius: '0.5rem',
            padding: '1rem',
            maxWidth: '500px',
            borderLeft: '4px solid #3B82F6', // blue-500
            zIndex: 9999,
          },
        }
      );
      setToastId(id);
    } else if (!hasUpdate && toastId) {
      // Update no longer available, dismiss toast
      toast.dismiss(toastId);
      setToastId(null);
      setIsUpdating(false);
    }
  }, [hasUpdate, toastId, isUpdating]);

  const handleUpdate = (id: string) => {
    setIsUpdating(true);
    
    try {
      // Show updating message
      toast.dismiss(id);
      setToastId(null);
      
      // Show a temporary success message before reload
      showSuccessToast('Mise à jour en cours...');
      
      // Trigger the update (this will reload the page)
      setTimeout(() => {
        updateApp();
      }, 500);
    } catch (error) {
      console.error('Error updating app:', error);
      setIsUpdating(false);
      toast.error('Erreur lors de la mise à jour. Veuillez réessayer.', {
        duration: 5000,
      });
    }
  };

  const handleDismiss = (id: string) => {
    toast.dismiss(id);
    setToastId(null);
    
    // Show info message
    toast('Vous serez notifié de nouveau dans 1 minute', {
      duration: 3000,
      icon: 'ℹ️',
      style: {
        borderLeft: '4px solid #3B82F6',
      },
    });
  };

  // This component doesn't render anything directly
  // It manages the toast notification via effects
  return null;
};

