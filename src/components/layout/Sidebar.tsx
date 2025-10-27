import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, DollarSign, Package2, FileBarChart, Settings, X, Receipt, Users, Building2, Plus, Grid3X3, ShoppingBag} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import UserAvatar from '../common/UserAvatar';
import DownloadAppButton from '../common/DownloadAppButton';
import { useTranslation } from 'react-i18next';
import CreateCompanyModal from '../modals/CreateCompanyModal';

interface SidebarProps {
  onClose: () => void;
  lockedTab?: boolean;
  isSelectionMode?: boolean; // true si on est sur /companies/me/:userId
}

const Sidebar = ({ onClose, isSelectionMode }: SidebarProps) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { company, effectiveRole, isOwner, currentEmployee } = useAuth();
  const [showCreateCompanyModal, setShowCreateCompanyModal] = React.useState(false);

  
  // Get dashboard colors
  const getDashboardColors = () => {
    const colors = {
      primary: company?.dashboardColors?.primary || company?.primaryColor || '#183524',
      secondary: company?.dashboardColors?.secondary || company?.secondaryColor || '#e2b069',
      tertiary: company?.dashboardColors?.tertiary || company?.tertiaryColor || '#2a4a3a'
    };
    return colors;
  };
  
  const colors = getDashboardColors();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const handleCreateCompany = () => {
    window.location.href = '/company/create';
  };


  const handleNavigationClick = (event: React.MouseEvent) => {
    if (isSelectionMode) {
      event.preventDefault();
      setShowCreateCompanyModal(true);
    }
    // Sinon, la navigation normale se fait via le Link
  };
  
  // Vérifier si on est dans une route d'entreprise
  const isCompanyRoute = location.pathname.startsWith('/company/');
  
  // Vérifier si on est en mode sélection
  const isCompanySelectionRoute = location.pathname.startsWith('/companies/me/');
  
  // Navigation items pour le mode sélection - TOUS ACTIVÉS
  const selectionModeItems = [
    { name: 'Companies (op)', path: location.pathname, icon: <Building2 size={20} />, alwaysEnabled: true, disabled: false },
    { name: t('navigation.dashboard'), path: '/dashboard', icon: <LayoutDashboard size={20} />, disabled: false },
    { name: t('navigation.sales'), path: '/sales', icon: <ShoppingCart size={20} />, disabled: false },
    { name: 'Orders', path: '/orders', icon: <ShoppingBag size={20} />, disabled: false },
    { name: 'Expenses', path: '/expenses', icon: <Receipt size={20} />, disabled: false },
    { name: 'Finance', path: '/finance', icon: <DollarSign size={20} />, disabled: false },
    { name: t('navigation.products'), path: '/products', icon: <Package2 size={20} />, disabled: false },
    { name: 'Categories', path: '/categories', icon: <Grid3X3 size={20} />, disabled: false },
    { name: t('navigation.suppliers'), path: '/suppliers', icon: <Users size={20} />, disabled: false },
    { name: t('navigation.reports'), path: '/reports', icon: <FileBarChart size={20} />, disabled: false },
    { name: t('navigation.settings'), path: '/settings', icon: <Settings size={20} />, disabled: false },
  ];

  // Navigation items normaux
  const normalNavigationItems = [
    // Bouton retour aux entreprises (seulement dans les routes d'entreprise)
    ...(isCompanyRoute ? [
      { name: 'Mes Entreprises', path: '/employee/dashboard', icon: <Building2 size={20} />, allowedRoles: ['vendeur', 'gestionnaire', 'magasinier', 'owner'] }
    ] : []),
    { name: t('navigation.dashboard'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/dashboard` : '/', icon: <LayoutDashboard size={20} />, allowedRoles: ['vendeur', 'gestionnaire', 'magasinier', 'owner'] },
    { name: t('navigation.sales'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/sales` : '/sales', icon: <ShoppingCart size={20} />, allowedRoles: ['vendeur', 'gestionnaire', 'magasinier', 'owner'] },
    { name: 'Orders', path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/orders` : '/orders', icon: <ShoppingBag size={20} />, allowedRoles: ['vendeur', 'gestionnaire', 'magasinier', 'owner'] },
    { name: 'Expenses', path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/expenses` : '/expenses', icon: <Receipt size={20} />, allowedRoles: ['vendeur', 'gestionnaire', 'magasinier', 'owner'] },
    { name: 'Finance', path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/finance` : '/finance', icon: <DollarSign size={20} />, allowedRoles: ['gestionnaire', 'magasinier', 'owner'] },
    { name: t('navigation.products'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/products` : '/products', icon: <Package2 size={20} />, allowedRoles: ['vendeur', 'gestionnaire', 'magasinier', 'owner'] },
    { name: 'Categories', path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/categories` : '/categories', icon: <Grid3X3 size={20} />, allowedRoles: ['vendeur', 'gestionnaire', 'magasinier', 'owner'] },
    { name: t('navigation.suppliers'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/suppliers` : '/suppliers', icon: <Users size={20} />, allowedRoles: ['vendeur', 'gestionnaire', 'magasinier', 'owner'] },
    { name: t('navigation.reports'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/reports` : '/reports', icon: <FileBarChart size={20} />, allowedRoles: ['gestionnaire', 'magasinier', 'owner'] },
    { name: t('navigation.settings'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/settings` : '/settings', icon: <Settings size={20} />, allowedRoles: ['magasinier', 'owner'] },
  ];

  const navigationItems = isCompanySelectionRoute ? selectionModeItems : normalNavigationItems;

  return (
    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
      {/* Sidebar header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        {isCompanySelectionRoute ? (
          // En mode sélection, afficher le bouton "Créer entreprise" à la place du logo
          <button
            onClick={() => window.location.href = '/company/create'}
            className="flex items-center px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="font-medium">Créer entreprise</span>
          </button>
        ) : (
          <Link to="/" className="flex items-center">
            <span className="font-bold text-xl" style={{color: colors.primary}}>Le Bon Prix</span>
          </Link>
        )}
        <button 
          className="md:hidden text-gray-500 hover:text-gray-700"
          onClick={onClose}
          aria-label={t('navigation.close')}
        >
          <X size={20} />
        </button>
      </div>
      
      {/* Navigation items */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2" id='select'>
          {navigationItems.map((item) => {
            // En mode sélection, tous les liens sont activés mais interceptés
            if (isCompanySelectionRoute) {
              return (
                <li key={item.name}>
                  <button
                    onClick={(e) => {
                      // Toujours intercepter en mode sélection
                      if (isSelectionMode) {
                        e.preventDefault();
                        setShowCreateCompanyModal(true);
                      }
                    }}
                    className={`
                      w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                      ${isActive(item.path)
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <span className="mr-3">{item.icon}</span>
                    {item.name}
                  </button>
                </li>
              );
            }

            // Mode normal - vérifier les permissions
            const hasAccess = isOwner || (effectiveRole && (item as any).allowedRoles?.includes(effectiveRole));
            
            if (!hasAccess) return null;
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={(e) => {
                    if (isSelectionMode) {
                      e.preventDefault();
                      handleNavigationClick(e);
                    } else {
                      onClose();
                    }
                  }}
                  className={`
                    flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                    ${isActive(item.path)
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}
                  `}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.name}
                </Link>
              </li>
            );
          })}
          
          
          {/* Download App Button */}
          <li className="px-2">
            <DownloadAppButton variant="sidebar" />
          </li>
        </ul>
      </nav>
      
      {/* User section */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center">
          <UserAvatar company={company} size="sm" />
          <div className="ml-3 flex-1 min-w-0">
            {currentEmployee && !isOwner ? (
              // Affichage pour les employés
              <div>
                <p className="text-sm font-medium text-gray-700 truncate">
                  Bonjour {currentEmployee.firstname}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {currentEmployee.role === 'staff' ? 'Vendeur' : 
                   currentEmployee.role === 'manager' ? 'Gestionnaire' : 
                   currentEmployee.role === 'admin' ? 'Magasinier' : currentEmployee.role}
                </p>
              </div>
            ) : (
              // Affichage pour les propriétaires (rien ne s'affiche)
              
              <div>
                {
                  !isSelectionMode ? (
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {company?.name || t('header.welcome')}
                    </p>
                  ) : <p className="text-sm font-medium text-gray-700 truncate">
                    veuillez creer une entreprise
                  </p>
                }
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Modal pour créer une entreprise */}
      <CreateCompanyModal
        isOpen={showCreateCompanyModal}
        onClose={() => setShowCreateCompanyModal(false)}
        onCreateCompany={handleCreateCompany}
      />
    </div>
  );
};

export default Sidebar;