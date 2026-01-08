import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { createCompany, deleteCompany } from '@services/firestore/companies/companyService';
import { getUserById } from '@services/utilities/userService';
import { getCompanyById } from '@services/firestore/companies/companyPublic';
import { Plus, Building2, Trash2, User, LogOut } from 'lucide-react';
import { Button, Modal, Input, Textarea } from '@components/common';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const { user, userCompanies, selectCompany, signOut } = useAuth();
  const navigate = useNavigate();
  
  // États pour la création d'entreprise
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    name: '',
    description: '',
    phone: '',
    email: '',
    report_mail: '',
    report_time: '8',
    location: '',
    logo: ''
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

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
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      
      // Créer un aperçu de l'image
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  /**
   * Convertir le fichier en base64
   */
  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Extraire seulement la partie base64 (après la virgule)
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  /**
   * Gérer la création d'une nouvelle entreprise
   */
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.uid) {
      showErrorToast('Utilisateur non connecté');
      return;
    }

    // Validation
    if (!companyForm.name.trim()) {
      showErrorToast('Le nom de l\'entreprise est requis');
      return;
    }
    if (!companyForm.phone.trim()) {
      showErrorToast('Le téléphone est requis');
      return;
    }
    if (!companyForm.email.trim()) {
      showErrorToast('L\'email est requis');
      return;
    }
    if (!companyForm.report_mail.trim()) {
      showErrorToast('L\'email de rapport est requis');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyForm.report_mail)) {
      showErrorToast('Format d\'email de rapport invalide');
      return;
    }

    try {
      setIsCreating(true);
      
      // Handle report_time: default to 8 if empty, show warning
      let reportTime = 8;
      if (companyForm.report_time && companyForm.report_time.trim() !== '') {
        const parsedTime = parseInt(companyForm.report_time);
        if (!isNaN(parsedTime) && parsedTime >= 0 && parsedTime <= 23) {
          reportTime = parsedTime;
        }
      } else {
        showWarningToast(t('settings.messages.reportTimeDefault'));
      }
      
      // Convertir le logo en base64 si un fichier est sélectionné
      let logoBase64: string | undefined;
      if (logoFile) {
        logoBase64 = await convertFileToBase64(logoFile);
      }
      
      await createCompany(user.uid, {
        name: companyForm.name.trim(),
        description: companyForm.description.trim() || undefined,
        phone: companyForm.phone.trim(),
        email: companyForm.email.trim(),
        report_mail: companyForm.report_mail.trim(),
        report_time: reportTime,
        location: companyForm.location.trim() || undefined,
        logo: logoBase64 || companyForm.logo.trim() || undefined
      });

      showSuccessToast('Entreprise créée avec succès');
      setShowCreateModal(false);
      setCompanyForm({
        name: '',
        description: '',
        phone: '',
        email: '',
        report_mail: '',
        report_time: '8',
        location: '',
        logo: ''
      });
      setLogoFile(null);
      setLogoPreview(null);
      
    } catch (error: any) {
      console.error('❌ Erreur lors de la création de l\'entreprise:', error);
      
      // Vérifier si c'est une erreur spécifique à report_mail
      if (error.message && error.message.includes('report_mail')) {
        showWarningToast('Email de rapport non sauvegardé (les autres modifications sont OK)');
      } else {
        showErrorToast(error.message || 'Erreur lors de la création de l\'entreprise');
      }
    } finally {
      setIsCreating(false);
    }
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
            const fullName = `${user.firstname || ''} ${user.lastname || ''}`.trim();
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
              const fullName = `${ownerUser.firstname || ''} ${ownerUser.lastname || ''}`.trim();
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
    const ownerDisplayName = ownerInfo 
      ? (ownerInfo.name || ownerInfo.email || 'Propriétaire')
      : 'Propriétaire';

    return (
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer p-6 border border-gray-200 group">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4 flex-1">
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
            
            {/* Rôle de l'utilisateur */}
            <div className="flex items-center mt-2">
              <User className="w-4 h-4 text-gray-400 mr-1" />
              <span className="text-sm text-gray-500">
                {company.role === 'owner' ? ownerDisplayName : 
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
            className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
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
              className={`relative cursor-pointer transition-all duration-200 hover:scale-105 ${
                selectedCompanyId === company.companyId ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <CompanyCard company={company} />
              
              {/* Loading overlay */}
              {selectedCompanyId === company.companyId && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                    <span className="text-sm text-gray-600 font-medium">Chargement...</span>
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
        <form onSubmit={handleCreateCompany}>
          <div className="space-y-4">
            <Input
              label="Nom de l'entreprise *"
              value={companyForm.name}
              onChange={(e) => setCompanyForm({...companyForm, name: e.target.value})}
              required
              placeholder="Mon Entreprise"
            />

            <Textarea
              label="Description"
              value={companyForm.description}
              onChange={(e) => setCompanyForm({...companyForm, description: e.target.value})}
              rows={3}
              placeholder="Description de l'entreprise..."
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone *
                </label>
                <div className="flex rounded-md shadow-sm">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                    +237
                  </span>
                  <Input
                    type="tel"
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm({...companyForm, phone: e.target.value})}
                    placeholder="678904568"
                    className="flex-1 rounded-l-none"
                    required
                  />
                </div>
              </div>

              <Input
                label="Email *"
                type="email"
                value={companyForm.email}
                onChange={(e) => setCompanyForm({...companyForm, email: e.target.value})}
                placeholder="contact@entreprise.com"
                required
              />
            </div>

            <Input
              label="Email pour les rapports de vente *"
              type="email"
              value={companyForm.report_mail}
              onChange={(e) => setCompanyForm({...companyForm, report_mail: e.target.value})}
              onBlur={() => {
                if (companyForm.report_mail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyForm.report_mail)) {
                  showErrorToast('Format d\'email de rapport invalide');
                }
              }}
              placeholder="rapports@entreprise.com"
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('settings.account.reportTime')}
              </label>
              <div className="flex rounded-md shadow-sm">
                <input
                  type="number"
                  name="report_time"
                  min="0"
                  max="23"
                  value={companyForm.report_time}
                  onChange={(e) => setCompanyForm({...companyForm, report_time: e.target.value})}
                  className="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-md border border-gray-300 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  placeholder="8"
                />
                <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                  h
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {t('settings.account.reportTimeHelp')}
              </p>
            </div>

            <Input
              label="Localisation"
              value={companyForm.location}
              onChange={(e) => setCompanyForm({...companyForm, location: e.target.value})}
              placeholder="Paris, France"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Logo de l'entreprise
              </label>
              <div className="mt-1 flex items-center space-x-4">
                <div className="flex-shrink-0">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-16 w-16 object-cover rounded-lg border border-gray-300"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-gray-300 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Ou entrez une URL d'image
                  </p>
                  <Input
                    value={companyForm.logo}
                    onChange={(e) => setCompanyForm({...companyForm, logo: e.target.value})}
                    placeholder="https://example.com/logo.png"
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateModal(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              isLoading={isCreating}
            >
              {isCreating ? 'Création...' : 'Créer l\'entreprise'}
            </Button>
          </div>
        </form>
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

