import { Menu, Bell, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface NavbarProps {
  onMenuClick: () => void;
}

const Navbar = ({ onMenuClick }: NavbarProps) => {
  const { signOut } = useAuth();

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
          <div className="relative">
            <div className="flex items-center">
              <button 
                className="flex text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                onClick={() => signOut()}
              >
                <span className="sr-only">Open user menu</span>
                <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                  U
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navbar;