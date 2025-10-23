import { useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, DollarSign, Package2, FileBarChart, Settings, X, Receipt, Users, Building2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import UserAvatar from '../common/UserAvatar';
import DownloadAppButton from '../common/DownloadAppButton';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  onClose: () => void;
}

const Sidebar = ({ onClose }: SidebarProps) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { company, effectiveRole, isOwner, currentEmployee } = useAuth();

  
  const isActive = (path: string) => {
    return location.pathname === path;
  };
  
  // Vérifier si on est dans une route d'entreprise
  const isCompanyRoute = location.pathname.startsWith('/company/');
  
  const navigationItems = [
    // Bouton retour aux entreprises (seulement dans les routes d'entreprise)
    ...(isCompanyRoute ? [
      { name: 'Mes Entreprises', path: '/employee/dashboard', icon: <Building2 size={20} />, allowedRoles: ['vendeur', 'gestionnaire', 'magasinier', 'owner'] }
    ] : []),
    { name: t('navigation.dashboard'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/dashboard` : '/', icon: <LayoutDashboard size={20} />, allowedRoles: ['vendeur', 'gestionnaire', 'magasinier', 'owner'] },
    { name: t('navigation.sales'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/sales` : '/sales', icon: <ShoppingCart size={20} />, allowedRoles: ['vendeur', 'gestionnaire', 'magasinier', 'owner'] },
    { name: 'Expenses', path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/expenses` : '/expenses', icon: <Receipt size={20} />, allowedRoles: ['vendeur', 'gestionnaire', 'magasinier', 'owner'] },
    { name: 'Finance', path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/finance` : '/finance', icon: <DollarSign size={20} />, allowedRoles: ['gestionnaire', 'magasinier', 'owner'] },
    { name: t('navigation.products'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/products` : '/products', icon: <Package2 size={20} />, allowedRoles: ['vendeur', 'gestionnaire', 'magasinier', 'owner'] },
    { name: t('navigation.suppliers'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/suppliers` : '/suppliers', icon: <Users size={20} />, allowedRoles: ['vendeur', 'gestionnaire', 'magasinier', 'owner'] },
    { name: t('navigation.reports'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/reports` : '/reports', icon: <FileBarChart size={20} />, allowedRoles: ['gestionnaire', 'magasinier', 'owner'] },
    { name: t('navigation.settings'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/settings` : '/settings', icon: <Settings size={20} />, allowedRoles: ['magasinier', 'owner'] },
  ];

  return (
    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
      {/* Sidebar header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        <Link to="/" className="flex items-center">
          <span className="font-bold text-xl text-emerald-600">Le Bon Prix</span>
        </Link>
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
        <ul className="space-y-1 px-2">
          {navigationItems.map((item) => {
            // Vérifier si l'utilisateur a accès à cet élément
            const hasAccess = isOwner || (effectiveRole && item.allowedRoles.includes(effectiveRole));
            
            if (!hasAccess) return null;
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={onClose}
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
                <p className="text-sm font-medium text-gray-700 truncate">
                  {company?.name || t('header.welcome')}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {company?.email || t('header.welcome')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;