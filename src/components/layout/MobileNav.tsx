import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, DollarSign, Package2, FileBarChart, Home, BarChart2, Receipt, Settings, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MobileNav = () => {
  const { t } = useTranslation();
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navigationItems = [
    { name: t('navigation.dashboard'), path: '/', icon: <LayoutDashboard size={20} /> },
    { name: t('navigation.sales'), path: '/sales', icon: <ShoppingCart size={20} /> },
    { name: t('navigation.expenses'), path: '/expenses', icon: <Receipt size={20} /> },
    { name: t('navigation.products'), path: '/products', icon: <Package2 size={20} /> },
    { name: t('navigation.suppliers'), path: '/suppliers', icon: <Users size={20} /> },
    { name: t('navigation.reports'), path: '/reports', icon: <FileBarChart size={20} /> },
    { name: t('navigation.finance'), path: '/finance', icon: <DollarSign size={20} /> },
    { name: t('navigation.settings'), path: '/settings', icon: <Settings size={20} /> },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden">
      <nav className="flex justify-around overflow-x-auto">
        {navigationItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`
              flex flex-col items-center py-2 px-3 text-xs 
              ${isActive(item.path) 
                ? 'text-emerald-600' 
                : 'text-gray-600 hover:text-gray-900'}
            `}
          >
            {item.icon}
            <span className="mt-1">{item.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default MobileNav;