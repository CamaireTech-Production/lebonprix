import { useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, DollarSign, Package2, FileBarChart, Settings, X, Receipt, Users, Grid3X3, ShoppingBag} from 'lucide-react';
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
  const { company } = useAuth();
  
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
  
  const navigationItems = [
    { name: t('navigation.dashboard'), path: '/', icon: <LayoutDashboard size={20} /> },
    { name: t('navigation.sales'), path: '/sales', icon: <ShoppingCart size={20} /> },
    { name: 'Orders', path: '/orders', icon: <ShoppingBag size={20} /> },
    { name: 'Expenses', path: '/expenses', icon: <Receipt size={20} /> },
    { name: 'Finance', path: '/finance', icon: <DollarSign size={20} /> },
    { name: t('navigation.products'), path: '/products', icon: <Package2 size={20} /> },
    { name: 'Categories', path: '/categories', icon: <Grid3X3 size={20} /> },
    { name: t('navigation.suppliers'), path: '/suppliers', icon: <Users size={20} /> },
    { name: t('navigation.reports'), path: '/reports', icon: <FileBarChart size={20} /> },
    { name: t('navigation.settings'), path: '/settings', icon: <Settings size={20} /> },
  ];

  return (
    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
      {/* Sidebar header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        <Link to="/" className="flex items-center">
          <span className="font-bold text-xl" style={{color: colors.primary}}>Geskap</span>
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
          {navigationItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                onClick={onClose}
                className={`
                  flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                  ${isActive(item.path)
                    ? 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}
                `}
                style={isActive(item.path) ? {
                  backgroundColor: `${colors.primary}20`,
                  color: colors.primary
                } : {}}
              >
                <span className="mr-3">{item.icon}</span>
                {item.name}
              </Link>
            </li>
          ))}
          
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
            <p className="text-sm font-medium text-gray-700 truncate">
              {company?.name || t('header.welcome')}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {company?.email || t('header.welcome')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;