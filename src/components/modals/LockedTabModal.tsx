import React from 'react';
import { X, Building2, Plus } from 'lucide-react';

interface LockedTabModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCompany: () => void;
}

const LockedTabModal: React.FC<LockedTabModalProps> = ({
  isOpen,
  onClose,
  onCreateCompany
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                <Building2 className="h-5 w-5 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Créez votre entreprise
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-8 w-8 text-indigo-600" />
              </div>
              <h4 className="text-xl font-medium text-gray-900 mb-2">
                Accès restreint
              </h4>
              <p className="text-gray-600">
                Veuillez créer ou sélectionner une entreprise pour accéder à cette fonctionnalité.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={onCreateCompany}
                className="w-full flex items-center justify-center px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                <Plus className="h-4 w-4 mr-2" />
                Créer une entreprise
              </button>
              
              <button
                onClick={onClose}
                className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Annuler
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 rounded-b-lg">
            <p className="text-xs text-gray-500 text-center">
              Une fois votre entreprise créée, vous pourrez accéder à toutes les fonctionnalités.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LockedTabModal;
