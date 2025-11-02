import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Building2, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ModeSelection: React.FC = () => {
  const [selectedMode, setSelectedMode] = useState<'employee' | 'company' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { userCompanies } = useAuth();

  const handleModeSelect = async (mode: 'employee' | 'company') => {
    setIsLoading(true);
    setSelectedMode(mode);

    try {
      // Stocker le mode choisi dans localStorage
      localStorage.setItem('selectedMode', mode);
      
      if (mode === 'company') {
        // Utiliser la logique de vérification des entreprises
        logCompanie();
      } else {
        // Mode employé - rediriger vers le dashboard employé
        navigate('/employee/dashboard');
      }
    } catch (error) {
      console.error('Erreur lors de la sélection du mode:', error);
      setIsLoading(false);
    }
  };
  const logCompanie = () => {
    // Vérifier si l'utilisateur a des entreprises
    if (!userCompanies || userCompanies.length === 0) {
      // Aucune entreprise → Créer une entreprise
      navigate('/company/create');
      return;
    }

    // Chercher une entreprise où l'utilisateur est owner ou admin
    const ownerOrAdminCompany = userCompanies.find((company: import('../types/models').UserCompanyRef) => 
      company.role === 'owner' || company.role === 'admin'
    );

    if (ownerOrAdminCompany) {
      // Trouvé une entreprise avec rôle owner/admin → Dashboard de cette entreprise
      navigate(`/company/${ownerOrAdminCompany.companyId}/dashboard`);
    } else {
      // Aucune entreprise avec rôle owner/admin → Créer une entreprise
      navigate('/company/create');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Bienvenue sur Le Bon Prix
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Choisissez comment vous souhaitez continuer. Vous pourrez toujours changer de mode plus tard.
          </p>
        </div>

        {/* Mode Selection Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Mode Employé */}
          <div 
            className={`relative bg-white rounded-2xl shadow-lg border-2 transition-all duration-300 cursor-pointer hover:shadow-xl hover:scale-105 ${
              selectedMode === 'employee' 
                ? 'border-indigo-500 ring-4 ring-indigo-100' 
                : 'border-gray-200 hover:border-indigo-300'
            }`}
            onClick={() => handleModeSelect('employee')}
          >
            <div className="p-8">
              <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto mb-6">
                <User className="h-8 w-8 text-blue-600" />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
                Continuer en tant qu'Employé
              </h2>
              
              <p className="text-gray-600 mb-6 text-center leading-relaxed">
                Accédez à votre tableau de bord employé pour gérer vos ventes, 
                consulter vos performances et interagir avec votre équipe.
              </p>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  Gestion des ventes et commissions
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  Suivi des objectifs et performances
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  Communication avec l'équipe
                </div>
              </div>
              
              <div className="flex items-center justify-center text-indigo-600 font-semibold">
                <span>Choisir ce mode</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </div>
            </div>
          </div>

          {/* Mode Company */}
          <div 
            className={`relative bg-white rounded-2xl shadow-lg border-2 transition-all duration-300 cursor-pointer hover:shadow-xl hover:scale-105 ${
              selectedMode === 'company' 
                ? 'border-emerald-500 ring-4 ring-emerald-100' 
                : 'border-gray-200 hover:border-emerald-300'
            }`}
            onClick={() => handleModeSelect('company')}
          >
            <div className="p-8">
              <div className="flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mx-auto mb-6">
                <Building2 className="h-8 w-8 text-emerald-600" />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
                Continuer en tant qu'Entreprise
              </h2>
              
              <p className="text-gray-600 mb-6 text-center leading-relaxed">
                Gérez votre entreprise, vos employés, vos produits et vos finances 
                avec tous les outils de gestion intégrés.
              </p>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></div>
                  Gestion complète de l'entreprise
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></div>
                  Suivi des employés et des performances
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></div>
                  Rapports financiers et analytiques
                </div>
              </div>
              
              <div className="flex items-center justify-center text-emerald-600 font-semibold">
                <span>Choisir ce mode</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
              <span className="text-gray-700">Redirection en cours...</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-sm text-gray-500">
            Vous pourrez changer de mode à tout moment depuis votre profil
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModeSelection;
