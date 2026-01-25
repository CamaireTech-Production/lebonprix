import React from 'react';
import { PlusCircle } from 'lucide-react';
import { Dish, Category } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';

interface MenuGridProps {
  categories: Category[];
  menuItems: Dish[];
  searchQuery: string;
  activeCategory: string;
  templateId: string;
  styles: {
    cardStyle: string;
    priceStyle: string;
    buttonBg: string;
  };
  currencySymbol: string;
  onDishClick: (dish: Dish) => void;
  onAddToCart: (dish: Dish) => void;
}

const MenuGrid: React.FC<MenuGridProps> = ({
  categories,
  menuItems,
  searchQuery,
  activeCategory,
  templateId,
  styles,
  currencySymbol,
  onDishClick,
  onAddToCart
}) => {
  const { language } = useLanguage();

  // Filter menu items based on search
  const filteredMenuItems = menuItems.filter(item => {
    if (searchQuery) {
      return item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return true;
  });

  // Filter categories based on active category
  const categoriesToShow = activeCategory 
    ? categories.filter(cat => cat.id === activeCategory)
    : categories;

  // Group dishes by category
  const dishesByCategory = categoriesToShow.reduce((acc, category) => {
    const categoryDishes = filteredMenuItems.filter(item => item.categoryId === category.id);
    if (categoryDishes.length > 0) {
      acc[category.id] = {
        category,
        dishes: categoryDishes
      };
    }
    return acc;
  }, {} as Record<string, { category: Category; dishes: Dish[] }>);

  const getCardClassName = () => {
    switch (templateId) {
      case 'theme1':
        return 'theme1-card';
      case 'lea':
        return 'lea-card';
      default:
        return 'dish-card';
    }
  };

  const getPriceClassName = () => {
    switch (templateId) {
      case 'theme1':
        return 'theme1-price';
      case 'lea':
        return 'lea-price';
      default:
        return 'default-price';
    }
  };

  const getOrderButtonClassName = () => {
    switch (templateId) {
      case 'theme1':
        return 'order-button theme1-order-button';
      case 'lea':
        return 'order-button lea-order-button';
      default:
        return 'order-button default-order-button';
    }
  };

  const getTitleClassName = () => {
    return templateId === 'lea' ? 'dish-title lea-dish-title' : 'dish-title';
  };

  return (
    <div className="menu-content">
      {Object.values(dishesByCategory).map(({ category, dishes }) => (
        <div key={category.id} className="category-section">
          <div className="text-center mb-4">
            <h2 className={`category-title ${templateId === 'lea' ? 'lea-category-title' : ''}`}>
              {category.title}
            </h2>
            {templateId === 'lea' && (
              <div className="lea-category-divider" />
            )}
          </div>

          <div className="menu-grid">
            {dishes.map((dish) => (
              <div
                key={dish.id}
                className={getCardClassName()}
                style={{ minHeight: templateId === 'lea' ? '200px' : 'auto' }}
                onClick={() => onDishClick(dish)}
              >
                {dish.image && (
                  <div className="dish-image">
                    <img
                      src={dish.image}
                      alt={dish.title}
                    />
                  </div>
                )}
                
                <div className="dish-content">
                  <h3 className={getTitleClassName()}>
                    {dish.title}
                  </h3>
                  
                  <div className="dish-price">
                    <span className={getPriceClassName()}>
                      {dish.price.toLocaleString()} {currencySymbol}
                    </span>
                  </div>
                  
                  <div className="mt-auto">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToCart(dish);
                      }}
                      className={getOrderButtonClassName()}
                    >
                      <PlusCircle size={14} />
                      {t('order_now', language)}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MenuGrid;

