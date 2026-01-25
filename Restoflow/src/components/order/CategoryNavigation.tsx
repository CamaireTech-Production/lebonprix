import React from 'react';
import { Utensils } from 'lucide-react';
import { Category } from '../../types';

interface CategoryNavigationProps {
  categories: Category[];
  activeCategory: string;
  onCategoryClick: (categoryId: string) => void;
  templateId: string;
  styles: {
    buttonBg: string;
  };
}

const CategoryNavigation: React.FC<CategoryNavigationProps> = ({
  categories,
  activeCategory,
  onCategoryClick,
  templateId,
  styles
}) => {
  return (
    <div 
      className={`relative z-10 ${templateId === 'theme1' ? 'bg-white' : ''}`} 
      style={{ 
        ...(templateId === 'lea' ? { 
          background: 'rgba(10,10,10,0.72)', 
          backdropFilter: 'blur(6px)' 
        } : {}) 
      }}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        <div className={`${templateId === 'lea' ? 'lea-scrollbar' : ''} overflow-x-auto`}>
          <div className="flex flex-nowrap whitespace-nowrap space-x-6 min-w-0 justify-start py-2">
            {categories
              .filter(c => !/salade/i.test(c.title) && !/new\s*fast\s*food/i.test(c.title))
              .map((category) => (
                <button
                  key={category.id}
                  onClick={() => onCategoryClick(category.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border ${
                    activeCategory === category.id
                      ? (templateId === 'theme1' 
                          ? 'bg-orange-500 text-white border-transparent shadow' 
                          : (templateId === 'lea' 
                              ? 'bg-yellow-500 text-black border-transparent shadow' 
                              : styles.buttonBg + ' text-white border-transparent'))
                      : (templateId === 'theme1' 
                          ? 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200' 
                          : (templateId === 'lea' 
                              ? 'bg-transparent text-white hover:bg-yellow-500/20 border-yellow-500/50' 
                              : 'bg-white text-gray-700 hover:text-gray-900 border-gray-300 hover:border-gray-400 shadow-sm'))
                  }`}
                >
                  {templateId === 'theme1' && <Utensils size={16} className="mr-2 opacity-80 inline-block" />}
                  {category.title}
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryNavigation;

