import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, DollarSign, Package2, FileBarChart, Home, BarChart2, Receipt, Settings, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';

const MobileNav = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { effectiveRole, isOwner } = useAuth();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navigationItems = [
    { name: t('navigation.dashboard'), path: '/', icon: <LayoutDashboard size={20} />, allowedRoles: ['vendeur', 'gestionnaire', 'magasinier', 'owner'] },
    { name: t('navigation.sales'), path: '/sales', icon: <ShoppingCart size={20} />, allowedRoles: ['vendeur', 'gestionnaire', 'magasinier', 'owner'] },
    { name: t('navigation.expenses'), path: '/expenses', icon: <Receipt size={20} />, allowedRoles: ['vendeur', 'gestionnaire', 'magasinier', 'owner'] },
    { name: t('navigation.products'), path: '/products', icon: <Package2 size={20} />, allowedRoles: ['vendeur', 'gestionnaire', 'magasinier', 'owner'] },
    { name: t('navigation.suppliers'), path: '/suppliers', icon: <Users size={20} />, allowedRoles: ['vendeur', 'gestionnaire', 'magasinier', 'owner'] },
    { name: t('navigation.reports'), path: '/reports', icon: <FileBarChart size={20} />, allowedRoles: ['gestionnaire', 'magasinier', 'owner'] },
    { name: t('navigation.finance'), path: '/finance', icon: <DollarSign size={20} />, allowedRoles: ['gestionnaire', 'magasinier', 'owner'] },
    { name: t('navigation.settings'), path: '/settings', icon: <Settings size={20} />, allowedRoles: ['magasinier', 'owner'] },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden pb-safe">
      <nav className="flex overflow-x-auto scrollbar-hide">
        {navigationItems.map((item) => {
          // Vérifier si l'utilisateur a accès à cet élément
          const hasAccess = isOwner || (effectiveRole && item.allowedRoles.includes(effectiveRole));
          
          if (!hasAccess) return null;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex flex-col items-center py-3 px-3 text-xs flex-shrink-0 min-w-0
                ${isActive(item.path) 
                  ? 'text-emerald-600' 
                  : 'text-gray-600 hover:text-gray-900'}
              `}
            >
              {item.icon}
              <span className="mt-1 truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default MobileNav;