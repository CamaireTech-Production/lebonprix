import React from 'react';
import { X, Download, Menu, Monitor, Smartphone, ExternalLink } from 'lucide-react';

interface PWAInstallGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallGuide: React.FC<PWAInstallGuideProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const isChrome = /Chrome/.test(navigator.userAgent);
  const isEdge = /Edg/.test(navigator.userAgent);
  const isFirefox = /Firefox/.test(navigator.userAgent);
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full max-h-[80vh] overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
              <Download className="h-5 w-5 text-red-600" />
              <span>Installer l'App</span>
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-3">
            <p className="text-gray-600 text-sm">
              Votre app est prête à être installée ! Suivez ces étapes :
            </p>

            {/* Method 1 - Address Bar */}
            <div className="bg-blue-50 p-3 rounded-lg">
              <h3 className="font-medium text-blue-800 mb-1 flex items-center space-x-2 text-sm">
                <Monitor className="h-3 w-3" />
                <span>Méthode 1 - Barre d'adresse</span>
              </h3>
              <p className="text-blue-700 text-xs">
                Cherchez une icône d'installation (📱 ou ⬇️) dans la barre d'adresse et cliquez dessus.
              </p>
            </div>

            {/* Method 2 - Browser Menu */}
            <div className="bg-green-50 p-3 rounded-lg">
              <h3 className="font-medium text-green-800 mb-1 flex items-center space-x-2 text-sm">
                <Menu className="h-3 w-3" />
                <span>Méthode 2 - Menu du navigateur</span>
              </h3>
              <div className="text-green-700 text-xs space-y-1">
                {isChrome && (
                  <p>• <strong>Chrome:</strong> Menu (⋮) → "Installer Geskap"</p>
                )}
                {isEdge && (
                  <p>• <strong>Edge:</strong> Menu (⋮) → "Installer Geskap"</p>
                )}
                {isFirefox && (
                  <p>• <strong>Firefox:</strong> Menu (⋮) → "Installer"</p>
                )}
                {isSafari && (
                  <p>• <strong>Safari:</strong> Partager → "Ajouter à l'écran d'accueil"</p>
                )}
                {!isChrome && !isEdge && !isFirefox && !isSafari && (
                  <p>• Cliquez sur le menu (⋮) et cherchez "Installer"</p>
                )}
              </div>
            </div>

            {/* Benefits */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-medium text-gray-800 mb-1 text-sm">Avantages :</h3>
              <ul className="text-gray-600 text-xs space-y-1">
                <li>✓ Accès rapide • ✓ Hors ligne • ✓ Notifications</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={onClose}
              className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Compris
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
