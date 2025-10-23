import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowRight, Plus } from 'lucide-react';
import Button from '../common/Button';
import { useAuth } from '../../contexts/AuthContext';
import { NavigationService } from '../../services/navigationService';

interface CompanySelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserCompany {
  companyId: string;
  name: string;
  description?: string;
  logo?: string;
  role: 'owner' | 'admin' | 'manager' | 'staff';
  joinedAt: any;
}

export default function CompanySelectionModal({ isOpen, onClose }: CompanySelectionModalProps) {
  const [companies, setCompanies] = useState<UserCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasOwnerCompany, setHasOwnerCompany] = useState<boolean | null>(null);
  const [isCheckingOwnerStatus, setIsCheckingOwnerStatus] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (isOpen && currentUser) {
      loadUserCompanies();
      checkOwnerStatus();
    }
  }, [isOpen, currentUser]);

  const loadUserCompanies = async () => {
    setIsLoading(true);
    try {
      // Récupérer les companies de l'utilisateur depuis AuthContext
      const userCompanies = (currentUser as any)?.companies || [];
      setCompanies(userCompanies);
    } catch (error) {
      console.error('Erreur lors du chargement des companies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkOwnerStatus = async () => {
    if (!currentUser?.uid) return;
    
    setIsCheckingOwnerStatus(true);
    try {
      const result = await NavigationService.handleCompanyMode(currentUser.uid);
      // Si la redirection est vers un dashboard (pas /create), l'utilisateur a une company owner
      const isOwner = result.success && result.redirectPath.includes('/company/') && !result.redirectPath.includes('/create');
      setHasOwnerCompany(isOwner);
    } catch (error) {
      console.error('Erreur lors de la vérification du statut owner:', error);
      setHasOwnerCompany(false);
    } finally {
      setIsCheckingOwnerStatus(false);
    }
  };

  const handleCompanySelect = (companyId: string) => {
    // Redirection vers le dashboard de la company avec basculement en mode company
    navigate(`/company/${companyId}/dashboard`);
    onClose();
  };

  const handleContinueAsCompany = async () => {
    // Utiliser NavigationService pour une redirection cohérente
    try {
      const result = await NavigationService.handleCompanyMode(currentUser?.uid || '');
      navigate(result.redirectPath);
      onClose();
    } catch (error) {
      console.error('Erreur lors de la redirection company:', error);
      // Fallback vers création
      navigate('/company/create');
      onClose();
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800';
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      case 'staff':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Propriétaire';
      case 'admin':
        return 'Administrateur';
      case 'manager':
        return 'Manager';
      case 'staff':
        return 'Employé';
      default:
        return role;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Choisir une companie
              </h2>
              <p className="text-gray-600">
                Sélectionnez l'entreprise pour laquelle vous souhaitez travailler
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="sr-only">Fermer</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-3 text-gray-600">Chargement des companies...</span>
            </div>
          ) : companies.length === 0 ? (
            // Aucune company
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Vous n'avez pas encore de company
              </h3>
              <p className="text-gray-600 mb-6">
                Vous n'êtes employé d'aucune entreprise pour le moment. Créez votre première entreprise pour commencer.
              </p>
            </div>
          ) : (
            // Liste des companies
            <div className="space-y-4">
              {companies.map((company) => (
                <div
                  key={company.companyId}
                  className="border border-gray-200 rounded-xl p-6 hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200 cursor-pointer"
                  onClick={() => handleCompanySelect(company.companyId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                        {company.logo ? (
                          <img 
                            src={company.logo} 
                            alt={company.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <Building2 className="h-6 w-6 text-indigo-600" />
                        )}
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {company.name}
                        </h3>
                        {company.description && (
                          <p className="text-gray-600 text-sm mt-1">
                            {company.description}
                          </p>
                        )}
                        <div className="flex items-center mt-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(company.role)}`}>
                            {getRoleLabel(company.role)}
                          </span>
                          <span className="ml-2 text-xs text-gray-500">
                            Rejoint le {company.joinedAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center text-indigo-600">
                      <span className="text-sm font-medium mr-2">Accéder</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              ))}

              {/* Bouton conditionnel selon le statut owner */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                {isCheckingOwnerStatus ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Vérification de vos entreprises...</p>
                  </div>
                ) : hasOwnerCompany ? (
                  <div className="text-center">
                    <Button 
                      onClick={handleContinueAsCompany} 
                      className="w-full flex items-center justify-center"
                    >
                      <Building2 className="h-4 w-4 mr-2" />
                      Accéder à mon entreprise
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Button 
                      onClick={handleContinueAsCompany} 
                      className="w-full flex items-center justify-center"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Créer mon entreprise
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <div className="flex justify-center">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
