import React, { useState } from 'react';
import { Download, RefreshCw, X, CheckCircle, AlertCircle } from 'lucide-react';
import { PWAUpdateStorage } from '../utils/pwaUpdateStorage';

interface PWAUpdateNotificationProps {
  onUpdate: () => void;
  onDismiss: () => void;
}

export const PWAUpdateNotification: React.FC<PWAUpdateNotificationProps> = ({ onUpdate, onDismiss }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [isUpdateReady, setIsUpdateReady] = useState(false);

  const handleConfirmUpdate = async () => {
    // Mark update as confirmed in localStorage BEFORE clearing caches
    PWAUpdateStorage.markUpdateAsConfirmed();
    
    // Clear all caches first
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('All caches cleared');
      } catch (error) {
        console.error('Error clearing caches:', error);
      }
    }

    // Trigger the actual update
    onUpdate();
    
    // Force a hard reload after a short delay to ensure service worker update
    setTimeout(() => {
      // Multiple methods to ensure hard reload
      try {
        // Method 1: Force navigation to same URL
        window.location.href = window.location.href;
      } catch (error) {
        console.error('Error with location.href reload:', error);
        // Method 2: Standard reload
        window.location.reload();
      }
      
      // Method 3: Fallback with replace
      setTimeout(() => {
        window.location.replace(window.location.href);
      }, 200);
    }, 500);
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    setUpdateProgress(0);
    
    // Simulate update progress
    for (let i = 0; i <= 100; i += 10) {
      setUpdateProgress(i);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // After the loop, progress is 100% - auto-confirm the update
    console.log('✅ Update progress reached 100%, auto-confirming update...');
    // Mark update as confirmed in localStorage BEFORE clearing caches
    PWAUpdateStorage.markUpdateAsConfirmed();
    setIsUpdateReady(true);
    setIsUpdating(false);
    
    // Clear all caches first
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('All caches cleared');
      } catch (error) {
        console.error('Error clearing caches:', error);
      }
    }

    // Trigger the actual update
    onUpdate();
    
    // Force a hard reload after a short delay to ensure service worker update
    setTimeout(() => {
      // Multiple methods to ensure hard reload
      try {
        // Method 1: Force navigation to same URL
        window.location.href = window.location.href;
      } catch (error) {
        console.error('Error with location.href reload:', error);
        // Method 2: Standard reload
        window.location.reload();
      }
      
      // Method 3: Fallback with replace
      setTimeout(() => {
        window.location.replace(window.location.href);
      }, 200);
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white bg-opacity-20 p-2 rounded-full">
                <Download className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Mise à jour disponible</h3>
                <p className="text-emerald-100 text-sm">Nouvelle version de l'application</p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="text-white hover:bg-white hover:bg-opacity-20 p-1 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="flex items-start space-x-4 mb-6">
            <div className="bg-emerald-100 p-3 rounded-full">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                Améliorations disponibles
              </h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                Une nouvelle version de l'application est disponible avec des améliorations de performance, 
                de nouvelles fonctionnalités et des corrections de bugs.
              </p>
            </div>
          </div>

          {/* Update Progress */}
          {(isUpdating || isUpdateReady) && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {isUpdateReady ? 'Mise à jour terminée' : 'Mise à jour en cours...'}
                </span>
                <span className={`text-sm font-semibold ${isUpdateReady ? 'text-green-600' : 'text-gray-500'}`}>
                  {updateProgress}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ease-out ${
                    isUpdateReady ? 'bg-green-500' : 'bg-emerald-600'
                  }`}
                  style={{ width: `${updateProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Features List */}
          <div className="mb-6">
            <h5 className="text-sm font-semibold text-gray-900 mb-3">Nouvelles fonctionnalités :</h5>
            <ul className="space-y-2">
              <li className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                <span>Améliorations de performance</span>
              </li>
              <li className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                <span>Corrections de bugs</span>
              </li>
              <li className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                <span>Interface utilisateur améliorée</span>
              </li>
              <li className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                <span>Nouvelles fonctionnalités</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            {!isUpdating && !isUpdateReady ? (
              <>
                <button
                  onClick={handleUpdate}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Mettre à jour maintenant</span>
                </button>
                <button
                  onClick={onDismiss}
                  className="px-4 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl font-semibold transition-colors"
                >
                  Plus tard
                </button>
              </>
            ) : (
              <div className="w-full">
                <div className="flex items-center justify-center space-x-2 text-emerald-600">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span className="text-sm font-semibold">
                    {isUpdateReady ? 'Mise à jour confirmée, redémarrage en cours...' : 'Mise à jour en cours...'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-800">
                La mise à jour sera appliquée automatiquement lorsque le téléchargement atteint 100%. L'application se rechargera automatiquement pour appliquer les changements.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};