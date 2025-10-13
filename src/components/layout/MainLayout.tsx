import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { FloatingActionButton } from '../common/Button';
import AddSaleModal from '../sales/AddSaleModal';

interface MainLayoutProps {
  isAddSaleModalOpen: boolean;
  setIsAddSaleModalOpen: (open: boolean) => void;
}

const MainLayout = ({ isAddSaleModalOpen, setIsAddSaleModalOpen }: MainLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();

  // Handle responsive layout
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    checkMobile();

    // Add resize listener
    window.addEventListener('resize', checkMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('sidebar');
      const toggleButton = document.getElementById('sidebar-toggle');
      
      if (
        sidebarOpen &&
        sidebar && 
        !sidebar.contains(event.target as Node) &&
        toggleButton &&
        !toggleButton.contains(event.target as Node)
      ) {
        setSidebarOpen(false);
      }
    };

    if (isMobile) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sidebarOpen, isMobile]);

  return (
    <div className="h-screen flex flex-col">
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-grow flex overflow-hidden relative">
        {/* Sidebar for larger screens */}
        <div 
          id="sidebar"
          className={`
            fixed inset-y-0 left-0 z-50
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            md:relative md:translate-x-0 md:z-0
          `}
        >
          <div className="h-full w-64 bg-white shadow-lg">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
        
        {/* Backdrop for mobile */}
        {sidebarOpen && isMobile && (
          <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Main content */}
        <main className="flex-1 overflow-auto bg-gray-50 p-4 md:p-6 lg:p-8 pb-20 md:pb-8">
          <Outlet />
        </main>
      </div>
      
      {/* Mobile navigation */}
      {isMobile && <MobileNav />}
      
      {/* Floating Action Button - show on all dashboard pages except catalogue */}
      {!location.pathname.startsWith('/catalogue') && (
        <FloatingActionButton onClick={() => setIsAddSaleModalOpen(true)} label="Add Sale" />
      )}
      
      {/* Add Sale Modal */}
      <AddSaleModal isOpen={isAddSaleModalOpen} onClose={() => setIsAddSaleModalOpen(false)} />
    </div>
  );
};

export default MainLayout;