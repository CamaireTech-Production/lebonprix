import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { useLanguage } from '../../../contexts/LanguageContext';
import { t } from '../../../utils/i18n';
import { Users, Shield } from 'lucide-react';

const StaffLayout = () => {
  const { language } = useLanguage();
  const location = useLocation();

  const tabs = [
    {
      name: t('team', language),
      path: '/staff',
      icon: <Users size={18} />,
    },
    {
      name: t('permissions', language),
      path: '/staff/permissions',
      icon: <Shield size={18} />,
    },
  ];

  return (
    <DashboardLayout title={t('staff_management', language)}>
      <div className="pb-20 md:pb-6">
        {/* Header with description */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">{t('staff_management', language)}</h1>
          <p className="text-gray-600">{t('manage_staff_and_permissions', language)}</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const isActive = location.pathname === tab.path;
              return (
                <NavLink
                  key={tab.path}
                  to={tab.path}
                  className={`
                    group inline-flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm
                    transition-colors duration-200
                    ${
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <span className={isActive ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500'}>
                    {tab.icon}
                  </span>
                  {tab.name}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <Outlet />
      </div>
    </DashboardLayout>
  );
};

export default StaffLayout;
