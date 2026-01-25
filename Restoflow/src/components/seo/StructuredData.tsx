import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Restaurant, Dish } from '../../types';

interface StructuredDataProps {
  restaurant: Restaurant;
  menuItems: Dish[];
  pageType: 'menu' | 'daily-menu';
}

const StructuredData: React.FC<StructuredDataProps> = ({
  restaurant,
  menuItems,
  pageType
}) => {
  const isDailyMenu = pageType === 'daily-menu';
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
  
  // Group menu items by category
  const menuSections = menuItems.reduce((sections, item) => {
    const category = item.categoryId || "Main";
    if (!sections[category]) {
      sections[category] = [];
    }
    sections[category].push({
      "@type": "MenuItem",
      "name": item.title,
      "description": item.description || "",
      "image": item.image || "",
      "offers": {
        "@type": "Offer",
        "price": item.price || 0,
        "priceCurrency": "USD"
      }
    });
    return sections;
  }, {} as Record<string, any[]>);

  // Convert sections to schema.org format
  const hasMenuSection = Object.entries(menuSections).map(([categoryName, items]) => ({
    "@type": "MenuSection",
    "name": categoryName,
    "hasMenuItem": items
  }));

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "name": restaurant.name,
    "description": restaurant.description || `Restaurant serving ${restaurant.cuisine || 'international'} cuisine`,
    "url": `${baseUrl}/public-${pageType}/${restaurant.id}`,
    "image": restaurant.logo || `${baseUrl}/icons/icon-512x512.png`,
    "telephone": restaurant.phone || "",
    "address": restaurant.address ? {
      "@type": "PostalAddress",
      "streetAddress": restaurant.address
    } : undefined,
    "servesCuisine": restaurant.cuisine || "International",
    "priceRange": restaurant.priceRange || "$$",
    "hasMenu": {
      "@type": "Menu",
      "name": isDailyMenu ? "Daily Menu" : "Full Menu",
      "hasMenuSection": hasMenuSection
    },
    "aggregateRating": restaurant.rating ? {
      "@type": "AggregateRating",
      "ratingValue": restaurant.rating,
      "reviewCount": restaurant.reviewCount || 1
    } : undefined,
    "openingHours": restaurant.openingHours || undefined,
    "paymentAccepted": restaurant.paymentMethods || ["Cash", "Credit Card"]
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
};

export default StructuredData;

