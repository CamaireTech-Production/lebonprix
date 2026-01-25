import React from 'react';
import { Category } from '../../types';

interface ActiveCategoryTitleProps {
  activeCategory: string;
  categories: Category[];
  templateId: string;
}

const ActiveCategoryTitle: React.FC<ActiveCategoryTitleProps> = ({
  activeCategory,
  categories,
  templateId
}) => {
  if (!activeCategory) return null;

  const category = categories.find(c => c.id === activeCategory);
  if (!category) return null;

  return (
    <div 
      className={`active-category-title ${
        templateId === 'lea' ? 'lea-active-category' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-2">
        <div 
          className="text-sm font-semibold text-center"
          style={{ color: templateId === 'lea' ? '#d4af37' : undefined }}
        >
          {category.title}
        </div>
      </div>
    </div>
  );
};

export default ActiveCategoryTitle;

