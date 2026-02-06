import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { deleteCompany } from '@services/firestore/companies/companyService';
import { getUserById } from '@services/utilities/userService';
import { getCompanyById } from '@services/firestore/companies/companyPublic';
import { Plus, Building2, Trash2, User, LogOut } from 'lucide-react';
import { Button, Modal } from '@components/common';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';

import { CompanyForm } from '@components/company/CompanyForm';

/**
 * Dashboard de gestion des entreprises type Netflix
 * 
 * Page principale affichée après connexion pour :
 * - Afficher toutes les entreprises de l'utilisateur
 * - Créer de nouvelles entreprises
 * - Supprimer des entreprises (owners seulement)
 * - Naviguer vers le dashboard d'une entreprise
 */
export const CompaniesManagement: React.FC = () => {

  const { user, userCompanies, selectCompany, signOut } = useAuth();
  const navigate = useNavigate();

  // États pour la création d'entreprise
  const [showCreateModal, setShowCreateModal] = useState(false);

  // États pour la suppression d'entreprise
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // État pour la sélection d'entreprise
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // État pour stocker les informations des propriétaires
  const [ownersInfo, setOwnersInfo] = useState<Record<string, { name: string; email: string }>>({});

  /**
   * Gérer la sélection d'une entreprise
   */
  const handleCompanySelect = async (companyId: string) => {
    try {
      setSelectedCompanyId(companyId); // Set loading state
      await selectCompany(companyId);
      navigate(`/company/${companyId}/dashboard`);
    } catch (error) {
      console.error('❌ Erreur lors de la sélection de l\'entreprise:', error);
      showErrorToast('Erreur lors de la sélection de l\'entreprise');
      setSelectedCompanyId(null); // Reset loading state on error
    }
  };

  /**
   * Gérer le changement de fichier logo
   */
  /**
   * Gérer la création d'une nouvelle entreprise (Succès)
   */
  const handleCreateSuccess = () => {
    showSuccessToast('Entreprise créée avec succès');
    setShowCreateModal(false);
    // La liste des entreprises se mettra à jour automatiquement via le context
  };

  /**
   * Gérer la suppression d'une entreprise
   */
  const handleDeleteCompany = async () => {
    if (!user?.uid || !companyToDelete) return;

    try {
      setIsDeleting(true);

      await deleteCompany(user.uid, companyToDelete);

      showSuccessToast('Entreprise supprimée avec succès');
      setCompanyToDelete(null);

    } catch (error: any) {
      console.error('❌ Erreur lors de la suppression de l\'entreprise:', error);
      showErrorToast(error.message || 'Erreur lors de la suppression de l\'entreprise');
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Gérer la déconnexion
   */
  const handleSignOut = async () => {
    try {
      await signOut();
      showSuccessToast('Déconnexion réussie');
      navigate('/auth/login');
    } catch (error: any) {
      console.error('❌ Erreur lors de la déconnexion:', error);
      showErrorToast('Erreur lors de la déconnexion');
    }
  };

  /**
   * Charge les informations des propriétaires des entreprises
   */
  useEffect(() => {
    const loadOwnersInfo = async () => {
      const owners: Record<string, { name: string; email: string }> = {};

      for (const company of userCompanies) {
        try {
          let ownerId: string | null = null;

          // Si l'utilisateur actuel est le propriétaire, utiliser ses infos
          if (company.role === 'owner' && user) {
            const fullName = user.displayName || user.email || 'Propriétaire';
            owners[company.companyId] = {
              name: fullName || user.email || 'Propriétaire',
              email: user.email || ''
            };
            continue;
          }

          // Sinon, récupérer le document company pour obtenir le userId (owner)
          const companyDoc = await getCompanyById(company.companyId);
          if (companyDoc && companyDoc.userId) {
            ownerId = companyDoc.userId;
          } else if (companyDoc && companyDoc.companyId) {
            // Fallback pour les anciennes companies où companyId est le userId
            ownerId = companyDoc.companyId;
          }

          // Récupérer les infos du propriétaire
          if (ownerId) {
            const ownerUser = await getUserById(ownerId);
            if (ownerUser) {
              const fullName = ownerUser.username || ownerUser.email || 'Propriétaire';
              owners[company.companyId] = {
                name: fullName || ownerUser.email || 'Propriétaire',
                email: ownerUser.email || ''
              };
            }
          }
        } catch (error) {
          console.error(`Erreur lors de la récupération du propriétaire pour ${company.companyId}:`, error);
        }
      }

      setOwnersInfo(owners);
    };

    if (userCompanies.length > 0) {
      loadOwnersInfo();
    }
  }, [userCompanies, user]);

  /**
   * Récupère les initiales d'un nom d'entreprise
   */
  const getCompanyInitials = (name: string): string => {
    if (!name) return '';

    // Prendre les premières lettres de chaque mot (maximum 2 lettres)
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      // Si un seul mot, prendre les 2 premières lettres
      return name.substring(0, 2).toUpperCase();
    } else {
      // Si plusieurs mots, prendre la première lettre de chaque mot (max 2)
      return words
        .slice(0, 2)
        .map(word => word.charAt(0).toUpperCase())
        .join('');
    }
  };

  /**
   * Rendu d'une carte d'entreprise
   */
  const CompanyCard: React.FC<{ company: any }> = ({ company }) => {
    const hasLogo = company.logo && company.logo.trim() !== '';

    // Déterminer l'URL du logo : peut être une URL Firebase Storage (https://) ou base64
    let logoUrl: string | null = null;
    if (hasLogo) {
      if (company.logo.startsWith('http://') || company.logo.startsWith('https://')) {
        // URL Firebase Storage - utiliser directement
        logoUrl = company.logo;
      } else if (company.logo.startsWith('data:')) {
        // Déjà formaté en data URL
        logoUrl = company.logo;
      } else {
        // Base64 - ajouter le préfixe
        logoUrl = `data:image/jpeg;base64,${company.logo}`;
      }
    }

    const initials = getCompanyInitials(company.name || '');
    const ownerInfo = ownersInfo[company.companyId];
    const ownerEmail = ownerInfo
      ? (ownerInfo.email || 'Propriétaire')
      : 'Propriétaire';

    return (
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer p-6 border border-gray-200 group overflow-hidden">
        <div className="flex items-start justify-between min-w-0">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            {/* Logo ou initiales */}
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0 relative">
              {logoUrl ? (
                <>
                  <img
                    src={logoUrl}
                    alt={company.name}
                    className="w-full h-full object-cover rounded-lg"
                    onError={(e) => {
                      // Si l'image ne charge pas, masquer l'image et afficher les initiales
                      e.currentTarget.style.display = 'none';
                      const initialsEl = e.currentTarget.nextElementSibling as HTMLElement;
                      if (initialsEl) {
                        initialsEl.style.display = 'flex';
                      }
                    }}
                  />
                  <span
                    className="company-initials text-white font-bold text-xl absolute inset-0 flex items-center justify-center"
                    style={{ display: 'none' }}
                  >
                    {initials}
                  </span>
                </>
              ) : (
                <span className="text-white font-bold text-xl">
                  {initials || <Building2 className="w-8 h-8 text-white" />}
                </span>
              )}
            </div>

            {/* Informations de l'entreprise */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">{company.name}</h3>
              {company.description && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{company.description}</p>
              )}

              {/* Email du propriétaire */}
              <div className="flex items-center mt-2 min-w-0">
                <User className="w-4 h-4 text-gray-400 mr-1 flex-shrink-0" />
                <span className="text-sm text-gray-500 truncate">
                  {ownerEmail}
                </span>
              </div>

              {/* Rôle de l'utilisateur connecté dans cette entreprise */}
              <div className="flex items-center mt-1 min-w-0">
                <span className="text-xs text-gray-400 mr-1 flex-shrink-0">Rôle:</span>
                <span className="text-xs font-medium text-gray-600 truncate">
                  {company.role === 'owner' ? 'Propriétaire' :
                    company.role === 'admin' ? 'Administrateur' :
                      company.role === 'manager' ? 'Gestionnaire' : 'Employé'}
                </span>
              </div>
            </div>
          </div>

          {/* Bouton supprimer (seulement pour les owners) */}
          {company.role === 'owner' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCompanyToDelete(company.companyId);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg flex-shrink-0 ml-2"
              title="Supprimer l'entreprise"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  /**
   * Rendu du bouton "Créer entreprise"
   */
  const CreateCompanyCard: React.FC = () => (
    <div
      className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors cursor-pointer p-6 flex flex-col items-center justify-center min-h-[120px]"
      onClick={() => setShowCreateModal(true)}
    >
      <Plus className="w-8 h-8 text-gray-400 mb-2" />
      <span className="text-gray-600 font-medium">Créer une entreprise</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* En-tête avec bouton de déconnexion */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mes Entreprises</h1>
            <p className="text-gray-600 mt-2">
              Gérez vos entreprises et accédez à leurs tableaux de bord
            </p>
          </div>

          {/* Bouton de déconnexion */}
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 whitespace-nowrap"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>Se déconnecter</span>
          </button>
        </div>

        {/* Grille des entreprises */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Cartes des entreprises existantes */}
          {userCompanies.map((company) => (
            <div
              key={company.companyId}
              onClick={() => handleCompanySelect(company.companyId)}
              className={`relative cursor-pointer transition-all duration-200 hover:scale-105 ${selectedCompanyId === company.companyId ? 'opacity-50 pointer-events-none' : ''
                }`}
            >
              <CompanyCard company={company} />

              {/* Loading overlay */}
              {selectedCompanyId === company.companyId && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="animate-pulse bg-gray-100 w-32 h-4 rounded" />
                    <div className="animate-pulse bg-gray-100 w-20 h-3 rounded" />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Bouton créer entreprise */}
          <CreateCompanyCard />
        </div>

        {/* Message si aucune entreprise */}
        {userCompanies.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucune entreprise trouvée
            </h3>
            <p className="text-gray-600 mb-6">
              Créez votre première entreprise pour commencer
            </p>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Créer ma première entreprise
            </Button>
          </div>
        )}
      </div>

      {/* Modal de création d'entreprise */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Créer une entreprise"
        size="lg"
      >
        <CompanyForm
          onSuccess={handleCreateSuccess}
          onCancel={() => setShowCreateModal(false)}
          isModal={true}
        />
      </Modal>

      {/* Modal de confirmation de suppression */}
      <Modal
        isOpen={!!companyToDelete}
        onClose={() => setCompanyToDelete(null)}
        title="Supprimer l'entreprise"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Êtes-vous sûr de vouloir supprimer cette entreprise ? Cette action est irréversible.
          </p>

          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setCompanyToDelete(null)}
            >
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteCompany}
              isLoading={isDeleting}
            >
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CompaniesManagement;

