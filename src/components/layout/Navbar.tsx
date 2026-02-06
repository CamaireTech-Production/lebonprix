import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Menu, Search, User, Settings, LogOut, ScanLine } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import UserAvatar from '../common/UserAvatar';
import LanguageSwitcher from '../common/LanguageSwitcher';
import { DownloadAppButton } from '../pwa';
import { PWAStatusIndicator } from '../pwa';
import { useTranslation } from 'react-i18next';
import { useRolePermissions } from '../../hooks/business/useRolePermissions';
import NotificationBell from '../notifications/NotificationBell';

interface NavbarProps {
  onMenuClick: () => void;
  isSelectionMode?: boolean;
}

const Navbar = ({ onMenuClick, isSelectionMode }: NavbarProps) => {
  const { t } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { company, signOut, isOwner, effectiveRole } = useAuth();
  const location = useLocation();
  const { companyId } = useParams<{ companyId: string }>();
  const { canAccess } = useRolePermissions(company?.id);

  // Check if user has access to POS (sales resource)
  const hasPOSAccess = isOwner || effectiveRole === 'owner' || canAccess('sales');

  // Check if we're on a company route
  const isCompanyRoute = location.pathname.startsWith('/company/') && companyId;

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      // The AuthContext will handle redirecting to login via onAuthStateChanged
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="h-16 px-4 lg:px-6 flex items-center justify-between">
        {/* Menu button (mobile) */}
        <button
          id="sidebar-toggle"
          className="md:hidden mr-3 text-gray-500 hover:text-gray-700 focus:outline-none"
          onClick={onMenuClick}
          aria-label={t('navigation.menu')}
        >
          <Menu size={24} />
        </button>

        {/* Logo (mobile only) */}
        <div className="md:hidden flex-1 flex justify-center">
          <span className="font-bold text-lg" style={{ color: colors.primary }}>Geskap</span>
        </div>

        {/* Search bar (hidden on mobile) */}
        <div className="hidden md:flex md:flex-1 md:max-w-sm lg:max-w-lg relative">
          <div className="w-full relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
              placeholder={t('header.search')}
            />
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center space-x-4">
          {/* POS Button - only show if user has access and on company route */}
          {hasPOSAccess && isCompanyRoute && !isSelectionMode && (
            <Link
              to={`/company/${companyId}/pos`}
              className="flex items-center space-x-2 px-3 py-2 rounded-md transition-colors bg-red-600 hover:bg-red-700 text-white font-medium"
              title={t('navigation.pos')}
            >
              <ScanLine size={18} />
              <span className="hidden sm:inline text-sm">{t('navigation.pos')}</span>
            </Link>
          )}

          <LanguageSwitcher />

          {/* PWA Status Indicator */}
          <PWAStatusIndicator variant="header" />

          {/* Download App Button */}
          <DownloadAppButton variant="header" showText={false} />

          {/* Notifications Bell */}
          {isCompanyRoute && !isSelectionMode && <NotificationBell />}

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center focus:outline-none"
              aria-label={t('header.profile')}
            >
              {isSelectionMode ? null : <UserAvatar company={company} size="sm" />}
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1" role="menu" aria-orientation="vertical">
                  <Link
                    to={`/company/${location.pathname.split('/')[2]}/profile`}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <User size={16} className="mr-3" />
                    {t('navigation.profile')}
                  </Link>
                  <Link
                    to={`/company/${location.pathname.split('/')[2]}/settings`}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <Settings size={16} className="mr-3" />
                    {t('navigation.settings')}
                  </Link>

                  <button
                    onClick={handleSignOut}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    <LogOut size={16} className="mr-3" />
                    {t('navigation.logout')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navbar;