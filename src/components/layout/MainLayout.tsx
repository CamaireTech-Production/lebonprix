import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { FloatingActionButton } from '../common/Button';
import AddSaleModal from '../sales/AddSaleModal';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface MainLayoutProps {
  isAddSaleModalOpen: boolean;
  setIsAddSaleModalOpen: (open: boolean) => void;
}

const MainLayout = ({ isAddSaleModalOpen, setIsAddSaleModalOpen }: MainLayoutProps) => {
  // ✅ TOUS LES HOOKS EN PREMIER - AUCUN RETURN CONDITIONNEL AVANT
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoadingCompany, setIsLoadingCompany] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const location = useLocation();
  const { selectCompany } = useAuth();

  // Vérifier qu'une entreprise est sélectionnée pour les routes /company/:companyId/*
  const isCompanyRoute = location.pathname.startsWith('/company/');
  const isCatalogueRoute = location.pathname.startsWith('/catalogue/');
  
  // Extraire l'ID de la company depuis l'URL selon le type de route
  let urlCompanyId: string | null = null;
  const pathSegments = location.pathname.split('/');
  
  console.log('🔍 URL complète:', location.pathname);
  console.log('🔍 Segments URL:', pathSegments);
  console.log('🔍 isCompanyRoute:', isCompanyRoute);
  console.log('🔍 isCatalogueRoute:', isCatalogueRoute);
  
  if (isCompanyRoute) {
    urlCompanyId = pathSegments[2]; // /company/{id}/...
    console.log('🔍 Company route - ID extrait:', urlCompanyId);
  } else if (isCatalogueRoute) {
    urlCompanyId = pathSegments[3]; // /catalogue/{name}/{id}
    console.log('🔍 Catalogue route - ID extrait:', urlCompanyId);
    console.log('🔍 Nom de l\'entreprise:', pathSegments[2]);
  }

  // ✅ TOUS LES useEffect EN PREMIER
  useEffect(() => {
    if ((isCompanyRoute || isCatalogueRoute) && urlCompanyId) {
      // ✅ TOUJOURS charger les données de l'entreprise, même si selectedCompanyId correspond
      // Cela garantit que les données sont toujours à jour après redirection
      console.log('🔄 Chargement company pour route:', location.pathname, 'ID:', urlCompanyId);
      loadCompanyFromUrl(urlCompanyId);
    }
  }, [isCompanyRoute, isCatalogueRoute, urlCompanyId]); // Supprimer selectedCompanyId des dépendances

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    checkMobile();

    // Add resize listener
    window.addEventListener('resize', checkMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('sidebar');
      const toggleButton = document.getElementById('sidebar-toggle');
      
      if (
        sidebarOpen &&
        sidebar && 
        !sidebar.contains(event.target as Node) &&
        toggleButton &&
        !toggleButton.contains(event.target as Node)
      ) {
        setSidebarOpen(false);
      }
    };

    if (isMobile) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sidebarOpen, isMobile]);

  const loadCompanyFromUrl = async (companyId: string) => {
    // ✅ Optimisation : éviter les chargements inutiles si déjà en cours
    if (isLoadingCompany) {
      console.log('⏳ Chargement déjà en cours, ignoré');
      return;
    }

    setIsLoadingCompany(true);
    setCompanyError(null); // Reset error state
    try {
      console.log('🔍 URL complète:', location.pathname);
      console.log('🔍 CompanyId extrait:', companyId);
      console.log('🔍 Type de route:', isCompanyRoute ? 'company' : isCatalogueRoute ? 'catalogue' : 'autre');
      console.log('🔄 Chargement de la company depuis l\'URL:', companyId);
      
      // Vérifier que l'ID n'est pas vide ou undefined
      if (!companyId || companyId.trim() === '') {
        throw new Error('ID de company vide ou invalide');
      }
      
      console.log('🔍 Tentative de récupération du document Firestore...');
      const companyDoc = await getDoc(doc(db, 'companies', companyId));
      
      console.log('🔍 Document existe:', companyDoc.exists());
      console.log('🔍 Document ID:', companyDoc.id);
      
      if (companyDoc.exists()) {
        const companyData = { id: companyDoc.id, ...companyDoc.data() } as any;
        console.log('✅ Company chargée:', companyData.name);
        console.log('✅ Données company:', companyData);
        
        // ✅ Toujours sélectionner la company pour synchroniser les données
        console.log('🔄 Sélection de la company...');
        await selectCompany(companyId);
        setCompanyError(null); // Clear any previous errors
        
        console.log('✅ Company sélectionnée et données synchronisées');
      } else {
        console.error('❌ Company non trouvée dans Firestore:', companyId);
        console.error('❌ Vérifiez que l\'ID de la company est correct dans l\'URL');
        console.error('❌ Vérifiez que l\'entreprise existe dans la base de données');
        setCompanyError(`L'entreprise avec l'ID "${companyId}" n'a pas été trouvée. Vérifiez que le lien est correct.`);
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement de la company:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('❌ Détails de l\'erreur:', errorMessage);
      setCompanyError(`Erreur lors du chargement de l'entreprise: ${errorMessage}`);
    } finally {
      setIsLoadingCompany(false);
    }
  };
  
  // ✅ MAINTENANT LES RETURNS CONDITIONNELS APRÈS TOUS LES HOOKS
  // Afficher un loader pendant le chargement de la company
  if ((isCompanyRoute || isCatalogueRoute) && isLoadingCompany) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de l'entreprise...</p>
        </div>
      </div>
    );
  }

  // Afficher une erreur si la company n'a pas pu être chargée
  if ((isCompanyRoute || isCatalogueRoute) && companyError) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Entreprise non trouvée
          </h2>
          <p className="text-gray-600 mb-6">
            {companyError}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.href = '/company/create'}
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Créer une nouvelle entreprise
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-grow flex overflow-hidden relative">
        {/* Sidebar for larger screens */}
        <div 
          id="sidebar"
          className={`
            fixed inset-y-0 left-0 z-50
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            md:relative md:translate-x-0 md:z-0
          `}
        >
          <div className="h-full w-64 bg-white shadow-lg">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
        
        {/* Backdrop for mobile */}
        {sidebarOpen && isMobile && (
          <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Main content */}
        <main className="flex-1 overflow-auto bg-gray-50 p-4 md:p-6 lg:p-8 pb-20 md:pb-8">
          <Outlet />
        </main>
      </div>
      
      {/* Mobile navigation */}
      {isMobile && <MobileNav />}
      
      {/* Floating Action Button - show on all dashboard pages except catalogue */}
      {!location.pathname.startsWith('/catalogue') && (
        <FloatingActionButton onClick={() => setIsAddSaleModalOpen(true)} label="Add Sale" />
      )}
      
      {/* Add Sale Modal */}
      <AddSaleModal isOpen={isAddSaleModalOpen} onClose={() => setIsAddSaleModalOpen(false)} />
    </div>
  );
};

export default MainLayout;