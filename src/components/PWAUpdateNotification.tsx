import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, X, CheckCircle, AlertCircle } from 'lucide-react';

interface PWAUpdateNotificationProps {
  onUpdate: () => void;
  onDismiss: () => void;
}

export const PWAUpdateNotification: React.FC<PWAUpdateNotificationProps> = ({ onUpdate, onDismiss }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);

  const handleUpdate = async () => {
    setIsUpdating(true);
    
    // Simulate update progress
    for (let i = 0; i <= 100; i += 10) {
      setUpdateProgress(i);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Trigger the actual update
    onUpdate();
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
          {isUpdating && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Mise à jour en cours...</span>
                <span className="text-sm text-gray-500">{updateProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-300 ease-out"
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
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Mise à jour...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Mettre à jour maintenant</span>
                </>
              )}
            </button>
            <button
              onClick={onDismiss}
              disabled={isUpdating}
              className="px-4 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors"
            >
              Plus tard
            </button>
          </div>

          {/* Info */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-800">
                La mise à jour sera appliquée automatiquement. L'application se rechargera pour appliquer les changements.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};