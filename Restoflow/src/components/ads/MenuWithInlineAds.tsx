import React from 'react';
import CompactAdCard from './CompactAdCard';

interface MenuWithInlineAdsProps {
  children: React.ReactNode;
  menuItems: any[];
  currentAd?: any;
  restaurant?: any;
  onReserve?: () => void;
}

const MenuWithInlineAds: React.FC<MenuWithInlineAdsProps> = ({ 
  children, 
  menuItems, 
  currentAd, 
  restaurant, 
  onReserve 
}) => {
  if (!currentAd || menuItems.length === 0) {
    return <>{children}</>;
  }

  // Find a good position to inject the ad (middle of the menu items)
  const middleIndex = Math.floor(menuItems.length / 2);
  
  // Create a new array with the ad injected
  const newMenuItems = [...menuItems];
  
  // Add the ad as a special "ad" item
  const adItem = {
    id: `ad-${currentAd.id}`,
    title: currentAd.title,
    description: currentAd.description,
    price: 0,
    image: currentAd.imageBase64 || '',
    categoryId: 'ad-category',
    status: 'active',
    restaurantId: restaurant?.id || '',
    createdAt: null,
    updatedAt: null,
    deleted: false,
    isAd: true, // Flag to identify this as an ad
    adData: currentAd // Store the full ad data
  };
  
  newMenuItems.splice(middleIndex, 0, adItem);
  
  // Clone the children and inject the ad
  const childrenWithAd = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      // Clone the child and pass the modified menu items
      return React.cloneElement(child, {
        ...child.props,
        menuItems: newMenuItems
      });
    }
    return child;
  });

  return <>{childrenWithAd}</>;
};

export default MenuWithInlineAds;
