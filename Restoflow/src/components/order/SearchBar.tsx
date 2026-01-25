import React from 'react';
import { Search } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  templateId: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  onSearchChange,
  templateId
}) => {
  return (
    <div 
      className={`relative z-10 py-3 ${templateId === 'theme1' ? 'bg-white' : ''}`} 
      style={{ 
        ...(templateId === 'lea' ? { 
          background: 'rgba(10,10,10,0.72)', 
          backdropFilter: 'blur(6px)', 
          borderBottom: '1px solid rgba(212,175,55,0.25)' 
        } : {}) 
      }}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        <div className={`relative ${templateId === 'theme1' ? 'max-w-xl' : 'max-w-md'} mx-auto`}>
          <Search 
            size={16} 
            className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
              templateId === 'lea' ? 'text-yellow-500' : 'text-gray-400'
            }`} 
          />
          <input
            type="text"
            placeholder={t('search_menu', 'en')}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`w-full pl-9 pr-3 ${
              templateId === 'theme1' 
                ? 'py-2 rounded-xl text-sm' 
                : (templateId === 'lea' 
                    ? 'py-2 rounded-xl text-sm' 
                    : 'py-1 rounded-full')
            } border focus:ring-1 focus:ring-primary focus:border-primary/50 ${
              templateId === 'lea' 
                ? 'text-white placeholder-white/70' 
                : templateId === 'theme1' 
                  ? 'border-gray-200' 
                  : 'border-gray-3'
            }`}
            style={templateId === 'lea' ? { 
              backgroundColor: '#0f0f0f', 
              border: '1px solid rgba(212,175,55,0.45)', 
              boxShadow: '0 0 0 1px rgba(212,175,55,0.15) inset' 
            } : undefined}
          />
        </div>
      </div>
    </div>
  );
};

export default SearchBar;

