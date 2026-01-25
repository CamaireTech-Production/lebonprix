import React, { useEffect, useRef } from 'react';
import CompactAdCard from './CompactAdCard';

interface MenuAdInjectorProps {
  currentAd?: any;
  restaurant?: any;
  onReserve?: () => void;
}

const MenuAdInjector: React.FC<MenuAdInjectorProps> = ({ 
  currentAd, 
  restaurant, 
  onReserve 
}) => {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentAd || !adRef.current) return;

    // Find the main content area
    const mainContent = document.querySelector('main');
    if (!mainContent) return;

    // Find all category sections
    const categorySections = mainContent.querySelectorAll('[data-cat-id]');
    if (categorySections.length === 0) return;

    // Find the middle category section
    const middleIndex = Math.floor(categorySections.length / 2);
    const middleSection = categorySections[middleIndex];
    
    if (middleSection) {
      // Insert the ad after the middle section
      middleSection.parentNode?.insertBefore(adRef.current, middleSection.nextSibling);
    }
  }, [currentAd]);

  if (!currentAd) return null;

  return (
    <div 
      ref={adRef}
      className="w-full px-4 sm:px-6 py-2"
      style={{ display: 'none' }} // Initially hidden, will be shown when positioned
    >
      <CompactAdCard
        ad={currentAd}
        restaurant={restaurant}
        onReserve={onReserve || (() => {})}
      />
    </div>
  );
};

export default MenuAdInjector;
