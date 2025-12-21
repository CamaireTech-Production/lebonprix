import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, DollarSign, Package2, FileBarChart, Receipt, Settings, Users, ShoppingBag, Loader2, Phone, ScanLine, Warehouse, Building2, UserCheck} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useRolePermissions } from '../../hooks/business/useRolePermissions';
import { RESOURCES } from '../../constants/resources';

const MobileNav = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { effectiveRole, isOwner } = useAuth();
  const { canAccess, canAccessFinance, canAccessHR, canAccessSettings, templateLoading } = useRolePermissions();
  
  // Vérifier si on est dans une route d'entreprise
  const isCompanyRoute = location.pathname.startsWith('/company/');
  
  // Vérifier si on est sur le dashboard employé (ne pas afficher la navigation)
  const isEmployeeDashboard = location.pathname.startsWith('/employee/');
  
  // Extraire le companyId depuis l'URL si on est dans une route d'entreprise
  const companyId = isCompanyRoute ? location.pathname.split('/')[2] : null;
  
  // Ne pas afficher la navigation sur le dashboard employé ou si on n'a pas de companyId valide
  if (isEmployeeDashboard || (isCompanyRoute && !companyId)) {
    return null;
  }
  
  // Vérifier si on doit afficher le loader pour le template
  const isActualOwner = isOwner || effectiveRole === 'owner';
  const showTemplateLoader = !isActualOwner && templateLoading;
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  // Navigation items matching the Sidebar main menu items (excluding subItems)
  const navigationItems = [
    // Mes Entreprises (only in company route)
    ...(isCompanyRoute ? [
      { 
        name: 'Mes Entreprises', 
        path: '/companies', 
        icon: <Building2 size={20} />, 
        resource: 'dashboard' 
      }
    ] : []),
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
      name: 'POS', 
      path: isCompanyRoute ? `/company/${companyId}/pos` : '/pos', 
      icon: <ScanLine size={20} />, 
      resource: 'sales' 
    },
    { 
      name: 'Orders', 
      path: isCompanyRoute ? `/company/${companyId}/orders` : '/orders', 
      icon: <ShoppingBag size={20} />, 
      resource: 'orders' 
    },
    { 
      name: 'Expenses', 
      path: isCompanyRoute ? `/company/${companyId}/expenses` : '/expenses', 
      icon: <Receipt size={20} />, 
      resource: 'expenses' 
    },
    { 
      name: 'Finance', 
      path: isCompanyRoute ? `/company/${companyId}/finance` : '/finance', 
      icon: <DollarSign size={20} />, 
      resource: 'finance' 
    },
    { 
      name: t('navigation.products'), 
      path: isCompanyRoute ? `/company/${companyId}/products` : '/products', 
      icon: <Package2 size={20} />, 
      resource: 'products' 
    },
    { 
      name: 'Magasin', 
      path: isCompanyRoute ? `/company/${companyId}/magasin` : '/magasin', 
      icon: <Warehouse size={20} />, 
      resource: RESOURCES.MAGASIN 
    },
    { 
      name: t('navigation.suppliers'), 
      path: isCompanyRoute ? `/company/${companyId}/suppliers` : '/suppliers', 
      icon: <Users size={20} />, 
      resource: 'suppliers' 
    },
    { 
      name: 'Contacts', 
      path: isCompanyRoute ? `/company/${companyId}/contacts` : '/contacts', 
      icon: <Phone size={20} />, 
      resource: 'customers' 
    },
    { 
      name: 'HR Management', 
      path: isCompanyRoute ? `/company/${companyId}/hr` : '/hr', 
      icon: <UserCheck size={20} />, 
      resource: 'hr' 
    },
    { 
      name: t('navigation.reports'), 
      path: isCompanyRoute ? `/company/${companyId}/reports` : '/reports', 
      icon: <FileBarChart size={20} />, 
      resource: 'reports' 
    },
    { 
      name: t('navigation.settings'), 
      path: isCompanyRoute ? `/company/${companyId}/settings` : '/settings', 
      icon: <Settings size={20} />, 
      resource: 'settings' 
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden pb-safe mb-4">
      <nav className="flex overflow-x-auto scrollbar-hide">
        {showTemplateLoader ? (
          <div className="flex items-center justify-center w-full py-4">
            <Loader2 className="h-6 w-6 text-emerald-500 animate-spin mr-2" />
            <span className="text-sm text-gray-500">Chargement des permissions...</span>
          </div>
        ) : (
          navigationItems.map((item) => {
            // Vérifier si l'utilisateur a accès à cet élément
            let hasAccess = true;
            
            // Les propriétaires ont accès à tout
            if (!isActualOwner) {
            const resource = (item as any).resource;
            
            if (resource) {
              // Toutes les ressources utilisent maintenant canAccess (unifié avec canView array)
              hasAccess = canAccess(resource);
            } else {
              // If no resource specified, deny access by default for non-owners
              hasAccess = false;
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
        })
        )}
      </nav>
    </div>
  );
};

export default MobileNav;