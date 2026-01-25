import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Restaurant, Dish } from '../../types';

interface RestaurantMetaTagsProps {
  restaurant: Restaurant | null;
  menuItems?: Dish[];
  pageType: 'menu' | 'daily-menu';
  baseUrl?: string;
}

const RestaurantMetaTags: React.FC<RestaurantMetaTagsProps> = ({
  restaurant,
  menuItems = [],
  pageType,
  baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'
}) => {
  if (!restaurant) return null;

  const isDailyMenu = pageType === 'daily-menu';
  
  // Get custom preview settings or use defaults
  const customSettings = restaurant.socialMediaPreview?.[pageType];
  
  const pageTitle = customSettings?.title || 
    (isDailyMenu ? `${restaurant.name} - Daily Menu` : `${restaurant.name} - Menu`);
  
  const pageDescription = customSettings?.description || 
    (isDailyMenu
      ? `Discover today's special menu at ${restaurant.name}. Fresh daily selections with ${menuItems.length} delicious options.`
      : `Explore our full menu at ${restaurant.name}. ${menuItems.length} delicious dishes across multiple categories.`);

  // Get featured image (custom image, first menu item with image, or restaurant logo)
  const featuredImage = customSettings?.image || 
                       menuItems.find(item => item.image)?.image || 
                       restaurant.logo || 
                       `${baseUrl}/icons/icon-512x512.png`;

  // Generate keywords from menu items
  const keywords = [
    restaurant.name,
    'restaurant',
    'menu',
    'food',
    'dining',
    ...menuItems.slice(0, 5).map(item => item.title),
    ...(restaurant.cuisine ? [restaurant.cuisine] : [])
  ].join(', ');

  const currentUrl = `${baseUrl}/public-${pageType}/${restaurant.id}`;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={currentUrl} />

      {/* Open Graph Tags */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:image" content={featuredImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${restaurant.name} menu preview`} />
      <meta property="og:site_name" content="RestaurantOS" />
      <meta property="og:locale" content="en_US" />

      {/* Restaurant-specific Open Graph */}
      <meta property="restaurant:name" content={restaurant.name} />
      <meta property="restaurant:cuisine" content={restaurant.cuisine || 'International'} />
      <meta property="restaurant:price_range" content={restaurant.priceRange || '$$'} />
      {restaurant.address && (
        <meta property="restaurant:location" content={restaurant.address} />
      )}

      {/* Twitter Card Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={featuredImage} />
      <meta name="twitter:image:alt" content={`${restaurant.name} menu preview`} />

      {/* Additional Meta Tags */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content={restaurant.name} />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </Helmet>
  );
};

export default RestaurantMetaTags;
