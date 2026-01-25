import React, { useRef, useState, useEffect } from 'react';
import { MapPin, Phone, Globe, ChevronDown } from 'lucide-react';
import { Restaurant } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';

interface OrderHeaderProps {
  restaurant: Restaurant;
  templateId: string;
  scrolled: boolean;
  styles: {
    headerBg: string;
    headerText: string;
  };
}

const OrderHeader: React.FC<OrderHeaderProps> = ({
  restaurant,
  templateId,
  scrolled,
  styles
}) => {
  const { language, setLanguage, supportedLanguages } = useLanguage();
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langSwitcherRef = useRef<HTMLDivElement>(null);

  // Close language dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langSwitcherRef.current && !langSwitcherRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      className={`${templateId === 'theme1' ? (scrolled ? 'bg-red-600/90 backdrop-blur-sm' : 'bg-red-600') : styles.headerBg} py-3`}
      style={templateId === 'lea' ? { background: 'rgba(10,10,10,0.72)', backdropFilter: 'blur(6px)' } : undefined}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {restaurant?.logo && (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white overflow-hidden shadow-sm flex-shrink-0">
                <img 
                  src={restaurant.logo} 
                  alt={restaurant.name} 
                  className="w-full h-full object-cover rounded-full" 
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className={`text-lg sm:text-xl font-bold ${styles.headerText} truncate`}>
                {restaurant?.name}
              </h1>
              {templateId !== 'theme1' && (
                <div className="mt-1 flex items-center gap-3 text-xs whitespace-nowrap overflow-hidden">
                  {restaurant?.address && (
                    <span className="flex items-center gap-1 min-w-0">
                      <MapPin 
                        size={14} 
                        className={`${templateId === 'lea' ? 'text-yellow-500' : 'text-gray-500'}`} 
                      />
                      <span className={`${styles.headerText} opacity-80 truncate max-w-[35vw] sm:max-w-none`}>
                        {restaurant.address.replace(/cameron/gi, 'Cameroon')}
                      </span>
                    </span>
                  )}
                  {restaurant?.phone && (
                    <a 
                      href={`tel:${restaurant.phone.replace(/[^\d+]/g, '')}`} 
                      className="flex items-center gap-1 min-w-0" 
                      title={restaurant.phone}
                    >
                      <Phone 
                        size={14} 
                        className={`${templateId === 'lea' ? 'text-yellow-500' : 'text-gray-500'}`} 
                      />
                      <span className={`${styles.headerText} truncate max-w-[30vw] sm:max-w-none`}>
                        {restaurant.phone}
                      </span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Language Dropdown */}
          <div className="relative" ref={langSwitcherRef}>
            <button
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              className={`flex items-center gap-1 px-3 py-1.5 sm:px-3 sm:py-1.5 rounded-full border ${
                templateId === 'lea' 
                  ? 'border-black bg-black text-yellow-500 hover:bg-black/80' 
                  : 'border-gray-300 bg-white/70 hover:bg-white/90'
              } text-xs sm:text-sm ${templateId === 'lea' ? 'font-medium' : styles.headerText} transition-colors`}
            >
              <Globe size={14} className={`sm:hidden ${templateId === 'lea' ? 'text-yellow-500' : 'text-gray-500'}`} />
              <Globe size={16} className={`hidden sm:inline ${templateId === 'lea' ? 'text-yellow-500' : 'text-gray-500'}`} />
              <span className="inline sm:inline">
                {supportedLanguages.find(lang => lang.code === language)?.label || 'English'}
              </span>
              <ChevronDown size={16} className={`ml-1 ${templateId === 'lea' ? 'text-yellow-500' : 'text-gray-500'}`} />
            </button>
            {langDropdownOpen && (
              <div className="absolute right-0 mt-2 w-32 sm:w-36 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                {supportedLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => { 
                      setLanguage(lang.code); 
                      setLangDropdownOpen(false); 
                    }}
                    className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderHeader;

