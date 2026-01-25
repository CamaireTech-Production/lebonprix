import React from 'react';
import CompactAdCard from './CompactAdCard';

interface MenuWithAdsProps {
  children: React.ReactNode;
  compactAd?: React.ReactNode;
  adPosition?: 'middle' | 'end';
}

const MenuWithAds: React.FC<MenuWithAdsProps> = ({ 
  children, 
  compactAd, 
  adPosition = 'middle' 
}) => {
  if (!compactAd) {
    return <>{children}</>;
  }

  // For now, we'll place the ad at the end of the menu content
  // This creates a natural break between menu items and the ad
  return (
    <div>
      {children}
      {compactAd}
    </div>
  );
};

export default MenuWithAds;
