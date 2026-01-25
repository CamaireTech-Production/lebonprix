import React from 'react';
import CompactAdCard from './CompactAdCard';

interface MenuAdSectionProps {
  currentAd?: any;
  restaurant?: any;
  onReserve?: () => void;
}

const MenuAdSection: React.FC<MenuAdSectionProps> = ({ 
  currentAd, 
  restaurant, 
  onReserve 
}) => {
  console.log('MenuAdSection - Rendering with currentAd:', currentAd);
  
  if (!currentAd) {
    console.log('MenuAdSection - No currentAd, not rendering');
    return null;
  }

  return (
    <div className="w-full px-3 py-2">
      <div className="max-w-3xl mx-auto">
        <CompactAdCard
          ad={currentAd}
          restaurant={restaurant}
          onReserve={onReserve || (() => {})}
        />
      </div>
    </div>
  );
};

export default MenuAdSection;
