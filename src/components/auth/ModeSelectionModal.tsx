import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Building2, ArrowRight } from 'lucide-react';
import Button from '../common/Button';
import { useAuth } from '../../contexts/AuthContext';

interface ModeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ModeSelectionModal({ isOpen, onClose }: ModeSelectionModalProps) {
  const [selectedMode, setSelectedMode] = useState<'employee' | 'company' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const handleModeSelect = async (mode: 'employee' | 'company') => {
    setIsLoading(true);
    setSelectedMode(mode);

    try {
      if (mode === 'employee') {
        // Fermer le modal immédiatement et rediriger vers dashboard employé
        onClose();
        navigate('/employee/dashboard');
      } else {
        // Mode company - utiliser le NavigationService pour éviter les conflits
        const { NavigationService } = await import('../../services/navigationService');
        
        console.log('Navigation via NavigationService pour userId:', currentUser?.uid);
        
        const result = await NavigationService.handleCompanyMode(currentUser?.uid || '');
        console.log('Résultat NavigationService:', result);
        
        onClose(); // Fermer le modal
        
        if (result.success) {
          console.log('Redirection vers:', result.redirectPath);
          navigate(result.redirectPath);
        } else {
          console.error('Erreur NavigationService:', result.error);
          // Fallback vers création
          navigate('/company/create');
        }
      }
    } catch (error) {
      console.error('Erreur lors de la sélection du mode:', error);
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Choisissez votre mode
            </h2>
            <p className="text-gray-600">
              Comment souhaitez-vous utiliser l'application ?
            </p>
          </div>
        </div>

        {/* Mode Selection Cards */}
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Mode Employé */}
            <div
              className={`relative p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                selectedMode === 'employee'
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
              }`}
              onClick={() => handleModeSelect('employee')}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                  <User className="h-8 w-8 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Continuer en tant qu'Employé
                </h3>
                <p className="text-gray-600 mb-4">
                  Accéder aux companies où vous travaillez et voir un aperçu du système
                </p>
                <div className="flex items-center text-indigo-600 font-medium">
                  <span>Choisir ce mode</span>
                  <ArrowRight className="h-4 w-4 ml-2" />
                </div>
              </div>
            </div>

            {/* Mode Companie */}
            <div
              className={`relative p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                selectedMode === 'company'
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
              }`}
              onClick={() => handleModeSelect('company')}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                  <Building2 className="h-8 w-8 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Continuer en tant que Companie
                </h3>
                <p className="text-gray-600 mb-4">
                  Gérer votre entreprise, vos employés et vos données
                </p>
                <div className="flex items-center text-indigo-600 font-medium">
                  <span>Choisir ce mode</span>
                  <ArrowRight className="h-4 w-4 ml-2" />
                </div>
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-sm">ℹ</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-800">
                  <strong>Note :</strong> Vous pourrez changer de mode à tout moment via la navigation.
                  Ce choix détermine votre expérience initiale dans l'application.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="min-w-[120px]"
            >
              {isLoading ? 'Chargement...' : 'Annuler'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
