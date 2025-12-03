import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export const LandingHeader: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Business Sizes', href: '#business-sizes' },
    { label: 'Industries', href: '#industries' },
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' }
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-sm shadow-sm'
          : 'bg-white'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center">
              <div className="w-6 h-6 bg-white rounded-sm"></div>
            </div>
            <span className="text-2xl font-title text-gray-900">GESKAP</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* CTAs */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              to="/auth/login"
              className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/auth/register"
              className="bg-black text-white px-6 py-2 rounded-md font-medium hover:bg-gray-900 transition-colors"
            >
              Get started
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden text-gray-700"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-4 space-y-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-gray-700 hover:text-gray-900 font-medium"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-4 border-t border-gray-200 space-y-3">
              <Link
                to="/auth/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-gray-700 hover:text-gray-900 font-medium"
              >
                Log in
              </Link>
              <Link
                to="/auth/register"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block bg-black text-white px-6 py-2 rounded-md font-medium text-center hover:bg-gray-900 transition-colors"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

