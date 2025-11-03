import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, DollarSign, Package2, FileBarChart, Receipt, Settings, Users, Grid3X3, ShoppingBag} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useRolePermissions } from '../../hooks/useRolePermissions';

const MobileNav = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { effectiveRole, isOwner } = useAuth();
  const { canAccess } = useRolePermissions();
  
  // Vérifier si on est dans une route d'entreprise
  const isCompanyRoute = location.pathname.startsWith('/company/');
  
  // Extraire le companyId depuis l'URL si on est dans une route d'entreprise
  const companyId = isCompanyRoute ? location.pathname.split('/')[2] : null;
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navigationItems = [
    { 
      name: t('navigation.dashboard'), 
      path: isCompanyRoute ? `/company/${companyId}/dashboard` : '/', 
      icon: <LayoutDashboard size={20} />, 
      resource: 'dashboard' 
    },
    { 
      name: t('navigation.sales'), 
      path: isCompanyRoute ? `/company/${companyId}/sales` : '/sales', 
      icon: <ShoppingCart size={20} />, 
      resource: 'sales' 
    },
    { 
      name: 'Orders', 
      path: isCompanyRoute ? `/company/${companyId}/orders` : '/orders', 
      icon: <ShoppingBag size={20} />, 
      resource: 'orders' 
    },
    { 
      name: t('navigation.expenses'), 
      path: isCompanyRoute ? `/company/${companyId}/expenses` : '/expenses', 
      icon: <Receipt size={20} />, 
      resource: 'expenses' 
    },
    { 
      name: t('navigation.products'), 
      path: isCompanyRoute ? `/company/${companyId}/products` : '/products', 
      icon: <Package2 size={20} />, 
      resource: 'products' 
    },
    { 
      name: 'Categories', 
      path: isCompanyRoute ? `/company/${companyId}/categories` : '/categories', 
      icon: <Grid3X3 size={20} />, 
      resource: 'categories' 
    },
    { 
      name: t('navigation.suppliers'), 
      path: isCompanyRoute ? `/company/${companyId}/suppliers` : '/suppliers', 
      icon: <Users size={20} />, 
      resource: 'suppliers' 
    },
    { 
      name: t('navigation.reports'), 
      path: isCompanyRoute ? `/company/${companyId}/reports` : '/reports', 
      icon: <FileBarChart size={20} />, 
      resource: 'reports' 
    },
    { 
      name: t('navigation.finance'), 
      path: isCompanyRoute ? `/company/${companyId}/finance` : '/finance', 
      icon: <DollarSign size={20} />, 
      resource: 'finance' 
    },
    { 
      name: t('navigation.settings'), 
      path: isCompanyRoute ? `/company/${companyId}/settings` : '/settings', 
      icon: <Settings size={20} />, 
      resource: 'settings' 
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden pb-safe">
      <nav className="flex overflow-x-auto scrollbar-hide">
        {navigationItems.map((item) => {
          // Vérifier si l'utilisateur a accès à cet élément
          let hasAccess = true;
          if (!isOwner) {
            if ((item as any).allowedRoles) {
              hasAccess = effectiveRole ? (item as any).allowedRoles.includes(effectiveRole) : false;
            } else if ((item as any).resource) {
              hasAccess = canAccess((item as any).resource);
            }
          }
          
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