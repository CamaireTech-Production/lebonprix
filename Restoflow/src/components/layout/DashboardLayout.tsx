import React, { ReactNode, useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import OfflineStatusBanner from './OfflineStatusBanner';
import Header from './Header';
import { useAuth } from '../../contexts/AuthContext';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
}

const MOBILE_WIDTH = 768;

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title }) => {
  // Sidebar state: collapsed (web) or open (mobile)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const { restaurant } = useAuth();
  const demoContext = null; // Demo functionality removed
  const isDemoUser = !!demoContext;
  const demoAccount = demoContext?.demoAccount;
  const effectiveRestaurant = isDemoUser ? demoAccount : restaurant;

  // Detect mobile
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_WIDTH);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Toggle for web (collapse/expand)
  const handleSidebarCollapse = () => setSidebarCollapsed((prev) => !prev);
  // Toggle for mobile (open/close)
  const handleSidebarOpen = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-100">
      {/* Sidebar: supports collapsed (web) and open (mobile) */}
      <Sidebar
        collapsed={!isMobile && sidebarCollapsed}
        open={isMobile ? sidebarOpen : true}
        onClose={closeSidebar}
      />
      {/* Main content wrapper with conditional blur/dim on mobile sidebar open */}
      <div
        className={`flex-1 overflow-x-hidden overflow-y-auto transition-all duration-300 relative
          ${!isMobile ? (sidebarCollapsed ? 'md:ml-20' : 'md:ml-64') : ''}
          ${isMobile && sidebarOpen ? 'z-10 pointer-events-none select-none filter blur-sm brightness-75' : 'z-20'}
        `}
      >
        {/* Admin offline status banner */}
        <OfflineStatusBanner />
        {/* Sticky Header */}
        <Header
          title={typeof title === 'string' ? title : ''}
          onSidebarToggle={handleSidebarCollapse}
          sidebarCollapsed={sidebarCollapsed}
          onMobileSidebarToggle={handleSidebarOpen}
          isMobile={isMobile}
          restaurant={effectiveRestaurant}
        />
        <main className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;