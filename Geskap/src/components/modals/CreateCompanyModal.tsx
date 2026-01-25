import React from 'react';
import { Building2, Plus, X } from 'lucide-react';

interface CreateCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCompany: () => void;
}

const CreateCompanyModal: React.FC<CreateCompanyModalProps> = ({ 
  isOpen, 
  onClose, 
  onCreateCompany 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <Building2 className="mr-2 h-5 w-5 text-indigo-600" />
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
          <p className="text-gray-600 mb-4">
            Veuillez d'abord créer une entreprise ou en sélectionner une.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Voulez-vous créer une nouvelle entreprise maintenant ?
          </p>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={onCreateCompany}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors flex items-center"
            >
              <Plus className="mr-2 h-4 w-4" />
              Créer une entreprise
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateCompanyModal;
