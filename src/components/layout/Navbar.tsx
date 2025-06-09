import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Bell, Search, User, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import UserAvatar from '../common/UserAvatar';

interface NavbarProps {
  onMenuClick: () => void;
}

const Navbar = ({ onMenuClick }: NavbarProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { company, signOut } = useAuth();
  const navigate = useNavigate();

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
      navigate('/login');
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
        >
          <Menu size={24} />
        </button>

        {/* Logo (mobile only) */}
        <div className="md:hidden flex-1 flex justify-center">
          <span className="font-bold text-lg text-emerald-600">Le Bon Prix</span>
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
              placeholder="Search..."
            />
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center space-x-4">
          <button className="p-1 rounded-full text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500">
            <Bell className="h-5 w-5" />
          </button>

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-3 focus:outline-none"
            >
              <UserAvatar company={company} size="sm" />
              <span className="text-sm font-medium text-gray-700 hidden md:block">
                {company?.name || 'Loading...'}
              </span>
            </button>

            {/* Dropdown menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1" role="menu" aria-orientation="vertical">
                  <Link
                    to="/profile"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <User size={16} className="mr-3" />
                    Profile
                  </Link>
                  <Link
                    to="/settings"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <Settings size={16} className="mr-3" />
                    Settings
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    <LogOut size={16} className="mr-3" />
                    Sign out
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