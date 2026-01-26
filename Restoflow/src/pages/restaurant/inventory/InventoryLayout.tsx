import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Package, Tag, Boxes } from 'lucide-react';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { useLanguage } from '../../../contexts/LanguageContext';
import { t } from '../../../utils/i18n';

const InventoryLayout = () => {
  const { language } = useLanguage();
  const location = useLocation();

  const tabs = [
    {
      name: t('ingredients', language),
      path: '/inventory/ingredients',
      icon: <Package size={18} />,
    },
    {
      name: t('inventory_categories', language),
      path: '/inventory/categories',
      icon: <Tag size={18} />,
    },
    {
      name: t('stock_levels', language),
      path: '/inventory/stocks',
      icon: <Boxes size={18} />,
    },
  ];

  return (
    <DashboardLayout title={t('inventory', language)}>
      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => {
              const isActive = location.pathname === tab.path ||
                (tab.path === '/inventory/ingredients' && location.pathname === '/inventory');

              return (
                <NavLink
                  key={tab.path}
                  to={tab.path}
                  className={`
                    group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                    ${isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <span className={`mr-2 ${isActive ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500'}`}>
                    {tab.icon}
                  </span>
                  {tab.name}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Page Content */}
      <Outlet />
    </DashboardLayout>
  );
};

export default InventoryLayout;
