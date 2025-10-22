import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createCompany } from '../../services/companyService';
import { PlusIcon, BuildingOfficeIcon, UserIcon } from '@heroicons/react/24/outline';

interface CompanySelectorProps {
  onCompanySelected?: (companyId: string) => void;
}

/**
 * Dashboard type Netflix pour la sélection d'entreprises
 * 
 * Affiche toutes les entreprises de l'utilisateur sous forme de cartes
 * avec un bouton + pour créer une nouvelle entreprise
 */
export const CompanySelector: React.FC<CompanySelectorProps> = ({ onCompanySelected }) => {
  const { userCompanies, selectCompany, user } = useAuth();
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Données du formulaire de création d'entreprise
  const [companyForm, setCompanyForm] = useState({
    name: '',
    description: '',
    phone: '',
    email: '',
    location: '',
    logo: ''
  });

  /**
   * Gérer la sélection d'une entreprise
   */
  const handleCompanySelect = async (companyId: string) => {
    try {
      await selectCompany(companyId);
      onCompanySelected?.(companyId);
    } catch (error) {
      console.error('❌ Erreur lors de la sélection de l\'entreprise:', error);
    }
  };

  /**
   * Gérer la création d'une nouvelle entreprise
   */
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.uid) {
      console.error('❌ Utilisateur non connecté');
      return;
    }

    try {
      setIsCreatingCompany(true);
      
      await createCompany(user.uid, {
        name: companyForm.name,
        description: companyForm.description,
        phone: companyForm.phone,
        email: companyForm.email,
        location: companyForm.location,
        logo: companyForm.logo
      });

      console.log('✅ Entreprise créée avec succès');
      setShowCreateForm(false);
      setCompanyForm({
        name: '',
        description: '',
        phone: '',
        email: '',
        location: '',
        logo: ''
      });
      
    } catch (error) {
      console.error('❌ Erreur lors de la création de l\'entreprise:', error);
    } finally {
      setIsCreatingCompany(false);
    }
  };

  /**
   * Rendu d'une carte d'entreprise
   */
  const CompanyCard: React.FC<{ company: any }> = ({ company }) => (
    <div 
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer p-6 border border-gray-200"
      onClick={() => handleCompanySelect(company.companyId)}
    >
      <div className="flex items-center space-x-4">
        {/* Logo ou icône par défaut */}
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
          {company.logo ? (
            <img 
              src={company.logo} 
              alt={company.name}
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <BuildingOfficeIcon className="w-8 h-8 text-white" />
          )}
        </div>
        
        {/* Informations de l'entreprise */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{company.name}</h3>
          {company.description && (
            <p className="text-sm text-gray-600 mt-1">{company.description}</p>
          )}
          
          {/* Rôle de l'utilisateur */}
          <div className="flex items-center mt-2">
            <UserIcon className="w-4 h-4 text-gray-400 mr-1" />
            <span className="text-sm text-gray-500 capitalize">
              {company.role === 'owner' ? 'Propriétaire' : 
               company.role === 'admin' ? 'Administrateur' :
               company.role === 'manager' ? 'Gestionnaire' : 'Employé'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  /**
   * Rendu du bouton "Créer entreprise"
   */
  const CreateCompanyCard: React.FC = () => (
    <div 
      className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors cursor-pointer p-6 flex flex-col items-center justify-center min-h-[120px]"
      onClick={() => setShowCreateForm(true)}
    >
      <PlusIcon className="w-8 h-8 text-gray-400 mb-2" />
      <span className="text-gray-600 font-medium">Créer une entreprise</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Mes Entreprises</h1>
          <p className="text-gray-600 mt-2">
            Sélectionnez une entreprise pour commencer à travailler
          </p>
        </div>

        {/* Grille des entreprises */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Cartes des entreprises existantes */}
          {userCompanies.map((company) => (
            <CompanyCard key={company.companyId} company={company} />
          ))}
          
          {/* Bouton créer entreprise */}
          <CreateCompanyCard />
        </div>

        {/* Message si aucune entreprise */}
        {userCompanies.length === 0 && (
          <div className="text-center py-12">
            <BuildingOfficeIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucune entreprise trouvée
            </h3>
            <p className="text-gray-600 mb-6">
              Créez votre première entreprise pour commencer
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Créer ma première entreprise
            </button>
          </div>
        )}
      </div>

      {/* Modal de création d'entreprise */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-4">Créer une entreprise</h2>
            
            <form onSubmit={handleCreateCompany}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom de l'entreprise *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({...companyForm, name: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Mon Entreprise"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={companyForm.description}
                    onChange={(e) => setCompanyForm({...companyForm, description: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Description de l'entreprise..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Téléphone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={companyForm.phone}
                      onChange={(e) => setCompanyForm({...companyForm, phone: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+33 1 23 45 67 89"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={companyForm.email}
                      onChange={(e) => setCompanyForm({...companyForm, email: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="contact@entreprise.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Localisation
                  </label>
                  <input
                    type="text"
                    value={companyForm.location}
                    onChange={(e) => setCompanyForm({...companyForm, location: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Paris, France"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCompany}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isCreatingCompany ? 'Création...' : 'Créer l\'entreprise'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanySelector;
