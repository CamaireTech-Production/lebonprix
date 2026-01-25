import React from 'react';
import CompactAdCard from './CompactAdCard';

interface SimpleMenuWithAdProps {
  children: React.ReactNode;
  currentAd?: any;
  restaurant?: any;
  onReserve?: () => void;
}

const SimpleMenuWithAd: React.FC<SimpleMenuWithAdProps> = ({ 
  children, 
  currentAd, 
  restaurant, 
  onReserve 
}) => {
  console.log('SimpleMenuWithAd - currentAd:', currentAd);
  console.log('SimpleMenuWithAd - restaurant:', restaurant);
  console.log('SimpleMenuWithAd - onReserve:', onReserve);
  
  if (!currentAd) {
    console.log('SimpleMenuWithAd - No currentAd, returning children only');
    return <>{children}</>;
  }
  
  console.log('SimpleMenuWithAd - Creating ad component with currentAd:', currentAd);

  // Create the ad component
  const adComponent = (
    <div className="w-full px-4 sm:px-6 py-2">
      <CompactAdCard
        ad={currentAd}
        restaurant={restaurant}
        onReserve={onReserve || (() => {})}
      />
    </div>
  );

  // Place the ad in the body section between menu items
  console.log('SimpleMenuWithAd - Placing ad in body section between menu items');
  
  // Clone the children and inject the ad at a strategic position
  const childrenArray = React.Children.toArray(children);
  console.log('SimpleMenuWithAd - childrenArray length:', childrenArray.length);
  
  // Find the main content area and inject the ad
  const modifiedChildren = childrenArray.map((child, index) => {
    console.log(`SimpleMenuWithAd - Processing child ${index}:`, child);
    
    if (React.isValidElement(child)) {
      // Look for the main content area (usually the second child)
      if (index === 1 && child.props.children) {
        console.log('SimpleMenuWithAd - Found main content area at index 1');
        const mainContent = child.props.children;
        console.log('SimpleMenuWithAd - mainContent:', mainContent);
        
        // If mainContent is an array, inject the ad in the middle
        if (Array.isArray(mainContent)) {
          console.log('SimpleMenuWithAd - mainContent is array, injecting ad in middle');
          const middleIndex = Math.floor(mainContent.length / 2);
          const newContent = [...mainContent];
          newContent.splice(middleIndex, 0, adComponent);
          
          console.log('SimpleMenuWithAd - Injected ad at index:', middleIndex);
          return React.cloneElement(child, {
            ...child.props,
            children: newContent
          });
        } else {
          console.log('SimpleMenuWithAd - mainContent is not array, adding ad at end');
          return React.cloneElement(child, {
            ...child.props,
            children: [mainContent, adComponent]
          });
        }
      }
    }
    return child;
  });

  console.log('SimpleMenuWithAd - Returning modified children with ad in body');
  return <>{modifiedChildren}</>;
};

export default SimpleMenuWithAd;
